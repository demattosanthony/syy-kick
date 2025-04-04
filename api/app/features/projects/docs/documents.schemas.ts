import { z } from "zod";

export const documentsSchemas = {
  docsUpload: z.object({
    entries: z.array(
      z.object({
        path: z.string(),
        type: z.enum(["file", "folder"]),
        // File-specific fields
        fileKey: z.string().optional(),
        size: z.number().optional(),
        mimeType: z.string().optional(),
        sha256: z.string().optional(),
      })
    ),
    basePath: z.string(),
    organizationId: z.string().optional(),
  }),
};
