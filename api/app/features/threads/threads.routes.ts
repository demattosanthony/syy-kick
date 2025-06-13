import { Router } from "express";
import threadsHandlers from "./threads.handlers";
import messagesRouter from "./messages/messages.routes";

const threadsRouter = Router({ mergeParams: true })
  .get("/", threadsHandlers.getThreads)
  .post("/", threadsHandlers.createThread)
  .get("/:threadId", threadsHandlers.getThread)
  .put("/:threadId", threadsHandlers.updateThread)
  .delete("/:threadId", threadsHandlers.deleteThread)
  .get("/:threadId/stream", threadsHandlers.streamMessages)
  .post("/:threadId/clone", threadsHandlers.cloneThread)
  .post("/:threadId/stop", threadsHandlers.stopInference)
  .use("/:threadId/messages", messagesRouter);

export default threadsRouter;
