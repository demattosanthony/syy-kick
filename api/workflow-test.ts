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
  tool,
  generateText,
  generateObject,
  Tool,
  GenerateTextOnStepFinishCallback,
  CoreMessage,
} from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { PDFDocument } from "pdf-lib";
import { getPdfPageAsImage } from "./app/utils";
import { Jimp } from "jimp";
import { MODELS } from "./app/features/models";
import { ArtifactService } from "./app/features/workflows/artifact-service";
import util from "util";

// Define types

type Agent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  tools: Record<string, Tool>;
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
  messages: CoreMessage[];
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

// ARTIFACT SERVICE

const artifactService = new ArtifactService();

// DEFINE TOOLS

const listArtifactsTool = tool({
  description: "Lists the filenames of all currently available artifacts.",
  parameters: z.object({}).describe("No parameters required."),
  execute: async () => {
    try {
      const filenames = artifactService.listArtifacts();
      return { filenames: filenames };
    } catch (error: any) {
      console.error("Error in listArtifactsTool:", error);
      return {
        success: false,
        message: `Failed to list artifacts: ${error.message}`,
      };
    }
  },
});

const loadArtifactTool = tool({
  description:
    "Loads an artifact from the artifact service. This tool allows you to read the contents of an artifact. For example, if you need to read the contents of a PDF file, you can use this tool to load the PDF file into your context. This also works for images and allows you to see the image in your context.",
  parameters: z.object({
    fileName: z.string().describe("The file name of the artifact to load."),
  }),
  execute: async ({ fileName }) => {
    const artifact = artifactService.loadArtifact(fileName);
    if (!artifact) {
      return {
        success: false,
        message: `Artifact '${fileName}' not found.`,
      };
    }

    return {
      success: true,
      message: `Successfully loaded artifact '${fileName}'.`,
    };
  },
});

const createArtifactTool = tool({
  description:
    "Creates a text-based artifact in the artifact service. This is useful for saving textual data like Markdown documents, CSV files, or plain text notes. For example, you could use this to save extracted text, generated reports, or structured data.",
  parameters: z.object({
    fileName: z
      .string()
      .describe(
        "The name of the artifact to create (e.g., 'report.md', 'data.csv')."
      ),
    mimeType: z
      .string()
      .describe(
        "The MIME type of the artifact (e.g., 'text/markdown', 'text/csv', 'text/plain')."
      ),
    data: z
      .string()
      .describe(
        "The text content of the artifact. Do not base64 encode this data; provide it as a plain string."
      ),
  }),
  execute: async ({ fileName, mimeType, data }) => {
    // Convert the plain text string data to a Uint8Array for storage
    const artifactData = new TextEncoder().encode(data);

    artifactService.saveArtifact(fileName, {
      data: artifactData,
      mimeType,
    });

    return {
      success: true,
      message: `Successfully created artifact '${fileName}' with MIME type '${mimeType}'.`,
    };
  },
});

const pdfPageExtractionTool = tool({
  description: "Extracts pages from a PDF file and converts them to images.",
  parameters: z.object({
    fileName: z
      .string()
      .describe("The name of the PDF file to extract pages from."),
    pageNumbers: z.array(z.number()).describe("The page numbers to extract."),
  }),
  execute: async ({ fileName, pageNumbers }) => {
    const pdfBytes = artifactService.loadArtifact(fileName)?.data;
    if (!pdfBytes) {
      return {
        success: false,
        message: `PDF file '${fileName}' not found.`,
      };
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    // const totalPages = pdfDoc.getPageCount();

    for (const pageNumber of pageNumbers) {
      const newPdfDoc = await PDFDocument.create();
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]);
      newPdfDoc.addPage(copiedPage);

      const newPdfBytes = await newPdfDoc.save();

      const pageImageBase64 = await getPdfPageAsImage(newPdfBytes, 1, {
        format: "png",
        dpi: 96,
        maxDimension: 8000,
      });

      artifactService.saveArtifact(`${fileName}-page-${pageNumber}.png`, {
        data: Buffer.from(pageImageBase64, "base64"),
        mimeType: "image/png",
      });
    }

    return {
      success: true,
      message: `Successfully extracted ${pageNumbers.length} pages from '${fileName}' and saved them as artifacts.`,
    };
  },
});

