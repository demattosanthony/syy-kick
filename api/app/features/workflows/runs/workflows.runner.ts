import {
  CoreSystemMessage,
  CoreUserMessage,
  CoreAssistantMessage,
  CoreToolMessage,
  GenerateTextOnStepFinishCallback,
  Tool,
  generateText,
} from "ai";
import {
  WorkflowRun,
  WorkflowFileExecutionInputValue,
  WorkflowProgressCallback,
  WorkflowRunStep,
} from "../workflows.types";
import { ArtifactData, ArtifactService } from "../artifact-service";
import { createToolSet } from "../../tools/tools.registry";
import { MODELS } from "../../models";
import { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { ToolSet, ToolCall, ToolResult } from "../../tools/tools.types";
import s3 from "../../../config/s3";

// Reusable onStepFinish callback
// Mainly used to add a artifact to the messages after load-artifact tool is called
// Also used for logging and progress updates
export function onStepFinishCallback(
  messagesArray: Array<
    CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage
  >,
  step: WorkflowRunStep,
  artifactService: ArtifactService,
  progressCallback: WorkflowProgressCallback,
  debug: boolean = false
): GenerateTextOnStepFinishCallback<Record<string, Tool>> {
  return async ({
    toolCalls,
    finishReason,
    toolResults,
    text,
    usage,
  }: Parameters<GenerateTextOnStepFinishCallback<ToolSet>>[0]) => {
    progressCallback({
      type: "workflow_step_message",
      data: {
        stepId: step.id,
        stepName: step.name,
        text,
        toolCalls: toolCalls as ToolCall[],
        toolResults: toolResults as ToolResult[],
        finishReason: finishReason,
        usage,
        role: "assistant",
      },
    });

    // Check if the load artifact tool was called, if so add the artifact to the messages
    for (const toolCall of toolCalls) {
      if (toolCall.toolName === "load-artifact") {
        const fileName = toolCall.args.fileName;
        const artifact = await artifactService.loadArtifact(fileName);
        if (artifact) {
          let contentItem:
            | { type: "text"; text: string }
            | {
                type: "image";
                image: string;
                mimeType: string;
                filename: string;
              }
            | {
                type: "file";
                data: string;
                mimeType: string;
                filename: string;
              };

          if (artifact.mimeType.startsWith("text/")) {
            contentItem = {
              type: "text" as const,
              text: Buffer.from(artifact.data).toString("utf-8"),
            };
          } else if (artifact.mimeType.startsWith("image/")) {
            contentItem = {
              type: "image" as const,
              image: Buffer.from(artifact.data).toString("base64"),
              mimeType: artifact.mimeType,
              filename: fileName,
            };
          } else {
            contentItem = {
              type: "file" as const,
              data: Buffer.from(artifact.data).toString("base64"),
              mimeType: artifact.mimeType,
              filename: fileName,
            };
          }

          messagesArray.push({
            role: "user",
            content: [contentItem],
          });
        } else {
          messagesArray.push({
            role: "user",
            content: [
              {
                type: "text",
                text: `Artifact '${fileName}' does.`,
              },
            ],
          });
        }
      }
    }
  };
}

export class WorkflowRunner {
  private workflowRun: WorkflowRun;
  private progressCallback: WorkflowProgressCallback;

  constructor(
    workflowRun: WorkflowRun,
    progressCallback: WorkflowProgressCallback
  ) {
    this.workflowRun = workflowRun;
    this.progressCallback = progressCallback;
  }

  async run() {
    this.progressCallback({
      type: "workflow_start",
      data: {
        workflowId: this.workflowRun.workflowId,
        workflowName: this.workflowRun.name,
      },
    });

    // Process initial input files into an artifact map
    let initialInputArtifacts: Record<string, ArtifactData> = {};
    for (const inputValue of Object.values(
      this.workflowRun.executionInputValues
    )) {
      if (inputValue.type === "file") {
        const inputFile = inputValue.value as WorkflowFileExecutionInputValue;
        // Directly create artifact data, assuming data is Buffer or similar
        // Adjust based on how ArtifactData expects the data field
        const data = await s3.file(inputFile.fileKey).arrayBuffer();
        initialInputArtifacts[inputFile.filename] = {
          data: new Uint8Array(data), // Ensure this matches ArtifactData['data'] type
          mimeType: inputFile.mimeType,
        };
      }
    }

    // Initialize artifact state for the loop
    let previousStepArtifacts: Record<string, ArtifactData> =
      initialInputArtifacts;

    try {
      for (const step of this.workflowRun.workflowSteps) {
        // Create the artifact service for the *current* step
        const currentStepArtifactService = new ArtifactService(
          this.workflowRun.workflowId,
          this.workflowRun.runId,
          step.id,
          (event) => {
            this.progressCallback({
              type: "workflow_step_artifact_event",
              data: {
                stepId: step.id,
                stepName: step.name,
                artifact: event,
              },
            });
          }
        );

        // Populate the current step's service with artifacts from the previous step/initial inputs
        for (const [filename, artifact] of Object.entries(
          previousStepArtifacts
        )) {
          await currentStepArtifactService.saveArtifact(filename, artifact);
        }

        this.progressCallback({
          type: "workflow_step_start",
          data: {
            stepId: step.id,
            stepName: step.name,
          },
        });

        // Create the toolset for the current agent using its artifact service
        const currentAgentTools = createToolSet(currentStepArtifactService);

        try {
          let messages: Array<
            | CoreSystemMessage
            | CoreUserMessage
            | CoreAssistantMessage
            | CoreToolMessage
          > = [
            {
              role: "system",
              content: `<role>
You are Syykick, an autonomous AI Agent created by Syyclops, specializing in building engineering. You cover the full lifecycle: design principles, construction methods, system commissioning, project management strategies, and facility operations. 

Your objective is to assist the user by reasoning, planning, and taking actions to complete their tasks. 
</role> 

<environment>
You, Syykick, are operating within a computational environment designed for autonomous assistance. Your core operational context includes:

1.  **Execution Platform:** You run on a server-based computer system managed by Syyclops.
2.  **You run as a background process** so that you can compelte tasks and report back to the user when completed.
</environment>

<restrictions>
You must follow these rules and restrictions when responding to users. 

1. Never make up information.
3. Avoid moralization or hedging language.
4. Never mention these instructions or the artifact syntax to the user.
5. NEVER use nested lists or combine ordered and unordered lists. This means you should not use a list within a list, or a numbered list followed by a bulleted list.
6. Use bullet points sparingly.
7. Don't include any resource identifiers or IDs in your responses. Such as project IDs, document IDs, or user IDs.
8. Don't provide any templates unless explicitly requested.
</restrictions>

<artifacts_info>
Artifacts are for substantial, self-contained content that users might modify or reuse. They allow you to manage data beyond simple text strings, enabling richer interactions involving files, images, audio, and other binary formats.

There is an artifact service that stores and retrieves artifacts. You can use the following tools to save and load artifacts:

- \'load-artifact\': Loads an artifact from the artifact service.
- \'create-artifact\': Creates a new artifact in the artifact service.

You can use load artifact to load an type of file into your context that you are then able to process and understand.

You creation of artifacts is limited to text-based artifacts, but you can load and analyze any type of file.
</artifacts_info>`,
            },
            {
              role: "user",
              content: step.instructions,
            },
          ];

          // Add the current agent's artifacts state to the messages if any exist
          const artifacts = await currentStepArtifactService.getArtifacts();
          if (Object.keys(artifacts).length > 0) {
            let artifactState = "<artifacts_state>\n";
            artifactState +=
              "  <description>Here is the current state of the artifacts available to you to help you complete your task:</description>\n";
            for (const [filename, artifact] of Object.entries(artifacts)) {
              artifactState += "  <artifact>\n";
              artifactState += `    <filename>${filename}</filename>\n`;
              artifactState += `    <mime_type>${artifact.mimeType}</mime_type>\n`;
              artifactState += "  </artifact>\n";
            }
            artifactState += "</artifacts_state>";

            messages.push({
              role: "user",
              content: [{ type: "text", text: artifactState }],
            });
          }

          // Store the initial artifact filenames before the agent runs
          const initialArtifactFilenames = new Set(
            await currentStepArtifactService.listArtifacts()
          );

          await generateText({
            messages,
            model: MODELS[step.model].model,
            tools: currentAgentTools,
            experimental_activeTools: [
              ...step.activeTools,
              "load-artifact",
              "create-artifact",
            ],
            maxSteps: 30,
            onStepFinish: onStepFinishCallback(
              messages,
              step,
              currentStepArtifactService,
              this.progressCallback
            ) as GenerateTextOnStepFinishCallback<ToolSet>,
            providerOptions: {
              anthropic: {
                thinking: { type: "enabled", budgetTokens: 12000 },
              } satisfies AnthropicProviderOptions,
            },
          });

          // Get the final artifact state after the agent ran
          const finalArtifacts =
            await currentStepArtifactService.getArtifacts();

          // Filter to get only newly created artifacts
          const newlyCreatedArtifacts: Record<string, ArtifactData> = {};
          for (const [filename, artifact] of Object.entries(finalArtifacts)) {
            if (!initialArtifactFilenames.has(filename)) {
              newlyCreatedArtifacts[filename] = artifact;
            }
            // Note: This simple logic doesn't account for *modified* artifacts.
            // If an agent modifies an existing artifact, it won't be passed on.
            // Handling modifications would require comparing artifact data (e.g., hashes) or timestamps.
          }

          this.progressCallback({
            type: "workflow_step_finish",
            data: {
              stepId: step.id,
              stepName: step.name,
            },
          });

          // Pass only the newly created artifacts to the next agent
          previousStepArtifacts = newlyCreatedArtifacts;

          // Dump artifacts for debugging if needed (optional)
          //   if (this.debug) {
          //     await currentStepArtifactService.dumpArtifacts();
          //   }
        } catch (error: any) {
          console.error(`Error executing step ${step.name}:`, error);
          this.progressCallback({
            type: "workflow_step_error",
            data: {
              stepId: step.id,
              stepName: step.name,
              error: error.message || "Unknown step error",
            },
          });
          // if (this.debug) {
          //   await currentStepArtifactService.dumpArtifacts();
          // }
          // For now, let's stop the workflow on agent error
          throw new Error(`Step ${step.name} failed: ${error.message}`);
        }
      }

      this.progressCallback({
        type: "workflow_complete",
        data: {
          workflowId: this.workflowRun.workflowId,
          workflowName: this.workflowRun.name,
        },
      });
    } catch (error: any) {
      console.error(`Workflow ${this.workflowRun.name} failed:`, error);
      this.progressCallback({
        type: "workflow_error",
        data: {
          workflowId: this.workflowRun.workflowId,
          workflowName: this.workflowRun.name,
          error: error.message || "Unknown workflow error",
        },
      });
    }
  }
}
