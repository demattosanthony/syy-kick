import { Router } from "express";
import { renderToReadableStream } from "react-dom/server";
import { desc } from "drizzle-orm/sql";
import db from "../../../config/db";
import { logs } from "../../../config/schema";
import { LogsDashboard } from "./logs-dashboard";

const router = Router();

router.get("", async (req, res) => {
  try {
    const logsData = await db
      .select()
      .from(logs)
      .orderBy(desc(logs.timestamp))
      .limit(100); // Limit to the latest 100 logs for performance

    const stream = await renderToReadableStream(
      <LogsDashboard logsData={logsData} />
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
