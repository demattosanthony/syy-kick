// Can we convert the window and door schedule gen workflow to just use
// A workflow is really agent orchestration.
// This workflow is made up of
// 1. Find schedules page agent. - Finds pages with schedules and uses tool to convert them to images. Save them as artifacts
// 2. Table extraction agent. - Uses the image artifacts and the object detection tool to detect the objects in the images. Save the bounding boxes as artifacts
// 3. Excel Generation agent. - Uses the bounding boxes and the create artifact tool to create an excel file. Save the excel file as an artifact

import {
  CoreToolMessage,
  CoreAssistantMessage,
  CoreSystemMessage,
  CoreUserMessage,
  generateText,
  Tool,
  GenerateTextOnStepFinishCallback,
  FinishReason,
  ToolCallUnion,
  ToolResultUnion,
  LanguageModelUsage,
} from "ai";
import { MODELS } from "./app/features/models";
import {
  ArtifactService,
  createCreateArtifactTool,
  createListArtifactsTool,
  createLoadArtifactTool,
} from "./app/features/workflows/artifact-service";
import util from "util";
import { createPdfPageExtractionTool } from "./app/features/workflows/tools";
import { createObjectDetectionTool } from "./app/features/workflows/tools/object-detection";

// Define types

// Define tool names based on the keys of the toolSet object
type ToolSet = ReturnType<typeof createToolSet>;
type ToolName = keyof ToolSet;

// Define union types for tool calls and results based on the toolSet
type WorkflowToolCall = ToolCallUnion<ToolSet>;
type WorkflowToolResult = ToolResultUnion<ToolSet>;

type Agent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  activeTools: ToolName[]; // Uses the dynamically derived ToolName type
};

type SequentialWorkflow = {
  id: string;
  name: string;
  description: string;
  agents: Agent[];
};

type AgentStartData = {
  agentId: string;
  agentName: string;
};

type AgentStepData = {
  agentId: string;
  agentName: string;
  text: string;
  toolCalls: WorkflowToolCall[]; // Use the specific union type
  toolResults: WorkflowToolResult[]; // Use the specific union type
  finishReason: FinishReason;
  usage: LanguageModelUsage;
};

type AgentErrorData = {
  agentId: string;
  agentName: string;
  error: string;
};

type AgentFinishData = {
  agentId: string;
  agentName: string;
  result?: any;
};

type WorkflowStartData = {
  workflowId: string;
  workflowName: string;
};

type WorkflowCompleteData = {
  workflowId: string;
  workflowName: string;
};

type WorkflowErrorData = {
  workflowId: string;
  workflowName: string;
  error: string;
};

// Type for progress updates
export type WorkflowProgressUpdate =
  | { type: "workflow_start"; data: WorkflowStartData }
  | { type: "agent_start"; data: AgentStartData }
  | { type: "agent_step"; data: AgentStepData }
  | { type: "agent_finish"; data: AgentFinishData }
  | { type: "agent_error"; data: AgentErrorData }
  | { type: "workflow_complete"; data: WorkflowCompleteData }
  | { type: "workflow_error"; data: WorkflowErrorData };
export type WorkflowProgressCallback = (update: WorkflowProgressUpdate) => void;

// DEFINE TOOLS

const createToolSet = (toolArtifactService: ArtifactService) => {
  return {
    "list-artifacts": createListArtifactsTool(toolArtifactService),

    "load-artifact": createLoadArtifactTool(toolArtifactService),

    "create-artifact": createCreateArtifactTool(toolArtifactService),

    "pdf-page-extraction": createPdfPageExtractionTool(toolArtifactService),

    "object-detection": createObjectDetectionTool(toolArtifactService),
  };
};

// HELPER FUNCTION

function dumpArtifacts() {
  artifactService.listArtifacts().forEach((filename) => {
    const artifact = artifactService.loadArtifact(filename);
    if (artifact) {
      Bun.write(`./debug-artifacts/${filename}`, artifact.data);
    }
  });
}

