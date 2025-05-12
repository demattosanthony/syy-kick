import "dotenv/config";
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

import logger from "../logger.ts";
import {
  totalizedBomBuilder,
  windowDoorScheduleGen,
} from "./workflows/index.ts";

const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
});

export const mastra = new Mastra({
  vnext_workflows: {
    "totalized-bom-builder": totalizedBomBuilder,
    "window-door-schedule-gen": windowDoorScheduleGen,
  },
  logger: logger,
  storage,
});
