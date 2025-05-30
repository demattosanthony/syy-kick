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
    const { knowledgeBaseId, workflowId } = createThreadSchema.parse(req.body);
    const orgId = getOrgIdOrUnedfined(req.workspace);
    return threadsOps.createThread(
      req.dbUser!.id,
      orgId,
      knowledgeBaseId,
      workflowId
    );
  })
);

// Get threads (with optional search, pagination, org)
router.get(
  "/",
  handle(async (req) => {
    const { page, pageSize, search, knowledgeBaseId, workflowId } =
      getThreadsSchema.parse(req.query);
    const orgId = getOrgIdOrUnedfined(req.workspace);
    return threadsOps.listThreads(
      req.dbUser!.id,
      parseInt(page || "1", 10),
      parseInt(pageSize || "10", 10),
      (search || "").trim(),
      orgId,
      knowledgeBaseId,
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

// Inference (SSE)
router.post("/:threadId/inference", async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    await inferenceSchema.parseAsync(req.body);
    return threadsOps.inference(req, res);
  } catch (error: any) {
    console.error("Error in inference endpoint:", error);
    res.status(500).json({
      error: "An error occurred during inference",
      details: error.message,
    });
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

export default router;
