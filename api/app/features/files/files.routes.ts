import { Router } from "express";
import { filesHandlers } from "./files.handlers";

const router = Router();

router.get("/", filesHandlers.getFiles);
router.post("/", filesHandlers.createFile);
router.post("/presigned-url", filesHandlers.getPresignedUrl);

export default router;
