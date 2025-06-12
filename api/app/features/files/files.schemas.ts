import { z } from "zod";

// File type from database
export const FileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().nullable(),
  type: z.enum(["file", "folder"]),
  fileHash: z.string().nullable(),
  syyclops_path: z.string().nullable(),
  sharepoint_path: z.string().nullable(),
  google_drive_path: z.string().nullable(),
  file_origin_type: z.enum(["syyclops", "sharepoint", "google_drive"]),
  category: z.enum(["drawing", "document"]).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string().optional(), // Presigned URL for file access
});

// Query parameters for listing files
export const GetFilesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().min(1).optional(),
  type: z.enum(["file", "folder"]).optional(),
  category: z.enum(["drawing", "document"]).optional(),
  file_origin_type: z
    .enum(["syyclops", "sharepoint", "google_drive"])
    .optional(),
});

// Schema for presigned URL requests
export const PresignedUrlRequestSchema = z
  .object({
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number(),
    featureType: z.enum(["threads", "workflows"]).optional(),
    organizationFeature: z.enum(["avatars"]).optional(),
  })
  .refine(
    (data) => {
      // Either featureType or organizationFeature must be provided, but not both
      return (
        (data.featureType && !data.organizationFeature) ||
        (!data.featureType && data.organizationFeature)
      );
    },
    {
      message:
        "Either featureType or organizationFeature must be provided, but not both",
    }
  );

// Response type for paginated files
export const PaginatedFilesSchema = z.object({
  files: z.array(FileSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

export type File = z.infer<typeof FileSchema>;
export type GetFilesQuery = z.infer<typeof GetFilesQuerySchema>;
export type PaginatedFiles = z.infer<typeof PaginatedFilesSchema>;
export type PresignedUrlRequest = z.infer<typeof PresignedUrlRequestSchema>;

// Generic file operation types
export type FileContext =
  | { type: "user"; userId: string }
  | { type: "thread"; threadId: string }
  | { type: "fileIds"; fileIds: string[] };

export type GetFilesOptions = {
  context: FileContext;
  query?: GetFilesQuery;
  includePresignedUrls?: boolean;
};
