import { z } from "zod";
import { WORKFLOW_NODE_TYPES } from "../../config/schema";

const inputNodeConfigSchema = z.object({
  fields: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(["text", "file"]),
        required: z.boolean().optional().default(false),
        options: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
            })
          )
          .optional(),
        accept: z.string().optional(),
        multiple: z.boolean().optional(),
        maxFileSize: z.number().optional(),
      })
    )
    .optional(),
});

const llmAgentConfigSchema = z.object({
  prompt: z.string().optional(),
  system: z.string().optional(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

const workflowSchemas = {
  create: z.object({
    name: z.string(),
  }),

  update: z.object({
    name: z.string(),
  }),

  node: {
    create: z.object({
      type: z.enum(WORKFLOW_NODE_TYPES),
      positionX: z.number().optional(),
      positionY: z.number().optional(),
      config: z.union([inputNodeConfigSchema, llmAgentConfigSchema]).optional(),
    }),

    update: z.object({
      type: z.enum(WORKFLOW_NODE_TYPES).optional(),
      positionX: z.number().optional(),
      positionY: z.number().optional(),
      config: z.union([inputNodeConfigSchema, llmAgentConfigSchema]).optional(),
    }),
  },

  edge: {
    create: z.object({
      sourceNodeId: z.string().uuid(),
      targetNodeId: z.string().uuid(),
    }),
  },
};

export default workflowSchemas;
