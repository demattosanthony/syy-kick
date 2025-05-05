/** Zod */
import { z } from "zod";

export const WorkflowRequestBodySchema = z.object({
    title: z.string(),
    description: z.string(),
    attachments: z.record(z.object({
        fileKey: z.string(),
        filename: z.string(),
        mimeType: z.string(),
    })),
    steps: z.array(z.object({
        title: z.string(),
        details: z.string(),
        inputs: z.array(z.string()),
        dependsOn: z.array(z.string()),
        outputDescription: z.string()
    })),
    notes: z.string().optional()
});

export type WorkflowRequestBody = z.infer<typeof WorkflowRequestBodySchema>;

export type WorkflowRequestFile = {
    fileKey: string;
    mimeType: string;
    filename: string;
    url?: string;
  };
  