// External dependencies
import { CoreMessage, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Internal configuration
import { CONFIG } from "../../config/constants";
import db from "../../config/db";
import reranker from "../../config/reranker";
import s3 from "../../config/s3";
import {
  artifacts,
  documentThumbnails,
  MessageAttachment,
  messageAttachments,
  messages,
  Project,
  threads,
  toolCalls,
} from "../../config/schema";

// Internal utilities
import { generateThreadTitle, getPdfPageAsImage } from "../../utils";

// Feature imports
import { ModelConfig, MODELS } from "../models";
import { searchProjectDocuments } from "../projects";
import {
  DocumentSearchToolResult,
  MyMessage,
  ThreadWithMessages,
} from "./threads.types";

/** Retrieve the model config. */
async function getModelConfig(model: string) {
  if (model !== "Auto") return MODELS[model];
  return MODELS["claude-3.7-sonnet"];
}

/** If environment is production and user allows, return a presigned URL, else base64. */
async function generateAttachmentData(
  fileKey: string,
  mimeType?: string,
  allowUrl?: boolean
): Promise<string> {
  if (allowUrl && CONFIG.__prod__) {
    return s3.file(fileKey).presign({ expiresIn: 3600 });
  }
  const buffer = Buffer.from(await s3.file(fileKey).arrayBuffer());
  return buffer.toString("base64");
}

/** Adds presigned URLs (or base64 data) to each attachment. */
async function processAttachments(attachments: MessageAttachment[]) {
  try {
    const processed: MessageAttachment[] = [];
    for (const att of attachments) {
      const url = s3.file(att.fileKey).presign({ expiresIn: 3600 });
      processed.push({ ...att, url });
    }
    return processed;
  } catch (error) {
    console.error("Error processing attachments:", error);
    return attachments;
  }
}

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

/** Tool to search all project information */
const createProjectSearchTool = (projectId: string, modelConfig: ModelConfig) =>
  tool({
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
  });

async function processThreadMessages(thread: ThreadWithMessages | null) {
  if (!thread) return null;
  for (const msg of thread.messages) {
    msg.attachments = await processAttachments(msg.attachments);

    msg.toolCalls = msg.toolCalls?.map((call) => {
      if (call.toolName === "search_project_information" && call.result?.docs) {
        const uniqueDocs = getUniqueDocuments(call.result.docs);

        return {
          ...call,
          result: {
            ...call.result, // Preserve existing result properties
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
      }

      // For other tool calls
      return call;
    });
  }

  return thread;
}

// Create Document tool
const createDocumentTool = () =>
  tool({
    description:
      "Create a document for a writing or content creation activities. This will create as simeple markdown format style document, so the content should be in markdown format.",
    parameters: z.object({
      title: z.string(),
      content: z.string(),
    }),
    execute: async ({ title, content }) => {
      const [artifact] = await db
        .insert(artifacts)
        .values({
          title,
          content,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        document_id: artifact.id,
      };
    },
  });

const updateDocumentTool = () =>
  tool({
    description: "Update a document with new content.",
    parameters: z.object({
      id: z.string(),
      content: z.string(),
    }),
    execute: async ({ id, content }) => {
      console.log("Updating document with id: ", id);
      await db
        .update(artifacts)
        .set({ content, updatedAt: new Date() })
        .where(eq(artifacts.id, id));

      console.log("Document updated with id: ", id);
      return `Document updated with id: ${id}.`;
    },
  });

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
   - Separate your answer into logical sections using level 2 headers (##) for sections and bolding (**) for subsections. Never use level 1 headers (#).
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

  systemMsg += `\n\nArtifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side. When creating or updating documents, changes are reflected in real-time on the artifacts and visible to the user.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.

This is a guide for using artifacts tools: \`createDocument\` and \`updateDocument\`, which render content on a artifacts beside the conversation.

**When to use \`createDocument\`:**
- For substantial content (>10 lines) or code
- For content users will likely save/reuse (emails, code, essays, etc.)
- When explicitly requested to create a document
- For when content contains a single code snippet
- Use ## for headers and ** for bolding
- Don't make the title and beginning of the content the same

**When NOT to use \`createDocument\`:**
- For informational/explanatory content
- For conversational responses
- When asked to keep it in chat

**Using \`updateDocument\`:**
- Default to full document rewrites for major changes
- Use targeted updates only for specific, isolated changes
- Follow user instructions for which parts to modify

**When NOT to use \`updateDocument\`:**
- Immediately after creating a document

Do not update document right after creating it. Wait for user feedback or request to update it.`;

  return systemMsg;
}

/**
 * Directly transforms database messages into inference messages format
 * in a single function, handling attachments, tool calls, and content formatting.
 */
async function dbMessagesToInferenceMessages(
  dbMsgs: Array<
    typeof messages.$inferSelect & {
      toolCalls: Array<typeof toolCalls.$inferSelect>;
      attachments: Array<typeof messageAttachments.$inferSelect>;
    }
  >,
  modelConfig: {
    model: {
      modelId: string;
    };
    supportedMimeTypes?: string[];
    supportsSystemMessages?: boolean;
  },
  project?: Project,
  instructions?: string
): Promise<CoreMessage[]> {
  // Initialize the result array
  const inferenceMessages: CoreMessage[] = [];

  // Add system message if supported
  if (modelConfig.supportsSystemMessages) {
    inferenceMessages.push({
      role: "system",
      content: buildSystemMessage(instructions, project),
    });
  }

  // Process each database message
  for (let i = 0; i < dbMsgs.length; i++) {
    const msg = dbMsgs[i];

    // Skip messages with unsupported attachments
    if (
      !isAttachmentSupported(msg.attachments, modelConfig.supportedMimeTypes)
    ) {
      continue;
    }

    // Handle assistant messages with tool calls
    if (msg.role === "assistant" && msg.toolCalls.length > 0) {
      // Add assistant message with tool calls
      inferenceMessages.push(await createAssistantMessage(msg, modelConfig));

      // Add tool response message if there are completed calls
      const toolMessage = await createToolMessage(msg, modelConfig);
      if (toolMessage) {
        inferenceMessages.push(toolMessage);
      }
    } else {
      // Process regular message
      inferenceMessages.push(await createRegularMessage(msg, modelConfig));
    }
  }

  return inferenceMessages;
}

/**
 * Determines if all attachments in a message are supported by the model
 */
function isAttachmentSupported(
  attachments: Array<typeof messageAttachments.$inferSelect>,
  supportedMimeTypes?: string[]
): boolean {
  if (!attachments.length) return true; // No attachments, so supported

  // Check if all attachments are supported
  return attachments.every((attachment) =>
    supportedMimeTypes?.includes(attachment.mimeType || "")
  );
}

/**
 * Creates an assistant message with tool calls
 */
async function createAssistantMessage(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
    attachments: Array<typeof messageAttachments.$inferSelect>;
  },
  modelConfig: any
): Promise<CoreMessage> {
  const chunks = [];

  // Add text content if present
  if (msg.text) {
    chunks.push({ type: "text", text: msg.text });
  }

  // Add tool calls
  for (const call of msg.toolCalls) {
    chunks.push({
      type: "tool-call",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      args: call.args,
    });
  }

  // Process attachments
  const attachmentChunks = await createAttachmentMessages(msg.attachments);
  chunks.push(...attachmentChunks);

  return {
    role: "assistant",
    content: chunks,
  };
}

/**
 * Creates a tool message with results from completed tool calls
 */
async function createToolMessage(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
    attachments: Array<typeof messageAttachments.$inferSelect>;
  },
  modelConfig: {
    model: {
      modelId: string;
    };
  }
): Promise<CoreMessage | null> {
  const completedCalls = msg.toolCalls.filter(
    (call) => call.status === "completed" && call.result
  );

  if (completedCalls.length === 0) {
    return null;
  }

  const processedResults = await Promise.all(
    completedCalls.map(async (call) => {
      // Special handling for Claude 3.7 Sonnet
      if (
        modelConfig.model.modelId.includes("claude-3.7-sonnet") &&
        call.toolName === "search_project_information"
      ) {
        return await processClaudeToolResult(call);
      }

      // Standard handling for other models
      return {
        type: "tool-result",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        result:
          call.toolName === "search_project_information"
            ? convertResultsToXml((call.result as any).docs)
            : call.result,
      };
    })
  );

  return {
    id: `${msg.id}_tool_results`,
    role: "tool",
    content: processedResults,
  } as MyMessage;
}

/**
 * Processes tool results specifically for Claude 3.7 Sonnet
 */
async function processClaudeToolResult(call: {
  toolCallId: string;
  toolName: string;
  result: any;
}): Promise<any> {
  const images = call.result.images || [];
  const imagesData = await Promise.all(
    images.map(async (image: { fileKey: string; mimeType: string }) => {
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

/**
 * Creates a regular message (not an assistant with tool calls)
 */
async function createRegularMessage(
  msg: typeof messages.$inferSelect & {
    toolCalls: Array<typeof toolCalls.$inferSelect>;
    attachments: Array<typeof messageAttachments.$inferSelect>;
  },
  modelConfig: any
): Promise<CoreMessage> {
  const chunks = [];

  // Add text content
  if (msg.text) {
    chunks.push({ type: "text", text: msg.text });
  }

  // Process attachments
  const attachmentChunks = await createAttachmentMessages(msg.attachments);
  chunks.push(...attachmentChunks);

  return {
    id: msg.id,
    role: msg.role,
    content: chunks,
  } as MyMessage;
}

/**
 * Process attachments into appropriate chunks
 */
async function createAttachmentMessages(
  attachments: Array<typeof messageAttachments.$inferSelect>
): Promise<any[]> {
  const chunks = [];

  for (const att of attachments) {
    const data = await generateAttachmentData(att.fileKey, att.mimeType!, true);

    if (att.mimeType?.includes("image")) {
      chunks.push({
        type: "image",
        image: data,
        mimeType: att.mimeType,
      });
    } else {
      chunks.push({
        type: "file",
        data,
        mimeType: att.mimeType,
      });
    }
  }

  return chunks;
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
    const textContent = Array.isArray(firstUserTextMessage.content)
      ? firstUserTextMessage.content.find((chunk) => chunk.type === "text")
          ?.text || ""
      : (firstUserTextMessage.content as string) || "";

    const title = await generateThreadTitle(textContent);
    await db.update(threads).set({ title }).where(eq(threads.id, threadId));
  } catch (error) {
    console.error("Error generating title", error);
  }
}

export {
  getModelConfig,
  generateAttachmentData,
  processAttachments,
  processThreadMessages,
  createProjectSearchTool,
  createDocumentTool,
  updateDocumentTool,
  processDocumentImages,
  dbMessagesToInferenceMessages,
  maybeGenerateTitle,
};
