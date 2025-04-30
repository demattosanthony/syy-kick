import { CONFIG } from "../../config/constants";
import {
  basisOfDesignGenWorkflow,
  billOfMaterialsWorkflow,
  equipmentServingListWorkflow,
  rfpEvalWorkflow,
  windowDoorScheduleGenWorkflow,
} from "./workflow-definitions";
import { Workflow } from "./workflows.types";

const workflows: Workflow[] = [
  rfpEvalWorkflow,
  windowDoorScheduleGenWorkflow,
  equipmentServingListWorkflow,
  basisOfDesignGenWorkflow,
  billOfMaterialsWorkflow,
];

const workflowRegistry = new Map<string, Workflow>();
workflows.forEach((wf) => {
  try {
    workflowRegistry.set(wf.id, wf);
  } catch (e) {
    console.error(`Error validating workflow definition '${wf.id}':`, e);
  }
});

export function getWorkflowDefinition(id: string): Workflow | undefined {
  if (!CONFIG.__prod__) {
    return workflowRegistry.get(id);
  }

  return workflowRegistry.get(id);
}

export function getAllWorkflowDefinitions(): Workflow[] {
  if (!CONFIG.__prod__) {
    return Array.from(workflowRegistry.values());
  }

  return Array.from(workflowRegistry.values()).filter(
    (workflow) =>
      !workflow.authorizedOrganizationIds ||
      workflow.authorizedOrganizationIds.length === 0
  );
}

export function getAuthorizedWorkflowDefinitions(
  organizationId: string
): Workflow[] {
  if (!CONFIG.__prod__) {
    return Array.from(workflowRegistry.values());
  }

  return Array.from(workflowRegistry.values()).filter(
    (workflow) =>
      !workflow.authorizedOrganizationIds ||
      workflow.authorizedOrganizationIds.length === 0 ||
      workflow.authorizedOrganizationIds.includes(organizationId)
  );
}

export function isWorkflowAuthorized(
  workflowId: string,
  organizationId: string
): boolean {
  const workflow = getWorkflowDefinition(workflowId);
  if (!workflow) return false;
  if (
    !workflow.authorizedOrganizationIds ||
    workflow.authorizedOrganizationIds.length === 0
  )
    return true;
  return workflow.authorizedOrganizationIds.includes(organizationId);
}
