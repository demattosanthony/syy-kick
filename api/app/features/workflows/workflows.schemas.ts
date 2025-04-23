import { z } from "zod";

// --- Basic Data Types ---
export const FileDataSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  url: z.string(), // base64 data or presigned URL
});
export type FileData = z.infer<typeof FileDataSchema>;

// --- Workflow Configuration ---
export const WorkflowInputConfigSchema = z.object({
  id: z.string(),
  type: z.enum(["file", "text"]),
  title: z.string(),
  description: z.string(),
  required: z.boolean(),
  acceptedFileTypes: z.string().optional(),
  options: z.array(z.string()).optional(),
});
export type WorkflowInputConfig = z.infer<typeof WorkflowInputConfigSchema>;

export const WorkflowOutputConfigSchema = z.object({
  type: z.enum(["text/csv", "text/markdown", "json", "file", "text"]),
  title: z.string(),
  description: z.string(),
  outputKey: z.string(),
});
export type WorkflowOutputConfig = z.infer<typeof WorkflowOutputConfigSchema>;

// Base Schema for common fields
const BaseStepSchema = z.object({
  id: z.string().min(1),
  processingMessage: z.string(),
  processedMessage: z.string(),
  description: z.string().optional(),
  inputMapping: z
    .record(z.string())
    .optional()
    .describe(
      "Maps step's input keys (key) to data sources (value), e.g., 'workflowInput.fileId' or 'previousStepId.output.dataKey'"
    ),
});

// Schema for LLM Steps
export const LLMStepSchema = BaseStepSchema.extend({
  type: z.literal("llm"),
  config: z.object({
    modelName: z.string().optional(),
    systemMessage: z.string().optional(),
    promptTemplate: z.string().min(1),
    // We store the Zod schema definition itself for runtime use.
    // For pure validation *of the config*, we just check it's a Zod schema.
    // If you were loading from JSON, you might store a schema definition string/object instead.
    outputSchema: z
      .instanceof(z.ZodType)
      .describe("Zod schema instance for the expected JSON output"),
  }),
});
export type LLMStepConfig = z.infer<typeof LLMStepSchema>;

// Schema for Built-in PDF Page Extraction Steps
export const PdfPageExtractStepSchema = BaseStepSchema.extend({
  type: z.literal("pdf_page_extract"),
  config: z.object({
    pdfDataSource: z
      .string()
      .min(1)
      .describe("Path to the FileData object (e.g., 'workflowInput.rfpDoc')"),
    pageNumbersSource: z
      .string()
      .min(1)
      .describe(
        "Path to the page numbers (e.g., 'find-page-step.output.pageNumbers')"
      ),
    scale: z.number().positive().optional(),
  }),
  // Note: The implicit output schema { imageBase64: string, pageNumber: number }
  // isn't part of the *configuration* schema but is known by the executor.
});
export type PdfPageExtractStepConfig = z.infer<typeof PdfPageExtractStepSchema>;

// Schema for Built-in Object Detection Steps. Take in a image and outputs images detected from bounding boxes
export const ObjectDetectionStepSchema = BaseStepSchema.extend({
  type: z.literal("object_detection"),
  config: z.object({
    imageDataSource: z
      .string()
      .min(1)
      .describe("Path to the FileData object (e.g., 'workflowInput.image')"),
    model: z.string().min(1),
    promptTemplate: z.string().min(1),
    outputSchema: z
      .instanceof(z.ZodType)
      .describe("Zod schema instance for the expected JSON output"),
  }),
});
export type ObjectDetectionStepConfig = z.infer<
  typeof ObjectDetectionStepSchema
>;

export const DocumentOCRStepSchema = BaseStepSchema.extend({
  type: z.literal("document_ocr"),
  config: z.object({
    documentDataSource: z
      .string()
      .min(1)
      .describe("Path to the FileData object (e.g., 'workflowInput.document')"),
    outputSchema: z
      .instanceof(z.ZodType)
      .describe("Zod schema instance for the expected JSON output"),
  }),
});
export type DocumentOCRStepConfig = z.infer<typeof DocumentOCRStepSchema>;

// --- Union Schema for Any Step Type ---
// This uses the 'type' field to determine which specific schema to apply.
export const WorkflowStepSchemaUnion = z.discriminatedUnion("type", [
  LLMStepSchema,
  PdfPageExtractStepSchema,
  ObjectDetectionStepSchema,
  DocumentOCRStepSchema,
]);
export type WorkflowStepConfig = z.infer<typeof WorkflowStepSchemaUnion>;

export const WorkflowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  authorizedOrganizationIds: z.array(z.string()).optional(),
  inputs: z.array(WorkflowInputConfigSchema),
  output: WorkflowOutputConfigSchema,
  steps: z.array(z.lazy(() => WorkflowStepSchemaUnion)),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// --- Execution Related Types ---
export type StepInputData = Record<string, any>;
export type StepOutputData = Record<string, any>;
export type WorkflowState = {
  workflowInput: Record<string, any>; // Processed initial inputs
  stepOutputs: Record<string, StepOutputData>; // Outputs keyed by step.id
};

// Type for progress updates sent via SSE
export type ProgressUpdate = {
  type:
    | "workflow_start"
    | "step_start"
    | "step_progress"
    | "step_complete"
    | "step_error"
    | "workflow_complete"
    | "workflow_error"
    | "log";
  data: any; // Can be more specific, e.g., { stepId: string, title: string } for step_start
};
export type ProgressCallback = (update: ProgressUpdate) => void;

// Type for Step Executor function signature
export type StepExecutorInput = {
  step: WorkflowStepConfig; // The specific config for this step
  inputs?: StepInputData; // Data prepared via inputMapping
  state: WorkflowState; // Full current workflow state
  workflow: Workflow; // The parent workflow definition
  utils: StepExecutorUtilities; // Shared utilities
  debug: boolean;
  progressCallback?: ProgressCallback;
};
export type StepExecutorFunction = (
  input: StepExecutorInput
) => Promise<StepOutputData>;

// Utilities passed to executors
export type StepExecutorUtilities = {
  getDataSourceValue: (state: WorkflowState, sourcePath: string) => any; // Resolve data paths
};
