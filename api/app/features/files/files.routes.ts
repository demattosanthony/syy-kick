import { Router } from "express";
import {
  getFilesHandler,
  getPresignedUrlHandler,
  createFileRecordHandler,
} from "./files.handlers";

const router = Router();

router.get("/", getFilesHandler);
router.post("/presigned-url", getPresignedUrlHandler);
router.post("/", createFileRecordHandler);

export default router;