// Reusable onStepFinish callback
// Mainly used to add a artifact to the messages after load-artifact tool is called
// Also used for logging and progress updates
function onStepFinishCallback(
  messagesArray: Array<
    CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage
  >,
  agent: Agent,
  artifactService: ArtifactService,
  progressCallback: WorkflowProgressCallback,
  debug: boolean = false
): GenerateTextOnStepFinishCallback<Record<string, Tool>> {
  return ({
    toolCalls,
    finishReason,
    toolResults,
    text,
    usage,
  }: Parameters<GenerateTextOnStepFinishCallback<Record<string, Tool>>>[0]) => {
    progressCallback({
      type: "agent_step",
      data: {
        agentId: agent.id,
        agentName: agent.name,
        text,
        toolCalls: toolCalls as WorkflowToolCall[],
        toolResults: toolResults as WorkflowToolResult[],
        finishReason: finishReason,
        usage,
      },
    });

    // Check if the load artifact tool was called, if so add the artifact to the messages
    for (const toolCall of toolCalls) {
      if (toolCall.toolName === "load-artifact") {
        const fileName = toolCall.args.fileName;
        const artifact = artifactService.loadArtifact(fileName);
        if (artifact) {
          const contentItem = artifact.mimeType.startsWith("image/")
            ? {
                type: "image" as const,
                image: Buffer.from(artifact.data).toString("base64"),
                mimeType: artifact.mimeType,
                filename: fileName,
              }
            : {
                type: "file" as const,
                data: Buffer.from(artifact.data).toString("base64"),
                mimeType: artifact.mimeType,
                filename: fileName,
              };

          messagesArray.push({
            role: "user",
            content: [contentItem],
          });
        } else {
          if (debug) {
            console.log(
              `Artifact '${fileName}' not found, cannot load into message context.`
            );
          }
        }
      }
    }
  };
}

// WORKFLOW RUNNER

class WorkflowRunner {
  private workflow: SequentialWorkflow;
  private artifactService: ArtifactService;
  private tools: Record<string, Tool>;
  private progressCallback: WorkflowProgressCallback;
  private debug: boolean;

  constructor(
    workflow: SequentialWorkflow,
    artifactService: ArtifactService,
    progressCallback: WorkflowProgressCallback,
    debug: boolean = false
  ) {
    this.workflow = workflow;
    this.artifactService = artifactService;
    this.tools = createToolSet(artifactService);
    this.progressCallback = progressCallback;
    this.debug = debug;
  }

  async run() {
    this.progressCallback({
      type: "workflow_start",
      data: {
        workflowId: this.workflow.id,
        workflowName: this.workflow.name,
      },
    });

    try {
      for (const agent of this.workflow.agents) {
        try {
          this.progressCallback({
            type: "agent_start",
            data: {
              agentId: agent.id,
              agentName: agent.name,
            },
          });

          let messages: Array<
            | CoreSystemMessage
            | CoreUserMessage
            | CoreAssistantMessage
            | CoreToolMessage
          > = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: agent.instructions,
                },
              ],
            },
          ];

          await generateText({
            messages,
            model: MODELS[agent.model].model,
            tools: this.tools,
            experimental_activeTools: agent.activeTools,
            maxSteps: 10,
            onStepFinish: onStepFinishCallback(
              messages,
              agent,
              this.artifactService,
              this.progressCallback,
              this.debug
            ),
          });

          if (this.debug) {
            dumpArtifacts();
          }

          this.progressCallback({
            type: "agent_finish",
            data: {
              agentId: agent.id,
              agentName: agent.name,
            },
          });
        } catch (error: any) {
          console.error(`Error executing agent ${agent.name}:`, error);
          this.progressCallback({
            type: "agent_error",
            data: {
              agentId: agent.id,
              agentName: agent.name,
              error: error.message || "Unknown agent error",
            },
          });
          // For now, let's stop the workflow on agent error
          throw new Error(`Agent ${agent.name} failed: ${error.message}`);
        }
      }

      this.progressCallback({
        type: "workflow_complete",
        data: {
          workflowId: this.workflow.id,
          workflowName: this.workflow.name,
        },
      });
    } catch (error: any) {
      console.error(`Workflow ${this.workflow.name} failed:`, error);
      this.progressCallback({
        type: "workflow_error",
        data: {
          workflowId: this.workflow.id,
          workflowName: this.workflow.name,
          error: error.message || "Unknown workflow error",
        },
      });
    }
  }
}

