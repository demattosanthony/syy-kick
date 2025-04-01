import { Attachment, generateObject } from "ai";
import {
  FileData,
  LLMStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
} from "./workflows.schemas";
import { MODELS } from "../models";

export const executeLLMStep: StepExecutorFunction = async ({
  step,
  state,
  inputs,
  workflow,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as LLMStepConfig["config"];
  const modelName = stepConfig.modelName || "claude-3.5-sonnet";

  // Populate the prompt template and get all the attachments
  let populatedPrompt = stepConfig.promptTemplate;
  let files: FileData[] = [];

  for (const key in inputs) {
    const placeholder = `{input.${key}}`;
    const value = inputs[key];

    // Handle file data
    if (value && value.url && typeof value === "object") {
      files.push(value);
    } else {
      // Replace all placeholders with the actual values
      populatedPrompt = populatedPrompt.replace(placeholder, String(value));
    }
  }

  const attachments: Attachment[] = files?.map((file) => ({
    url: file.url,
    contentType: file.mimeType,
    name: file.fileName,
  }));

  console.log(`[${step.id}] Starting LLM step execution`);
  console.log(`[${step.id}] Prompt:`, populatedPrompt);
  console.log(`[${step.id}] Attachments Length:`, attachments.length);

  try {
    const { object } = await generateObject({
      model: MODELS[modelName].model,
      schema: stepConfig.outputSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: populatedPrompt,
            },
            ...(attachments.map((attachment) => ({
              type: "file",
              data: attachment.url,
              mimeType: attachment.contentType,
            })) as any),
          ],
        },
      ],
    });

    const validatedOutput = stepConfig.outputSchema.safeParse(object);

    console.log(`[${step.id}] LLM step completed successfully`);
    return validatedOutput.data as StepOutputData;
  } catch (error) {
    console.error(`[${step.id}] Error during LLM step execution:`, error);
    throw error; // Re-throw the error after logging
  }
};

export const stepExecutorRegistry = new Map<string, StepExecutorFunction>();
stepExecutorRegistry.set("llm", executeLLMStep);
