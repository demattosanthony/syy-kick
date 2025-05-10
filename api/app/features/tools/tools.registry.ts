import { ArtifactService } from "../workflows/artifact-service";
import {
  createDocOcrTool,
  createPdfPageExtractionTool,
  createObjectDetectionTool,
  createWebSearchTool,
  createCodeExecutionTool,
} from "./tool-definitions";

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
    "code-execution": createCodeExecutionTool(toolArtifactService),
  };
};
