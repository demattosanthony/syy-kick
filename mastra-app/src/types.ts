import { z } from "zod";

export type WorkflowFile = {
  fileKey: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
  url?: string;
};

export type WorkflowRunStepOutput = {
  type: "text" | "file" | "number";
  text?: string;
  file?: WorkflowFile;
  number?: number;
};

export type WorkflowTextExecutionInputValue = {
  text: string;
};

export type WorkflowFileExecutionInputValue = WorkflowFile;

export type WorkflowNumberExecutionInputValue = {
  number: number;
};

export type WorkflowExecutionInputValue = {
  type: "text" | "file" | "number";
  label: string;
  value:
    | WorkflowTextExecutionInputValue
    | WorkflowFileExecutionInputValue
    | WorkflowNumberExecutionInputValue;
};

export type WorkflowExecutionInputValues = {
  [inputId: string]: WorkflowExecutionInputValue;
};

export const WorkflowFileSchema = z.object({
  fileKey: z.string(),
  mimeType: z.string(),
  fileName: z.string(),
  fileSize: z.number().optional(),
  url: z.string().optional(),
});

export const WorkflowRunStepOutputSchema = z
  .object({
    type: z.enum(["text", "file", "number"]),
    text: z.string().optional(),
    file: WorkflowFileSchema.optional(),
    number: z.number().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "text")
        return (
          typeof data.text === "string" &&
          data.file === undefined &&
          data.number === undefined
        );
      if (data.type === "file")
        return (
          WorkflowFileSchema.safeParse(data.file).success &&
          data.text === undefined &&
          data.number === undefined
        );
      if (data.type === "number")
        return (
          typeof data.number === "number" &&
          data.text === undefined &&
          data.file === undefined
        );
      return false;
    },
    {
      message:
        "Only the value field corresponding to the 'type' should be present and valid",
    }
  );
