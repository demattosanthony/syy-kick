import z from "zod";
import db from "../config/db";
import {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  like,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import {
  accessLogs,
  documentEmbeddings,
  documents,
  organizations,
  projects,
  sites,
} from "../config/schema";
import { Router, Request, Response } from "express";
import s3 from "../config/s3";
import { smallOpenaiEmbeddingModel } from "./models";
import { queue } from "../doc-job-queue";
import { ALLOWED_UNSTRUCTURED_EXTENSIONS } from "../config/unstructured";
import { getOrgIdOrUnedfined, slugify } from "../utils";
import { Workspace } from "../middleware";
import { Permissions } from "./permissions/permissions.types";
import { PermissionManager } from "./permissions/permissions.tools";
import PermissionsFactory from "./permissions/permissions.factory";
import PermissionsMiddlewares from "./permissions/permissions.middlewares";
import { formatSites } from "./sites/sites.utils";

const schemas = {
  createProject: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(255).optional(),
    project_number: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    estimated_start_date: z.string().datetime().optional(),
    estimated_end_date: z.string().datetime().optional(),
    siteId: z.string().uuid(),
  }),

  updateProject: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(255).optional(),
    project_number: z.string().optional(),
    estimated_start_date: z.string().datetime().optional(),
    estimated_end_date: z.string().datetime().optional(),
    organizationId: z.string().optional(),
    siteId: z.string().uuid(),
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
async function createProject(
  data: z.infer<typeof schemas.createProject>,
  userId: string
) {
  // Check organization exists if organizationId is provided
  if (data.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, data.organizationId),
    });
    if (!org) {
      throw new Error("Organization not found");
    }
  }

  return await db.transaction(async (tx) => {
    const newProject = await db
      .insert(projects)
      .values({
        name: data.name,
        slug: slugify(data.name),
        description: data.description,
        projectNumber: data.project_number,
        estimatedStartDate: data.estimated_start_date
          ? new Date(data.estimated_start_date)
          : null,
        estimatedEndDate: data.estimated_end_date
          ? new Date(data.estimated_end_date)
          : null,
        organizationId: data.organizationId,
        userId: userId,
        visibility: "private",
        siteId: data.siteId,
      })
      .returning()
      .then((res) => res[0]);

    if (data?.organizationId) {
      const orgRoleAndResources =
        await PermissionManager.getOrgRoleResourcesPermissions(
          userId,
          data.organizationId
        );

      await PermissionsFactory.addProjectsAccess(
        userId,
        [newProject.id],
        data.organizationId,
        orgRoleAndResources.role.id,
        orgRoleAndResources.resources
      );
    }

    return newProject;
  });
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

type SortOption =
  | "recent"
  | "name-asc"
  | "name-desc"
  | "created-asc"
  | "created-desc";

async function listProjects(params: {
  siteId: string;
  organizationId?: string;
  userId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: SortOption;
}) {
  if (!params.organizationId && !params.userId) {
    throw new Error("Either organizationId or userId must be provided");
  }
  // if (!params.siteId) {
  //   throw new Error("Please select a site");
  // }

  // Pagination
  const page = params.page || 1;
  const limit = params.limit || 10;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.organizationId && params.userId) {
    const orgProjectsIds = await PermissionManager.getUserOrgProjectsIds(
      params.userId,
      params.organizationId
    );
    conditions.push(inArray(projects.id, orgProjectsIds));
  } else if (params.userId) {
    conditions.push(eq(projects.userId, params.userId));
  }

  if (params.siteId) {
    conditions.push(eq(projects.siteId, params.siteId));
  }

  if (params.search) {
    conditions.push(
      sql`(
        ${ilike(projects.name, `%${params.search}%`)} 
        OR 
        ${ilike(projects.projectNumber, `%${params.search}%`)}
      )`
    );
  }

  if (params.sort === "recent" && params.userId) {
    return await getPaginatedRecentProjects({
      page: params.page,
      limit: params.limit,
      conditions,
    });
  }

  let orderBy: Array<SQL> = [];
  if (params.sort) {
    switch (params.sort) {
      case "name-asc":
        orderBy = [asc(projects.name)];
        break;
      case "name-desc":
        orderBy = [desc(projects.name)];
        break;
      case "created-asc":
        orderBy = [asc(projects.createdAt)];
        break;
      case "created-desc":
        orderBy = [desc(projects.createdAt)];
        break;
      case "recent": // fallback
        orderBy = [desc(projects.createdAt)];
        break;
      default:
        break;
    }
  }

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(and(...conditions));
  const totalCount = countResult[0]?.count || 0;

  const projs = await db.query.projects.findMany({
    where: and(...conditions),
    orderBy,
    limit,
    offset,
    with: {
      site: true,
    },
  });

  return {
    data: projs.map((p) => {
      const site = p.site ? formatSites([p.site]) : null;

      if (!site) {
        return p;
      }

      return {
        ...p,
        site: site[0],
      };
    }),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: page * limit < totalCount,
    },
  };
}

