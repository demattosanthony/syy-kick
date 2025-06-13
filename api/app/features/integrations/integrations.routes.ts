import { Router } from "express";
import integrationsHandlers from "./integrations.handlers";

const integrationsRouter = Router({ mergeParams: true })
  .get("/", integrationsHandlers.getTokens)
  .get("/:provider/token", integrationsHandlers.getToken)
  .delete("/:provider", integrationsHandlers.deleteIntegration);

export default integrationsRouter;
