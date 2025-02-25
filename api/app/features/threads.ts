import { Router, Request, Response } from "express";
import z from "zod";
import crypto from "crypto";
import { sql, desc, and, eq, cosineDistance } from "drizzle-orm";

import s3 from "../config/s3";
import db from "../config/db";
import {
  messages,
  threads,
  messageAttachments,
  toolCalls as toolCallsTable,
  documentThumbnails,
  Project,
} from "../config/schema";
import { MessageAttachment } from "../config/schema";
import { embeddingModel, ModelConfig, MODELS } from "./models";
import { handle, generateThreadTitle, getPdfPageAsImage } from "../utils";

// ai-related imports
import { Attachment, CoreMessage, streamText, tool } from "ai";
import { searchProjectDocuments } from "./projects";
import reranker from "../config/reranker";
import { CONFIG } from "../config/constants";

// --------------------------------------------------------
// 1. Define Zod Schemas
// --------------------------------------------------------
const createThreadSchema = z.object({
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
});

const getThreadsSchema = z.object({
  page: z.string().optional(),
  search: z.string().optional(),
  organizationId: z.string().optional(),
});

const inferenceSchema = z.object({
  model: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  instructions: z.string().optional(),
  proejctId: z.string().optional(), // preserving original name
  // We'll also allow message data in here
  message: z.object({
    id: z.string().optional(),
    role: z.enum(["system", "user", "assistant", "tool"]).optional(),
    content: z.string().optional(),
    experimental_attachments: z
      .array(
        z.object({
          name: z.string().optional(),
          file_key: z.string(),
          contentType: z.string().optional(),
          url: z.any().optional(),
        })
      )
      .optional(),
  }),
});

// --------------------------------------------------------
// 2. Define/Reuse Types
// --------------------------------------------------------
type ExtendedAttachment = Attachment & {
  file_key: string;
};

type MyMessage = CoreMessage & {
  experimental_attachments?: ExtendedAttachment[];
};

type ThreadWithMessages = {
  id: string;
  title?: string | null;
  userId: string;
  organizationId?: string | null;
  projectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: {
    id: string;
    threadId: string;
    userId: string;
    role: "system" | "user" | "assistant" | "tool";
    text: string | null;
    reasoning?: string | null;
    model?: string | null;
    provider?: string | null;
    createdAt: Date;
    attachments: MessageAttachment[];
    content?: any;
    toolCalls?: {
      args: any;
      id: string;
      result: any;
      status: string;
      toolName: string;
      toolCallId: string;
    }[];
  }[];
  project?: any;
  organization?: any;
};

// --------------------------------------------------------
// 3. Small Helpers
// --------------------------------------------------------

/** Generates presigned URL or returns raw data depending on environment. */
async function generateAttachmentData(
  fileKey: string,
  contentType?: string,
  s3UrlAllowed?: boolean
): Promise<string> {
  if (s3UrlAllowed && CONFIG.__prod__) {
    return s3.file(fileKey).presign({ expiresIn: 3600 });
  }

  const metadata = s3.file(fileKey);
  const buffer = Buffer.from(new Uint8Array(await metadata.arrayBuffer()));
  return buffer.toString("base64");
}

/** Adds presigned URLs (or base64 data) to each attachment. */
async function processAttachments(attachments: MessageAttachment[]) {
  try {
    const processed: MessageAttachment[] = [];
    for (const att of attachments) {
      const url = s3.file(att.fileKey).presign({
        acl: "public-read",
        expiresIn: 3600,
        method: "GET",
      });
      processed.push({ ...att, url });
    }
    return processed;
  } catch (error) {
    console.error("Error processing attachments:", error);
    return attachments;
  }
}

