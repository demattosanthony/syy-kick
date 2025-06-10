import { z } from "zod";

const getThreadsSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().optional(),
});

const updateThreadSchema = z.object({
  title: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const inferenceSchema = z.object({
  model: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  instructions: z.string().optional(),
  workflowId: z.string().optional(),
  thinking: z.boolean().optional(),
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

const retryMessageSchema = z.object({
  model: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  instructions: z.string().optional(),
  thinking: z.boolean().optional(),
});

export {
  createThreadSchema,
  getThreadsSchema,
  inferenceSchema,
  retryMessageSchema,
  updateThreadSchema,
};
