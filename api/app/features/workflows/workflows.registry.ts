import { ArtifactService } from "./artifact-service";
import {
  createPdfPageExtractionTool,
  createObjectDetectionTool,
} from "./tools";
import {
  basisOfDesignGenWorkflow,
  billOfMaterialsWorkflow,
  equipmentServingListWorkflow,
  rfpEvalWorkflow,
} from "./workflow-definitions";
import {
  executePdfPageExtractionStep,
  executeObjectDetectionStep,
  documentOcrStep,
  executeLLMStep,
} from "./workflow-processors";
import {
  StepExecutorFunction,
  Workflow,
  WorkflowSchema,
} from "./workflows.schemas";

const workflows: Workflow[] = [rfpEvalWorkflow, basisOfDesignGenWorkflow];

const workflowRegistry = new Map<string, Workflow>();
workflows.forEach((wf) => {
  try {
    WorkflowSchema.parse(wf); // Validate schema on load
    workflowRegistry.set(wf.id, wf);
  } catch (e) {
    console.error(`Error validating workflow definition '${wf.id}':`, e);
  }
});

export function getWorkflowDefinition(id: string): Workflow | undefined {
  return workflowRegistry.get(id);
}

export function getAllWorkflowDefinitions(): Workflow[] {
  return Array.from(workflowRegistry.values());
}

export function getAuthorizedWorkflowDefinitions(
  organizationId: string
): Workflow[] {
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

export const stepExecutorRegistry = new Map<string, StepExecutorFunction>();
stepExecutorRegistry.set("llm", executeLLMStep);
stepExecutorRegistry.set("pdf_page_extract", executePdfPageExtractionStep);
stepExecutorRegistry.set("object_detection", executeObjectDetectionStep);
stepExecutorRegistry.set("document_ocr", documentOcrStep);

export const createToolSet = (toolArtifactService: ArtifactService) => {
  const artifactTools = toolArtifactService.getArtifactTools();
  return {
    "list-artifacts": artifactTools["list-artifacts"],
    "load-artifact": artifactTools["load-artifact"],
    "create-artifact": artifactTools["create-artifact"],

    "pdf-page-extraction": createPdfPageExtractionTool(toolArtifactService),
    "object-detection": createObjectDetectionTool(toolArtifactService),
  };
};
