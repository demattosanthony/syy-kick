import { z } from "zod";
import { tool } from "ai";

import { DbUser } from "../../../createAuthToken";
import { Project } from "../../../config/schema";
import { Workspace } from "../../../middleware";

import { documentsOps } from "../../projects/docs/documents.ops";
import { projectsOps } from "../../projects/projects.ops";
import { SortOption } from "../../projects/projects.types";
import { normalizePath } from "../../projects/docs/documents.utils";

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return "0 Bytes"; // Handle 0 or non-numeric input

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** Tool to list projects or project contents (like 'ls') */
export const createListTool = (
  workspace: Workspace,
  user: DbUser,
  project?: Project // Project ID provided at tool creation time
) =>
  tool({
    description: project
      ? `List files and folders within the current project context (Name: ${project.name}).

Usage:
- List root directory: provide no path argument
- List specific directory: provide path (e.g., "docs/specifications")

Examples:
- List root: {}
- List specific folder: { "path": "docs/mechanical" }
- List nested folder: { "path": "docs/mechanical/schedules" }A

Returns:
- Directory contents with file sizes
- Folders marked with 📁
- Files marked with 📄 with size in bytes`
      : `List and navigate projects and their contents in your workspace.

Usage:
1. List all projects: provide no path argument
2. List project contents: use "projectId:/path" format
   - projectId: ID shown in brackets [id] when listing projects
   - path: (optional) specific directory path within project

Examples:
- List all projects: {}
- List project root: { "path": "abc123:/" }
- List project folder: { "path": "abc123:/docs" }
- List nested folder: { "path": "abc123:/docs/specifications" }

Returns:
- When listing projects:
  • Project names with IDs in brackets [abc123]
  • Project numbers (if available)
  • Total count of accessible projects
- When listing project contents:
  • Directory contents with file sizes
  • Folders marked with 📁
  • Files marked with 📄

Notes:
- Project IDs are shown in brackets when listing projects [abc123]
- Use these IDs to navigate into specific projects
- Forward slashes (/) are used as path separators`,
    parameters: z.object({
      path: z
        .string()
        .optional()
        .describe(
          'Optional. Either:\n1. Directory path (when project selected)\n2. "projectId:/path" format to list contents of a specific project\n3. Empty to list projects or project root'
        ),
    }),
    execute: async ({ path }) => {
      try {
        if (project) {
          // List project contents for the given projectId
          const normalizedPath = path ? normalizePath(path) : ""; // Use utility to clean path
          const contents = await documentsOps.getProjectDocs(
            project.id,
            normalizedPath
          );

          if (contents.length === 0) {
            return `No files or folders found at path: "${
              normalizedPath || "/"
            }" in project ${project.id}.`;
          }

          const folders = contents
            .filter((item) => item.type === "folder")
            .map((item) => `📁 ${item.name}/`); // Indicate folders with '/'
          const files = contents
            .filter((item) => item.type === "file")
            .map(
              (item) =>
                `📄 ${item.name} ID: ${item.id} (${
                  item.size ? formatBytes(item.size) : "N/A"
                })`
            );

          const result = `Contents of "${normalizedPath || "/"}" in project ${
            project.id
          }:\n${[...folders, ...files].join("\n")}`;

          console.log(result);

          return result;
        } else {
          // Check if path contains project ID specification
          if (path?.includes(":/")) {
            const [projectId, projectPath] = path.split(":/");

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
              (p) => p.id === projectId
            );

            if (!hasAccess) {
              return `Error: You do not have access to project ${projectId}`;
            }

            // List contents of the specified project
            const normalizedPath = projectPath
              ? normalizePath(projectPath)
              : "";
            const contents = await documentsOps.getProjectDocs(
              projectId,
              normalizedPath
            );

            if (contents.length === 0) {
              return `No files or folders found at path: "${
                normalizedPath || "/"
              }" in project ${projectId}.`;
            }

            const folders = contents
              .filter((item) => item.type === "folder")
              .map((item) => `📁 ${item.name}/`);
            const files = contents
              .filter((item) => item.type === "file")
              .map(
                (item) =>
                  `📄 ${item.name} ID: ${item.id} (${
                    item.size ? formatBytes(item.size) : "N/A"
                  })`
              );

            return `Contents of "${
              normalizedPath || "/"
            }" in project ${projectId}:\n${[...folders, ...files].join("\n")}`;
          }

          // List projects accessible to the user in the workspace
          let projectsResult;
          const listParams: Parameters<typeof projectsOps.listProjects>[0] = {
            limit: 100,
            sort: SortOption.NAME_ASC,
          };

          if (workspace.type === "organization") {
            listParams.organizationId = workspace.id;
            listParams.userId = user.id; // Needed for permission checks within the org
          } else {
            // Personal workspace ID is the user ID
            listParams.userId = workspace.id;
          }

          projectsResult = await projectsOps.listProjects(listParams);

          if (!projectsResult || projectsResult.data.length === 0) {
            return "No accessible projects found in this workspace.";
          }

          const projectNames = projectsResult.data.map(
            (p) =>
              `${p.name}${p.projectNumber ? ` (#${p.projectNumber})` : ""} [${
                p.id
              }]`
          );

          // Calculate the terminal width (default to 80 if not available)
          const termWidth = 80;

          // Format projects in columns
          const maxLength = Math.max(
            ...projectNames.map((name) => name.length)
          );
          const colWidth = maxLength + 2; // Add spacing between columns
          const numCols = Math.floor(termWidth / colWidth);
          const numRows = Math.ceil(projectNames.length / numCols);

          let formattedList = "";
          for (let row = 0; row < numRows; row++) {
            const rowItems = [];
            for (let col = 0; col < numCols; col++) {
              const index = col * numRows + row;
              if (index < projectNames.length) {
                rowItems.push(projectNames[index].padEnd(colWidth));
              }
            }
            formattedList += rowItems.join("") + "\n";
          }

          // Create header with total count and usage hint
          const total = projectsResult.pagination.totalCount;
          const displayCount = projectsResult.data.length;
          const header = `Accessible projects (${displayCount}${
            total > displayCount ? ` of ${total}` : ""
          }). Use project ID in brackets to list contents (e.g., "projectId:/path"):`;

          console.log(`${header}\n${formattedList.trim()}`);
          return `${header}\n${formattedList.trim()}`;
        }
      } catch (error: any) {
        console.error("Error executing list tool:", error);
        // Provide a more informative error if possible
        return `Error listing items: ${
          error.message || "An unknown error occurred."
        }`;
      }
    },
    // Use simple text output for the tool result
    experimental_toToolResultContent(result) {
      return [{ type: "text", text: result }];
    },
  });
