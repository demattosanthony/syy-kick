import { Router } from "express";

import { serve } from "@upstash/workflow/express";
import { generateText, tool } from "ai";
import { z } from "zod";
import { Client } from "@upstash/workflow";

import Exa from "exa-js";
import { MODELS } from "../models";
import { createProjectSearchTool } from "../threads/threads.utils";

const exa = new Exa(process.env.EXA_API_KEY);

const client = new Client({
  token: process.env.QSTASH_TOKEN,
});

const router = Router();

router.post("/run", async (req, res) => {
  const prompt = req.body.message;

  console.log("Prompt:", prompt);

  const modelConfig = MODELS["gpt-4o"];

  const response = await generateText({
    model: modelConfig.model,
    maxSteps: 10,
    tools: {
      project_search_tool: createProjectSearchTool(
        "470c92ea-6560-4884-9c17-6d0114f663d7",
        modelConfig
      ),
      web_search_tool: tool({
        description: "A tool for searching the web",
        parameters: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          const results = await exa.search(query);
          return results;
        },
      }),
      web_scrape_tool: tool({
        description: "A tool for scraping the web",
        parameters: z.object({ url: z.string() }),
        execute: async ({ url }) => {
          const response = await fetch(
            `https://r.jina.ai/${encodeURIComponent(url)}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.JINA_API_KEY}`,
              },
            }
          );
          const data = await response.text();
          console.log(data);
          return data;
        },
      }),
    },
    prompt,
    system: `You are a Mechanical QA QC building engineer for a certain project. Your job is to review mechanical drwaings and plans and analyze if anything is not done properly. Todays date is ${new Date().toLocaleDateString()}.`,
    onStepFinish: async ({
      finishReason,
      text,
      toolCalls,
      toolResults,
      reasoning,
    }) => {
      console.log("Tool calls:", toolCalls);
      console.log("Tool results:", toolResults.length);
      console.log("Finish reason:", finishReason);
      console.log("Text:", text);
      console.log("Reasoning:", reasoning);
      console.log("\n\n\n");
    },
  });

  res.json({ message: "Workflow started" });
});

router.get("/:workflowId/logs", async (req, res) => {
  const { workflowId } = req.params;
  const { runs } = await client.logs({ workflowRunId: workflowId });

  res.json({ runs });
});

export default router;
