import { z } from "zod";
import type { WorkflowExecutionInputValues } from "../../../types.ts";

export const windowAndDoorScheduleInputSchema: z.ZodType<WorkflowExecutionInputValues> =
  z.object({
    architecturalPdf: z.object({
      type: z.literal("file"),
      label: z.literal("Architectural PDF"),
      value: z.object({
        fileKey: z.string(),
        mimeType: z.literal("application/pdf"),
        fileName: z.string(),
      }),
    }),
  });

export const windowAndDoorScheduleOutputSchema = z.object({
  windowAndDoorScheduleCsvFile: z.object({
    type: z.literal("file"),
    file: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
      url: z.string().optional(),
    }),
  }),
});
