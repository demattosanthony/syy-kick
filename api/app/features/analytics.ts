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
