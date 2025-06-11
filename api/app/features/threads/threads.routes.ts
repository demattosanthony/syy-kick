import { Router } from "express";
import messagesRouter from "./messages/messages.routes";
import { threadsHandlers } from "./threads.handlers";

const router = Router();

router.post("/", threadsHandlers.createThread);
router.get("/", threadsHandlers.getThreads);

router.get("/:threadId", threadsHandlers.getThread);
router.put("/:threadId", threadsHandlers.updateThread);
router.delete("/:threadId", threadsHandlers.deleteThread);

router.get("/:threadId/stream", threadsHandlers.streamMessages);
router.post("/:threadId/clone", threadsHandlers.cloneThread);
router.post("/:threadId/stop", threadsHandlers.stopInference);

router.use("/:threadId/messages", messagesRouter);

export default router;
