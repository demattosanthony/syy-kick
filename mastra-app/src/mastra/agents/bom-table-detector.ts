import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const bomTableDetectorAgent = new Agent({
  name: "bom-table-detector",
  instructions: `Your task is to analyze a image and determine if there are any bill of materials embedded tables on it. 
These tables typically list details about components used in the control system, such as sizes, types, and quantities. The table header should also be Bill of Materials.`,
  model: openai("gpt-4.1"),
});
