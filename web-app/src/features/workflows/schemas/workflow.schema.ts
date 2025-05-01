import { z } from "zod";

const formFieldSchema = z.object({
  type: z.enum(["text", "number", "date", "file", "select"]),
  label: z.string().min(1, "Label is required"),
  description: z.string().optional(),
  required: z.boolean().default(false),
  referenceType: z.enum(["userInput", "previousStep"]).default("userInput"),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    )
    .optional(),
});

const formSchema = z.object({
  fields: z.record(formFieldSchema),
});

export const stepSchema = z
  .object({
    id: z.string(),
    agentId: z.string().nullable().optional(),
    name: z.string().min(1, "Name is required").optional(),
    description: z.string().optional(),
    instructions: z.string().min(1, "Instructions are required").optional(),
    model: z.string().min(1, "Model is required").optional(),
    activeTools: z.array(z.string()).optional(),
    formSchema: formSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.agentId) {
        return !!(data.name && data.instructions && data.model);
      }
      return true;
    },
    {
      message:
        "Name, Instructions and Model are required when no agent is selected",
    }
  );

export const workflowBuilderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  workflowSteps: z.array(stepSchema).min(1, "At least one step is required"),
});

export type WorkflowBuilderSchema = z.infer<typeof workflowBuilderSchema>;
