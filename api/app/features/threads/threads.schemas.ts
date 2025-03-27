import { z } from "zod";

const createThreadSchema = z.object({
  projectId: z.string().optional(),
  knowledgeBaseId: z.string().optional(),
});

const getThreadsSchema = z.object({
  page: z.string().optional(),
  search: z.string().optional(),
  projectId: z.string().optional(),
  knowledgeBaseId: z.string().optional(),
});

const updateThreadSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const inferenceSchema = z.object({
  model: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  instructions: z.string().optional(),
  proejctId: z.string().optional(), // preserving original name
  // We'll also allow message data in here
  message: z.object({
    id: z.string().optional(),
    role: z.enum(["system", "user", "assistant", "tool"]).optional(),
    content: z.string().optional(),
    experimental_attachments: z
      .array(
        z.object({
          name: z.string().optional(),
          file_key: z.string(),
          contentType: z.string().optional(),
          url: z.any().optional(),
        })
      )
      .optional(),
  }),
});

export {
  createThreadSchema,
  getThreadsSchema,
  inferenceSchema,
  updateThreadSchema,
};
