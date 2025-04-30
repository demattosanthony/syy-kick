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
import { agents } from "../features/agents/agents.schema";
import {
  workflowFiles,
  workflowRuns,
  workflowRunStepMessages,
  workflowRunSteps,
  workflowRunStepsInputs,
  workflowRunStepsInputsValue,
  workflowRunStepsOutputs,
  workflowRunStepToolCalls,
  workflowSteps,
} from "../workflows.schema";
import { InferSelectModel } from "drizzle-orm";
import db from "../../../config/db";
import { WorkflowRunner } from "./workflows.runner";
import EventEmitter from "events";

// Event bus for workflow events
export const eventBus = new EventEmitter();

// Define the type for a workflow step including its relations (agents)
// We infer the base type from the schema and add the relations manually
type WorkflowStepWithRelations = InferSelectModel<typeof workflowSteps> & {
  agents: InferSelectModel<typeof agents> | null; // Assuming agents is the relation name and it can be null
  // Add other relations here if needed, matching the 'with' clause in getWorkflow
};

export const workflowRunsOps = {
  getWorkflowRun: async (workflowId: string, workflowRunId: string) => {
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
                agents: true,
              },
            },
            inputs: {
              with: {
                value: {
                  with: {
                    file: true,
                  },
                },
              },
            },
          },
        },
        workflow: true,
      },
    });

    if (!workflowRun) {
      throw new Error("Workflow run not found");
    }

    // Prepare executionInputValues from the first step's inputs
    const executionInputValues: WorkflowExecutionInputValues = {};
    const firstStepInputs = workflowRun.steps[0]?.inputs;

    if (firstStepInputs) {
      for (const input of firstStepInputs) {
        if (input.key && input.value) {
          let valueObject: WorkflowExecutionInputValue["value"] | null = null;
          switch (input.type) {
            case "text":
              // Check type and ensure value exists
              if (
                input.type === "text" &&
                input.value &&
                typeof input.value.text === "string"
              ) {
                valueObject = { text: input.value.text };
              } else {
                valueObject = { text: "" }; // Default or error handling
              }
              break;
            case "number":
              // Check type and ensure value exists
              if (
                input.type === "number" &&
                input.value &&
                typeof input.value.number === "number"
              ) {
                valueObject = { number: input.value.number };
              } else {
                valueObject = { number: 0 }; // Default or error handling
              }
              break;
            case "file":
              // Rely on switch for type narrowing, check value and file exist
              if (input.value && (input.value as any).file) {
                // Use type assertion (as any) to bypass TS check
                const fileData = (input.value as any).file;
                valueObject = {
                  fileKey: fileData.fileKey ?? "",
                  mimeType: fileData.mimeType ?? "",
                  filename: fileData.name ?? "",
                };
              } else {
                valueObject = { fileKey: "", mimeType: "", filename: "" };
              }
              break;
            // Handle other types if necessary
            default:
              // Handle unexpected input types
              console.warn(
                `Unhandled input type: ${input.type} for key: ${input.key}`
              );
              break;
          }

          if (valueObject) {
            executionInputValues[input.key] = {
              type: input.type as "text" | "file" | "number", // Cast type
              label: input.label ?? "",
              value: valueObject,
            };
          }
        }
      }
    }

    // Return the augmented workflow run object
    // We might need a more specific return type later
    return {
      ...workflowRun,
      executionInputValues,
    };
  },

  createWorkflowRun: async (
    workflowId: string,
    inputValues: Record<string, WorkflowExecutionInputValue>
  ) => {
    // 1. Get the workflow and its steps
    const workflow = await workflowsOps.getWorkflow(workflowId);
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      throw new Error(
        "Workflow not found or has no steps defined. Cannot create run."
      );
    }

    // --- Linear Sorting Logic for Workflow Steps ---
    // Needed to ensure the steps are executed in the correct order
    // Uses the workflow step parentStepId to determine the order
    const sortedWorkflowSteps: WorkflowStepWithRelations[] = [];
    const stepMap = new Map(workflow.steps.map((step) => [step.id, step]));
    const parentToChildMap = new Map<string, string>(); // Map parentId -> childId for quick lookup
    let rootStep: WorkflowStepWithRelations | undefined = undefined;

    for (const step of workflow.steps) {
      if (step.parentStepId === null) {
        if (rootStep) {
          throw new Error(
            "Workflow has multiple root steps (parentStepId is null)."
          );
        }
        rootStep = step;
      } else {
        if (parentToChildMap.has(step.parentStepId)) {
          throw new Error(
            `Workflow has branching steps. Parent step ${step.parentStepId} has multiple children.`
          );
        }
        parentToChildMap.set(step.parentStepId, step.id);
      }
    }

    if (!rootStep) {
      throw new Error("Workflow has no root step (parentStepId is null).");
    }

    let currentStep: WorkflowStepWithRelations | undefined = rootStep;
    while (currentStep) {
      sortedWorkflowSteps.push(currentStep);
      const nextStepId = parentToChildMap.get(currentStep.id);
      currentStep = nextStepId ? stepMap.get(nextStepId) : undefined;
    }

    // Verification: Ensure all steps were included (detects gaps or cycles in the linear chain)
    if (sortedWorkflowSteps.length !== workflow.steps.length) {
      // This could happen if there's a cycle or disconnected steps
      console.error("Sorted steps count does not match original steps count.", {
        sortedCount: sortedWorkflowSteps.length,
        originalCount: workflow.steps.length,
      });
      throw new Error(
        "Failed to sort workflow steps into a single linear sequence. Check for gaps, cycles, or disconnected steps."
      );
    }
    // --- End Linear Sorting Logic ---

    if (sortedWorkflowSteps.length === 0) {
      throw new Error("Workflow has no steps after attempting to sort.");
    }

    let newWorkflowRunId: string | undefined;
    let createdRunSteps: { id: string; workflowStepId: string }[] = [];

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // 2. Create the workflow run entry and get its ID
      const [newWorkflowRun] = await tx
        .insert(workflowRuns)
        .values({
          workflowId,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: workflowRuns.id });

      if (!newWorkflowRun || !newWorkflowRun.id) {
        throw new Error("Failed to create workflow run record");
      }
      newWorkflowRunId = newWorkflowRun.id;

      // 3. Prepare and insert data for workflow run steps using the SORTED order
      const runStepsData = sortedWorkflowSteps.map((step) => ({
        workflowRunId: newWorkflowRunId!,
        workflowStepId: step.id,
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      createdRunSteps = await tx
        .insert(workflowRunSteps)
        .values(runStepsData)
        .returning({
          id: workflowRunSteps.id,
          workflowStepId: workflowRunSteps.workflowStepId,
        });

      // --- Populate inputs for the FIRST step (based on the sorted order) ---
      const firstWorkflowStepId = sortedWorkflowSteps[0].id; // Get ID from the first sorted step
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
          throw new Error(`Failed to create input record for key: ${key}`);
        }

        // 4b. Prepare and insert the input value based on type
        let valueToInsert: any = {
          workflowRunStepInputId: newInput.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        switch (inputValue.type) {
          case "text":
            // Revert: Use Zod parsing
            const textValue = WorkflowTextExecutionInputValueSchema.parse(
              inputValue.value
            );
            valueToInsert.text = textValue.text;
            break;
          case "number":
            // Revert: Use Zod parsing
            const numberValue = WorkflowNumberExecutionInputValueSchema.parse(
              inputValue.value
            );
            valueToInsert.number = numberValue.number;
            break;
          case "file":
            // Revert: Use Zod parsing and file creation logic
            const fileValue = WorkflowFileExecutionInputValueSchema.parse(
              inputValue.value
            );
            // Insert file record first
            const [newFile] = await tx
              .insert(workflowFiles)
              .values({
                workflowRunStepId: firstRunStepId, // Associate with the step receiving the input
                workflowRunId: newWorkflowRunId, // Associate with the overall run
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
            // Should be caught by Zod validation earlier, but good practice
            throw new Error(`Unsupported input type: ${inputValue.type}`);
        }

        // 4c. Insert the actual value
        await tx.insert(workflowRunStepsInputsValue).values(valueToInsert);
      }
    }); // End transaction

    if (!newWorkflowRunId) {
      throw new Error("Workflow run creation failed or was rolled back.");
    }

    // 5. Fetch and return the created run with its steps
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
  },

  runWorkflow: async (workflowRun: WorkflowRun) => {
    const workflowRunner = new WorkflowRunner(workflowRun, async (update) => {
      // Send updates to the event bus
      eventBus.emit(workflowRun.workflowId, update);

      // Store the updates to the db

      // Update the existing run status to 'running'
      if (update.type === "workflow_start") {
        await db
          .update(workflowRuns)
          .set({
            status: "running",
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, workflowRun.runId));
      }

      // Update the existing step status to 'running'
      if (update.type === "workflow_step_start") {
        await db
          .update(workflowRunSteps)
          .set({
            status: "running",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workflowRunSteps.workflowRunId, workflowRun.runId),
              eq(workflowRunSteps.workflowStepId, update.data.stepId)
            )
          );
      }

      if (update.type === "workflow_step_message") {
        const { stepId, text, toolCalls, toolResults, role } = update.data;
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
                eq(workflowRunStepToolCalls.toolCallId, toolResult.toolCallId)
              );
          }
        }
      }

      if (update.type === "workflow_step_artifact_event") {
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

          // Add to the workflow step outputs
          await db.insert(workflowRunStepsOutputs).values({
            workflowRunStepId: stepId,
            fileId: newFile.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // Update the existing step status to 'completed'
      if (update.type === "workflow_step_finish") {
        await db
          .update(workflowRunSteps)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workflowRunSteps.workflowRunId, workflowRun.runId),
              eq(workflowRunSteps.workflowStepId, update.data.stepId)
            )
          );
      }

      // Update the existing step status to 'failed'
      if (update.type === "workflow_step_error") {
        await db
          .update(workflowRunSteps)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workflowRunSteps.workflowRunId, workflowRun.runId),
              eq(workflowRunSteps.workflowStepId, update.data.stepId)
            )
          );
      }

      // Update the specific run status to 'completed'
      if (update.type === "workflow_complete") {
        await db
          .update(workflowRuns)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, workflowRun.runId));
      }

      // Update the specific run status to 'failed'
      if (update.type === "workflow_error") {
        await db
          .update(workflowRuns)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(workflowRuns.id, workflowRun.runId));
      }
    });

    try {
      await workflowRunner.run();
    } catch (error) {
      console.error(error);
    }
  },
};
