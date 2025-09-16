import { ArtifactService } from "./artifact-service";

export const createToolSet = (toolArtifactService: ArtifactService) => {
  const artifactTools = toolArtifactService.getTools();
  return {
    "create-artifact": artifactTools["create-artifact"],
  };
};
