import { Request, Response } from "express";
import { messagesOps } from "./messages.ops";
import messagesSchemas from "./messages.schemas";

const messagesHandlers = {
  async getThreadMessages(req: Request, res: Response) {
    try {
      const result = await messagesOps.getMessages(req.params.threadId);
      res.json(result);
    } catch (error) {
      console.error("Error getting thread messages:", error);
      res.status(500).json({ error: "Failed to get thread messages" });
    }
  },

  async postMessage(req: Request, res: Response) {
    try {
      const { message, model, maxTokens, instructions } =
        messagesSchemas.postMessage.parse(req.body);
      const { threadId } = req.params;

      await messagesOps.postMessageAndStartInference(
        req.dbUser!.id,
        threadId,
        message,
        model,
        maxTokens,
        instructions,
        req.workspace
      );

      res.json({
        success: true,
        message: "Message posted and inference started",
      });
    } catch (error) {
      console.error("Error posting message:", error);
      res.status(500).json({ error: "Failed to post message" });
    }
  },

  async retryMessage(req: Request, res: Response) {
    try {
      const { model, maxTokens, instructions } =
        messagesSchemas.retryMessage.parse(req.body);
      const { threadId, messageId } = req.params;

      const result = await messagesOps.retryMessage(
        req.dbUser!.id,
        threadId,
        messageId,
        model,
        maxTokens,
        instructions,
        req.workspace
      );
      res.json(result);
    } catch (error) {
      console.error("Error retrying message:", error);
      res.status(500).json({ error: "Failed to retry message" });
    }
  },
};

export default messagesHandlers;
