/** Express */
import { Router } from "express";

/** Handlers */
import { handlers } from "./agents.handlers";

export default Router({ mergeParams: true })
    .get("", handlers.list)