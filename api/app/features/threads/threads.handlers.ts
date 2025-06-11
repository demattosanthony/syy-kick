import { Request, Response } from "express";
import threadsOps from "./threads.ops";
import { getThreadsSchema, updateThreadSchema } from "./threads.schemas";

export const threadsHandlers = {
  async createThread(req: Request, res: Response) {
    try {
      const result = await threadsOps.createThread(req.dbUser!.id);
      res.json(result);
    } catch (error) {
      console.error("Error creating thread:", error);
      res.status(500).json({ error: "Failed to create thread" });
    }
  },

  async getThreads(req: Request, res: Response) {
    try {
      const { page, pageSize, search } = getThreadsSchema.parse(req.query);
      const result = await threadsOps.listThreads(
        req.dbUser!.id,
        parseInt(page || "1", 10),
        parseInt(pageSize || "10", 10),
        (search || "").trim()
      );
      res.json(result);
    } catch (error) {
      console.error("Error getting threads:", error);
      res.status(500).json({ error: "Failed to get threads" });
    }
  },

  async getThread(req: Request, res: Response) {
    try {
      const result = await threadsOps.getThread(req.params.threadId);
      res.json(result);
    } catch (error) {
      console.error("Error getting thread:", error);
      res.status(500).json({ error: "Failed to get thread" });
    }
  },

  async updateThread(req: Request, res: Response) {
    try {
      const { title, isPublic } = updateThreadSchema.parse(req.body);
      const result = await threadsOps.updateThread(
        req.params.threadId,
        req.dbUser!.id,
        {
          isPublic,
          title,
        }
      );
      res.json(result);
    } catch (error) {
      console.error("Error updating thread:", error);
      res.status(500).json({ error: "Failed to update thread" });
    }
  },

  async streamMessages(req: Request, res: Response) {
    try {
      return threadsOps.streamMessages(req, res);
    } catch (error: any) {
      console.error("Error in stream endpoint:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "An error occurred during streaming",
          details: error.message,
        });
      }
      return;
    }
  },

  async deleteThread(req: Request, res: Response) {
    try {
      const result = await threadsOps.deleteThread(
        req.dbUser!.id,
        req.params.threadId
      );
      res.json(result);
    } catch (error) {
      console.error("Error deleting thread:", error);
      res.status(500).json({ error: "Failed to delete thread" });
    }
  },

  async cloneThread(req: Request, res: Response) {
    try {
      const result = await threadsOps.cloneThread(
        req.dbUser!.id,
        req.params.threadId
      );
      res.json(result);
    } catch (error) {
      console.error("Error cloning thread:", error);
      res.status(500).json({ error: "Failed to clone thread" });
    }
  },

  async stopInference(req: Request, res: Response) {
    try {
      const result = await threadsOps.stopInference(req.params.threadId);
      res.json(result);
    } catch (error) {
      console.error("Error stopping inference:", error);
      res.status(500).json({ error: "Failed to stop inference" });
    }
  },
};
