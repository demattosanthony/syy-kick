import { Request, Response } from "express";
import { GetFilesQuerySchema } from "./files.schemas";
import { getFilesForUser } from "./files.ops";
import logger from "../../config/logger";

export async function getFilesHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Get user ID from the authenticated request
    const userId = req.dbUser?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate query parameters
    const queryValidation = GetFilesQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: queryValidation.error.errors,
      });
      return;
    }

    const query = queryValidation.data;

    // Get files for the user
    const result = await getFilesForUser(userId, query);

    res.json(result);
  } catch (error) {
    logger.error("Error fetching files", { error, userId: req.dbUser?.id });
    res.status(500).json({ error: "Internal server error" });
  }
}