/** Enrich each message in the thread with presigned attachments. */
async function processThreadMessages(thread: ThreadWithMessages | null) {
  if (!thread) return null;
  for (const msg of thread.messages) {
    msg.attachments = await processAttachments(msg.attachments);

    msg.toolCalls = msg.toolCalls?.map((call) => {
      const uniqueDocs = getUniqueDocuments(call.result.docs);

      return {
        ...call,
        result: {
          dataForFrontend: uniqueDocs.map((doc) => ({
            document_id: doc.documentId,
            source: doc.documentName,
            snippet: doc.text,
            path: doc.path,
            score: doc.similarity,
            page: doc.pageNumber,
            projectId: doc.projectId,
            url: doc.fileKey
              ? s3.file(doc.fileKey).presign({ expiresIn: 3600 })
              : undefined,
          })),
        },
      };
    });
  }

  return thread;
}

/** Creates a new message in DB with optional embedding and attachments. */
async function createMessage(
  userId: string,
  threadId: string,
  role: "system" | "user" | "assistant" | "tool",
  message: MyMessage
) {
  const messageId = crypto.randomUUID();
  let embedding = null;

  // Attempt to embed message content
  try {
    const embeddingResult = await embeddingModel.doEmbed({
      values: [message.content as string],
    });
    embedding = embeddingResult.embeddings[0];
  } catch (error) {
    console.error("Error embedding message", error);
  }

  // Insert the message into DB
  await db.insert(messages).values({
    userId,
    id: messageId,
    threadId,
    role,
    text: (message.content as string) ?? null,
    embedding,
    createdAt: new Date(),
  });

  // Insert attachments if any
  if (message.experimental_attachments?.length) {
    for (const attachment of message.experimental_attachments) {
      await db.insert(messageAttachments).values({
        messageId,
        fileName: attachment.name,
        mimeType: attachment.contentType,
        fileKey: attachment.file_key,
        type: attachment.contentType?.includes("image") ? "image" : "file",
      });
    }
  }
  return { message: "Message created successfully" };
}

/** Determines which model to use. "Auto" triggers classification logic. */
async function getModelConfig(model: string) {
  if (model !== "Auto") {
    return MODELS[model];
  }

  return MODELS["claude-3.7-sonnet"];
}

/** Generates a thread title from the first user message if it doesn’t already exist. */
async function maybeGenerateTitle(
  threadId: string,
  rawMessages: MyMessage[],
  existingTitle?: string | null
) {
  if (existingTitle) return; // no need to do anything if we have a title

  const firstUserTextMessage = rawMessages.find((msg) => msg.role === "user");
  if (!firstUserTextMessage) return;

  try {
    const title = await generateThreadTitle(
      (firstUserTextMessage.content as string) || ""
    );
    await db.update(threads).set({ title }).where(eq(threads.id, threadId));
  } catch (error) {
    console.error("Error generating title", error);
  }
}

/** Constructs a "system" style message, appending user instructions if they exist. */
function buildSystemMessage(instructions?: string, project?: Project): string {
  const dateString = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let systemMsg = `You are Yo, a highly skilled multi-disciplinary engineer with extensive expertise across various fields, including building systems, product design, automation, project management, and HVAC engineering. Your task is to provide accurate, detailed, and comprehensive answers to user queries using tools provided or your existing knowledge.

<current_date>
${dateString}
</current_date>

Instructions:

1. Analyze the query carefully. Users may phrase their questions as search queries or conversational messages.

2. For project-specific questions:
   - Use the search tool to find relevant information from project documents.
   - Synthesize information from search results to provide accurate, contextual answers.
   - Clearly state if search results don't provide sufficient information.
   - If <current_project> is provided, use the search tool unless sufficient context is in the prompt.

3. Structure your answer for optimal readability:
   - Begin with a brief introductory sentence or paragraph.
   - Use level 2 headers (##) for main sections.
   - Use bolding (**) for subsections or emphasis.
   - Incorporate tables for comparisons or data presentation.
   - Use bullet points sparingly, only for clear enumerations.
   - Use numbered lists only for rankings.
   - Never nest lists or mix ordered and unordered lists.
   - Use markdown tables for comparisons instead of lists.
   - Use code blocks with language specification for code snippets.
   - You may include relevant quotes in markdown format.

4. Be concise and direct in your answer. Avoid preambles or explanations of your process.

5. If the user provides sufficient context (e.g., files or images) in the prompt, answer directly without additional searching.

6. Never invent information. Only provide answers supported by search results or your existing knowledge.

Restrictions:
- Do not include URLs or links.
- Avoid moralization or hedging language.
- Do not repeat copyrighted content verbatim.
- If search results are insufficient, state that the information is not available.
- Never use phrases like "According to the search results" or similar constructions.

Remember to prioritize accuracy, comprehensiveness, and adherence to all guidelines provided.`;

  if (instructions && instructions.length > 0) {
    systemMsg += `\n\nHere are any user specific instructions:\n<user_personalization>${instructions}</user_personalization>`;
  }

  if (project) {
    systemMsg += `\n\nHere is the current project information\n<current_project>\n<name>${
      project.name
    }</name>${
      project.description
        ? `\n<description>${project.description}</description>`
        : ""
    }\n</current_project>`;
  }

  return systemMsg;
}