// Define agent 1
const pageExtractionAgent: Agent = {
  id: "page-extraction-agent",
  name: "Page Extraction Agent",
  description: "Extracts pages from a PDF file and converts them to images.",
  instructions: `You are an AI assistant specialized in analyzing architectural drawings. Your task is to examine a set of architectural drawings provided in a PDF format, identify the specific pages that contains the embedded window and door schedules tables, and extract the pages as images.
          
Instructions:
1. Use the "list-artifacts" tool to get the file name of the PDF file.
2. Use the "load-artifact" tool to load the PDF file into your context.
3. Carefully examine each page of the provided PDF.
4. Look for pages that contains window and door schedules. These schedules typically list details about windows and doors used in the building, such as sizes, types, and quantities.
5. When you find the page with the schedules, note the PDF page number. This should be the actual page number in the PDF file, not the sheet number that might be printed on the drawing itself.
6. If you cannot find a page with window and door schedules, indicate that the schedules were not found and return an empty array for pageNumbers.
7. Use the "pdf-page-extraction" tool to extract the pages as images.

I've placed the pdf file in the artifact service. Use the list artifacts tool to get the file name and then use the load artifact tool to load the file into your context.`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["pdf-page-extraction", "load-artifact", "list-artifacts"],
};

// Define agent 2
const tableExtractionAgent: Agent = {
  id: "table-extraction-agent",
  name: "Table Extraction Agent",
  description: "Extracts tables from images.",
  instructions: `You are a table extraction agent. Your task is to locate the window and door schedule tables in the images and save them as image artifacts.

Steps:
1. Use the "list-artifacts" tool to get the file names of the image artifacts.
2. Use the "object-detection" tool to locate the window and door schedule tables in each of the images. This will save the bounding boxes as image artifacts.

The label you want to detect is "Window or Door Schedule table".`,
  model: "gemini-2.5-flash-preview",
  activeTools: ["object-detection", "load-artifact", "list-artifacts"],
};

// Define agent 3
const csvGenerationAgent: Agent = {
  id: "csv-generation-agent",
  name: "CSV Generation Agent",
  description: "Generates a CSV file from the window and door schedule tables.",
  instructions: `You are a CSV generation agent. Your task is to too analyze cropped images of window and door schedule tables and extract the data from them. You are able to see images so once you load the image artifacts you will able to analyze them and create an accurate CSV file.

Steps:
1. Use the "list-artifacts" tool to get the file names of the image artifacts.
2. Use the "load-artifact" tool to load the image artifact into your context. (Only load the image artifacts that contain the window and door schedule tables.)
3. Use the "create-artifact" tool to create a CSV file.`,
  model: "gpt-4.1",
  activeTools: ["create-artifact", "load-artifact", "list-artifacts"],
};

// ARTIFACT SERVICE

const artifactService = new ArtifactService();

// BEGIN THE WORKFLOW

// Add inital inputs
const filePath =
  "/Users/anthonydemattos/syy-kick/workflows-dataset/window-door-gen/20250318PacificStADUPermitSetProgress.pdf";

const file = Bun.file(filePath);

const pdf = await file.arrayBuffer();

const pdfBytes = new Uint8Array(pdf);

artifactService.saveArtifact("test.pdf", {
  data: pdfBytes,
  mimeType: "application/pdf",
});

const workflow: SequentialWorkflow = {
  id: "window-door-gen",
  name: "Window and Door Generation Workflow",
  description:
    "A workflow that extracts pages from a PDF file and converts them to images.",
  agents: [pageExtractionAgent, tableExtractionAgent, csvGenerationAgent],
};

const workflowRunner = new WorkflowRunner(
  workflow,
  artifactService,
  (update) => {
    console.log(util.inspect(update, { depth: null, colors: true }));
    console.log("\n");
  },
  true
);

await workflowRunner.run();

dumpArtifacts();
