import { z } from "zod";
import { tool } from "ai";

import { DbUser } from "../../../createAuthToken";
import { Project } from "../../../config/schema";
import { Workspace } from "../../../middleware";

import { documentsOps } from "../../projects/docs/documents.ops";
import { projectsOps } from "../../projects/projects.ops";
import { normalizePath } from "../../projects/docs/documents.utils";
import { SortOption } from "../../projects/projects.types";

export const createFileReadTool = (
  workspace: Workspace,
  user: DbUser,
  project?: Project
) =>
  tool({
    description: project
      ? `Read contents of a file within the current project context (Name: ${project.name}).

Usage:
- Provide the file path to read (e.g., "docs/specifications/plan.md")

Example:
{ "path": "docs/mechanical/schedule.txt" }

Returns:
- File contents as text
- Error if file not found or is a folder`
      : `Read contents of files across projects in your workspace.

Usage:
- Use "projectId:/path" format to specify project and file
  - projectId: ID shown in brackets [id] when listing projects
  - path: path to the file within project

Example:
{ "path": "abc123:/docs/specifications/plan.md" }

Returns:
- File contents as text
- Error if file not found or is a folder`,
    parameters: z.object({
      path: z
        .string()
        .describe(
          'Required. Either:\n1. File path (when project selected)\n2. "projectId:/path" format to read file from specific project'
        ),
    }),
    execute: async ({ path }) => {
      try {
        let targetProjectId: string;
        let targetPath: string;

        if (project) {
          // Project context already provided
          targetProjectId = project.id;
          targetPath = normalizePath(path);
        } else {
          // Parse projectId:/path format
          if (!path.includes(":/")) {
            throw new Error(
              'Path must be in format "projectId:/path" when no project context is set'
            );
          }

          const [projectId, projectPath] = path.split(":/");
          targetProjectId = projectId;
          targetPath = normalizePath(projectPath);

          // Verify user has access to this project
          const listParams: Parameters<typeof projectsOps.listProjects>[0] = {
            limit: 100,
            sort: SortOption.NAME_ASC,
          };

          if (workspace.type === "organization") {
            listParams.organizationId = workspace.id;
            listParams.userId = user.id;
          } else {
            listParams.userId = workspace.id;
          }

          const projectsResult = await projectsOps.listProjects(listParams);
          const hasAccess = projectsResult.data.some(
            (p) => p.id === targetProjectId
          );

          if (!hasAccess) {
            return `Error: You do not have access to project ${targetProjectId}`;
          }
        }

        // Get document and its embeddings
        const { embeddings } = await documentsOps.getDocumentEmbeddings(
          targetProjectId,
          targetPath
        );

        // Combine all embedding chunks in order
        const fileContent = embeddings
          .map(
            (embedding) => `<chunk>
<text>${embedding.text?.trim()}</text>
${
  (embedding.metadata as { page_number?: number })?.page_number
    ? `<page_number>${
        (embedding.metadata as { page_number?: number }).page_number
      }</page_number>`
    : ""
}</chunk>`
          )
          .join("\n\n");

        console.log("File content:", fileContent);

        return fileContent || "File is empty";
      } catch (error: any) {
        console.error("Error executing file read tool:", error);
        return `Error reading file: ${
          error.message || "An unknown error occurred"
        }`;
      }
    },
  });
