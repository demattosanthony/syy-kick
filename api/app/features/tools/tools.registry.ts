import { ArtifactService } from "./artifact-service";
import {
  createDocOcrTool,
  createPdfPageExtractionTool,
  createObjectDetectionTool,
} from "./tool-definitions";

export const createToolSet = (toolArtifactService: ArtifactService) => {
  const artifactTools = toolArtifactService.getTools();
  return {
    "list-artifacts": artifactTools["list-artifacts"],
    "load-artifact": artifactTools["load-artifact"],
    "create-artifact": artifactTools["create-artifact"],

    "pdf-page-extraction": createPdfPageExtractionTool(toolArtifactService),
    "object-detection": createObjectDetectionTool(toolArtifactService),
    "doc-ocr": createDocOcrTool(toolArtifactService),
  };
};
