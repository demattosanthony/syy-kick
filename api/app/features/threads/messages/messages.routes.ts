import { Router } from "express";
import { messagesHandlers } from "./messages.handlers";

const router = Router({ mergeParams: true });

router.get("/", messagesHandlers.getThreadMessages);
router.post("/", messagesHandlers.postMessage);
router.post("/:messageId/retry", messagesHandlers.retryMessage);

export default router;