const objectDetectionTool = tool({
  description:
    "Analyzes an image artifact (specified by `fileName`) to detect objects using an AI model. For each object found, it crops the image around the object's bounding box and saves this cropped region as a new, separate image artifact in the artifact service.",
  parameters: z.object({
    fileName: z
      .string()
      .describe("The name of the image file to detect objects in."),
    label: z.string().describe("The label of the object to detect."),
  }),
  execute: async ({ fileName, label }) => {
    const imageArtifact = artifactService.loadArtifact(fileName);
    if (!imageArtifact) {
      return {
        success: false,
        message: `Image '${fileName}' not found.`,
      };
    }

    const imagebase64 = Buffer.from(imageArtifact.data).toString("base64");

    const { object } = await generateObject({
      model: google("gemini-2.5-pro-preview-03-25"),
      schema: z.object({
        bounding_boxes: z.array(
          z.object({ box_2d: z.array(z.number()).length(4), label: z.string() })
        ),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imagebase64,
              mimeType: imageArtifact.mimeType,
            },
            {
              type: "text",
              text: `Your task is to locate all instances of "${label}" and place 2d bounding boxes around them. Each bounding box should tightly enclose the identified object.
Output the bounding boxes in the [y_min, x_min, y_max, x_max] format.
The top left corner is (0,0). The x axis goes left→right, the y axis top→bottom.
Coordinate values must be normalized to 0–1000 for both width and height.
Each entry should contain { "box_2d": [y_min, x_min, y_max, x_max], "label": "${label}" }.`,
            },
          ],
        },
      ],
    });

    console.log(object.bounding_boxes);

    // Process image
    const image = await Jimp.read(Buffer.from(imagebase64, "base64"));
    const { width, height } = image.bitmap;

    for (const [index, boundingBox] of object.bounding_boxes.entries()) {
      const {
        box_2d: [y_min, x_min, y_max, x_max],
        label,
      } = boundingBox;

      // Convert normalized [0..1000] to pixel coordinates
      const padding = 20; // 20px padding on each side
      const x1 = Math.max(0, Math.round((x_min / 1000) * width) - padding);
      const y1 = Math.max(0, Math.round((y_min / 1000) * height) - padding);
      const x2 = Math.min(width, Math.round((x_max / 1000) * width) + padding);
      const y2 = Math.min(
        height,
        Math.round((y_max / 1000) * height) + padding
      );

      const croppedImage = image
        .clone()
        .crop({ h: y2 - y1, w: x2 - x1, x: x1, y: y1 });

      const croppedImageBase64 = (
        await croppedImage.getBuffer("image/jpeg")
      ).toString("base64");

      artifactService.saveArtifact(`${fileName}-${label}-${index}.jpeg`, {
        data: Buffer.from(croppedImageBase64, "base64"),
        mimeType: "image/jpeg",
      });
    }

    dumpArtifacts();

    return {
      success: true,
      message: `Successfully detected ${object.bounding_boxes.length} objects in '${fileName}' and saved them as artifacts.`,
    };
  },
});

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
  progressCallback: WorkflowProgressCallback,
  debug: boolean = false
): GenerateTextOnStepFinishCallback<Record<string, Tool>> {
  return ({
    toolCalls,
    finishReason,
    text,
    toolResults,
    response,
  }: Parameters<GenerateTextOnStepFinishCallback<Record<string, Tool>>>[0]) => {
    if (debug) {
      console.log("toolCalls", toolCalls);
      console.log("finishReason", finishReason);
      console.log("text", text);
      console.log("toolResults", toolResults);
      console.log("response messages", response.messages);
      console.log("\n\n\n\n");
    }

    progressCallback({
      type: "agent_step",
      data: {
        agentId: agent.id,
        agentName: agent.name,
        messages: response.messages,
      },
    });

    // Check if the load artifact tool was called, if so add the artifact to the messages
    for (const toolCall of toolCalls) {
      if (toolCall.toolName === "load-artifact") {
        const fileName = toolCall.args.fileName;
        const artifact = artifactService.loadArtifact(fileName);
        if (artifact) {
          messagesArray.push({
            role: "user",
            content: [
              {
                type: "file",
                data: Buffer.from(artifact.data).toString("base64"),
                mimeType: artifact.mimeType,
                filename: fileName,
              },
            ],
          });
          if (debug) {
            console.log(`Artifact '${fileName}' loaded into message context.`);
          }
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
            tools: agent.tools,
            maxSteps: 10,
            onStepFinish: onStepFinishCallback(
              messages,
              agent,
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
  tools: {
    "pdf-page-extraction": pdfPageExtractionTool,
    "load-artifact": loadArtifactTool,
    "list-artifacts": listArtifactsTool,
  },
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
  tools: {
    "object-detection": objectDetectionTool,
    "load-artifact": loadArtifactTool,
    "list-artifacts": listArtifactsTool,
  },
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
  model: "gemini-2.5-pro-preview",
  tools: {
    "create-artifact": createArtifactTool,
    "load-artifact": loadArtifactTool,
    "list-artifacts": listArtifactsTool,
  },
};

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
    console.log("\n\n\n\n");
  },
  false
);

await workflowRunner.run();
