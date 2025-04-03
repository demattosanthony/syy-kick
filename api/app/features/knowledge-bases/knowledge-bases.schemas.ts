import { z } from "zod";

export const schemas = {
  createKnowledgeBase: z
    .object({
      name: z.string().min(1).max(255),
      description: z.string().max(255).optional(),
      organizationId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
    })
    .refine((data) => data.organizationId || data.userId, {
      message: "Either organizationId or userId must be provided",
    }),

  updateKnowledgeBase: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(255).optional(),
  }),

  docsUpload: z.object({
    entries: z.array(
      z.object({
        path: z.string(),
        type: z.enum(["file", "folder"]),
        fileKey: z.string().optional(),
        size: z.number().optional(),
        mimeType: z.string().optional(),
        sha256: z.string().optional(),
      })
    ),
    basePath: z.string().optional(),
  }),
};
