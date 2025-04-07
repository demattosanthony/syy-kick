import { tool } from "ai";
import { z } from "zod";

import reranker from "../../../config/reranker";
import { DbUser } from "../../../createAuthToken";
import { Workspace } from "../../../middleware";
import { ModelConfig } from "../../models";
import { PermissionManager } from "../../permissions/permissions.tools";
import { Permissions } from "../../permissions/permissions.types";
import { documentsOps } from "../../projects/docs/documents.ops";
import {
  formatDocumentSearchResults,
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
          limit: 25,
          documentId,
        });
        console.log("Search results:", res);

        const llmContext = formatDocumentSearchResults(res);

        console.log("\n\n");
        console.log(llmContext.context);

        return llmContext.context;
      } catch (error) {
        console.error("Error searching project documents:", error);
        return "Error searching project documents";
      }
    },
  });
