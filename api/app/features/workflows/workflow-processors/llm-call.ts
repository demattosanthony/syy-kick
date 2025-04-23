import {
  LLMStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
} from "../workflows.schemas";

import { generateObject } from "ai";

import { Attachment } from "ai";
import { FileData } from "../workflows.schemas";
import { MODELS } from "../../models";

export const executeLLMStep: StepExecutorFunction = async ({
  step,
  inputs,
  debug,
}: StepExecutorInput): Promise<StepOutputData> => {
  if (debug) {
    console.log(`[${step.id}]`);
  }
  const stepConfig = step.config as LLMStepConfig["config"];
  const modelName = stepConfig.modelName || "claude-3.5-sonnet";
  let populatedPrompt = stepConfig.promptTemplate;
  const files: FileData[] = [];

  // Process inputs: replace placeholders or collect files
  for (const [key, value] of Object.entries(inputs || {})) {
    const placeholder = `{input.${key}}`;
    if (value && typeof value === "object" && "url" in value) {
      files.push(value as FileData);
    } else if (Array.isArray(value)) {
      files.push(...value.filter((item): item is FileData => item?.url));
    } else {
      populatedPrompt = populatedPrompt.replace(placeholder, String(value));
    }
  }

  const attachments: Attachment[] = files.map((file) => ({
    url: file.url,
    contentType: file.mimeType,
    name: file.fileName,
  }));

  if (debug) {
    console.log(`[${step.id}] Populated Prompt:`, populatedPrompt);
    console.log(
      `[${step.id}] Attachments:`,
      attachments.map((a) => a.name)
    );
  }

  try {
    const { object } = await generateObject({
      model: MODELS[modelName].model,
      schema: stepConfig.outputSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: populatedPrompt },
            ...(attachments.map((a) => ({
              type: a.contentType?.startsWith("image") ? "image" : "file",
              [a.contentType?.startsWith("image") ? "image" : "data"]: a.url,
              mimeType: a.contentType,
            })) as any),
          ],
        },
      ],
      experimental_repairText: async ({ text, error }) => {
        if (debug) {
          console.log("[experimental_repairText] Original text:", text);
          console.log("[experimental_repairText] Error:", error);
        }

        // Remove 'ny\n' and ```json wrappers from the text
        const cleaned = text
          .replace("ny\n", "")
          .replace(/```json\n/g, "")
          .replace(/```/g, "")
          .trim();

        if (debug) {
          console.log("[experimental_repairText] Cleaned text:", cleaned);
        }

        return cleaned;
      },
    });

    const validatedOutput = stepConfig.outputSchema.safeParse(object);
    if (!validatedOutput.success) {
      throw new Error(
        `Output validation failed: ${validatedOutput.error.message}`
      );
    }

    if (debug) {
      console.log(`[${step.id}] Validated Output:`, validatedOutput.data);
    }

    return validatedOutput.data as StepOutputData;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${step.id}] LLM step failed with ${modelName}:`, error);
    throw new Error(`LLM step ${step.id} failed: ${msg}`);
  }
};
