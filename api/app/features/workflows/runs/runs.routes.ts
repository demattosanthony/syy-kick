import { Router } from "express";
import { workflowsRunsHandlers } from "./runs.handlers";

const router = Router({ mergeParams: true });

router.post("", workflowsRunsHandlers.createRun);
router.get("", workflowsRunsHandlers.getRuns);
router.get("/:workflowRunId", workflowsRunsHandlers.getRun);
router.post("/:workflowRunId", workflowsRunsHandlers.run);
router.get("/:workflowRunId/events", workflowsRunsHandlers.getRunEvents);

export default router;
