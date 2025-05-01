import { and, eq } from "drizzle-orm";
import {
  WorkflowExecutionInputValue,
  WorkflowExecutionInputValues,
  WorkflowFileExecutionInputValueSchema,
  WorkflowNumberExecutionInputValueSchema,
  WorkflowRun,
  WorkflowTextExecutionInputValueSchema,
} from "../workflows.types";
import { workflowsOps } from "../workflows.ops";
import {
  workflowFiles,
  workflowRuns,
  workflowRunStepMessages,
  workflowRunSteps,
  workflowRunStepsInputs,
  workflowRunStepsInputsValue,
  workflowRunStepsOutputs,
  workflowRunStepToolCalls,
} from "../workflows.schema";
import db from "../../../config/db";
import { WorkflowRunner } from "./workflows.runner";
import EventEmitter from "events";

// Event bus for workflow events
export const eventBus = new EventEmitter();

export const workflowRunsOps = {
  getWorkflowRun: async (workflowId: string, workflowRunId: string) => {
    try {
      const workflowRun = await db.query.workflowRuns.findFirst({
        where: and(
          eq(workflowRuns.id, workflowRunId),
          eq(workflowRuns.workflowId, workflowId)
        ),
        with: {
          steps: {
            orderBy: (steps, { asc }) => [asc(steps.createdAt)],
            with: {
              workflowStep: {
                with: {
                  agent: true,
                },
              },
              inputsForStep: {
                with: {
                  value: true, // Need to get the file relation separately because its too deeply nested. Was giving errors
                },
              },
            },
          },
          workflow: true,
        },
      });

      if (!workflowRun) {
        throw new Error(`Workflow run not found for id: ${workflowRunId}`);
      }

      if (!workflowRun.steps || workflowRun.steps.length === 0) {
        throw new Error(`No steps found for workflow run: ${workflowRunId}`);
      }

      // Fetch associated file data manually for file inputs in the first step
      const firstStepInputs = workflowRun.steps[0]?.inputsForStep;
      if (firstStepInputs) {
        for (const input of firstStepInputs) {
          if (input.type === "file" && input.value?.fileId) {
            const fileRecord = await db.query.workflowFiles.findFirst({
              where: eq(workflowFiles.id, input.value.fileId),
            });
            // Attach the fetched file data to the input's value object
            // We'll cast input.value to any temporarily to add the file property
            if (fileRecord) {
              (input.value as any).file = fileRecord;
            } else {
              console.warn(
                `File record not found for fileId: ${input.value.fileId} in workflow run ${workflowRunId}`
              );
              (input.value as any).file = null; // Indicate missing file
            }
          }
        }
      }

      // Prepare executionInputValues from the first step's inputs
      const executionInputValues: WorkflowExecutionInputValues = {};
      // Reuse firstStepInputs which now potentially has file data attached
      // const firstStepInputs = workflowRun.steps[0]?.inputsForStep; // Already defined above

      if (!firstStepInputs) {
        throw new Error(
          `No inputs found for first step of workflow run: ${workflowRunId}`
        );
      }

      for (const input of firstStepInputs) {
        if (!input.key) {
          console.warn(`Input missing key in workflow run ${workflowRunId}`);
          continue;
        }

        if (!input.value) {
          console.warn(
            `Input ${input.key} missing value in workflow run ${workflowRunId}`
          );
          continue;
        }

        try {
          let valueObject: WorkflowExecutionInputValue["value"] | null = null;

          switch (input.type) {
            case "text":
              if (typeof input.value.text !== "string") {
                throw new Error(`Invalid text value for input ${input.key}`);
              }
              valueObject = { text: input.value.text };
              break;

            case "number":
              if (typeof input.value.number !== "number") {
                throw new Error(`Invalid number value for input ${input.key}`);
              }
              valueObject = { number: input.value.number };
              break;

            case "file":
              // Access the manually attached file data
              const fileData = (input.value as any)?.file;
              if (!fileData) {
                // Check if fileId existed but lookup failed
                if (input.value?.fileId) {
                  console.error(
                    `File data missing for input ${input.key} despite having fileId ${input.value.fileId}. Lookup likely failed.`
                  );
                  throw new Error(
                    `Missing file data for input ${input.key} (lookup failed)`
                  );
                } else {
                  throw new Error(
                    `Missing file data for input ${input.key} (no fileId)`
                  );
                }
              }
              valueObject = {
                fileKey: fileData.fileKey ?? "",
                mimeType: fileData.mimeType ?? "",
                filename: fileData.name ?? "",
              };
              break;

            default:
              throw new Error(
                `Unsupported input type: ${input.type} for key: ${input.key}`
              );
          }

          if (valueObject) {
            executionInputValues[input.key] = {
              type: input.type as "text" | "file" | "number",
              label: input.label ?? "",
              value: valueObject,
            };
          }
        } catch (error) {
          console.error(`Error processing input ${input.key}:`, error);
          // Skip this input but continue processing others
          continue;
        }
      }

      return {
        ...workflowRun,
        executionInputValues,
      };
    } catch (error) {
      console.error("Error in getWorkflowRun:", error);
      throw error instanceof Error
        ? error
        : new Error("An unexpected error occurred while getting workflow run");
    }
  },

  createWorkflowRun: async (
    workflowId: string,
    inputValues: Record<string, WorkflowExecutionInputValue>,
    userId: string
  ) => {
    try {
      // 1. Get the workflow and its steps
      const workflow = await workflowsOps.getWorkflow(workflowId);
      if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        throw new Error(
          "Workflow not found or has no steps defined. Cannot create run."
        );
      }

      let newWorkflowRunId: string | undefined;
      let createdRunSteps: { id: string; workflowStepId: string }[] = [];

      // Use a transaction to ensure atomicity
      try {
        await db.transaction(async (tx) => {
          // 2. Create the workflow run entry and get its ID
          const [newWorkflowRun] = await tx
            .insert(workflowRuns)
            .values({
              workflowId,
              status: "pending",
              userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning({ id: workflowRuns.id });

          if (!newWorkflowRun || !newWorkflowRun.id) {
            throw new Error("Failed to create workflow run record");
          }
          newWorkflowRunId = newWorkflowRun.id;

          // 3. Prepare and insert data for workflow run steps
          const runStepsData = workflow.steps.map((step) => ({
            workflowRunId: newWorkflowRunId!,
            workflowStepId: step.id,
            status: "pending" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          try {
            createdRunSteps = await tx
              .insert(workflowRunSteps)
              .values(runStepsData)
              .returning({
                id: workflowRunSteps.id,
                workflowStepId: workflowRunSteps.workflowStepId,
              });
          } catch (error: any) {
            console.error("Error creating workflow run steps:", error);
            throw new Error(
              `Failed to create workflow run steps: ${error.message}`
            );
          }

          // --- Populate inputs for the FIRST step ---
          const firstWorkflowStepId = workflow.steps[0].id;
          const firstRunStep = createdRunSteps.find(
            (rs) => rs.workflowStepId === firstWorkflowStepId
          );

          if (!firstRunStep) {
            throw new Error(
              "Could not find the created run step for the first workflow step."
            );
          }
          const firstRunStepId = firstRunStep.id;

          // 4. Iterate through user-provided inputValues
          try {
            for (const [key, inputValue] of Object.entries(inputValues)) {
              // 4a. Insert the input definition
              const [newInput] = await tx
                .insert(workflowRunStepsInputs)
                .values({
                  workflowRunStepId: firstRunStepId,
                  key: key,
                  label: inputValue.label,
                  type: inputValue.type,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning({ id: workflowRunStepsInputs.id });

              if (!newInput || !newInput.id) {
                throw new Error(
                  `Failed to create input record for key: ${key}`
                );
              }

              // 4b. Prepare and insert the input value based on type
              let valueToInsert: any = {
                workflowRunStepInputId: newInput.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              try {
                switch (inputValue.type) {
                  case "text":
                    const textValue =
                      WorkflowTextExecutionInputValueSchema.parse(
                        inputValue.value
                      );
                    valueToInsert.text = textValue.text;
                    break;
                  case "number":
                    const numberValue =
                      WorkflowNumberExecutionInputValueSchema.parse(
                        inputValue.value
                      );
                    valueToInsert.number = numberValue.number;
                    break;
                  case "file":
                    const fileValue =
                      WorkflowFileExecutionInputValueSchema.parse(
                        inputValue.value
                      );
                    // Insert file record first
                    const [newFile] = await tx
                      .insert(workflowFiles)
                      .values({
                        workflowRunStepId: firstRunStepId,
                        workflowRunId: newWorkflowRunId,
                        name: fileValue.filename,
                        mimeType: fileValue.mimeType,
                        fileKey: fileValue.fileKey,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      })
                      .returning({ id: workflowFiles.id });

                    if (!newFile || !newFile.id) {
                      throw new Error(
                        `Failed to create file record for input key: ${key}`
                      );
                    }
                    valueToInsert.fileId = newFile.id;
                    break;
                  default:
                    throw new Error(
                      `Unsupported input type: ${inputValue.type}`
                    );
                }

                // 4c. Insert the actual value
                await tx
                  .insert(workflowRunStepsInputsValue)
                  .values(valueToInsert);
              } catch (error: any) {
                console.error(
                  `Error processing input value for key ${key}:`,
                  error
                );
                throw new Error(
                  `Failed to process input value: ${error.message}`
                );
              }
            }
          } catch (error: any) {
            console.error("Error processing input values:", error);
            throw new Error(`Failed to process input values: ${error.message}`);
          }
        }); // End transaction
      } catch (error: any) {
        console.error("Transaction error:", error);
        throw new Error(`Database transaction failed: ${error.message}`);
      }

      if (!newWorkflowRunId) {
        throw new Error("Workflow run creation failed or was rolled back.");
      }

      // 5. Fetch and return the created run with its steps
      try {
        const createdRun = await db.query.workflowRuns.findFirst({
          where: eq(workflowRuns.id, newWorkflowRunId),
          with: {
            steps: true,
          },
        });

        if (!createdRun) {
          throw new Error(
            "Failed to retrieve the created workflow run post-transaction."
          );
        }

        return createdRun;
      } catch (error: any) {
        console.error("Error fetching created workflow run:", error);
        throw new Error(
          `Failed to fetch created workflow run: ${error.message}`
        );
      }
    } catch (error) {
      console.error("Error in createWorkflowRun:", error);
      throw error;
    }
  },

  runWorkflow: async (workflowRun: WorkflowRun) => {
    const workflowRunner = new WorkflowRunner(workflowRun, async (update) => {
      try {
        // Send updates to the event bus
        console.log("Emitting update:", update);
        eventBus.emit(workflowRun.workflowId, update);

        // Store the updates to the db
        if (update.type === "workflow_start") {
          await db
            .update(workflowRuns)
            .set({
              status: "running",
              updatedAt: new Date(),
            })
            .where(eq(workflowRuns.id, workflowRun.runId));
        }

        if (update.type === "workflow_step_start") {
          console.log("\n\n");
          console.log("Updating workflow step status to running");
          console.log(update.data);
          console.log("\n\n");
          await db
            .update(workflowRunSteps)
            .set({
              status: "running",
              updatedAt: new Date(),
            })
            .where(eq(workflowRunSteps.id, update.data.stepId));
        }

        if (update.type === "workflow_step_message") {
          const { stepId, text, toolCalls, toolResults, role } = update.data;
          try {
            const [newMessage] = await db
              .insert(workflowRunStepMessages)
              .values({
                workflowRunStepId: stepId,
                text,
                role,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning({ id: workflowRunStepMessages.id });

            if (toolCalls) {
              for (const toolCall of toolCalls) {
                await db.insert(workflowRunStepToolCalls).values({
                  workflowRunStepMessageId: newMessage.id,
                  toolName: toolCall.toolName,
                  toolCallId: toolCall.toolCallId,
                  args: toolCall.args,
                  status: "pending",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }

            if (toolResults) {
              for (const toolResult of toolResults) {
                await db
                  .update(workflowRunStepToolCalls)
                  .set({
                    result: toolResult.result,
                    status: "completed",
                    updatedAt: new Date(),
                  })
                  .where(
                    eq(
                      workflowRunStepToolCalls.toolCallId,
                      toolResult.toolCallId
                    )
                  );
              }
            }
          } catch (error) {
            console.error("Error handling workflow step message:", error);
            throw new Error(
              `Failed to process workflow step message: ${error}`
            );
          }
        }

        if (update.type === "workflow_step_artifact_event") {
          try {
            const { stepId, artifact } = update.data;
            if (artifact.type === "created") {
              const [newFile] = await db
                .insert(workflowFiles)
                .values({
                  workflowRunStepId: stepId,
                  workflowRunId: workflowRun.runId,
                  name: artifact.filename,
                  mimeType: artifact.mimeType,
                  fileKey: artifact.fileKey,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning({ id: workflowFiles.id });

              await db.insert(workflowRunStepsOutputs).values({
                workflowRunStepId: stepId,
                fileId: newFile.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          } catch (error) {
            console.error("Error handling workflow step artifact:", error);
            throw new Error(
              `Failed to process workflow step artifact: ${error}`
            );
          }
        }

        if (update.type === "workflow_step_finish") {
          await db
            .update(workflowRunSteps)
            .set({
              status: "completed",
              updatedAt: new Date(),
            })
            .where(eq(workflowRunSteps.id, update.data.stepId));
        }

        if (update.type === "workflow_step_error") {
          await db
            .update(workflowRunSteps)
            .set({
              status: "failed",
              updatedAt: new Date(),
            })
            .where(eq(workflowRunSteps.id, update.data.stepId));
        }

        if (update.type === "workflow_complete") {
          await db
            .update(workflowRuns)
            .set({
              status: "completed",
              updatedAt: new Date(),
            })
            .where(eq(workflowRuns.id, workflowRun.runId));
        }

        if (update.type === "workflow_error") {
          await db
            .update(workflowRuns)
            .set({
              status: "failed",
              updatedAt: new Date(),
            })
            .where(eq(workflowRuns.id, workflowRun.runId));
        }
      } catch (error) {
        console.error("Error processing workflow update:", error);
        // Update workflow run status to failed on any error
        await db
          .update(workflowRuns)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, workflowRun.runId))
          .catch((err) => {
            console.error("Failed to update workflow status to failed:", err);
          });
        throw new Error(`Failed to process workflow update: ${error}`);
      }
    });

    try {
      await workflowRunner.run();
    } catch (error) {
      console.error("Error running workflow:", error);
      // Ensure workflow run is marked as failed
      await db
        .update(workflowRuns)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(workflowRuns.id, workflowRun.runId))
        .catch((err) => {
          console.error("Failed to update workflow status to failed:", err);
        });
      throw new Error(`Workflow execution failed: ${error}`);
    }
  },

  getWorkflowRuns: async (workflowId: string) => {
    const runs = await db.query.workflowRuns.findMany({
      where: eq(workflowRuns.workflowId, workflowId),
      orderBy: (workflowRuns, { desc }) => [desc(workflowRuns.createdAt)],
      with: {
        steps: {
          with: {
            workflowStep: true,
          },
        },
      },
    });

    // Sort steps for each run in application code based on workflowStep.createdAt
    runs.forEach((run) => {
      if (run.steps) {
        run.steps.sort((a, b) => {
          // Ensure workflowStep and createdAt exist before comparing
          const dateA = a.workflowStep?.createdAt
            ? new Date(a.workflowStep.createdAt).getTime()
            : 0;
          const dateB = b.workflowStep?.createdAt
            ? new Date(b.workflowStep.createdAt).getTime()
            : 0;
          return dateA - dateB;
        });
      }
    });

    return runs;
  },
};
