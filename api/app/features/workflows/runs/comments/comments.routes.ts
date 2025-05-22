/** Express */
import { Router } from "express";

/** Handlers */
import { workflowRunCommentsHandlers } from "./comments.handlers";

const router = Router({ mergeParams: true });

router.post(
  "",
  workflowRunCommentsHandlers.createComment
);

router.put(
  "/:commentId",
  workflowRunCommentsHandlers.updateComment
);

router.delete(
  "/:commentId",
  workflowRunCommentsHandlers.deleteComment
);

router.get(
  "",
  workflowRunCommentsHandlers.getComments
);

export default router;
