import { Request, Response } from "express";
import { documentsOps } from "./documents.ops";
import { documentsSchemas } from "./documents.schemas";

export const handlers = {
  /**
   * Get file metadata + content. If it's an LFS pointer, return a presigned S3 URL.
   * Otherwise, return the actual file (text or base64).
   */
  getDocument: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!projectId) {
      res.status(400).json({ error: "Project ID is required" });
      return;
    }

    const { path } = req.query;

    const file = await documentsOps.getDocContent(
      projectId,
      decodeURIComponent(path as string)
    );
    res.json(file);
  },

  documentsUpload: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!projectId) {
      res.status(400).json({ error: "Project ID is required" });
      return;
    }

    const validatedData = documentsSchemas.docsUpload.parse(req.body);

    // Sort so folders are created before files; if two folders, shorter path first
    const sortedEntries = [...validatedData.entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.path.length - b.path.length;
    });

    await documentsOps.createFolderStructure(projectId, {
      entries: sortedEntries,
      basePath: validatedData.basePath,
    });

    res.json({ success: true });
  },

  getDocuments: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { path } = req.query;

      if (!projectId) {
        res.status(400).json({ error: "Project ID is required" });
        return;
      }

      const files = await documentsOps.getProjectDocs(
        projectId,
        path as string
      );
      res.json(files);
    } catch (error) {
      console.error("Error getting project files:", error);
      res.status(500).json({ error: "Failed to get project files" });
      return;
    }
  },

  deleteContents: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    if (!projectId) {
      res.status(400).json({ error: "Project ID is required" });
      return;
    }

    const { path } = req.query;
    await documentsOps.deleteProjectContent(
      projectId,
      decodeURIComponent(path as string)
    );
    res.json({ success: true });
  },
};
