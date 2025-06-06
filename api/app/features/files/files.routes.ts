import { Router } from "express";
import { auth } from "../../middleware";
import { getFilesHandler } from "./files.handlers";

const router = Router();

// GET /files - Get paginated list of files for the authenticated user
router.get("/", getFilesHandler);

export default router;
