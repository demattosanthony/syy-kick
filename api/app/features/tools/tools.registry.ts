import { ArtifactService } from "../workflows/artifact-service";
import {
  createDocOcrTool,
  createPdfPageExtractionTool,
  createObjectDetectionTool,
  createWebSearchTool,
  createSharepointFilesFinderTool,
} from "./tool-definitions";

export const createToolSet = (toolArtifactService: ArtifactService, userId: string) => {
  const artifactTools = toolArtifactService.getArtifactTools();
  return {
    "list-artifacts": artifactTools["list-artifacts"],
    "load-artifact": artifactTools["load-artifact"],
    "create-artifact": artifactTools["create-artifact"],

    "pdf-page-extraction": createPdfPageExtractionTool(toolArtifactService),
    "object-detection": createObjectDetectionTool(toolArtifactService),
    "doc-ocr": createDocOcrTool(toolArtifactService),
    "web-search": createWebSearchTool(),
    "sharepoint-files-finder": createSharepointFilesFinderTool({ userId }),
  };
};
