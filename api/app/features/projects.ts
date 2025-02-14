import z from "zod";
import db from "../config/db";
import { and, eq, ilike } from "drizzle-orm";
import { organizations, projects, users } from "../config/schema";
import gitea from "../config/gitea";
import { Router, Request, Response } from "express";
import s3 from "../config/s3";
import multer from "multer";
import { shouldUseLfs } from "../utils/lfs-utils";
import { getFileMimeType } from "../utils";

const upload = multer({ storage: multer.memoryStorage() });

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
  }),
};

function toGitSafeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/[^a-z0-9-._]/g, "") // Remove special chars except dash, dot, underscore
    .replace(/^[-._]+|[-._]+$/g, "") // Remove leading/trailing dash, dot, underscore
    .replace(/\.+/g, ".") // Replace multiple dots with single dot
    .replace(/\.git$/i, "-git"); // Replace .git suffix
}

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

  // Create the git repo
  const response = await gitea.user.createCurrentUserRepo({
    default_branch: "main",
    name: toGitSafeName(data.name),
    private: true,
    description: data.description,
    auto_init: false,
  });
  const gitRepo = response.data;

  if (!gitRepo || !gitRepo.id) {
    throw new Error("Failed to create git repo");
  }

  const newProject = await db
    .insert(projects)
    .values({
      name: data.name,
      description: data.description,
      organizationId: data.organizationId,
      userId: data.userId,
      giteaRepoId: gitRepo.id,
      visibility: "private",
    })
    .returning()
    .then((res) => res[0]);

  return newProject;
}

/**
 * For smaller / text-based files, we commit directly via base64 content to Gitea.
 */
async function createFileInGitea(
  owner: string,
  repoName: string,
  filePath: string,
  fileBuffer: Buffer,
  message: string
) {
  const base64Content = fileBuffer.toString("base64");
  await gitea.repos.repoCreateFile(owner, repoName, filePath, {
    content: base64Content,
    message,
  });
}

/**
 * We'll keep the existing logic that picks LFS or normal commit,
 * but now we only do the direct buffer approach for small files.
 */
async function uploadFileToProject(
  projectId: string,
  filePath: string,
  fileBuffer: Buffer, // Only used if not LFS
  message: string = "Add file via API"
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const repoOwner = "admin"; // or however you manage your Gitea user
  const repoName = toGitSafeName(project.name);

  // If it’s forced LFS or beyond threshold => throw or handle it:
  if (shouldUseLfs(filePath, fileBuffer.length)) {
    // You could either throw an Error telling the client to use presign-lfs,
    // or simply do the old approach of uploading to S3 from here (not recommended).
    throw new Error(
      "File too large or forced for LFS. Please use the LFS presigned upload flow."
    );
  }

  // Otherwise, commit file to Gitea as normal (base64)
  await createFileInGitea(repoOwner, repoName, filePath, fileBuffer, message);
}

