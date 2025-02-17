import z from "zod";
import db from "../config/db";
import { and, asc, eq, ilike, isNull, like, or } from "drizzle-orm";
import { documents, organizations, projects, users } from "../config/schema";
import { Router, Request, Response } from "express";
import s3 from "../config/s3";

const schemas = {
  createProject: z
    .object({
      name: z.string().min(1).max(255),
      description: z.string().max(255).optional(),
      organizationId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
    })
    .refine((data) => data.organizationId || data.userId, {
      message: "Either organizationId or userId must be provided",
    }),

  updateProject: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(255).optional(),
    organizationId: z.string().optional(),
  }),

  docsUpload: z.object({
    entries: z.array(
      z.object({
        path: z.string(),
        type: z.enum(["file", "folder"]),
        // File-specific fields
        fileKey: z.string().optional(),
        size: z.number().optional(),
        mimeType: z.string().optional(),
        sha256: z.string().optional(),
      })
    ),
    basePath: z.string(),
    organizationId: z.string().optional(),
  }),
};

// Helpers

/**
 * Normalizes a path:
 * - Trims leading/trailing slashes
 * - Replaces multiple slashes with a single slash
 */
function normalizePath(input: string) {
  // Remove leading/trailing slashes
  const trimmed = input.replace(/^\/+|\/+$/g, "");
  // Replace multiple consecutive slashes with single
  return trimmed.replace(/\/{2,}/g, "/");
}

async function getProjectOrThrow(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error("Project not found");
  }
  return project;
}

// Ops methods
async function createProject(data: z.infer<typeof schemas.createProject>) {
  // Check organization exists if organizationId is provided
  if (data.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, data.organizationId),
    });
    if (!org) {
      throw new Error("Organization not found");
    }
  }

  // Check user exists if userId is provided
  if (data.userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    });
    if (!user) {
      throw new Error("User not found");
    }
  }

  const newProject = await db
    .insert(projects)
    .values({
      name: data.name,
      description: data.description,
      organizationId: data.organizationId,
      userId: data.userId,
      visibility: "private",
    })
    .returning()
    .then((res) => res[0]);

  return newProject;
}

