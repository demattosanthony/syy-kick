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
  Agent,
  Workflow,
  WorkflowExecutionInputValues,
  WorkflowProgressCallback,
  WorkflowToolCall,
  WorkflowToolResult,
} from "./workflows.types";
import { ArtifactService } from "./artifact-service";
import { createToolSet } from "./workflows.registry";
import { MODELS } from "../models";

// Reusable onStepFinish callback
// Mainly used to add a artifact to the messages after load-artifact tool is called
// Also used for logging and progress updates
export function onStepFinishCallback(
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

export class WorkflowRunner {
  private workflow: Workflow;
  private artifactService: ArtifactService;
  private tools: Record<string, Tool>;
  private progressCallback: WorkflowProgressCallback;
  private debug: boolean;

  constructor(
    workflow: Workflow,
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

  async run(inputValues: WorkflowExecutionInputValues) {
    this.progressCallback({
      type: "workflow_start",
      data: {
        workflowId: this.workflow.id,
        workflowName: this.workflow.name,
      },
    });

    // Add any files or images from the inputValues to the artifact service
    for (const inputId in inputValues) {
      const inputValue = inputValues[inputId];
      if (
        inputValue.data instanceof Uint8Array &&
        inputValue.mimeType &&
        inputValue.filename
      ) {
        this.artifactService.saveArtifact(inputValue.filename, {
          data: inputValue.data,
          mimeType: inputValue.mimeType,
        });
      }
    }

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
