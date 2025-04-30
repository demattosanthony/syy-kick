/** Express */
import { Router } from "express";

/** Handlers */
import workflowHandlers from "./workflows.handlers";

/** Routers */
import agentsRouter from "./features/agents/agents.routes";

const router = Router();

// Workflow routes
router.get("", workflowHandlers.getAll);

// Workflow Agents
router.use("/agents", agentsRouter);

router.get("/:id", workflowHandlers.getById);

// Run workflow
router.post("/:workflowId/run", workflowHandlers.run);

export default router;
