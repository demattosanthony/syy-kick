// External dependencies
import { Request, Response, Router } from "express";

// Internal utilities
import { getOrgIdOrUnedfined, handle } from "../../utils";

// Thread-specific imports
import threadsOps from "./threads.ops";
import {
  createThreadSchema,
  getThreadsSchema,
  inferenceSchema,
  updateThreadSchema,
} from "./threads.schemas";

const router = Router();

router.post(
  "/",
  handle(async (req) => {
    const { workflowId } = createThreadSchema.parse(req.body);
    const orgId = getOrgIdOrUnedfined(req.workspace);
    return threadsOps.createThread(req.dbUser!.id, orgId, workflowId);
  })
);

// Get threads (with optional search, pagination, org)
router.get(
  "/",
  handle(async (req) => {
    const { page, pageSize, search, workflowId } = getThreadsSchema.parse(
      req.query
    );
    const orgId = getOrgIdOrUnedfined(req.workspace);
    return threadsOps.listThreads(
      req.dbUser!.id,
      parseInt(page || "1", 10),
      parseInt(pageSize || "10", 10),
      (search || "").trim(),
      orgId,
      workflowId
    );
  })
);

// Get single thread
router.get(
  "/:threadId",
  handle(async (req) => {
    return threadsOps.getThread(req.params.threadId);
  })
);

// Update thread
router.put(
  "/:threadId",
  handle(async (req) => {
    const { title, isPublic } = updateThreadSchema.parse(req.body);
    return threadsOps.updateThread(req.params.threadId, req.dbUser!.id, {
      isPublic,
      title,
    });
  })
);

// Get thread messages
router.get(
  "/:threadId/messages",
  handle(async (req) => {
    return threadsOps.getThreadMessages(req.params.threadId);
  })
);

// Post a new message and trigger inference
router.post(
  "/:threadId/messages",
  handle(async (req) => {
    const { message, model, maxTokens, instructions, thinking } =
      inferenceSchema.parse(req.body);
    const { threadId } = req.params;

    // Store the user message and start inference asynchronously
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

    return { success: true, message: "Message posted and inference started" };
  })
);

// Stream new messages for a thread (SSE)
router.get("/:threadId/stream", async (req: Request, res: Response) => {
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
});

// Delete thread
router.delete(
  "/:threadId",
  handle(async (req) => {
    const orgId = getOrgIdOrUnedfined(req.workspace);
    return threadsOps.deleteThread(req.dbUser!.id, req.params.threadId, orgId);
  })
);

// Clone a thread
router.post(
  "/:threadId/clone",
  handle(async (req) => {
    return threadsOps.cloneThread(req.dbUser!.id, req.params.threadId);
  })
);

// Stop inference for a thread
router.post(
  "/:threadId/stop",
  handle(async (req) => {
    return threadsOps.stopInference(req.params.threadId);
  })
);

export default router;
