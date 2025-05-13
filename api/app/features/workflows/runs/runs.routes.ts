import { Router } from "express";
import { workflowsRunsHandlers } from "./runs.handlers";

const router = Router({ mergeParams: true });

router.post("", workflowsRunsHandlers.createRun);
router.get("", workflowsRunsHandlers.getRuns);
router.get("/:workflowRunId/events", workflowsRunsHandlers.getRunEvents);
router.get("/:workflowRunId", workflowsRunsHandlers.getRun);
// router.get("/:workflowRunId/watch", workflowsRunsHandlers.watchRun);
// router.post("/:workflowRunId", workflowsRunsHandlers.run);

export default router;
