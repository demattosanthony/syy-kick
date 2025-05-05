/** Drizzle */
import { eq, or, exists, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

/** Schemas */
import {
  workflows,
  workflowOrganizations,
  workflowUsers,
  workflowSteps,
  workflowRunSteps,
  workflowRunStepsInputs,
  workflowRunStepsInputsValue,
  workflowRunStepsOutputs,
  type Workflow,
  workflowRuns,
  workflowFiles,
} from "./workflows.schema";

/** Database */
import db from "../../config/db";

/** Types */
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  WorkflowRunStep,
  WorkflowWithRelations,
  WorkflowStepUpdateInput,
} from "./workflows.types";
import { workflowsUtils } from "./workflows.utils";

export const workflowsOps = {
  getWorkflows: async ({
    orgId,
    userId,
  }: {
    orgId?: string;
    userId?: string;
  }) => {
    if (!orgId && !userId) {
      throw new Error("Either orgId or userId must be provided");
    }

    const orgWorkflows: WorkflowWithRelations[] =
      await db.query.workflows.findMany({
        orderBy: (workflows, { desc }) => [desc(workflows.createdAt)],
        where: or(
          orgId
            ? exists(
                db
                  .select()
                  .from(workflowOrganizations)
                  .where(
                    eq(workflowOrganizations.workflowId, workflows.id) &&
                      eq(workflowOrganizations.organizationId, orgId)
                  )
              )
            : undefined,
          userId
            ? exists(
                db
                  .select()
                  .from(workflowUsers)
                  .where(
                    eq(workflowUsers.workflowId, workflows.id) &&
                      eq(workflowUsers.userId, userId)
                  )
              )
            : undefined
        ),
        with: {
          steps: {
            with: {
              agent: true,
            },
            orderBy: (steps, { asc }) => [asc(steps.createdAt)],
          },
        },
      });

    return workflowsUtils.formatWorkflows(orgWorkflows);
  },

  getWorkflow: async (workflowId: string) => {
    const workflow: WorkflowWithRelations | undefined =
      await db.query.workflows.findFirst({
        where: eq(workflows.id, workflowId),
        with: {
          steps: {
            with: {
              agent: true,
            },
            orderBy: (steps, { asc }) => [asc(steps.createdAt)],
          },
          tags: true,
        },
      });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    return workflowsUtils.formatWorkflow(workflow);
  },

  createWorkflow: async (
    userId: string,
    name: string,
    description: string,
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<typeof workflows.$inferSelect> => {
    const [workflow] = await tx
      .insert(workflows)
      .values({
        name,
        description,
        createdBy: userId,
      })
      .returning();

    return workflow;
  },

  createWorkflowSteps: async (
    workflowId: string,
    steps: WorkflowRunStep[],
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<void> => {
    let previousStepId: string | null = null;
    let currentTimestamp = new Date();

    for (const step of steps) {
      const { id, ...stepData } = step;

      const baseValues = {
        workflowId,
        parentStepId: previousStepId,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      };

      const values = step.agentId
        ? {
            ...baseValues,
            agentId: step.agentId,
          }
        : {
            ...baseValues,
            ...stepData,
          };

      const [insertedStep] = (await tx
        .insert(workflowSteps)
        .values(values as any)
        .returning({ id: workflowSteps.id })) as [{ id: string }];

      if (!insertedStep) {
        throw new Error(
          `Failed to insert workflow step ${(step as any).name || "(unknown name)"}`
        );
      }

      previousStepId = insertedStep.id;
      currentTimestamp = new Date(currentTimestamp.getTime() + 1);
    }
  },

  updateWorkflow: async (
    workflowId: string,
    updateData: Partial<Pick<Workflow, "name" | "description">>,
    steps: WorkflowStepUpdateInput[],
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<string> => {
    // 1. Update workflow details if provided
    if (Object.keys(updateData).length > 0) {
      await tx
        .update(workflows)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(workflows.id, workflowId));
    }

    // 2a. Get IDs of the workflowSteps associated with the workflow.
    const workflowStepsToDelete = await tx
      .select({ id: workflowSteps.id })
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, workflowId));

    // 2b. If there are workflowSteps to delete...
    if (workflowStepsToDelete.length > 0) {
      const workflowStepIdsToDelete = workflowStepsToDelete.map(
        (step) => step.id
      );

      // Before deleting the workflowSteps, update referencing workflowRunSteps
      // to set workflowStepId to NULL to prevent FK violation.
      // The run steps retain the necessary step info via duplicated fields.
      await tx
        .update(workflowRunSteps)
        .set({ workflowStepId: sql`null` })
        .where(
          inArray(workflowRunSteps.workflowStepId, workflowStepIdsToDelete)
        );

      // Now delete the old workflowSteps.
      await tx
        .delete(workflowSteps)
        .where(inArray(workflowSteps.id, workflowStepIdsToDelete));
    }

    // 3. Insert new steps
    let previousStepId: string | null = null;
    let currentTimestamp = new Date();

    for (const stepInput of steps) {
      const baseValues = {
        workflowId,
        parentStepId: previousStepId,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      };

      const values = stepInput.agentId
        ? {
            ...baseValues,
            agentId: stepInput.agentId,
          }
        : {
            ...baseValues,
            ...stepInput,
          };

      // const valuesToInsert: Partial<WorkflowStep> = {
      //   workflowId,
      //   parentStepId: previousStepId,
      //   createdAt: currentTimestamp,
      //   updatedAt: currentTimestamp,
      //   ...stepInput, // Spread the original input
      // };

      // // Remove undefined keys explicitly
      // Object.keys(valuesToInsert).forEach((key) => {
      //   if (valuesToInsert[key as keyof typeof valuesToInsert] === undefined) {
      //     delete valuesToInsert[key as keyof typeof valuesToInsert];
      //   }
      // });

      const [insertedStep] = (await tx
        .insert(workflowSteps)
        .values(values)
        .returning({ id: workflowSteps.id })) as [{ id: string }];

      if (!insertedStep) {
        throw new Error(
          `Failed to insert workflow step ${
            stepInput.name || "(unknown name)"
          } during update`
        );
      }

      previousStepId = insertedStep.id;
      currentTimestamp = new Date(currentTimestamp.getTime() + 1);
    }

    return workflowId;
  },

  createWorkflowOrganizationRelation: async (
    workflowId: string,
    organizationId: string,
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<void> => {
    await tx.insert(workflowOrganizations).values({
      workflowId,
      organizationId,
    });
  },

  createWorkflowUserRelation: async (
    workflowId: string,
    userId: string,
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<void> => {
    await tx.insert(workflowUsers).values({
      workflowId,
      userId,
    });
  },

  deleteWorkflow: async (
    workflowId: string,
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<void> => {
    // 1. Find associated workflowRuns
    const runsToDelete = await tx
      .select({ id: workflowRuns.id })
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflowId));

    const runIdsToDelete = runsToDelete.map((run) => run.id);

    if (runIdsToDelete.length > 0) {
      // 2. Find associated workflowRunSteps
      const runStepsToDelete = await tx
        .select({ id: workflowRunSteps.id })
        .from(workflowRunSteps)
        .where(inArray(workflowRunSteps.workflowRunId, runIdsToDelete));

      const runStepIdsToDelete = runStepsToDelete.map((step) => step.id);

      if (runStepIdsToDelete.length > 0) {
        // 3. Find associated workflowRunStepsInputs
        const runStepsInputsToDelete = await tx
          .select({ id: workflowRunStepsInputs.id })
          .from(workflowRunStepsInputs)
          .where(
            inArray(
              workflowRunStepsInputs.workflowRunStepId,
              runStepIdsToDelete
            )
          );

        const runStepInputIdsToDelete = runStepsInputsToDelete.map(
          (input) => input.id
        );

        if (runStepInputIdsToDelete.length > 0) {
          // 4. CRITICAL: Delete *all* workflowRunStepsInputsValue associated with the inputs
          // This must happen before the cascade delete reaches workflowRunStepsInputs
          await tx
            .delete(workflowRunStepsInputsValue)
            .where(
              inArray(
                workflowRunStepsInputsValue.workflowRunStepInputId,
                runStepInputIdsToDelete
              )
            );
        }

        // 5. Find associated workflowFiles using workflowRunIds
        const filesToDelete = await tx
          .select({ id: workflowFiles.id })
          .from(workflowFiles)
          .where(inArray(workflowFiles.workflowRunId, runIdsToDelete));

        const fileIdsToDelete = filesToDelete.map((file) => file.id);

        if (fileIdsToDelete.length > 0) {
          // 6. Delete records directly referencing workflowFiles that might block deletion
          // Example: workflowRunStepsOutputs might reference files.
          // If cascade isn't set or doesn't work reliably for file FKs, delete explicitly.
          // Let's add back the output deletion for safety.
          await tx
            .delete(workflowRunStepsOutputs)
            .where(inArray(workflowRunStepsOutputs.fileId, fileIdsToDelete));

          // We already deleted workflowRunStepsInputsValue based on input ID,
          // so no need to delete based on file ID here.
          // We assume workflowRunStepMessagesDocuments cascade correctly from messages/steps.

          // 7. Now explicitly delete the workflowFiles themselves.
          await tx
            .delete(workflowFiles)
            .where(inArray(workflowFiles.id, fileIdsToDelete)); // Delete by file ID
        }
      }
    }

    // 8. Delete relations not handled by cascade (Organizations, Users)
    await tx
      .delete(workflowOrganizations)
      .where(eq(workflowOrganizations.workflowId, workflowId));
    await tx
      .delete(workflowUsers)
      .where(eq(workflowUsers.workflowId, workflowId)); // Keep corrected field

    // 9. Delete the workflow itself. Rely on ON DELETE CASCADE for the rest.
    // Cascade should now work for workflowSteps -> workflowRunSteps -> workflowRunStepsInputs
    // because workflowRunStepsInputsValue was manually cleared.
    const deleteResult = await tx
      .delete(workflows)
      .where(eq(workflows.id, workflowId));

    // Check if any rows were affected to ensure the workflow existed
    if (deleteResult.rowCount === 0) {
      throw new Error(
        `Workflow with ID ${workflowId} not found or already deleted.`
      );
    }
  },
};
