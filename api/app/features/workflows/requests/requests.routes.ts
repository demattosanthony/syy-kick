/** Express */
import { Router } from "express";

/** Handlers */
import { requestsHandlers } from "./requests.handlers";

const router = Router();

router.post("/", requestsHandlers.create);

export default router;