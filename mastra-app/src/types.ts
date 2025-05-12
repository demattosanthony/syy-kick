export type WorkflowFile = {
  fileKey: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
  fileUrl?: string;
};

export type WorkflowRunStepOutput = {
  type: "text" | "file";
  text?: string;
  file?: WorkflowFile;
};
