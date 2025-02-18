// threads.ts

import { Router, Request, Response } from "express";
import z from "zod";
import crypto from "crypto";
import { sql, desc, and, eq, cosineDistance } from "drizzle-orm";

import s3 from "../config/s3";
import db from "../config/db";
import { messages, threads, messageAttachments } from "../config/schema";
import { MessageAttachment } from "../config/schema"; // reusing types
import { embeddingModel, MODELS } from "./models";
import { handle, generateThreadTitle } from "../utils";
import { CONFIG } from "../config/constants";

// ai-related imports
import {
  Attachment,
  CoreMessage,
  generateObject,
  Message,
  streamText,
} from "ai";

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

type MyMessage = Message & {
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
  contentType?: string
): Promise<string> {
  const metadata = s3.file(fileKey);
  // In local dev, we might return a base64 data URI
  if (!CONFIG.__prod__) {
    const buffer = Buffer.from(new Uint8Array(await metadata.arrayBuffer()));
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
  // In production, generate an actual presigned URL
  return metadata.presign({
    acl: "public-read",
    expiresIn: 3600,
    method: "GET",
  });
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
      values: [message.content],
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
    text: message.content ?? null,
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
async function getModelConfig(model: string, messages: MyMessage[]) {
  if (model !== "Auto") {
    return MODELS[model];
  }

  // Check for PDFs or images in attachments or messages
  const hasMediaContent = messages.some((msg) => {
    return msg.experimental_attachments?.some((attachment) => {
      return (
        attachment.contentType?.includes("pdf") ||
        attachment.contentType?.includes("image")
      );
    });
  });

  if (hasMediaContent) {
    return MODELS["gemini-2.0-flash"];
  }

  // If there's no media, classify conversation to pick a model
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const { object } = await generateObject({
    prompt: `Based on the conversation below, classify the type of request into:
- web_search
- coding
- type_1_thinking
- type_2_thinking

Conversation:

${conversationText}`,
    schema: z.object({
      request_type: z.enum([
        "web_search",
        "coding",
        "type_1_thinking",
        "type_2_thinking",
      ]),
    }),
    model: MODELS["claude-3.5-sonnet"].model,
  });

  const type = object.request_type;
  if (type === "coding") return MODELS["claude-3.5-sonnet"];
  if (type === "type_1_thinking") return MODELS["gemini-2.0-flash"];
  if (type === "type_2_thinking") return MODELS["o1"];
  if (type === "web_search") return MODELS["sonar-pro"];

  // Fallback
  return MODELS[object.request_type];
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
    const title = await generateThreadTitle(firstUserTextMessage.content || "");
    await db.update(threads).set({ title }).where(eq(threads.id, threadId));
  } catch (error) {
    console.error("Error generating title", error);
  }
}

/** Constructs a "system" style message, appending user instructions if they exist. */
function buildSystemMessage(instructions?: string): string {
  const dateString = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let systemMsg = `<assistant_instructions>
Your name is Yo. You are a multi-disciplinary engineer with vast expertise across diverse fields such as building systems, product design, automation, and project management. Whether it’s creating bill of materials, automating processes, or exploring new technical projects, you always provide clear, precise, and actionable advice. You combine technical depth with a friendly, professional, and accessible tone, making you both brilliant and approachable. When responding, use markdown formatting. Make your explanations straightforward, insightful, and easy to understand.
</assistant_instructions>

<current_date>
It is currently: ${dateString}
</current_date>`;

  if (instructions) {
    systemMsg += `<user_instructions>${instructions}</user_instructions>`;
  }
  return systemMsg;
}

/** Utility to transform raw DB messages into MyMessage objects. */
function dbMessagesToMyMessages(
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
  }[]
) {
  return dbMsgs.map((msg) => {
    const experimental_attachments: ExtendedAttachment[] =
      msg.attachments?.map((att) => ({
        name: att.fileName || undefined,
        file_key: att.fileKey,
        contentType: att.mimeType || undefined,
        url: s3.file(att.fileKey).presign({ expiresIn: 3600 }),
      })) || [];

    return {
      id: msg.id,
      role: msg.role as MyMessage["role"],
      content: msg.text || "",
      experimental_attachments,
    } as MyMessage;
  });
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
  }
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
  for (const msg of filteredMessages) {
    const chunks = [];

    // Main text
    if (msg.content) {
      chunks.push({ type: "text", text: msg.content });
    }

    // Process attachments
    if (msg.experimental_attachments?.length) {
      for (const att of msg.experimental_attachments) {
        const data = await generateAttachmentData(
          att.file_key,
          att.contentType
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
          },
        },
        project: true,
        organization: true,
      },
    });
    if (!thread) return null;

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
      const { model, maxTokens, temperature, instructions, message } =
        req.body as z.infer<typeof inferenceSchema>;

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
          id: message.id || crypto.randomUUID(),
          role: message.role as any,
        });
      }

      // 3) Re-fetch all messages from DB to build inference context
      const rawMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        orderBy: messages.createdAt,
        with: { attachments: true },
      });

      const allMessages = dbMessagesToMyMessages(rawMessages);

      // 4) Determine appropriate model
      const modelConfig = await getModelConfig(model, allMessages);

      // 5) Generate a thread title if missing
      await maybeGenerateTitle(threadId, allMessages, thread.title);

      // 6) Prepare messages for inference
      const inferenceMsgs = await buildInferenceMessages(
        allMessages,
        modelConfig
      );

      // 7) Build system message (if the chosen model supports system messages)
      const systemMessage = modelConfig.supportsSystemMessages
        ? buildSystemMessage(instructions)
        : undefined;

      // 8) Streaming logic
      let aiResponse = "";
      let reasoning: string | undefined;

      // Save the AI response once the client disconnects or the response ends
      req.on("close", async () => {
        const responseEmbedding = await embeddingModel.doEmbed({
          values: [aiResponse],
        });

        // Persist the assistant's response
        await db.insert(messages).values({
          userId: req.dbUser!.id,
          id: crypto.randomUUID(),
          threadId,
          role: "assistant",
          text: aiResponse,
          reasoning,
          createdAt: new Date(),
          model,
          embedding: responseEmbedding.embeddings[0],
          provider: modelConfig.provider,
        });

        res.end();
      });

      // Start the streaming from the AI
      const result = streamText({
        model: modelConfig.model,
        messages: inferenceMsgs as CoreMessage[],
        temperature,
        system: systemMessage,
        maxTokens: maxTokens,
        onChunk: ({ chunk }) => {
          if (chunk.type === "text-delta") {
            aiResponse += chunk.textDelta;
          } else if (chunk.type === "reasoning") {
            if (!reasoning) reasoning = "";
            reasoning += chunk.textDelta;
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
