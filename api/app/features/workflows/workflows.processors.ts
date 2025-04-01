import { Attachment, generateObject } from "ai";
import {
  FileData,
  LLMStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
  WorkflowState,
} from "./workflows.schemas";
import { MODELS } from "../models";

const getDataSourceValue = (state: WorkflowState, sourcePath: string): any => {
  if (!sourcePath) return undefined;

  const parts = sourcePath.split(".");
  const sourceKey = parts[0]; // e.g., 'workflowInput' or '{step-id}'
  const remainingPath = parts.slice(1); // e.g., ['file', 'url']

  let currentValue: any;

  if (sourceKey === "workflowInput") {
    currentValue = state.workflowInput;
  } else if (state.stepOutputs?.[sourceKey]) {
    currentValue = state.stepOutputs[sourceKey];
  }

  // Traverse the remaining path
  for (const key of remainingPath) {
    currentValue = currentValue?.[key];
    if (currentValue === undefined) break;
  }

  return currentValue;
};

export const executeLLMStep: StepExecutorFunction = async ({
  step,
  state,
  inputs,
  workflow,
  progressCallback,
  utils,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as LLMStepConfig["config"];
  const modelName = stepConfig.modelName || "claude-3.5-sonnet";

  // Collect all input files
  const inputMapping = stepConfig.inputMapping;
  const sourcesPaths = Object.values(inputMapping || {});

  let files: FileData[] = [];
  for (const sourcePath of sourcesPaths) {
    const file = getDataSourceValue(state, sourcePath);
    if (file) {
      files.push(file);
    }
  }

  const attachments: Attachment[] = files?.map((file) => ({
    url: file.url,
    contentType: file.mimeType,
  }));

  const { object } = await generateObject({
    model: MODELS[modelName].model,
    schema: stepConfig.outputSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: stepConfig.promptTemplate,
          },
          attachments.map((attachment) => ({
            type: attachment.contentType?.includes("image") ? "image" : "file",
            [attachment.contentType?.includes("image") ? "image" : "file"]:
              attachment.url,
            mimeType: attachment.contentType,
          })) as any,
        ],
      },
    ],
  });

  const validatedOutput = stepConfig.outputSchema.safeParse(object);
  console.log(`[${step.id}] LLM step completed successfully`);

  return validatedOutput;
};
