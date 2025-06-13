import { Router } from "express";
import messagesHandlers from "./messages.handlers";

const messagesRouter = Router({ mergeParams: true })
  .get("/", messagesHandlers.getThreadMessages)
  .post("/", messagesHandlers.postMessage)
  .post("/:messageId/retry", messagesHandlers.retryMessage);

export default messagesRouter;
