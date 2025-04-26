import { sql, desc } from "drizzle-orm/sql";
import db from "../config/db";
import { users } from "../config/schema";
import { Request, Response, Router } from "express";
import { renderToReadableStream } from "react-dom/server";
import { AnalyticsDashboard } from "./analytics/analytics-dashboard";

// New handler to fetch user data for the table
const getUsersTable = async (req: Request, res: Response) => {
  try {
    const usersData = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
      })
      .from(users)
      .orderBy(desc(users.lastActiveAt));

    res.json(usersData);
    return usersData;
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching user data." });
    throw new Error("Failed to fetch user data");
  }
};

const router = Router();

router.get("/dashboard", async (req, res) => {
  try {
    const usersData = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
        sessionCount: users.sessionCount,
      })
      .from(users)
      .orderBy(desc(sql`COALESCE(${users.lastActiveAt}, '1970-01-01')`));

    const stream = await renderToReadableStream(
      <AnalyticsDashboard usersData={usersData} />
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

export default router;
