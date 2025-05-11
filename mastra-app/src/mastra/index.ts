import "dotenv/config";
import { Mastra } from "@mastra/core";
import { totalizedBomBuilder } from "./workflows/totalized-bom-builder";

export const mastra = new Mastra({
  workflows: {
    totalizedBomBuilder,
  },
});
