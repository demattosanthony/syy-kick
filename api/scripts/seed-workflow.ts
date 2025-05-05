import db from "../app/config/db";
import * as schema from "../app/config/schema";
import { inArray } from "drizzle-orm";
import {
  windowDoorScheduleGenWorkflow,
  windowDoorScheduleGenWorkflowSteps,
  windowAndDoorAuthOrgIds,
} from "../app/features/workflows/workflow-definitions/window-door-schedule-gen";
import {
  billOfMaterialsWorkflowSteps,
  billOfMaterialsAuthOrgs,
  billOfMaterialsWorkflow,
} from "../app/features/workflows/workflow-definitions/bill-of-materials";

const CURRENT_WORKFLOW_INDEX = 0;

const workflows = [windowDoorScheduleGenWorkflow, billOfMaterialsWorkflow];
const allWorkflowSteps = [
  windowDoorScheduleGenWorkflowSteps,
  billOfMaterialsWorkflowSteps,
];
const allWorkflowAuthOrgs = [windowAndDoorAuthOrgIds, billOfMaterialsAuthOrgs];

// Select the workflow, steps, and auth orgs based on the index
const selectedWorkflow = workflows[CURRENT_WORKFLOW_INDEX];
const selectedWorkflowSteps = allWorkflowSteps[CURRENT_WORKFLOW_INDEX];
const selectedAuthOrgs = allWorkflowAuthOrgs[CURRENT_WORKFLOW_INDEX];

async function seedWorkflow() {
  console.log("Starting workflow seeding...");

  try {
    await db.transaction(async (tx) => {
      console.log(`Inserting workflow: ${selectedWorkflow.name}`);

      // Insert the main workflow
      const [insertedWorkflow] = await tx
        .insert(schema.workflows)
        .values({
          // Use the id from the definition if provided, otherwise generate a new one
          // id: selectedWorkflow.id, // Assuming the id in the definition is desired
          name: selectedWorkflow.name,
          description: selectedWorkflow.description,
          // createdBy: // Add createdBy user ID if available/needed
        })
        .returning();

      if (!insertedWorkflow) {
        throw new Error("Failed to insert workflow");
      }
      const workflowId = insertedWorkflow.id;
      console.log(`Workflow inserted with ID: ${workflowId}`);

      // Map to store definition step ID -> database step ID
      const definitionIdToDbIdMap: Record<string, string> = {}; // Assuming definition IDs are strings

      // Insert workflow steps for the selected workflow only
      for (const step of selectedWorkflowSteps) {
        // Assuming step objects have a unique 'id' property used by parentStepId
        const stepDefinitionId = (step as any).id; // Cast or ensure 'id' exists on step type
        if (!stepDefinitionId) {
          console.warn(
            `Step definition for '${step.name}' lacks an 'id'. Cannot map database ID accurately. Skipping mapping for this step.`
          );
          // Alternatively, consider using step.name if unique, or throw an error
        }
        console.log(
          `Inserting step: ${step.name}` +
            (stepDefinitionId ? ` (Definition ID: ${stepDefinitionId})` : "")
        );

        // Find the database ID of the parent step, if one is defined
        const dbParentStepId = step.parentStepId
          ? definitionIdToDbIdMap[step.parentStepId]
          : null;

        // Add a check if the parent ID was expected but not found in the map
        if (step.parentStepId && !dbParentStepId) {
          // This might happen if steps in windowDoorScheduleGenWorkflowSteps are not ordered topologically
          // (i.e., a child step appears before its parent in the array).
          console.warn(
            `Parent step with definition ID '${step.parentStepId}' for step '${step.name}' not found in the map of already inserted steps. This might indicate an issue with the step definition order or IDs. Setting parentStepId to null.`
          );
          // Consider throwing an error if strict parent enforcement is required:
          // throw new Error(`Parent step definition ID '${step.parentStepId}' not found for step '${step.name}'. Ensure steps are ordered correctly.`);
        }

        const [insertedStep] = await tx
          .insert(schema.workflowSteps)
          .values({
            workflowId: workflowId,
            // agentId: null, // No agentId provided in the definition
            name: step.name,
            description: step.description,
            instructions: step.instructions,
            model: step.model,
            activeTools: step.activeTools,
            formSchema: step.formSchema,
            // Use the mapped database ID for the parent step
            parentStepId: dbParentStepId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: schema.workflowSteps.id }); // Ensure the ID is returned

        if (!insertedStep) {
          throw new Error(`Failed to insert step: ${step.name}`);
        }
        const newDbStepId = insertedStep.id;
        console.log(`Step '${step.name}' inserted with DB ID: ${newDbStepId}`);

        // Store the mapping from the definition ID to the newly generated database ID
        if (stepDefinitionId) {
          definitionIdToDbIdMap[stepDefinitionId] = newDbStepId;
          console.log(
            `Mapped definition ID '${stepDefinitionId}' to DB ID '${newDbStepId}'`
          );
        }
      }
      console.log("Workflow steps inserted.");

      // Insert authorized organizations for the selected workflow only
      if (selectedAuthOrgs.length) {
        console.log("Inserting authorized organizations...");

        // Check if each org exists before inserting
        const existingOrgs = await tx
          .select({ id: schema.organizations.id })
          .from(schema.organizations)
          .where(inArray(schema.organizations.id, selectedAuthOrgs));

        const existingOrgIds = existingOrgs.map((org) => org.id);

        if (existingOrgIds.length) {
          const orgValues = existingOrgIds.map((orgId) => ({
            workflowId: workflowId,
            organizationId: orgId,
          }));
          await tx.insert(schema.workflowOrganizations).values(orgValues);
          console.log(
            `Inserted ${existingOrgIds.length} authorized organizations.`
          );
        } else {
          console.log(
            "No matching organizations found in database to authorize."
          );
        }
      } else {
        console.log("No authorized organizations to insert.");
      }
    });

    console.log("Workflow seeding completed successfully.");
  } catch (error) {
    console.error("Error seeding workflow:", error);
    // Optional: Exit with error code if run as a standalone script
    // process.exit(1);
  } finally {
    // Optional: Close DB connection if needed when run as a standalone script
    // await db.end(); // Or appropriate method based on your connection pool
  }
}

seedWorkflow();
