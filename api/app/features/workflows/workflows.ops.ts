/** Drizzle */
import { eq, or, exists, inArray } from "drizzle-orm";

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
import { WorkflowStep } from "./workflows.schema";

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

    // 2b. If there are workflowSteps to delete, handle cascading deletes manually.
    if (workflowStepsToDelete.length > 0) {
      const workflowStepIdsToDelete = workflowStepsToDelete.map(
        (step) => step.id
      );

      // Find associated workflowRunSteps.
      const workflowRunStepsToDelete = await tx
        .select({ id: workflowRunSteps.id })
        .from(workflowRunSteps)
        .where(
          inArray(workflowRunSteps.workflowStepId, workflowStepIdsToDelete)
        );

      const workflowRunStepIdsToDelete = workflowRunStepsToDelete.map(
        (runStep) => runStep.id
      );

      if (workflowRunStepIdsToDelete.length > 0) {
        // Find associated workflowRunStepsInputs.
        const workflowRunStepsInputsToDelete = await tx
          .select({ id: workflowRunStepsInputs.id })
          .from(workflowRunStepsInputs)
          .where(
            inArray(
              workflowRunStepsInputs.workflowRunStepId,
              workflowRunStepIdsToDelete
            )
          );

        const workflowRunStepInputIdsToDelete =
          workflowRunStepsInputsToDelete.map((input) => input.id);

        // Delete associated workflowRunStepsInputsValue first.
        if (workflowRunStepInputIdsToDelete.length > 0) {
          await tx
            .delete(workflowRunStepsInputsValue)
            .where(
              inArray(
                workflowRunStepsInputsValue.workflowRunStepInputId,
                workflowRunStepInputIdsToDelete
              )
            );
        }

        // Delete associated workflowRunStepsOutputs.
        await tx
          .delete(workflowRunStepsOutputs)
          .where(
            inArray(
              workflowRunStepsOutputs.workflowRunStepId,
              workflowRunStepIdsToDelete
            )
          );
      }

      // Now delete the workflowSteps (this will cascade delete workflowRunSteps and workflowFiles).
      await tx
        .delete(workflowSteps)
        .where(inArray(workflowSteps.id, workflowStepIdsToDelete));
    }

    // 3. Re-insert new steps with correct parent linking
    let previousStepId: string | null = null;
    let currentTimestamp = new Date();

    for (const stepInput of steps) {
      // Construct the object with a suitable type and filter undefined
      const valuesToInsert: Partial<WorkflowStep> = {
        workflowId,
        parentStepId: previousStepId,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
        ...stepInput,
      };

      // Remove undefined keys explicitly
      Object.keys(valuesToInsert).forEach((key) => {
        if (valuesToInsert[key as keyof typeof valuesToInsert] === undefined) {
          delete valuesToInsert[key as keyof typeof valuesToInsert];
        }
      });

      const [insertedStep] = (await tx
        .insert(workflowSteps)
        .values(valuesToInsert as any)
        .returning({ id: workflowSteps.id })) as [{ id: string }];

      if (!insertedStep) {
        throw new Error(
          `Failed to insert workflow step ${
            stepInput.name || "(unknown name)"
          } during update`
        );
      }

      previousStepId = insertedStep.id;
      currentTimestamp = new Date(currentTimestamp.getTime() + 1); // Ensure distinct timestamps for ordering
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
};
