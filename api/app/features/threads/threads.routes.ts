// External dependencies
import { Request, Response, Router } from "express";

// Internal utilities
import { handle } from "../../utils";

// Thread-specific imports
import threadsOps from "./threads.ops";
import {
  createThreadSchema,
  getThreadsSchema,
  inferenceSchema,
} from "./threads.schemas";

const router = Router();

router.post(
  "/",
  handle(async (req) => {
    const { organizationId, projectId } = createThreadSchema.parse(req.body);
    return threadsOps.createThread(req.dbUser!.id, organizationId, projectId);
  })
);

// Get threads (with optional search, pagination, org)
router.get(
  "/",
  handle(async (req) => {
    const { page, search, organizationId } = getThreadsSchema.parse(req.query);
    return threadsOps.listThreads(
      req.dbUser!.id,
      parseInt(page || "1", 10),
      (search || "").trim(),
      organizationId
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
    const organizationId = req.query.organizationId as string | undefined;
    return threadsOps.deleteThread(
      req.dbUser!.id,
      req.params.threadId,
      organizationId
    );
  })
);

export default router;
