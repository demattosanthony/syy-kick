import { createStep } from "@mastra/core/workflows";
import { WorkflowRunStepOutputSchema } from "../../../../types.ts";
import { z } from "zod";
import { classifyImages } from "../../../../image-classification.ts";

export const findSchedulesPagesStep = createStep({
  id: "findSchedulesPagesStep",
  inputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    const outputs = await classifyImages(convertedImages, {
      prompt: `Your task is to analyze an image from a architectural drawings pdf documentand determine if there are any window or door schedules embedded tables on it. 
These schedules typically list details about windows and doors used in the building, such as sizes, types, and quantities. The table header will be something like "Window Schedule" or "Door Schedule".`,
      schema: z.object({
        hasWindowOrDoorSchedule: z.boolean(),
      }),
    });

    console.log(
      "Number of images with window or door schedules: ",
      outputs.length
    );

    return {
      imagesWithWindowOrDoorSchedules: outputs,
    };
  },
});
