import { tool } from "ai";
import { z } from "zod";

import reranker from "../../../config/reranker";
import { DbUser } from "../../../createAuthToken";
import { Workspace } from "../../../middleware";
import { ModelConfig } from "../../models";
import { PermissionManager } from "../../permissions/permissions.tools";
import { Permissions } from "../../permissions/permissions.types";
import { documentsOps } from "../../projects/docs/documents.ops";
import { DocumentSearchToolResult } from "../threads.types";
import {
  formatDocumentSearchResults,
  getUniqueDocuments,
  processDocumentImages,
} from "../threads.utils";

export const createProjectSearchTool = (
  modelConfig: ModelConfig,
  workspace: Workspace,
  user: DbUser,
  projectId?: string
) =>
  tool({
    description: `Search project documents and retrieve relevant information.

Usage:
    1. Use when you need specific information from project documents not available in the conversation history.
    2. Provide a clear, specific query to search across all project documents.
    3. Best for technical details, specifications, or project-specific information.
    4. Avoid using for general questions or when information is already in the conversation.

Returns:
    - Relevant document excerpts with context
    - Document metadata (name, path, type)
    - Visual previews for supported document types`,
    parameters: z.object({
      query: z.string(),
      documentId: z.string().optional(),
    }),
    execute: async ({ query, documentId }) => {
      // Determine project IDs based on workspace type
      let projectIds: string[] | undefined;

      try {
        // Handle organization workspace
        if (workspace.type === "organization") {
          if (projectId) {
            // Check user's access to the specific project
            const orgRole = await PermissionManager.getUserOrganisationRole(
              user.id,
              workspace.id
            );

            // Admins and managers have access to all projects
            const isAdmin = [
              Permissions.Roles.SUPER_ADMIN,
              Permissions.Roles.ORGANIZATION_ADMIN,
              Permissions.Roles.ORGANIZATION_MANAGER,
            ].includes(orgRole?.role.name as Permissions.Roles);

            if (isAdmin) {
              projectIds = [projectId];
            } else {
              // Check regular member's access to the project
              if (!orgRole) {
                throw new Error("User is not a member of the organization");
              }

              const resourceId = await PermissionManager.getResourseId(
                Permissions.Resources.ORGANIZATION_PROJECT_DOCS
              );

              if (!resourceId) {
                throw new Error("Resource not found");
              }

              const hasAccess =
                await PermissionManager.userHasAccessToRessource(
                  orgRole,
                  workspace.id,
                  resourceId,
                  Permissions.Actions.READ,
                  projectId
                );

              if (!hasAccess) {
                throw new Error("User does not have access to the project");
              }

              projectIds = [projectId];
            }
          } else {
            // No specific project ID, get all accessible projects
            projectIds = await PermissionManager.getUserOrgProjectsIds(
              user.id,
              workspace.id
            );
          }
        } else if (projectId) {
          // For non-organization workspaces with a projectId
          projectIds = [projectId];
        }
      } catch (error) {
        console.error("Error determining project IDs:", error);
        return {
          images: [],
          context: "",
          docs: [],
          dataForFrontend: [],
        };
      }

      try {
        // Execute the search with the determined project IDs
        const res = await documentsOps.searchProjectDocuments({
          query,
          workspace,
          projectIds,
          limit: 80,
          documentId,
        });
        console.log("Search results:", res.length);

        // Rerank results
        const rerankedResults = await reranker.rerank(
          query,
          res.map((r) => r.text || ""),
          {
            topN: 20,
            returnDocuments: true,
          }
        );

        // Create a map of text to original result for lookup
        const textToResultMap = new Map(res.map((r) => [r.text, r]));

        // Map reranked results to simplified schema
        const simplifiedDocs: DocumentSearchToolResult[] =
          rerankedResults.results?.map((reranked) => {
            const originalDoc = textToResultMap.get(reranked.document.text)!;
            return {
              documentId: originalDoc.document.id,
              projectId: originalDoc.document.projectId || projectId || "", // Fallback to parameter or empty string
              path: originalDoc.document.path,
              documentName: originalDoc.document.name,
              text: originalDoc.text,
              similarity: reranked.relevance_score,
              pageNumber: (originalDoc.metadata as { page_number?: number })
                ?.page_number,
              mimeType: originalDoc.document.mimeType,
              fileKey: originalDoc.document.fileKey,
            };
          });
        console.log("Simplified docs length:", simplifiedDocs.length);

        // Generate final output
        const uniqueDocs = getUniqueDocuments(simplifiedDocs);
        const images =
          modelConfig.model.modelId.includes("claude-3-7-sonnet") ||
          modelConfig.model.modelId.includes("claude-3-5-sonnet")
            ? await processDocumentImages(uniqueDocs)
            : [];

        return formatDocumentSearchResults(uniqueDocs, images);
      } catch (error) {
        console.error("Error searching project documents:", error);
        return {
          images: [],
          context: "",
          docs: [],
          dataForFrontend: [],
        };
      }
    },
    experimental_toToolResultContent(result) {
      if (!result) {
        return [];
      }
      return [
        ...result.images.map((image) => ({
          type: "image" as const,
          data: image.imageData,
          mimeType: image.mimeType,
        })),
        {
          type: "text",
          text: result.context,
        },
      ];
    },
  });
