/** Express */
import { Request, Response } from "express";

/** Ops */
import { workflowRunCommentsOps } from "./comments.ops";

export const workflowRunCommentsHandlers = {
  createComment: async (req: Request, res: Response) => {
    try {
      const { workflowRunId } = req.params;
      const { comment } = req.body;
      const user = req.dbUser;

      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const newComment = await workflowRunCommentsOps.createComment(
        workflowRunId,
        user.id,
        comment
      );

      res.json(newComment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  },

  updateComment: async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const { comment } = req.body;
      
      const user = req.dbUser;

      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const updatedComment = await workflowRunCommentsOps.updateComment(
        commentId,
        user.id,
        comment
      );

      if (!updatedComment) {
        res.status(404).json({ error: "Comment not found or unauthorized" });
        return;
      }

      res.json(updatedComment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  },

  deleteComment: async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      
      const user = req.dbUser;

      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const deletedComment = await workflowRunCommentsOps.deleteComment(
        commentId,
        user.id
      );

      if (!deletedComment) {
        res.status(404).json({ error: "Comment not found or unauthorized" });
        return;
      }

      res.json(deletedComment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  },

  getComments: async (req: Request, res: Response) => {
    try {
      const { workflowRunId } = req.params;
      const organizationId = req.workspace?.type === "organization" ? req.workspace.id : undefined;

      if (!organizationId) {
        res.json([]);
        return;
      }

      const comments = await workflowRunCommentsOps.getComments(
        workflowRunId,
        organizationId
      );

      res.json(comments);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get comments" });
    }
  },
};
