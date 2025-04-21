import { Router } from "express";
import { siteHandlers as handlers } from "./sites.handlers";

export default Router()
  .get("", handlers.list)
  .get(
    "/:id",
    handlers.get
  );
