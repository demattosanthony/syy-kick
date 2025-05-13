import "dotenv/config";
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { NetlifyDeployer } from "@mastra/deployer-netlify";

import logger from "../logger.ts";
import {
  totalizedBomBuilder,
  windowDoorScheduleGen,
  settyRfpEval,
  equipmentServingListWorkflow,
  rfpResearcherWorkflow,
} from "./workflows/index.ts";
import { csvWriter, webResearcher } from "./agents/index.ts";

const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL!,
});

export const mastra = new Mastra({
  agents: {
    "csv-writer": csvWriter,
    "web-researcher": webResearcher,
  },
  vnext_workflows: {
    "totalized-bom-builder": totalizedBomBuilder,
    "window-door-schedule-gen": windowDoorScheduleGen,
    "setty-rfp-eval": settyRfpEval,
    "equipment-serving-list": equipmentServingListWorkflow,
    "rfp-researcher": rfpResearcherWorkflow,
  },
  logger: logger,
  storage,
  server: {
    middleware: [
      {
        // Authorization: Basic <base64 encoded username:password>
        handler: async (c, next) => {
          const authHeader = c.req.header("Authorization");

          if (
            !authHeader ||
            !authHeader.startsWith("Basic ") ||
            !verifyBasicAuth(authHeader)
          ) {
            return new Response("Unauthorized", {
              status: 401,
              headers: {
                "WWW-Authenticate": 'Basic realm="Restricted Area"',
              },
            });
          }

          await next();
        },
        path: "/*",
      },
    ],
  },
  deployer: new NetlifyDeployer({
    scope: process.env.NETLIFY_SCOPE!,
    projectName: process.env.NETLIFY_PROJECT_NAME!,
    token: process.env.NETLIFY_TOKEN!,
  }),
});

// Function to decode and verify basic auth credentials
const verifyBasicAuth = (authHeader: string): boolean => {
  try {
    // Remove "Basic " prefix and decode base64
    const encoded = authHeader.split(" ")[1];
    const decoded = Buffer.from(encoded, "base64").toString();
    const [username, password] = decoded.split(":");

    // Compare with environment variables
    return (
      username === process.env.BASIC_AUTH_USERNAME &&
      password === process.env.BASIC_AUTH_PASSWORD
    );
  } catch (error) {
    return false;
  }
};