async function getPaginatedRecentProjects(params: {
  conditions?: Array<SQL>;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 10;
  const offset = (page - 1) * limit;

  const [totalCountResult] = await db
    .select({
      totalCount: sql<number>`COUNT(DISTINCT ${projects.id})`,
    })
    .from(projects)
    .leftJoin(accessLogs, eq(accessLogs.projectId, projects.id))
    .where(and(...(params.conditions ?? [])));
  const totalCount = totalCountResult?.totalCount ?? 0;

  const projs = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      slug: projects.slug,
      projectNumber: projects.projectNumber,
      visibility: projects.visibility,
      estimatedStartDate: projects.estimatedStartDate,
      estimatedEndDate: projects.estimatedEndDate,
      address: projects.address,
      city: projects.city,
      state: projects.state,
      country: projects.country,
      postalCode: projects.postalCode,
      latitude: projects.latitude,
      longitude: projects.longitude,
      siteId: projects.siteId,
      organizationId: projects.organizationId,
      userId: projects.userId,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      lastAccess: sql`MAX(${accessLogs.createdAt})`.as("lastAccess"),
      site: sites,
    })
    .from(projects)
    .leftJoin(accessLogs, eq(accessLogs.projectId, projects.id))
    .leftJoin(sites, eq(sites.id, projects.siteId))
    .where(and(...(params.conditions ?? [])))
    .groupBy(projects.id, sites.id)
    .orderBy(sql`MAX(${accessLogs.createdAt}) DESC NULLS LAST`)
    .limit(limit)
    .offset(offset);

  return {
    data: projs.map((p) => {
      const site = p.site ? formatSites([p.site]) : null;

      if (!site) {
        return p;
      }

      return {
        ...p,
        site: site[0],
      };
    }),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: page * limit < totalCount,
    },
  };
}

