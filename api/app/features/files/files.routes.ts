import { Router } from "express";
import {
  getFilesHandler,
  getPresignedUrlHandler,
  createFileRecordHandler,
} from "./files.handlers";

const router = Router();

// GET /files - Get paginated list of files for the authenticated user
router.get("/", getFilesHandler);

// POST /files/presigned-url - Generate presigned URL for S3 upload
router.post("/presigned-url", getPresignedUrlHandler);

// POST /files/create - Create file record and start processing after S3 upload
router.post("/", createFileRecordHandler);

export default router;
