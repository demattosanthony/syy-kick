import { Request, Response } from "express";
import fileSchemas from "./files.schemas";
import { filesOps } from "./files.ops";
import logger from "../../config/logger";

export const filesHandlers = {
  async getFiles(req: Request, res: Response): Promise<void> {
    try {
      // Get user ID from the authenticated request
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Validate query parameters
      const queryValidation = fileSchemas.getFilesQuery.safeParse(req.query);
      if (!queryValidation.success) {
        res.status(400).json({
          error: "Invalid query parameters",
          details: queryValidation.error.errors,
        });
        return;
      }

      const query = queryValidation.data;

      // Get files for the user
      const result = await filesOps.getFilesForUser(userId, query);

      res.json(result);
    } catch (error) {
      logger.error("Error fetching files", { error, userId: req.dbUser?.id });
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async createFile(req: Request, res: Response): Promise<void> {
    try {
      // Get user ID from the authenticated request
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { fileName, mimeType, size, fileKey } = req.body;

      // Validate required fields
      if (!fileName || !mimeType || !size || !fileKey) {
        res.status(400).json({
          error: "Missing required fields: fileName, mimeType, size, fileKey",
        });
        return;
      }

      // Create file record and start processing
      const result = await filesOps.createFileRecordAndProcess(userId, {
        fileName,
        mimeType,
        size,
        fileKey,
      });

      res.json(result);
    } catch (error) {
      logger.error("Error creating file record", {
        error,
        userId: req.dbUser?.id,
      });

      if (error instanceof Error) {
        // Handle specific error types
        if (error.message === "FILE_ALREADY_EXISTS") {
          res.status(409).json({ error: "File already exists" });
          return;
        }
        if (error.message.includes("File not found in S3")) {
          res.status(404).json({ error: "File not found in S3" });
          return;
        }
      }

      res.status(500).json({ error: "Failed to create file record" });
    }
  },

  async getPresignedUrl(req: Request, res: Response): Promise<void> {
    try {
      // Get user ID from the authenticated request
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Validate request body
      const bodyValidation = fileSchemas.presignedUrlRequest.safeParse(
        req.body
      );
      if (!bodyValidation.success) {
        res.status(400).json({
          error: "Invalid request body",
          details: bodyValidation.error.errors,
        });
        return;
      }

      const { fileName, mimeType, size, featureType, organizationFeature } =
        bodyValidation.data;

      // Determine path configuration based on request
      let pathConfig;
      if (organizationFeature) {
        // Organization feature (e.g., avatars)
        pathConfig = {
          type: "organization" as const,
          feature: organizationFeature,
        };
      } else {
        // User feature (threads, workflows) - we know featureType exists due to schema validation
        pathConfig = {
          type: "user" as const,
          userId,
          featureType: featureType!,
        };
      }

      // Generate presigned URL
      const result = await filesOps.generatePresignedUrl(
        fileName,
        mimeType,
        size,
        pathConfig
      );

      res.json(result);
    } catch (error) {
      logger.error("Error generating presigned URL", {
        error,
        userId: req.dbUser?.id,
      });
      res.status(500).json({ error: "Failed to generate presigned URL" });
    }
  },
};
