import { CONFIG } from "../../config/constants";
import { ArtifactService } from "./artifact-service";
import {
  createPdfPageExtractionTool,
  createObjectDetectionTool,
  createDocOcrTool,
  createWebSearchTool,
} from "./tools";
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

// export const stepExecutorRegistry = new Map<string, StepExecutorFunction>();
// stepExecutorRegistry.set("llm", executeLLMStep);
// stepExecutorRegistry.set("pdf_page_extract", executePdfPageExtractionStep);
// stepExecutorRegistry.set("object_detection", executeObjectDetectionStep);
// stepExecutorRegistry.set("document_ocr", documentOcrStep);

export const createToolSet = (toolArtifactService: ArtifactService) => {
  const artifactTools = toolArtifactService.getArtifactTools();
  return {
    "list-artifacts": artifactTools["list-artifacts"],
    "load-artifact": artifactTools["load-artifact"],
    "create-artifact": artifactTools["create-artifact"],

    "pdf-page-extraction": createPdfPageExtractionTool(toolArtifactService),
    "object-detection": createObjectDetectionTool(toolArtifactService),
    "doc-ocr": createDocOcrTool(toolArtifactService),
    "web-search": createWebSearchTool(),
  };
};
