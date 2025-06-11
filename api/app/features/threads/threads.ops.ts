import { and, cosineDistance, desc, eq, sql } from "drizzle-orm";
import { Request, Response } from "express";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import db from "../../config/db";
import {
  messages,
  threads,
  toolCalls as toolCallsTable,
  messagesFiles,
} from "../../config/schema";

import { embeddingModel } from "../models";

// Event stream of assistant messages responses
export const eventEmitter = new EventEmitter();

// In-memory cache for active streams
export interface ActiveStreamData {
  currentAssistantMessageId: string | null;
  accumulatedResponseText: string;
  assistantMessageCreatedAt: Date | null;
  role: "assistant"; // Typically always assistant for this cache
  model?: string;
  provider?: string;
  reasoningStartTime?: Date;
}
export const activeStreamCache = new Map<string, ActiveStreamData>();

// In-memory cache for abort controllers
export const abortControllers = new Map<string, AbortController>();

const threadsOps = {
  async createThread(userId: string) {
    if (!userId) throw new Error("User ID is required");
    const id = uuidv4();
    const now = new Date();
    await db.insert(threads).values({
      id,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },

  async getThread(threadId: string) {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
    });
    if (!thread) return null;

    return thread;
  },

  async updateThread(
    threadId: string,
    userId: string,
    data: { isPublic?: boolean; title?: string }
  ) {
    const updateData: any = {
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      ...(data.title !== undefined && { title: data.title }),
      updatedAt: new Date(),
    };

    if (Object.keys(updateData).length === 1) {
      // Only updatedAt exists
      return { message: "No changes to update" };
    }

    await db
      .update(threads)
      .set(updateData)
      .where(eq(threads.id, threadId))
      .returning();

    return { message: "Thread updated successfully" };
  },

  async listThreads(
    userId: string,
    page: number,
    pageSize: number,
    search: string
  ) {
    const LIMIT = pageSize || 10;
    const offset = (page - 1) * LIMIT;
    const conditions = [eq(threads.userId, userId)];

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
        .having(
          and(
            sql`COUNT(${messages.id}) > 0`, // Filter out empty threads
            sql`MAX(${similarity}) > 0.5` // Keep existing similarity condition
          )
        )
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
        .having(sql`COUNT(${messages.id}) > 0`)
        .orderBy(desc(threads.createdAt));
    }

    // Get one extra record to check if there are more pages
    const matchingThreads = await baseQuery.limit(LIMIT + 1).offset(offset);

    // Check if there are more pages
    const hasMore = matchingThreads.length > LIMIT;

    // Remove the extra record if it exists
    const paginatedThreads = hasMore
      ? matchingThreads.slice(0, LIMIT)
      : matchingThreads;

    // If no threads found, return empty result with pagination info
    if (paginatedThreads.length === 0) {
      return {
        threads: [],
        pagination: {
          page,
          pageSize: LIMIT,
          hasMore: false,
          total: 0,
        },
      };
    }

    // Retrieve the full objects while maintaining the original order
    const completeThreads = await db.query.threads.findMany({
      where: (tbl, { and, eq, inArray }) =>
        and(
          eq(tbl.userId, userId),
          inArray(
            tbl.id,
            paginatedThreads.map((t) => t.id)
          )
        ),
      with: {
        messages: {
          orderBy: messages.createdAt,
        },
      },
    });

    // Restore the original order from the paginated query
    const orderedThreads = paginatedThreads
      .map((paginatedThread) =>
        completeThreads.find((thread) => thread.id === paginatedThread.id)
      )
      .filter(
        (thread): thread is NonNullable<typeof thread> => thread !== undefined
      );

    // Process attachments for each thread
    const processed = [];
    for (const t of orderedThreads) {
      processed.push(t);
    }

    return {
      threads: processed,
      pagination: {
        page,
        pageSize: LIMIT,
        hasMore,
        total: paginatedThreads.length,
      },
    };
  },

  async deleteThread(userId: string, threadId: string) {
    // First delete messages
    await db
      .delete(messages)
      .where(and(eq(messages.threadId, threadId), eq(messages.userId, userId)));

    // Then delete the thread
    await db
      .delete(threads)
      .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
    return { success: true };
  },

  async stopInference(threadId: string) {
    const controller = abortControllers.get(threadId);
    if (controller) {
      console.log(`Aborting inference for thread ${threadId}`);
      controller.abort();

      // Emit an event to notify clients that inference was stopped
      eventEmitter.emit(`thread-${threadId}-message`, {
        type: "inference-stopped",
      });

      return { success: true, stopped: true };
    }
    return { success: true, stopped: false };
  },

  async streamMessages(req: Request, res: Response) {
    const { threadId } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write("data: " + JSON.stringify({ type: "connected" }) + "\n\n");

    // Check cache for active stream data on new connection
    const cachedStreamData = activeStreamCache.get(threadId);
    if (cachedStreamData && cachedStreamData.currentAssistantMessageId) {
      console.log(
        `Resuming stream for thread ${threadId} from cache for message ${cachedStreamData.currentAssistantMessageId}`
      );
      res.write(
        "event: message\ndata: " +
          JSON.stringify({
            type: "stream-resume",
            messageId: cachedStreamData.currentAssistantMessageId,
            fullText: cachedStreamData.accumulatedResponseText,
            createdAt:
              cachedStreamData.assistantMessageCreatedAt?.toISOString(),
            role: cachedStreamData.role,
          }) +
          "\n\n"
      );
    }

    const messageHandler = (data: any) => {
      res.write("event: message\ndata: " + JSON.stringify(data) + "\n\n");
    };
    eventEmitter.on(`thread-${threadId}-message`, messageHandler);

    req.on("close", () => {
      console.log(`Client disconnected from thread ${threadId} stream`);
      eventEmitter.removeListener(`thread-${threadId}-message`, messageHandler);
      res.end();
    });
    req.on("aborted", () => {
      console.log(`Client aborted thread ${threadId} stream`);
      eventEmitter.removeListener(`thread-${threadId}-message`, messageHandler);
      res.end();
    });
  },

  async cloneThread(userId: string, threadId: string) {
    const sourceThread = await threadsOps.getThread(threadId);
    if (!sourceThread) {
      throw new Error("Thread not found");
    }

    // Create a new thread with all properties from source thread
    const [newThread] = await db
      .insert(threads)
      .values({
        userId,
        isPublic: false, // Always set cloned threads to private initially
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Fetch original messages with embeddings
    const originalMessages = await db.query.messages.findMany({
      where: eq(messages.threadId, threadId),
      orderBy: messages.createdAt,
      with: { toolCalls: true },
    });

    // Clone all messages with embeddings
    const messagesToCopy = originalMessages.map((msg) => ({
      userId,
      threadId: newThread.id,
      role: msg.role,
      text: msg.text || "",
      reasoning: msg.reasoning || null,
      model: msg.model || null,
      provider: msg.provider || null,
      embedding: msg.embedding, // Copy embedding for search functionality
      createdAt: new Date(),
    }));

    // Insert all messages first to get their IDs
    const insertedMessages = [];
    for (const msg of messagesToCopy) {
      const [insertedMsg] = await db
        .insert(messages)
        .values({
          ...msg,
          id: uuidv4(),
        })
        .returning();

      insertedMessages.push(insertedMsg);
    }

    // Now handle files and tool calls for each message
    for (let i = 0; i < originalMessages.length; i++) {
      const sourceMsg = originalMessages[i];
      const newMsg = insertedMessages[i];

      // Clone file relationships by querying messagesFiles directly
      const messageFiles = await db.query.messagesFiles.findMany({
        where: eq(messagesFiles.messageId, sourceMsg.id),
      });

      for (const msgFile of messageFiles) {
        await db.insert(messagesFiles).values({
          messageId: newMsg.id,
          fileId: msgFile.fileId,
        });
      }

      // Clone tool calls
      if (sourceMsg.toolCalls && sourceMsg.toolCalls.length > 0) {
        for (const call of sourceMsg.toolCalls) {
          await db.insert(toolCallsTable).values({
            id: uuidv4(), // Generate new ID for tool call
            messageId: newMsg.id,
            toolName: call.toolName,
            toolCallId: call.toolCallId,
            args: call.args,
            status: call.status as any,
            result: call.result,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    return { id: newThread.id };
  },
};

export default threadsOps;
