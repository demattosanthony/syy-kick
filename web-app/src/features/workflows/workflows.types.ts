import { GetWorkflowResponse } from "@mastra/client-js";
import { WorkflowRun, WorkflowRuns } from "@mastra/core";

// Base types for form fields
type BaseFieldType = {
  type: string;
  const: "text" | "file" | "number";
};

type BaseFieldValue = {
  type: "object" | "array";
  properties?: Record<
    string,
    {
      type: string;
      const?: string;
    }
  >;
  items?: BaseFieldValue;
  required?: string[];
  additionalProperties?: boolean;
};

// Base structure for all fields
type BaseFieldStructure = {
  type: "object";
  properties: {
    type: BaseFieldType;
    value: BaseFieldValue;
  };
  required: ["type", "value"];
  additionalProperties: false;
};

// Specific types for text fields
type TextFieldType = BaseFieldType & {
  const: "text";
};

type NumberFieldType = BaseFieldType & {
  const: "number";
};

type TextFieldValue = BaseFieldValue & {
  type: "object";
  properties: {
    text: {
      type: string;
    };
  };
  required: ["text"];
};

type NumberFieldValue = BaseFieldValue & {
  type: "object";
  properties: {
    number: {
      type: string;
    };
  };
  required: ["number"];
};

export interface TextFormField extends BaseFieldStructure {
  properties: {
    type: TextFieldType;
    value: TextFieldValue;
    label: BaseFieldType;
  };
}

export interface NumberFormField extends BaseFieldStructure {
  properties: {
    type: NumberFieldType;
    value: NumberFieldValue;
    label: BaseFieldType;
  };
}

// Specific types for file fields
export type FileMimeType = "application/pdf" | "image/*";

type FileFieldType = BaseFieldType & {
  const: "file";
};

type FileFieldValue = BaseFieldValue & {
  type: "object";
  properties: {
    fileKey: {
      type: string;
    };
    mimeType: {
      type: string;
      const: FileMimeType;
    };
    fileName: {
      type: string;
    };
  };
  required: ["fileKey", "mimeType", "fileName"];
};

// Type for multiple files - array of FileFieldValue
type MultipleFileFieldValue = BaseFieldValue & {
  type: "array";
  items: FileFieldValue;
};

export interface FileFormField extends BaseFieldStructure {
  properties: {
    type: FileFieldType;
    multiple?: boolean;
    value: FileFieldValue | MultipleFileFieldValue;
    label: BaseFieldType;
  };
}

// Union type for all possible fields
export type FormField = TextFormField | FileFormField | NumberFormField;

// Types for the workflow schema
export type WorkflowInputSchemaRaw = string;

export type WorkflowInputSchemaParsed = {
  json: {
    type: "object";
    properties: Record<string, FormField>;
    required: string[];
    additionalProperties: boolean;
    $schema: string;
  };
};

export type WorkflowInputSchema = Record<string, WorkflowInputSchemaParsed>;

export enum StepStatus {
  Pending = "pending",
  Blocked = "blocked",
  Waiting = "waiting",
  Running = "running",
  Success = "success",
  Failed = "failed",
  Suspended = "suspended",
  Skipped = "skipped",
}

export interface TreeNodeBase {
  /** Unique path in the run, includes iteration suffixes. */
  path: string;
  /** Original step identifier from the definition. */
  stepId: string;
  type: "step" | "parallel" | "conditional" | "loop" | "foreach";
  description?: string;

  status: StepStatus;
  startedAt: number | null;
  finishedAt: number | null;
  output?: StepOutputValue;
  error?: string;
}

export interface TreeNode extends TreeNodeBase {
  children?: TreeNode[];
  /* Loop-specific */
  iteration?: number;
  loopType?: "dowhile" | "dountil";
  /* Foreach-specific */
  foreachIndex?: number;
  foreachConcurrency?: number;
}

export interface RuntimeIndex {
  byPath: Map<string, TreeNode>;
  byStepId: Map<string, TreeNode[]>;
}

export type StepContext = {
  status: StepStatus;
  output?: StepOutputValue;
  error?: string;
};

export interface VNextWorkflowRunState {
  value: Record<string, string>;
  context: {
    input: Record<string, any>;
  } & Record<string, StepContext>;
  runId: string;
  timestamp: number;
}
export interface CustomWorkflowRun {
  workflowName: string;
  runId: string;
  snapshot: VNextWorkflowRunState;
  createdAt: Date;
  updatedAt: Date;
  resourceId?: string;
  definition?: GetWorkflowResponse;
}

/** @todo: use their type when available */
export interface CustomWorkflowRuns extends Omit<WorkflowRuns, "runs"> {
  runs: WorkflowRun[];
}

export type StepOutputValue =
  | WorkflowRunStepOutput
  | WorkflowRunStepOutput[]
  | Record<string, WorkflowRunStepOutput | WorkflowRunStepOutput[]>;

// New output schema types
export interface WorkflowFile {
  fileKey: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
  url?: string;
}

export interface WorkflowRunStepOutput {
  type: "text" | "file" | "number";
  text?: string;
  file?: WorkflowFile;
  number?: number;
}

// Tag type to match backend schema
export interface Tag {
  id: string;
  name: string;
  createdAt: Date;
  hexBgColor: string;
  hexTextColor: string;
}

// Enhanced workflow response that includes description and tags
export type EnhancedWorkflowResponse = GetWorkflowResponse & {
  tags: Tag[];
};
