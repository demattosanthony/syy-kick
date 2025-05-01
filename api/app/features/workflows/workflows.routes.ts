/** Express */
import { Router } from "express";

/** Handlers */
import workflowHandlers from "./workflows.handlers";

/** Routers */
import agentsRouter from "./features/agents/agents.routes";
import runsRouter from "./runs/runs.routes";

export default Router()
  .get("", workflowHandlers.getAll)
  .post("/", workflowHandlers.create)
  .use("/agents", agentsRouter)
  .get("/:id", workflowHandlers.getById)
  .put("/:id", workflowHandlers.update)
  .use("/:workflowId/runs", runsRouter);