async function getProject(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      organization: {
        with: {
          members: true,
        },
      },
      user: true,
      site: true,
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
      // Instead of throwing an error, return an empty array if folder not found
      if (!folder) {
        console.log(
          `Folder not found at path: ${normalizedPath} for project: ${projectId}`
        );
        return [];
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
      with: {
        processingJob: true,
      },
      orderBy: [asc(documents.type), asc(documents.name)],
    });

    // Add presigned URLs for files
    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        if (doc.type === "file" && doc.fileKey) {
          const url = s3.presign(doc.fileKey, {
            expiresIn: 60 * 60, // 1 hour
          });
          return { ...doc, url };
        }
        return doc;
      })
    );

    // Filter out . files and sort the results GitHub-style
    return docsWithUrls
      .filter((doc) => !doc.name.startsWith(".")) // Filter out dot files
      .sort((a, b) => {
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
    console.log("Error getting project contents:", error);
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
      slug: data.name ? slugify(data.name) : project.slug,
      description: data.description ?? project.description,
      projectNumber: data.project_number ?? project.projectNumber,
      estimatedStartDate: data.estimated_start_date
        ? new Date(data.estimated_start_date)
        : null,
      estimatedEndDate: data.estimated_end_date
        ? new Date(data.estimated_end_date)
        : null,
      siteId: data.siteId || project.siteId,
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
    console.log(`Document not found at path: ${path}`);
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
  const createdDocs: any[] = [];

  for (const entry of data.entries) {
    // 1. Normalize the incoming path
    const normalizedEntryPath = normalizePath(entry.path);

    // 2. Combine with basePath if provided
    const fullPath = data.basePath
      ? normalizePath(`${data.basePath}/${normalizedEntryPath}`)
      : normalizedEntryPath;

    // Extract the final name (file or folder name)
    const finalName = fullPath.split("/").pop()!;

    // Skip hidden files/folders, i.e., any whose final name begins with "."
    if (finalName.startsWith(".")) {
      // You can log or handle this any way you prefer
      console.log(`Skipping hidden file/folder: ${fullPath}`);
      continue;
    }

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
    const [newDoc] = await db
      .insert(documents)
      .values({
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
      })
      .returning();

    // Mark this path as created
    createdThisRun.add(fullPath);
    createdDocs.push(newDoc);
  }

  // Process uploaded files in the background
  for (const doc of createdDocs) {
    const extension = doc.name.toLowerCase().match(/\.[^.]*$/)?.[0];
    if (
      doc.type === "file" &&
      doc.fileKey &&
      ALLOWED_UNSTRUCTURED_EXTENSIONS.includes(extension)
    ) {
      await queue.addToQueue({
        fileKey: doc.fileKey,
        fileName: doc.path,
        mimeType: doc.mimeType || "",
        documentId: doc.id,
      });
    }
  }

  return { success: true };
}

export async function searchProjectDocuments(params: {
  query: string;
  workspace: Workspace;
  projectIds?: string[];
  limit?: number;
}) {
  const { projectIds, query, limit = 20, workspace } = params;
  try {
    // If projectIds are provided, verify they exist
    if (projectIds && projectIds.length > 0) {
      try {
        // Verify at least one project exists (could enhance to check all)
        await getProjectOrThrow(projectIds[0]);
      } catch (error) {
        console.error(
          `Project verification failed for ID ${projectIds[0]}:`,
          error
        );
        throw new Error(`Invalid project ID: ${projectIds[0]}`);
      }
    } else if (!workspace.id) {
      throw new Error(
        "Either projectIds, userId, or organizationId must be provided"
      );
    }

    // Get the embedding for the search query
    let queryEmbedding;
    try {
      const { embeddings } = await smallOpenaiEmbeddingModel.doEmbed({
        values: [query],
      });
      queryEmbedding = embeddings[0];
    } catch (error) {
      console.error("Failed to generate embedding for search query:", error);
      throw new Error("Failed to process search query");
    }

    // Build the where clause based on provided parameters
    let whereClause;
    if (projectIds && projectIds.length > 0) {
      // Search within specific projects
      whereClause = and(
        inArray(documents.projectId, projectIds),
        sql`1 - (${cosineDistance(
          documentEmbeddings.embedding,
          queryEmbedding
        )}) > 0.45`
      );
    } else if (workspace.type === "organization") {
      // When workspace is an organization, projectIds should be provided
      return [];
    } else if (workspace.type === "personal") {
      // Search across all projects owned by the user
      whereClause = and(
        eq(projects.userId, workspace.id),
        sql`1 - (${cosineDistance(
          documentEmbeddings.embedding,
          queryEmbedding
        )}) > 0.45`
      );
    }

    // Search for similar documents using vector similarity
    const results = await db
      .select({
        documentId: documentEmbeddings.documentId,
        text: documentEmbeddings.text,
        metadata: documentEmbeddings.metadata,
        fileKey: documents.fileKey,
        similarity: sql<number>`1 - (${cosineDistance(
          documentEmbeddings.embedding,
          queryEmbedding
        )})`.as("similarity"),
        document: documents,
        project: projects,
      })
      .from(documentEmbeddings)
      .innerJoin(documents, eq(documents.id, documentEmbeddings.documentId))
      .innerJoin(projects, eq(projects.id, documents.projectId))
      .where(whereClause)
      .orderBy(
        sql`1 - (${cosineDistance(
          documentEmbeddings.embedding,
          queryEmbedding
        )}) DESC`
      )
      .limit(limit);

    console.log(`Found ${results.length} documents matching query: "${query}"`);

    // Add presigned URLs for files that need them
    const resultsWithUrls = await Promise.all(
      results.map(async (result) => {
        if (result.document.fileKey) {
          try {
            const url = s3.presign(result.document.fileKey, {
              expiresIn: 60 * 60, // 1 hour
            });
            return {
              ...result,
              document: {
                ...result.document,
                url,
              },
            };
          } catch (error) {
            console.error(
              `Failed to generate presigned URL for file ${result.document.fileKey}:`,
              error
            );
            // Return the result without URL rather than failing the entire operation
            return result;
          }
        }
        return result;
      })
    );

    return resultsWithUrls;
  } catch (error) {
    console.error("Error in searchProjectDocuments:", error);
    throw error;
  }
}

// Route handlers
const handlers = {
  createProject: async (req: Request, res: Response) => {
    const orgId = getOrgIdOrUnedfined(req.workspace);
    const data = {
      ...req.body,
      userId: !req.body.organizationId ? req.dbUser?.id : undefined,
      organizationId: req.body.organizationId ? orgId : undefined,
    };

    if (!req.dbUser?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.body.siteId) {
      res.status(400).json({ error: "Please select a site" });
      return;
    }

    const validatedData = schemas.createProject.parse(data);
    const project = await createProject(validatedData, req.dbUser?.id);

    res.json(project);
  },

  listProjects: async (req: Request, res: Response) => {
    const { search, page, limit, siteId, sort } = req.query;

    const orgId = getOrgIdOrUnedfined(req.workspace);
    try {
      const projectsList = await listProjects({
        siteId: siteId as string,
        organizationId: orgId,
        userId: req.dbUser?.id,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        sort: sort as SortOption,
      });
      res.json(projectsList);
    } catch (error: any) {
      res.status(error.code || 500).json({ error: error.message });
    }
  },

  getProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const project = await getProject(projectId);
    res.json(project || {});
  },

  deleteProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    await deleteProject(projectId);
    res.json({ success: true });
  },

  getDocuments: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { path } = req.query;
      const files = await getProjectDocs(projectId, path as string);
      res.json(files);
    } catch (error) {
      console.error("Error getting project files:", error);
      res.status(500).json({ error: "Failed to get project files" });
    }
  },

  deleteContents: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path } = req.query;
    await deleteProjectContent(projectId, decodeURIComponent(path as string));
    res.json({ success: true });
  },

  updateProject: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.dbUser?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const validatedData = schemas.updateProject.parse(req.body);
      const project = await updateProject(projectId, validatedData);
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update project" });
    }
  },

  /**
   * Get file metadata + content. If it's an LFS pointer, return a presigned S3 URL.
   * Otherwise, return the actual file (text or base64).
   */
  getDocument: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path } = req.query;
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
  .post(
    "/",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.CREATE
    ),
    handlers.createProject
  )
  .get("/", handlers.listProjects)
  .post(
    "/:projectId/documents",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
      Permissions.Actions.CREATE
    ),
    handlers.documentsUpload
  )
  .get(
    "/:projectId/documents",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
      Permissions.Actions.READ
    ),
    handlers.getDocuments
  )
  .delete(
    "/:projectId/documents",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
      Permissions.Actions.DELETE
    ),
    handlers.deleteContents
  )
  .patch(
    "/:projectId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.UPDATE
    ),
    handlers.updateProject
  )
  .get(
    "/:projectId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.READ
    ),
    handlers.getProject
  )
  .delete(
    "/:projectId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.DELETE
    ),
    handlers.deleteProject
  )
  .get(
    "/:projectId/document",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
      Permissions.Actions.READ
    ),
    handlers.getDocument
  );
