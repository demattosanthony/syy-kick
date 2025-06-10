import { Request, Response } from "express";
import threadsOps from "./threads.ops";
import {
  getThreadsSchema,
  inferenceSchema,
  retryMessageSchema,
  updateThreadSchema,
} from "./threads.schemas";

export async function createThread(req: Request, res: Response) {
  try {
    const result = await threadsOps.createThread(req.dbUser!.id);
    res.json(result);
  } catch (error) {
    console.error("Error creating thread:", error);
    res.status(500).json({ error: "Failed to create thread" });
  }
}

export async function getThreads(req: Request, res: Response) {
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
}

export async function getThread(req: Request, res: Response) {
  try {
    const result = await threadsOps.getThread(req.params.threadId);
    res.json(result);
  } catch (error) {
    console.error("Error getting thread:", error);
    res.status(500).json({ error: "Failed to get thread" });
  }
}

export async function updateThread(req: Request, res: Response) {
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
}

export async function getThreadMessages(req: Request, res: Response) {
  try {
    const result = await threadsOps.getThreadMessages(req.params.threadId);
    res.json(result);
  } catch (error) {
    console.error("Error getting thread messages:", error);
    res.status(500).json({ error: "Failed to get thread messages" });
  }
}

export async function postMessage(req: Request, res: Response) {
  try {
    const { message, model, maxTokens, instructions, thinking } =
      inferenceSchema.parse(req.body);
    const { threadId } = req.params;

    await threadsOps.postMessageAndStartInference(
      req.dbUser!.id,
      threadId,
      message,
      model,
      maxTokens,
      instructions,
      req.workspace,
      thinking
    );

    res.json({
      success: true,
      message: "Message posted and inference started",
    });
  } catch (error) {
    console.error("Error posting message:", error);
    res.status(500).json({ error: "Failed to post message" });
  }
}

export async function streamMessages(req: Request, res: Response) {
  try {
    console.log("Streaming messages for thread:", req.params.threadId);
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
}

export async function deleteThread(req: Request, res: Response) {
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
}

export async function cloneThread(req: Request, res: Response) {
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
}

export async function stopInference(req: Request, res: Response) {
  try {
    const result = await threadsOps.stopInference(req.params.threadId);
    res.json(result);
  } catch (error) {
    console.error("Error stopping inference:", error);
    res.status(500).json({ error: "Failed to stop inference" });
  }
}

export async function retryMessage(req: Request, res: Response) {
  try {
    const { model, maxTokens, instructions, thinking } =
      retryMessageSchema.parse(req.body);
    const { threadId, messageId } = req.params;

    const result = await threadsOps.retryMessage(
      req.dbUser!.id,
      threadId,
      messageId,
      model,
      maxTokens,
      instructions,
      req.workspace,
      thinking
    );
    res.json(result);
  } catch (error) {
    console.error("Error retrying message:", error);
    res.status(500).json({ error: "Failed to retry message" });
  }
}
