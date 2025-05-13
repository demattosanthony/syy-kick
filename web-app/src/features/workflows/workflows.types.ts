import { WorkflowRun, WorkflowRuns, WorkflowRunState } from "@mastra/core";

// Base types for form fields
type BaseFieldType = {
  type: string;
  const: "text" | "file";
};

type BaseFieldValue = {
  type: "object";
  properties: Record<string, {
    type: string;
    const?: string;
  }>;
  required: string[];
  additionalProperties: boolean;
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

type TextFieldValue = BaseFieldValue & {
  properties: {
    text: {
      type: string;
    };
  };
  required: ["text"];
};

export interface TextFormField extends BaseFieldStructure {
  properties: {
    type: TextFieldType;
    value: TextFieldValue;
    label: BaseFieldType;
  };
}

// Specific types for file fields
export type FileMimeType = "application/pdf" | "image/*";

type FileFieldType = BaseFieldType & {
  const: "file";
};

type FileFieldValue = BaseFieldValue & {
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

export interface FileFormField extends BaseFieldStructure {
  properties: {
    type: FileFieldType;
    value: FileFieldValue;
    label: BaseFieldType;
  };
}

// Union type for all possible fields
export type FormField = TextFormField | FileFormField;

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

export interface WorkflowProjectFile {
  source: "project";
  name: string;
  type: string;
  url: string;
  size: number;
  file_key: string;
}

/** ---- Runs ---- */

/** @todo: use their type when available */
export interface VNextWorkflowRunState extends Omit<WorkflowRunState, 'context'> {
  context: {
    input: Record<string, any>;
  } & {
    [stepId: string]: {
      status: 'success' | 'failed' | 'suspended' | 'waiting' | 'skipped';
      output?: any;
      error?: any;
    };
  }
}

export interface CustomWorkflowRun extends Omit<WorkflowRun, 'snapshot'> {
  snapshot: VNextWorkflowRunState;
}

/** @todo: use their type when available */
export interface CustomWorkflowRuns extends Omit<WorkflowRuns, 'runs'> {
  runs: CustomWorkflowRun[];
}