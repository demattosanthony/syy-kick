import "dotenv/config";
import { Mastra } from "@mastra/core";
import { totalizedBomBuilder } from "./workflows/totalized-bom-builder";
import { PostgresStore } from "@mastra/pg";
import logger from "../logger.ts";

const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
});

export const mastra = new Mastra({
  vnext_workflows: {
    totalizedBomBuilder,
  },
  logger: logger,
  storage,
});
