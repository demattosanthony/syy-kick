import { Router } from "express";
import { renderToReadableStream } from "react-dom/server";
import { desc, count } from "drizzle-orm/sql";
import db from "../../../config/db";
import { logs } from "../../../config/schema";
import { LogsDashboard } from "./logs-dashboard";

const router = Router();

router.get("", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;
    const offset = (page - 1) * pageSize;

    const logsData = await db
      .select()
      .from(logs)
      .orderBy(desc(logs.timestamp))
      .limit(pageSize)
      .offset(offset);

    const totalLogsResult = await db.select({ count: count() }).from(logs);
    const totalLogs = totalLogsResult[0].count;
    const totalPages = Math.ceil(totalLogs / pageSize);

    const stream = await renderToReadableStream(
      <LogsDashboard
        logsData={logsData}
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
      />
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
        res.status(500).send("Error generating logs dashboard");
      }
      reader.cancel();
    });
  } catch (error) {
    console.error("Error rendering logs dashboard:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating logs dashboard");
    }
  }
});

export default router;
