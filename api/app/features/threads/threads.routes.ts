import { Router } from "express";
import * as threadsHandlers from "./threads.handlers";

const router = Router();

router.post("/", threadsHandlers.createThread);
router.get("/", threadsHandlers.getThreads);

router.get("/:threadId", threadsHandlers.getThread);
router.put("/:threadId", threadsHandlers.updateThread);
router.delete("/:threadId", threadsHandlers.deleteThread);

router.get("/:threadId/stream", threadsHandlers.streamMessages);
router.post("/:threadId/clone", threadsHandlers.cloneThread);
router.post("/:threadId/stop", threadsHandlers.stopInference);

router.get("/:threadId/messages", threadsHandlers.getThreadMessages);
router.post("/:threadId/messages", threadsHandlers.postMessage);
router.post(
  "/:threadId/messages/:messageId/retry",
  threadsHandlers.retryMessage
);

export default router;