async function deleteProject(projectId: string) {
  // Get all documents associated with this project
  const docs = await db.query.documents.findMany({
    where: eq(documents.projectId, projectId),
  });

  // Delete all files from S3
  for (const doc of docs) {
    if (doc.fileKey) {
      await s3.delete(doc.fileKey);
    }
  }

  // Delete all documents and the project from the database
  await db.delete(documents).where(eq(documents.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
}

async function listProjects(params: {
  organizationId?: string;
  userId?: string;
  search?: string;
}) {
  if (!params.organizationId && !params.userId) {
    throw new Error("Either organizationId or userId must be provided");
  }

  let conditions = [];

  if (params.organizationId) {
    conditions.push(eq(projects.organizationId, params.organizationId));
  } else if (params.userId) {
    conditions.push(eq(projects.userId, params.userId));
  }

  if (params.search) {
    conditions.push(ilike(projects.name, `%${params.search}%`));
  }

  const projs = await db.query.projects.findMany({
    where: and(...conditions),
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });

  return projs;
}

async function getProject(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      organization: true,
      user: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Add logo presigned URL if organization has a logo
  if (project.organization?.logo) {
    (project.organization as any).logoUrl = await s3.presign(
      project.organization.logo,
      {
        expiresIn: 60 * 60, // 1 hour
      }
    );
  }

  return project;
}
export async function getProjectDocs(projectId: string, path: string = "") {
  await getProjectOrThrow(projectId);

  try {
    const normalizedPath = normalizePath(path);

    // If path is not empty, first find the folder document to get its ID
    let parentId: string | null = null;
    if (normalizedPath !== "") {
      const folder = await db.query.documents.findFirst({
        where: and(
          eq(documents.projectId, projectId),
          eq(documents.path, normalizedPath),
          eq(documents.type, "folder")
        ),
      });
      if (!folder) {
        throw new Error("Folder not found");
      }
      parentId = folder.id;
    }

    const docs = await db.query.documents.findMany({
      where: and(
        eq(documents.projectId, projectId),
        parentId === null
          ? isNull(documents.parentId)
          : eq(documents.parentId, parentId)
      ),
      orderBy: [asc(documents.type), asc(documents.name)],
    });

    // Add presigned URLs for files
    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        if (doc.type === "file" && doc.fileKey) {
          const url = await s3.presign(doc.fileKey, {
            expiresIn: 60 * 60, // 1 hour
          });
          return { ...doc, url };
        }
        return doc;
      })
    );

    // Sort the results GitHub-style
    return docsWithUrls.sort((a, b) => {
      // First sort by type (folders first)
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      // Then sort by name (case-insensitive)
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      // Natural sort for numbers (e.g., "file2" comes before "file10")
      return nameA.localeCompare(nameB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  } catch (error) {
    throw new Error("Failed to fetch project contents");
  }
}

async function deleteProjectContent(projectId: string, path: string) {
  await getProjectOrThrow(projectId);

  try {
    // Get all documents at and below this path
    const docsToDelete = await db.query.documents.findMany({
      where: and(
        eq(documents.projectId, projectId),
        // Match exact path or path starting with path/
        or(eq(documents.path, path), like(documents.path, `${path}/%`))
      ),
    });

    if (docsToDelete.length === 0) {
      throw new Error(`Path '${path}' not found`);
    }

    // Delete files from S3 first
    for (const doc of docsToDelete) {
      if (doc.type === "file" && doc.fileKey) {
        try {
          await s3.delete(doc.fileKey);
        } catch (s3Error) {
          console.error(
            `Failed to delete file from S3: ${doc.fileKey}`,
            s3Error
          );
          // Continue with other deletions even if one fails
        }
      }
    }

    // Delete all matching documents from database
    await db
      .delete(documents)
      .where(
        and(
          eq(documents.projectId, projectId),
          or(eq(documents.path, path), like(documents.path, `${path}/%`))
        )
      );

    return true;
  } catch (error: any) {
    console.error("Delete content error:", error);
    if (error.message.includes("not found")) {
      throw new Error(`Path '${path}' not found`);
    }
    throw new Error("Failed to delete content");
  }
}

async function updateProject(
  projectId: string,
  data: z.infer<typeof schemas.updateProject>
) {
  const project = await getProjectOrThrow(projectId);

  const updatedProject = await db
    .update(projects)
    .set({
      name: data.name || project.name,
      description: data.description ?? project.description,
    })
    .where(eq(projects.id, projectId))
    .returning()
    .then((res) => res[0]);

  return updatedProject;
}
/**
 * Gets the content and metadata for a document in a project
 * @param projectId The ID of the project containing the document
 * @param path The full path to the document within the project
 * @returns The document metadata including file content or S3 URL if it's an LFS file
 * @throws Error if file not found or if path points to a folder
 */
export async function getDocContent(projectId: string, path: string) {
  const document = await db.query.documents.findFirst({
    where: and(eq(documents.projectId, projectId), eq(documents.path, path)),
  });

  if (!document) {
    throw new Error("File not found");
  }

  if (document.type === "folder") {
    throw new Error("Cannot get content of a folder");
  }

  // If document has a fileKey, generate a presigned URL for S3 access
  if (document.fileKey) {
    const url = s3.presign(document.fileKey, {
      expiresIn: 60 * 60, // 1 hour
      method: "GET",
    });

    return {
      ...document,
      url,
    };
  }

  return document;
}

/**
 * Recursively creates missing folder ancestors if they don't exist.
 * Returns the ID of the final parent folder.
 */
async function ensureParentFolderExists(
  projectId: string,
  fullPath: string
): Promise<string | null> {
  // If there's no slash, it means there's no parent folder, e.g. "myFolder"
  if (!fullPath.includes("/")) {
    return null;
  }

  // e.g. parentPath = "folderA" or "folderA/folderB"
  const parentPath = fullPath.split("/").slice(0, -1).join("/");
  const normalizedParentPath = normalizePath(parentPath);

  if (!normalizedParentPath) {
    // This means fullPath was something like "/file.txt" after trimming
    // or there's effectively no real parent. Return null.
    return null;
  }

  // Check if parent folder already exists
  let parent = await db.query.documents.findFirst({
    where: and(
      eq(documents.projectId, projectId),
      eq(documents.path, normalizedParentPath),
      eq(documents.type, "folder")
    ),
  });

  // If not found, recursively create that parent
  if (!parent) {
    // Create the parent's parent first
    const grandParentId = await ensureParentFolderExists(
      projectId,
      normalizedParentPath
    );

    // Insert the parent folder
    const [parentDoc] = await db
      .insert(documents)
      .values({
        name: normalizedParentPath.split("/").pop()!,
        path: normalizedParentPath,
        type: "folder",
        projectId,
        parentId: grandParentId,
      })
      .returning();

    parent = parentDoc;
  }

  return parent.id;
}

/**
 * Creates documents (folders or files) based on a list of entries.
 * - Sort entries so folders come first
 * - Normalizes paths
 * - Recursively ensures parents exist (optional)
 * - Skips duplicates if a doc with the same path + projectId already exists
 */
async function createFolderStructure(
  projectId: string,
  data: z.infer<typeof schemas.docsUpload>
) {
  // Keep track of any paths created this run to avoid re-inserting
  const createdThisRun = new Set<string>();

  for (const entry of data.entries) {
    // 1. Normalize the incoming path
    const normalizedEntryPath = normalizePath(entry.path);

    // 2. Combine with basePath if provided
    const fullPath = data.basePath
      ? normalizePath(`${data.basePath}/${normalizedEntryPath}`)
      : normalizedEntryPath;

    // If we've already processed this path in the same request, skip
    if (createdThisRun.has(fullPath)) {
      continue;
    }

    // 3. Check if there's already a doc with this exact path in DB
    //    If so, skip (or handle it how you like—maybe overwrite)
    const existingDoc = await db.query.documents.findFirst({
      where: and(
        eq(documents.projectId, projectId),
        eq(documents.path, fullPath)
      ),
    });
    if (existingDoc) {
      continue; // or throw an error or update, depending on your needs
    }

    // 4. Ensure parent folder exists (only if there's a parent path)
    let parentId: string | null = null;
    if (fullPath.includes("/")) {
      parentId = await ensureParentFolderExists(projectId, fullPath);
    }

    // 5. Insert the folder or file
    await db.insert(documents).values({
      name: fullPath.split("/").pop()!,
      type: entry.type,
      path: fullPath,
      parentId,
      projectId,
      ...(entry.type === "file"
        ? {
            fileKey: entry.fileKey,
            size: entry.size,
            mimeType: entry.mimeType,
            fileHash: entry.sha256,
          }
        : {}),
    });

    // Mark this path as created
    createdThisRun.add(fullPath);
  }

  return { success: true };
}

// Route handlers
const handlers = {
  createProject: async (req: Request, res: Response) => {
    const data = {
      ...req.body,
      userId: req.body.organizationId ? undefined : req.dbUser?.id,
    };

    const validatedData = schemas.createProject.parse(data);
    const project = await createProject(validatedData);
    res.json(project);
  },

  listProjects: async (req: Request, res: Response) => {
    const { search, organizationId } = req.query;
    const projectsList = await listProjects({
      organizationId: organizationId as string | undefined,
      userId: req.dbUser?.id,
      search: search as string,
    });
    res.json(projectsList);
  },

  getProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.query.organizationId as string | undefined;
    const project = await getProject(projectId);
    res.json(project || {});
  },

  deleteProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const organizationId = req.query.organizationId as string | undefined;
    await deleteProject(projectId);
    res.json({ success: true });
  },

  getDocuments: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { path, organizationId } = req.query;
      const files = await getProjectDocs(projectId, path as string);
      res.json(files);
    } catch (error) {
      console.error("Error getting project files:", error);
      res.status(500).json({ error: "Failed to get project files" });
    }
  },

  deleteContents: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path, organizationId } = req.query;
    await deleteProjectContent(projectId, decodeURIComponent(path as string));
    res.json({ success: true });
  },

  updateProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const validatedData = schemas.updateProject.parse(req.body);
    const project = await updateProject(projectId, validatedData);
    res.json(project);
  },

  /**
   * Get file metadata + content. If it's an LFS pointer, return a presigned S3 URL.
   * Otherwise, return the actual file (text or base64).
   */
  getDocument: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path, organizationId } = req.query;
    const file = await getDocContent(
      projectId,
      decodeURIComponent(path as string)
    );
    res.json(file);
  },

  documentsUpload: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const validatedData = schemas.docsUpload.parse(req.body);

    // Sort so folders are created before files; if two folders, shorter path first
    const sortedEntries = [...validatedData.entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.path.length - b.path.length;
    });

    const result = await createFolderStructure(projectId, {
      entries: sortedEntries,
      basePath: validatedData.basePath,
    });

    res.json(result);
  },
};

export default Router()
  .post("/", handlers.createProject)
  .get("/", handlers.listProjects)

  .post("/:projectId/documents", handlers.documentsUpload)
  .get("/:projectId/documents", handlers.getDocuments)
  .delete("/:projectId/documents", handlers.deleteContents)

  .patch("/:projectId", handlers.updateProject)
  .get("/:projectId", handlers.getProject)
  .delete("/:projectId", handlers.deleteProject)
  .get("/:projectId/document", handlers.getDocument);
