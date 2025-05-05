/** Express */
import { Router } from "express";

/** Handlers */
import workflowHandlers from "./workflows.handlers";

/** Routers */
import agentsRouter from "./agents/agents.routes";
import runsRouter from "./runs/runs.routes";

export default Router()
  .get("", workflowHandlers.getAll)
  .post("/", workflowHandlers.create)
  .use("/agents", agentsRouter)
  .get("/:id", workflowHandlers.getById)
  .put("/:id", workflowHandlers.update)
  .delete("/:id", workflowHandlers.delete)
  .use("/:workflowId/runs", runsRouter);
