import { z } from "zod";

const messagesSchemas = {
  retryMessage: z.object({
    model: z.string(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    instructions: z.string().optional(),
  }),

  postMessage: z.object({
    model: z.string(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    instructions: z.string().optional(),
    workflowId: z.string().optional(),
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
  }),
};

export default messagesSchemas;
