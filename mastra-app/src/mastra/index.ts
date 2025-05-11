import "dotenv/config";
import { Mastra } from "@mastra/core";
import { bomTableDetectorAgent } from "./agents/bom-table-detector";
import { totalizedBomBuilder } from "./workflows/totalized-bom-builder";

export const mastra = new Mastra({
  agents: {
    bomTableDetectorAgent,
  },
  workflows: {
    totalizedBomBuilder,
  },
});
