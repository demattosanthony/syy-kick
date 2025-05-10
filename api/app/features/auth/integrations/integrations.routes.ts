import { Router } from "express";
import { integrationsHandlers } from "./integrations.handlers";

const router = Router();

router.get("/:provider/token", integrationsHandlers.getToken);
router.delete("/:provider", integrationsHandlers.deleteIntegration);

export default router;