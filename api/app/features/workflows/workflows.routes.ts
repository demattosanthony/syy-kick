import { Router } from "express";
import workflowHandlers from "./workflows.handlers";

const router = Router();

// Workflow routes
router.post("", workflowHandlers.create);
router.get("/:id", workflowHandlers.getById);
router.put("/:id", workflowHandlers.update);
router.delete("/:id", workflowHandlers.delete);

// Node routes
router.post("/:id/nodes", workflowHandlers.nodes.create);
router.put("/:workflowId/nodes/:nodeId", workflowHandlers.nodes.update);
router.delete("/:workflowId/nodes/:nodeId", workflowHandlers.nodes.delete);

// Edge routes
router.post("/:id/edges", workflowHandlers.edges.create);
router.delete("/:workflowId/edges/:edgeId", workflowHandlers.edges.delete);

// Run workflow
router.post("/run", workflowHandlers.run);

export default router;
