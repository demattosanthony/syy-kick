import { sql, desc, count } from "drizzle-orm/sql";
import db from "../../config/db";
import { users } from "../../config/schema";
import { Router } from "express";
import { renderToReadableStream } from "react-dom/server";
import { AnalyticsDashboard } from "./analytics-dashboard";
import {
  threads as threadsTable,
  messages as messagesTable,
  documentProcessingJobs,
  documents,
} from "../../config/schema";
import logsRoutes from "./log_viewer/logs.routes";

const router = Router();

router.get("", async (req, res) => {
  try {
    // Subquery for thread count
    const threadCountSubquery = db.$with("thread_count_sq").as(
      db
        .select({
          userId: threadsTable.userId,
          count: sql<number>`count(*)`.mapWith(Number).as("thread_count"),
        })
        .from(threadsTable)
        .groupBy(threadsTable.userId)
    );

    // Subquery for message count
    const messageCountSubquery = db.$with("message_count_sq").as(
      db
        .select({
          userId: messagesTable.userId,
          count: sql<number>`count(*)`.mapWith(Number).as("message_count"),
        })
        .from(messagesTable)
        .groupBy(messagesTable.userId)
    );

    // Main query joining users with count subqueries
    const usersData = await db
      .with(threadCountSubquery, messageCountSubquery)
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
        sessionCount: users.sessionCount,
        threadCount:
          sql<number>`coalesce(${threadCountSubquery.count}, 0)`.mapWith(
            Number
          ),
        messageCount:
          sql<number>`coalesce(${messageCountSubquery.count}, 0)`.mapWith(
            Number
          ),
      })
      .from(users)
      .leftJoin(
        threadCountSubquery,
        sql`${users.id} = ${threadCountSubquery.userId}`
      )
      .leftJoin(
        messageCountSubquery,
        sql`${users.id} = ${messageCountSubquery.userId}`
      )
      .orderBy(desc(sql`COALESCE(${users.lastActiveAt}, '1970-01-01')`));

    // Fetch document stats
    const totalDocsResult = await db.select({ count: count() }).from(documents);
    const jobStatsResult = await db
      .select({
        processing: count(
          sql`CASE WHEN status = 'processing' THEN 1 ELSE NULL END`
        ),
        pending: count(sql`CASE WHEN status = 'pending' THEN 1 ELSE NULL END`),
      })
      .from(documentProcessingJobs);

    const documentStats = {
      total: totalDocsResult[0]?.count ?? 0,
      processing: jobStatsResult[0]?.processing ?? 0,
      pending: jobStatsResult[0]?.pending ?? 0,
    };

    const stream = await renderToReadableStream(
      <AnalyticsDashboard usersData={usersData} documentStats={documentStats} />
    );

    res.setHeader("Content-Type", "text/html");
    const reader = stream.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      pump();
    };
    pump().catch((error) => {
      console.error("Error piping stream:", error);
      if (!res.headersSent) {
        res.status(500).send("Error generating dashboard");
      }
      reader.cancel();
    });
  } catch (error) {
    console.error("Error rendering dashboard:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating dashboard");
    }
  }
});

router.use("/logs", logsRoutes);

export default router;
