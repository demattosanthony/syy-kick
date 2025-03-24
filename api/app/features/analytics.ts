import { eq, inArray, sql } from "drizzle-orm/sql";
import db from "../config/db";
import {
  documentProcessingJobs,
  documents,
  messages,
  organizations,
  projects,
  threads,
  users,
} from "../config/schema";
import { Request, Response, Router } from "express";
import { encoding_for_model } from "tiktoken";

/** ─────────────────────────────────────────────────────────────────────────
 *  Calculate total tokens processed in messages
 *  ───────────────────────────────────────────────────────────────────────── */
const calculateTokens = async () => {
  // Get all messages
  const allMessages = await db
    .select({ text: messages.text, model: messages.model })
    .from(messages)
    .where(sql`${messages.text} IS NOT NULL`);

  let totalTokens = 0;

  // Group messages by model to avoid recreating encoders
  const messagesByModel: Record<string, string[]> = {};

  // Pre-process and group messages by model
  for (const message of allMessages) {
    const model = message.model || "gpt-4o"; // Default to gpt-4o
    if (!messagesByModel[model]) {
      messagesByModel[model] = [];
    }
    messagesByModel[model].push(message.text || "");
  }

  // Process each model group with a single encoder instance
  for (const [model, texts] of Object.entries(messagesByModel)) {
    try {
      // Create encoder once per model
      const enc = encoding_for_model("gpt-4o");

      // Process in batches of 100 for large datasets
      const BATCH_SIZE = 100;
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);

        // Count tokens for each message in the batch
        for (const text of batch) {
          totalTokens += enc.encode(text).length;
        }
      }

      // Free the encoder after processing all messages for this model
      enc.free();
    } catch (error) {
      // If model-specific encoder fails, try the fallback encoder
      try {
        const fallbackModel = "gpt-3.5-turbo";
        console.warn(
          `Falling back to ${fallbackModel} encoder for model: ${model}`
        );

        const enc = encoding_for_model(fallbackModel);

        // Process in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
          const batch = texts.slice(i, i + BATCH_SIZE);

          for (const text of batch) {
            totalTokens += enc.encode(text).length;
          }
        }

        enc.free();
      } catch (e) {
        console.error("Error calculating tokens with fallback encoder:", e);
      }
    }
  }

  return totalTokens;
};