async function deleteProject(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Delete the git repo
  await gitea.repos.repoDelete("admin", toGitSafeName(project.name));

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

export async function getProjectFiles(projectId: string, path: string = "") {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const repoName = toGitSafeName(project.name);

  try {
    const contents = await gitea.repos.repoGetContents(
      "admin",
      repoName,
      path,
      {
        ref: "main",
      }
    );

    // If directory, fetch commit metadata for each item
    if (Array.isArray(contents.data)) {
      const filesWithMetadata = await Promise.all(
        contents.data.map(async (file: any) => {
          const commitResponse = await gitea.repos.repoGetAllCommits(
            "admin",
            repoName,
            {
              path: file.path,
              page: 1,
              limit: 1,
            }
          );
          if (commitResponse.data && commitResponse.data.length > 0) {
            file.lastModified = commitResponse.data[0].commit?.committer?.date;
          }
          return file;
        })
      );

      // GitHub-style sorting
      return filesWithMetadata.sort((a, b) => {
        // First sort by type (directories first)
        if (a.type !== b.type) {
          return a.type === "dir" ? -1 : 1;
        }

        // Then sort by name (case-insensitive)
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // Handle dotfiles (files/folders starting with .) - they come first
        const isDotFileA = nameA.startsWith(".");
        const isDotFileB = nameB.startsWith(".");
        if (isDotFileA !== isDotFileB) {
          return isDotFileA ? -1 : 1;
        }

        // Natural sort for numbers (e.g., "file2" comes before "file10")
        return nameA.localeCompare(nameB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    } else {
      // Single file => fetch commit metadata
      const commitResponse = await gitea.repos.repoGetAllCommits(
        "admin",
        repoName,
        {
          path: contents.data.path,
          page: 1,
          limit: 1,
        }
      );
      if (commitResponse.data && commitResponse.data.length > 0) {
        (contents.data as any).lastModified =
          commitResponse.data[0].commit?.committer?.date;
      }
      return contents.data;
    }
  } catch (error) {
    throw new Error("Failed to fetch repository contents");
  }
}

async function deleteProjectContent(projectId: string, path: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const repoName = toGitSafeName(project.name);

  // First get the file/directory to obtain its SHA(s)
  const fileInfo = await gitea.repos.repoGetContents("admin", repoName, path, {
    ref: "main",
  });

  if (Array.isArray(fileInfo.data)) {
    // Directory => delete all children
    for (const file of fileInfo.data) {
      await gitea.repos.repoDeleteFile("admin", repoName, file.path, {
        message: "Delete file via API",
        branch: "main",
        sha: file.sha,
      });
    }
  } else {
    // Single file
    const fileSha = fileInfo.data.sha;
    if (!fileSha) {
      throw new Error("Could not get file SHA");
    }
    await gitea.repos.repoDeleteFile("admin", repoName, path, {
      message: "Delete file via API",
      branch: "main",
      sha: fileSha,
    });
  }

  return true;
}

async function updateProject(
  projectId: string,
  data: z.infer<typeof schemas.updateProject>
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const updatedProject = await db
    .update(projects)
    .set({
      name: data.name || project.name,
      description: data.description ?? project.description,
    })
    .where(eq(projects.id, projectId))
    .returning()
    .then((res) => res[0]);

  // Update the Gitea repo info (e.g. name, description)
  await gitea.repos.repoEdit("admin", toGitSafeName(project.name), {
    name: toGitSafeName(updatedProject.name),
    description: updatedProject.description ?? undefined,
  });

  return updatedProject;
}

/**
 * If the file content is an LFS pointer, return the S3 presigned url;
 * otherwise, return direct content (decoded for text, or base64 for binary).
 */
export async function getFileContent(projectId: string, path: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const repoName = toGitSafeName(project.name);
  const response = await gitea.repos.repoGetContents("admin", repoName, path, {
    ref: "main",
  });

  if (Array.isArray(response.data)) {
    throw new Error("Path points to a directory, not a file");
  }
  if (!response.data.name) {
    throw new Error("File name is missing");
  }

  const fileType = getFileMimeType(response.data.name);
  const baseResponse = {
    name: response.data.name,
    path: response.data.path,
    size: response.data.size,
    type: fileType,
    sha: response.data.sha,
  };

  const decoded = Buffer.from(response.data.content || "", "base64").toString(
    "utf-8"
  );

  // Check if it's an LFS pointer file.
  if (decoded.startsWith("version https://git-lfs.github.com/spec/v1")) {
    // Extract the oid.
    const oidMatch = decoded.match(/oid sha256:([0-9a-f]+)/i);
    if (!oidMatch) {
      return { ...baseResponse, error: "Invalid LFS pointer" };
    }
    // Default to using the oid.
    let s3FileKey = oidMatch[1];
    // But if the pointer file includes a "file" line, use that.
    const fileKeyMatch = decoded.match(/file\s+([^\s]+)/);
    if (fileKeyMatch) {
      s3FileKey = fileKeyMatch[1];
    }
    const presignedUrl = s3.presign(s3FileKey, { expiresIn: 60 * 60 }); // 1 hour

    return {
      ...baseResponse,
      isLfsPointer: true,
      s3Url: presignedUrl,
      s3FileKey: s3FileKey,
    };
  }

  // For non-LFS files.
  if (fileType.startsWith("text")) {
    return {
      ...baseResponse,
      content: decoded,
    };
  }

  return {
    ...baseResponse,
    base64Content: response.data.content,
  };
}

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
    const project = await getProject(projectId);
    res.json(project || {});
  },

  deleteProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    await deleteProject(projectId);
    res.json({ success: true });
  },

  /**
   * Upload a single file to a project.
   * If large/binary => S3 + pointer commit. Otherwise => direct base64 commit.
   */
  uploadFile: async (req: Request, res: Response) => {
    const { projectId } = req.params;

    // For multi-part form data, Multer places text fields on req.body
    // so read from there first, then fall back to query (if you still need it).
    let uploadPath = req.body.path;
    if (!uploadPath) {
      uploadPath = req.query.path as string;
    }

    if (!req.file) {
      throw new Error("No file provided");
    }

    if (!req.file) {
      throw new Error("No file provided");
    }

    // Attempt to directly upload (will throw if LFS is needed)
    await uploadFileToProject(
      projectId,
      uploadPath,
      req.file.buffer,
      `Upload ${req.file.originalname}`
    );

    res.json({ success: true });
  },

  getFiles: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path } = req.query;
    const files = await getProjectFiles(projectId, path as string);
    res.json(files);
  },

  deleteContents: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path } = req.query;
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
  getFile: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path } = req.query;
    const file = await getFileContent(
      projectId,
      decodeURIComponent(path as string)
    );
    res.json(file);
  },

  /**
   * Step 1 for LFS: client asks for a presigned URL if the file is big or forced by extension.
   */
  presignLfs: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { filename, mimeType, size, sha256 } = req.body;

    if (!shouldUseLfs(filename, size)) {
      res.json({ isLfs: false });
      return;
    }

    // Create a "clean" S3 key from the project and file name.
    // (You could add a timestamp or version suffix if needed to avoid accidental overwrites.)
    const safeFilename = toGitSafeName(filename);
    const s3FileKey = `files/${projectId}/${safeFilename}`;

    const putUrl = s3.presign(s3FileKey, {
      expiresIn: 3600,
      method: "PUT",
      type: mimeType,
    });

    res.json({
      isLfs: true,
      presignedUrl: putUrl,
      fileKey: s3FileKey, // Return the clean key for later use.
      file_metadata: {
        filename,
        mimeType,
        size,
        sha256,
      },
    });
  },

  /**
   * Step 2 for LFS: after the client has PUT the file to S3, finalize by creating the pointer in Gitea.
   */
  finalizeLfs: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { fileKey, filePath, size, sha256 } = req.body;

    // Optionally validate that fileKey follows your naming scheme.
    if (!fileKey || !fileKey.startsWith(`files/${projectId}/`)) {
      throw new Error("Invalid fileKey format");
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) {
      throw new Error("Project not found");
    }

    // Create an extended pointer file that includes the S3 file key.
    const pointerContent = `version https://git-lfs.github.com/spec/v1
oid sha256:${sha256}
size ${size}
file ${fileKey}
`;

    const base64Pointer = Buffer.from(pointerContent, "utf-8").toString(
      "base64"
    );

    await gitea.repos.repoCreateFile(
      "admin",
      toGitSafeName(project.name),
      filePath,
      {
        content: base64Pointer,
        message: `LFS upload of ${filePath}`,
      }
    );

    res.json({ success: true });
  },
};

export default Router()
  .post("/", handlers.createProject)
  .get("/", handlers.listProjects)

  // Routes with files
  .post("/:projectId/files", upload.single("file"), handlers.uploadFile)
  .post("/:projectId/files/presign-lfs", handlers.presignLfs)
  .post("/:projectId/files/finalize-lfs", handlers.finalizeLfs)
  .get("/:projectId/files", handlers.getFiles)
  .delete("/:projectId/files", handlers.deleteContents)

  .patch("/:projectId", handlers.updateProject)
  .get("/:projectId", handlers.getProject)
  .delete("/:projectId", handlers.deleteProject)

  .get("/:projectId/files/content", handlers.getFile);