/** Utility to transform raw DB messages into MyMessage objects. */
async function dbMessagesToMyMessages(
  dbMsgs: {
    id: string;
    createdAt: Date;
    userId: string;
    role: "system" | "user" | "assistant" | "tool";
    threadId: string;
    text: string | null;
    reasoning: string | null;
    model: string | null;
    provider: string | null;
    embedding: number[] | null;
    toolCalls: {
      id: string;
      messageId: string;
      toolName: string;
      toolCallId: string;
      args: any;
      status: "pending" | "completed" | "failed";
      result: any;
    }[];
    attachments: {
      id: string;
      messageId: string;
      type: "file" | "image";
      fileKey: string;
      fileName: string | null;
      mimeType: string | null;
      size: number | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
  }[],
  selectedModel: ModelConfig
) {
  const messages: MyMessage[] = [];

  for (const msg of dbMsgs) {
    // Process attachments
    const experimental_attachments: ExtendedAttachment[] =
      msg.attachments?.map((att) => ({
        name: att.fileName || undefined,
        file_key: att.fileKey,
        contentType: att.mimeType || undefined,
        url: s3.file(att.fileKey).presign({ expiresIn: 3600 }),
      })) || [];

    // If message has tool calls, create separate messages for the assistant and tool responses
    if (msg.toolCalls.length > 0 && msg.role === "assistant") {
      // Create assistant message with tool calls
      messages.push({
        role: "assistant",
        content: [
          ...(msg.text ? [{ type: "text" as const, text: msg.text }] : []),
          ...msg.toolCalls.map((call) => ({
            type: "tool-call" as const,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.args,
          })),
        ],
        experimental_attachments,
      });

      // Create tool message with results for completed tool calls
      const completedCalls = msg.toolCalls.filter(
        (call) => call.status === "completed" && call.result
      );

      if (completedCalls.length > 0) {
        const processedResults = await Promise.all(
          completedCalls.map(async (call) => {
            // If model is claude 3.7 sonnet, get images of any pdfs or images
            if (selectedModel.model.modelId.includes("claude-3.7-sonnet")) {
              const images: {
                fileKey: string;
                mimeType: string;
              }[] = call.result.images;

              const imagesData = await Promise.all(
                images.map(async (image) => {
                  return {
                    type: "image" as const,
                    data: await generateAttachmentData(image.fileKey),
                    mimeType: image.mimeType,
                  };
                })
              );

              return {
                type: "tool-result",
                toolCallId: call.toolCallId,
                toolName: call.toolName,
                experimental_content: [
                  ...imagesData,
                  {
                    type: "text" as const,
                    text: convertResultsToXml(call.result.docs),
                  },
                ],
              };
            }

            return {
              type: "tool-result",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              result: convertResultsToXml(call.result.docs),
            };
          })
        );

        messages.push({
          id: `${msg.id}_tool_results`,
          role: "tool",
          content: processedResults,
        } as MyMessage);
      }
    } else {
      // Regular message without tool calls
      messages.push({
        id: msg.id,
        role: msg.role,
        content: msg.text || "",
        experimental_attachments,
      } as MyMessage);
    }
  }

  return messages;
}

/**
 * Build a more AI-friendly representation of messages, filtering out attachments
 * unsupported by the chosen model, and flattening content for streaming.
 */
async function buildInferenceMessages(
  allMessages: MyMessage[],
  modelConfig: {
    supportedMimeTypes?: string[];
    supportsSystemMessages?: boolean;
  },
  project?: Project,
  instructions?: string
): Promise<CoreMessage[]> {
  // Filter out any attachments that the model doesn’t support
  const filteredMessages = allMessages.filter((msg) => {
    if (!msg.experimental_attachments?.length) return true; // no attachments, keep
    // If any attachment is not supported, exclude the entire message from inference
    return msg.experimental_attachments.every((a) =>
      modelConfig.supportedMimeTypes?.includes(a.contentType || "")
    );
  });

  // Transform each message into an array of chunks: text, image, or file
  const messagesForCore: CoreMessage[] = [];

  // If model supports system messages, add a system message at the start
  if (modelConfig.supportsSystemMessages) {
    messagesForCore.push({
      role: "system",
      content: buildSystemMessage(instructions, project),
    });
  }

  for (const msg of filteredMessages) {
    const chunks = [];

    // Handle different content types
    if (Array.isArray(msg.content)) {
      // Handle tool calls and results
      for (const item of msg.content) {
        if (item.type === "text") {
          chunks.push({ type: "text", text: item.text });
        } else if (item.type === "tool-call") {
          chunks.push({
            type: "tool-call",
            toolCallId: item.toolCallId,
            toolName: item.toolName,
            args: item.args,
          });
        } else if (item.type === "tool-result") {
          chunks.push({
            type: "tool-result",
            toolCallId: item.toolCallId,
            toolName: item.toolName,
            result: item.result,
            experimental_content: item.experimental_content,
          });
        }
      }
    } else if (msg.content) {
      // Handle simple text content
      chunks.push({ type: "text", text: msg.content });
    }

    // Process attachments
    if (msg.experimental_attachments?.length) {
      for (const att of msg.experimental_attachments) {
        const data = await generateAttachmentData(
          att.file_key,
          att.contentType,
          true
        );
        if (att.contentType?.includes("image")) {
          chunks.push({
            type: "image",
            image: data,
            mimeType: att.contentType,
          });
        } else {
          chunks.push({ type: "file", data, mimeType: att.contentType });
        }
      }
    }

    messagesForCore.push({
      role: msg.role,
      content: chunks,
    } as CoreMessage);
  }

  return messagesForCore;
}

type DocumentSearchToolResult = {
  documentId: string;
  path: string;
  documentName: string;
  text: string | null;
  projectId: string;
  similarity: number;
  pageNumber?: number;
  mimeType?: string | null;
  fileKey?: string | null;
};

/** Converts reranked search results to XML format for AI consumption */
function convertResultsToXml(docs: DocumentSearchToolResult[]): string {
  return `<documents_context>${docs
    .map(
      (doc) => `
<document>
  <document_id>${doc.documentId}</document_id>
  <source>${doc.documentName}</source>
  <snippet>${doc.text}</snippet>
  <score>${doc.similarity}</score>
</document>`
    )
    .join("\n\n")}
</documents_context>`;
}

/** Extracts unique documents, treating PDF pages as separate docs */
function getUniqueDocuments(
  docs: DocumentSearchToolResult[]
): DocumentSearchToolResult[] {
  const uniqueDocsMap = new Map<string, DocumentSearchToolResult>();
  for (const doc of docs) {
    const key = doc.pageNumber
      ? `${doc.documentId}_page${doc.pageNumber}`
      : doc.documentId;
    if (!uniqueDocsMap.has(key)) {
      uniqueDocsMap.set(key, doc);
    }
  }
  return Array.from(uniqueDocsMap.values());
}

/** Processes a PDF document and returns its page as an image data URL */
async function processPdfDocument(doc: DocumentSearchToolResult): Promise<{
  fileKey: string;
  imageData: string;
  mimeType: string;
} | null> {
  try {
    if (!doc.pageNumber || !doc.fileKey) {
      return null;
    }

    // Check if thumbnail already exists
    const existingThumbnail = await db.query.documentThumbnails.findFirst({
      where: and(
        eq(documentThumbnails.documentId, doc.documentId),
        eq(documentThumbnails.pageNumber, doc.pageNumber)
      ),
    });

    if (existingThumbnail) {
      // Return existing thumbnail
      return {
        fileKey: existingThumbnail.fileKey,
        imageData: await generateAttachmentData(existingThumbnail.fileKey),
        mimeType: "image/png",
      };
    }

    // Fetch and convert PDF page to image
    const pdfBytes = await s3.file(doc.fileKey).bytes();
    const base64Image = await getPdfPageAsImage(pdfBytes, doc.pageNumber);

    // Store converted image
    const imageKey = `document-thumbnails/${doc.documentId}_page${doc.pageNumber}.png`;
    await s3
      .file(imageKey)
      .write(Buffer.from(base64Image, "base64"), { type: "image/png" });

    // Save thumbnail reference in database
    await db.insert(documentThumbnails).values({
      documentId: doc.documentId,
      pageNumber: doc.pageNumber,
      fileKey: imageKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      fileKey: imageKey,
      imageData: base64Image,
      mimeType: "image/png",
    };
  } catch (error) {
    console.error("Error processing PDF document:", error);
    return null;
  }
}

/** Processes documents and returns image data URLs for supported types */
async function processDocumentImages(docs: DocumentSearchToolResult[]): Promise<
  {
    fileKey: string;
    imageData: string;
    mimeType: string;
  }[]
> {
  // Process all documents in parallel
  const processingPromises = docs.map(async (doc) => {
    try {
      if (doc.mimeType === "application/pdf") {
        return await processPdfDocument(doc);
      } else if (doc.mimeType?.includes("image") && doc.fileKey) {
        const imageData = await generateAttachmentData(doc.fileKey);
        return {
          fileKey: doc.fileKey,
          imageData,
          mimeType: doc.mimeType,
        };
      }
      return null;
    } catch (error) {
      console.error("Error processing document:", error);
      return null;
    }
  });

  // Wait for all processing to complete and filter out nulls
  const results = (await Promise.all(processingPromises)).filter(
    (result): result is NonNullable<typeof result> => result !== null
  );

  return results;
}

/** Creates search tool if project ID exists */
function createSearchTool(projectId: string | null, modelConfig: ModelConfig) {
  if (!projectId) return undefined;

  return {
    search_documents: tool({
      description: `Provides semantic search against project documents, returning relevant passages.

Usage:
    1. A query that will be used to search over all project information.
    2. This tool employs semantic search so you can use natural language queries.

Returns:
    - Document metadata (ID, name, path, mimeType)
    - Relevant text snippets
    - Relevance scores`,
      parameters: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        console.log("Searching project documents for: ", query);
        const res = await searchProjectDocuments(projectId, query, 80);

        console.log("Search results:", res.length);

        // Rerank results
        const rerankedResults = await reranker.rerank(
          query,
          res.map((r) => r.text || ""),
          {
            topN: 20,
            returnDocuments: true,
          }
        );

        // Create a map of text to original result for lookup
        const textToResultMap = new Map(res.map((r) => [r.text, r]));

        // Map reranked results to simplified schema
        const simplifiedDocs: DocumentSearchToolResult[] =
          rerankedResults.results.map((reranked) => {
            const originalDoc = textToResultMap.get(reranked.document.text)!;
            return {
              documentId: originalDoc.document.id,
              projectId: projectId,
              path: originalDoc.document.path,
              documentName: originalDoc.document.name,
              text: originalDoc.text,
              similarity: reranked.relevance_score,
              pageNumber: (originalDoc.metadata as { page_number?: number })
                ?.page_number,
              mimeType: originalDoc.document.mimeType,
              fileKey: originalDoc.document.fileKey,
            };
          });

        console.log("Simplified docs length:", simplifiedDocs.length);

        // Use the typed helper functions with simplified schema
        const uniqueDocs = getUniqueDocuments(simplifiedDocs);
        const searchContext = convertResultsToXml(simplifiedDocs);

        // Generate images if supported by model
        let images: {
          fileKey: string;
          imageData: string;
          mimeType: string;
        }[] = [];
        if (modelConfig.model.modelId.includes("claude-3-7-sonnet")) {
          images = await processDocumentImages(uniqueDocs);
        }

        return {
          context: searchContext,
          docs: simplifiedDocs,
          images,

          // Format data thats easy for frontend to use
          dataForFrontend: uniqueDocs.map((doc) => ({
            document_id: doc.documentId,
            path: doc.path,
            projectId: doc.projectId,
            source: doc.documentName,
            snippet: doc.text,
            score: doc.similarity,
            page: doc.pageNumber,
            url: doc.fileKey
              ? s3.file(doc.fileKey).presign({ expiresIn: 3600 })
              : undefined,
          })),
        };
      },
      experimental_toToolResultContent(result) {
        return [
          ...result.images.map((image) => ({
            type: "image" as const,
            data: image.imageData,
            mimeType: image.mimeType,
          })),
          {
            type: "text",
            text: result.context,
          },
        ];
      },
    }),
  };
}

// --------------------------------------------------------
// 4. Main Service for Threads (Ops)
// --------------------------------------------------------
const ThreadOps = {
  async createThread(
    userId: string,
    organizationId?: string,
    projectId?: string
  ) {
    if (!userId) throw new Error("User ID is required");
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(threads).values({
      id,
      userId,
      organizationId: organizationId || null,
      projectId: projectId || null,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },

  async getThread(threadId: string) {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
      with: {
        messages: {
          orderBy: messages.createdAt,
          columns: {
            embedding: false,
            id: true,
            threadId: true,
            userId: true,
            role: true,
            text: true,
            reasoning: true,
            model: true,
            provider: true,
            createdAt: true,
          },
          with: {
            attachments: true,
            toolCalls: true,
          },
        },
        project: true,
        organization: true,
      },
    });
    if (!thread) return null;

    // console.log("Thread found:", thread);

    // Cast the thread to match ThreadWithMessages type
    const typedThread: ThreadWithMessages = {
      ...thread,
      messages: thread.messages.map((msg) => ({
        ...msg,
        attachments: (msg.attachments || []).map((att) => ({
          ...att,
          fileName: att.fileName || undefined,
          mimeType: att.mimeType || undefined,
          size: att.size || undefined,
        })),
      })),
    };

    // Return the thread with processed attachments
    return processThreadMessages(typedThread);
  },

  async listThreads(
    userId: string,
    page: number,
    search: string,
    organizationId?: string
  ) {
    const LIMIT = 10;
    const offset = (page - 1) * LIMIT;
    const conditions = [eq(threads.userId, userId)];

    if (organizationId) {
      conditions.push(eq(threads.organizationId, organizationId));
    } else {
      // organizationId is null
      conditions.push(sql`${threads.organizationId} IS NULL`);
    }

    let baseQuery;
    if (search?.length > 0) {
      // similarity-based search
      const searchEmbedding = await embeddingModel.doEmbed({
        values: [search],
      });
      const similarity = sql<number>`1 - (${cosineDistance(
        messages.embedding,
        searchEmbedding.embeddings[0]
      )})`;

      baseQuery = db
        .select({
          id: threads.id,
          created_at: threads.createdAt,
          updated_at: threads.updatedAt,
          max_similarity: sql<number>`MAX(${similarity})`.as("max_similarity"),
        })
        .from(threads)
        .leftJoin(messages, eq(threads.id, messages.threadId))
        .where(and(...conditions))
        .groupBy(threads.id, threads.createdAt, threads.updatedAt)
        .having(sql`MAX(${similarity}) > 0.5`)
        .orderBy(desc(sql`max_similarity`));
    } else {
      // no search
      baseQuery = db
        .select({
          id: threads.id,
          created_at: threads.createdAt,
          updated_at: threads.updatedAt,
        })
        .from(threads)
        .leftJoin(messages, eq(threads.id, messages.threadId))
        .where(and(...conditions))
        .groupBy(threads.id, threads.createdAt, threads.updatedAt)
        .orderBy(desc(threads.createdAt));
    }

    const matchingThreads = await baseQuery.limit(LIMIT).offset(offset);

    // Retrieve the full objects
    const completeThreads = await db.query.threads.findMany({
      where: (tbl, { and, eq, inArray }) =>
        and(
          eq(tbl.userId, userId),
          organizationId
            ? eq(tbl.organizationId, organizationId)
            : sql`${tbl.organizationId} IS NULL`,
          inArray(
            tbl.id,
            matchingThreads.map((t) => t.id)
          )
        ),
      orderBy: [desc(threads.createdAt)],
      with: {
        messages: {
          orderBy: messages.createdAt,
        },
      },
    });

    // Process attachments for each thread
    const processed = [];
    for (const t of completeThreads) {
      const withProcessed = await processThreadMessages({
        ...t,
        messages: t.messages.map((m) => ({
          ...m,
          attachments: [],
        })),
      });
      processed.push(withProcessed);
    }
    return processed;
  },

  async inference(req: Request, res: Response) {
    try {
      const { threadId } = req.params;
      const { model, maxTokens, instructions, message } = req.body as z.infer<
        typeof inferenceSchema
      >;

      // SSE Setup
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Transfer-Encoding", "chunked");
      res.flushHeaders();

      // 1) Fetch thread
      const thread = await ThreadOps.getThread(threadId);
      if (!thread) {
        console.error("Thread not found");
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      // 2) Add the user message to DB
      if (message) {
        await createMessage(req.dbUser!.id, threadId, "user", {
          content: message.content || "",
          experimental_attachments: message.experimental_attachments as any,
          role: message.role as any,
        });
      }

      // 3) Re-fetch all messages from DB to build inference context
      const rawMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        orderBy: messages.createdAt,
        with: { attachments: true, toolCalls: true },
      });

      // 4) Determine appropriate model
      const modelConfig = await getModelConfig(model);

      const allMessages = await dbMessagesToMyMessages(
        rawMessages,
        modelConfig
      );

      // 5) Generate a thread title if missing
      await maybeGenerateTitle(threadId, allMessages, thread.title);

      // 6) Prepare messages for inference
      const inferenceMsgs = await buildInferenceMessages(
        allMessages,
        modelConfig,
        thread.project,
        instructions
      );

      // 7) Create tools for the assistant if project ID exists
      const tools =
        thread.projectId && message.content
          ? createSearchTool(thread.projectId, modelConfig)
          : undefined;

      // Start the streaming from the AI
      const result = streamText({
        model: modelConfig.model,
        messages: inferenceMsgs,
        temperature: 0.45,
        tools: tools ? tools : undefined,
        maxSteps: tools ? 8 : undefined,
        toolChoice: "auto",
        toolCallStreaming: true,
        maxTokens: maxTokens,
        onStepFinish: async ({
          toolCalls,
          toolResults,
          text,
          finishReason,
          reasoning,
        }) => {
          //   console.log("Tool calls:", toolCalls);
          //   console.log("Tool results:", toolResults.length);
          //   console.log("Finish reason:", finishReason);
          //   console.log("Text:", text);
          //   console.log("Reasoning:", reasoning);

          //   console.log("\n\n\n");

          if (finishReason === "tool-calls") {
            // First create a message for the assistant's tool call
            const toolCallMessage = await db
              .insert(messages)
              .values({
                userId: req.dbUser!.id,
                threadId,
                role: "assistant",
                text,
                reasoning,
                model,
                provider: modelConfig.provider,
              })
              .returning();

            // Then persist each tool call and its result
            for (const toolCall of toolCalls) {
              const toolCallId = crypto.randomUUID();
              await db.insert(toolCallsTable).values({
                id: toolCallId,
                messageId: toolCallMessage[0].id,
                toolName: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                args: toolCall.args,
                status: "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              // Find matching result for this tool call
              const result = toolResults.find(
                (r) => r.toolCallId === toolCall.toolCallId
              );

              if (result) {
                await db
                  .update(toolCallsTable)
                  .set({
                    status: "completed",
                    result: {
                      docs: result.result.docs,
                      images: result.result.images.map((image) => ({
                        fileKey: image.fileKey,
                        mimeType: image.mimeType,
                      })),
                    },
                    updatedAt: new Date(),
                  })
                  .where(eq(toolCallsTable.toolCallId, toolCall.toolCallId));
              }
            }

            return;
          }

          // Create a message for the assistant's response
          if (finishReason === "stop" && text) {
            let embedding = null;
            if (text && text.length > 0) {
              try {
                const embeddingResult = await embeddingModel.doEmbed({
                  values: [text],
                });
                embedding = embeddingResult.embeddings[0];
              } catch (error) {
                console.error("Error embedding message", error);
              }
            }

            // Persist the assistant's response
            await db.insert(messages).values({
              userId: req.dbUser!.id,
              id: crypto.randomUUID(),
              threadId,
              role: "assistant",
              text: text,
              reasoning,
              createdAt: new Date(),
              model,
              embedding: embedding,
              provider: modelConfig.provider,
            });
            return;
          }
        },
      });

      // Pipe the data out as SSE
      return result.pipeDataStreamToResponse(res, {
        sendReasoning: true,
      });
    } catch (error) {
      console.error("Error in inference:", error);
      res.status(500).json({
        error: "An error occurred during inference",
      });
    }
  },

  async deleteThread(
    userId: string,
    threadId: string,
    organizationId?: string
  ) {
    // First delete messages
    await db
      .delete(messages)
      .where(and(eq(messages.threadId, threadId), eq(messages.userId, userId)));

    // Then delete the thread
    await db
      .delete(threads)
      .where(
        and(
          eq(threads.id, threadId),
          eq(threads.userId, userId),
          organizationId
            ? eq(threads.organizationId, organizationId)
            : sql`${threads.organizationId} IS NULL`
        )
      );
    return { success: true };
  },
};

// --------------------------------------------------------
// 5. The Router
// --------------------------------------------------------
const threadsRouter = Router();

// Create a thread
threadsRouter.post(
  "/",
  handle(async (req) => {
    const { organizationId, projectId } = createThreadSchema.parse(req.body);
    return ThreadOps.createThread(req.dbUser!.id, organizationId, projectId);
  })
);

// Get threads (with optional search, pagination, org)
threadsRouter.get(
  "/",
  handle(async (req) => {
    const { page, search, organizationId } = getThreadsSchema.parse(req.query);
    return ThreadOps.listThreads(
      req.dbUser!.id,
      parseInt(page || "1", 10),
      (search || "").trim(),
      organizationId
    );
  })
);

// Get single thread
threadsRouter.get(
  "/:threadId",
  handle(async (req) => {
    return ThreadOps.getThread(req.params.threadId);
  })
);

// Inference (SSE)
threadsRouter.post(
  "/:threadId/inference",
  async (req: Request, res: Response) => {
    try {
      // Validate request body with Zod
      await inferenceSchema.parseAsync(req.body);
      return ThreadOps.inference(req, res);
    } catch (error: any) {
      console.error("Error in inference endpoint:", error);
      res.status(500).json({
        error: "An error occurred during inference",
        details: error.message,
      });
      return;
    }
  }
);

// Delete thread
threadsRouter.delete(
  "/:threadId",
  handle(async (req) => {
    const organizationId = req.query.organizationId as string | undefined;
    return ThreadOps.deleteThread(
      req.dbUser!.id,
      req.params.threadId,
      organizationId
    );
  })
);

export default threadsRouter;
