import { Router } from "express";
import workflowHandlers from "./workflows.handlers";

const router = Router();

// Workflow routes
router.get("", workflowHandlers.getAll);
router.get("/:id", workflowHandlers.getById);

// Run workflow
router.post("/:workflowId/run", workflowHandlers.run);

export default router;