const handlers = {
  getAnalytics: async (req: Request, res: Response) => {
    try {
      /** ─────────────────────────────────────────────────────────────────────────
       *  1) High-level totals
       *  ───────────────────────────────────────────────────────────────────────── */
      const [{ userCount }] = await db
        .select({ userCount: sql<number>`COUNT(${users.id})` })
        .from(users);

      const [{ orgCount }] = await db
        .select({ orgCount: sql<number>`COUNT(${organizations.id})` })
        .from(organizations);

      const [{ projectCount }] = await db
        .select({ projectCount: sql<number>`COUNT(${projects.id})` })
        .from(projects);

      const [{ threadCount }] = await db
        .select({ threadCount: sql<number>`COUNT(${threads.id})` })
        .from(threads);

      const [{ documentCount }] = await db
        .select({ documentCount: sql<number>`COUNT(${documents.id})` })
        .from(documents);
      const [{ messageCount }] = await db
        .select({ messageCount: sql<number>`COUNT(${messages.id})` })
        .from(messages);

      /** ─────────────────────────────────────────────────────────────────────────
       *  2) Document processing stats
       *  (Number currently processing vs. total processed)
       *  ───────────────────────────────────────────────────────────────────────── */
      // Currently processing = 'pending' or 'processing'
      const [{ currentlyProcessing }] = await db
        .select({ currentlyProcessing: sql<number>`COUNT(*)` })
        .from(documentProcessingJobs)
        .where(
          inArray(documentProcessingJobs.status, ["pending", "processing"])
        );

      // Total processed = 'completed'
      const [{ totalProcessed }] = await db
        .select({ totalProcessed: sql<number>`COUNT(*)` })
        .from(documentProcessingJobs)
        .where(eq(documentProcessingJobs.status, "completed"));

      /** ─────────────────────────────────────────────────────────────────────────
       *  3) Daily signups (User Growth) for last 30 days
       *  (Builds a small array of { date, count })
       *  ───────────────────────────────────────────────────────────────────────── */
      const dailyUserSignups = await db
        .select({
          date: sql<Date>`DATE_TRUNC('day', ${users.createdAt})`.as("date"),
          count: sql<number>`COUNT(${users.id})`.as("count"),
        })
        .from(users)
        .where(sql`${users.createdAt} >= NOW() - INTERVAL '30 days'`)
        .groupBy(sql`DATE_TRUNC('day', ${users.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${users.createdAt})`);

      /** ─────────────────────────────────────────────────────────────────────────
       *  4) Daily threads created for the last 30 days
       *  (Again, an array of { date, count })
       *  ───────────────────────────────────────────────────────────────────────── */
      const dailyThreadsCreated = await db
        .select({
          date: sql<Date>`DATE_TRUNC('day', ${threads.createdAt})`.as("date"),
          count: sql<number>`COUNT(${threads.id})`.as("count"),
        })
        .from(threads)
        .where(sql`${threads.createdAt} >= NOW() - INTERVAL '30 days'`)
        .groupBy(sql`DATE_TRUNC('day', ${threads.createdAt})`)
        .orderBy(sql`DATE_TRUNC('day', ${threads.createdAt})`);

      /** ─────────────────────────────────────────────────────────────────────────
       *  5) Simple growth comparison
       *  e.g. # of new users in last 7 days vs. previous 7 days
       *       # of new threads in last 7 days vs. previous 7 days
       *  ───────────────────────────────────────────────────────────────────────── */

      // Last 7 days for users
      const [{ recentUserSignups }] = await db
        .select({ recentUserSignups: sql<number>`COUNT(*)` })
        .from(users)
        .where(sql`${users.createdAt} >= NOW() - INTERVAL '7 days'`);

      // Previous 7 days for users
      const [{ olderUserSignups }] = await db
        .select({ olderUserSignups: sql<number>`COUNT(*)` })
        .from(users)
        .where(
          sql`${users.createdAt} >= NOW() - INTERVAL '14 days' 
          AND ${users.createdAt} < NOW() - INTERVAL '7 days'`
        );

      // Growth % for user signups
      const userGrowthRate = olderUserSignups
        ? ((recentUserSignups - olderUserSignups) / olderUserSignups) * 100
        : recentUserSignups > 0
        ? 100
        : 0;

      // Last 7 days for threads
      const [{ recentThreads }] = await db
        .select({ recentThreads: sql<number>`COUNT(*)` })
        .from(threads)
        .where(sql`${threads.createdAt} >= NOW() - INTERVAL '7 days'`);

      // Previous 7 days for threads
      const [{ olderThreads }] = await db
        .select({ olderThreads: sql<number>`COUNT(*)` })
        .from(threads)
        .where(
          sql`${threads.createdAt} >= NOW() - INTERVAL '14 days' 
          AND ${threads.createdAt} < NOW() - INTERVAL '7 days'`
        );

      // Growth % for threads
      const threadGrowthRate = olderThreads
        ? ((recentThreads - olderThreads) / olderThreads) * 100
        : recentThreads > 0
        ? 100
        : 0;

      /** ─────────────────────────────────────────────────────────────────────────
       *  6) Top 10 users by message count
       *  ───────────────────────────────────────────────────────────────────────── */
      const topMessageUsers = await db
        .select({
          userId: messages.userId,
          userName: users.name,
          userEmail: users.email,
          messageCount: sql<number>`COUNT(${messages.id})`.as("message_count"),
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .groupBy(messages.userId, users.name, users.email)
        .orderBy(sql`COUNT(${messages.id}) DESC`)
        .limit(10);

      /** ─────────────────────────────────────────────────────────────────────────
       *  7) Token usage statistics
       *  ───────────────────────────────────────────────────────────────────────── */
      const totalTokensProcessed = await calculateTokens();

      /** ─────────────────────────────────────────────────────────────────────────
       *  Aggregate the results and send back
       *  ───────────────────────────────────────────────────────────────────────── */
      const analytics = {
        totals: {
          users: userCount,
          organizations: orgCount,
          projects: projectCount,
          threads: threadCount,
          documents: documentCount,
          messages: messageCount,
          tokensProcessed: totalTokensProcessed,
        },
        processing: {
          currentlyProcessing,
          totalProcessed,
        },
        topUsers: {
          byMessageCount: topMessageUsers,
        },
        dailyUserSignups, // Array of { date, count }
        dailyThreadsCreated, // Array of { date, count }
        growth: {
          userSignupsLast7Days: recentUserSignups,
          userSignupsPrevious7Days: olderUserSignups,
          userGrowthRate, // e.g., 23.7 => 23.7%
          threadsLast7Days: recentThreads,
          threadsPrevious7Days: olderThreads,
          threadGrowthRate, // e.g., -10 => -10%
        },
      };

      res.json(analytics);
      return;
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ error: "An error occurred while fetching analytics." });
      return;
    }
  },
};

const router = Router();

router.get("", handlers.getAnalytics);

export default router;
