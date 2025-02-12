import z from "zod";
import db from "../config/db";
import { and, eq, ilike } from "drizzle-orm";
import { organizations, projects, users } from "../config/schema";
import gitea from "../config/gitea";
import { Router, Request, Response } from "express";
import s3 from "../config/s3";
import multer from "multer";
import { shouldUseLfs } from "../utils/lfs-utils";

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
    auto_init: true,
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

async function getProjectFiles(projectId: string, path: string = "") {
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
      return filesWithMetadata;
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

function getFileType(filename: string): "text" | "pdf" | "image" | "binary" {
  const extension = filename.toLowerCase().split(".").pop();

  const textExtensions = [
    "txt",
    "md",
    "js",
    "ts",
    "json",
    "yaml",
    "yml",
    "css",
    "html",
    "sh",
  ];
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "svg", "webp"];

  if (extension && textExtensions.includes(extension)) return "text";
  if (extension === "pdf") return "pdf";
  if (extension && imageExtensions.includes(extension)) return "image";
  return "binary";
}

/**
 * If the file content is an LFS pointer, return the S3 presigned url;
 * otherwise, return direct content (decoded for text, or base64 for binary).
 */
async function getFileContent(projectId: string, path: string) {
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

  // Basic metadata
  const fileType = getFileType(response.data.name);
  const baseResponse = {
    name: response.data.name,
    path: response.data.path,
    size: response.data.size,
    type: fileType,
    sha: response.data.sha,
  };

  // Decode the Gitea base64 content
  const decoded = Buffer.from(response.data.content || "", "base64").toString(
    "utf-8"
  );

  // Check if it's an LFS pointer file
  if (decoded.startsWith("version https://git-lfs.github.com/spec/v1")) {
    // Parse the sha256 from the pointer
    const match = decoded.match(/oid sha256:([0-9a-f]+)/i);
    if (!match) {
      // It's an LFS pointer but no recognized OID
      return { ...baseResponse, error: "Invalid LFS pointer" };
    }

    const oid = match[1];
    const presignedUrl = s3.presign(oid, { expiresIn: 60 * 60 }); // 1hr

    return {
      ...baseResponse,
      isLfsPointer: true,
      s3Url: presignedUrl,
    };
  }

  // Otherwise, it's a normal file stored in Gitea
  if (fileType === "text") {
    // Return actual text content
    return {
      ...baseResponse,
      content: decoded, // plain text
    };
  }

  // For non-text, just return the original base64 string
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
    const { path } = req.query;

    if (!req.file) {
      throw new Error("No file provided");
    }

    const uploadPath = (path as string) || req.file.originalname;

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

    // Use the SHA256 as the S3 key directly
    const fileKey = sha256; // No need for uploads/timestamp prefix since SHA256 is unique

    const putUrl = s3.presign(fileKey, {
      expiresIn: 3600,
      method: "PUT",
      type: mimeType,
    });

    const viewUrl = s3.file(fileKey).presign({
      expiresIn: 3600,
      method: "GET",
    });

    res.json({
      isLfs: true,
      presignedUrl: putUrl,
      viewUrl,
      fileKey,
      file_metadata: {
        filename,
        mimeType,
        size,
        sha256, // Include this so we can verify it later
      },
    });
    return;
  },

  /**
   * Step 2 for LFS: after the client has PUT the file to S3, finalize by creating the pointer in Gitea.
   */
  finalizeLfs: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { fileKey, filePath, size, sha256 } = req.body;

    // Verify the provided SHA256 matches the fileKey (they should be the same)
    if (fileKey !== sha256) {
      throw new Error("SHA256 mismatch");
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) {
      throw new Error("Project not found");
    }

    // Create pointer file using the SHA256 directly - no need to read file from S3
    const pointerContent = `version https://git-lfs.github.com/spec/v1
oid sha256:${sha256}
size ${size}
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
    return;
  },
};

export default Router()
  .post("/", handlers.createProject)
  .get("/", handlers.listProjects)
  .patch("/:projectId", handlers.updateProject)
  .get("/:projectId", handlers.getProject)
  .delete("/:projectId", handlers.deleteProject)
  .post("/:projectId/files", upload.single("file"), handlers.uploadFile)
  .post("/:projectId/files/presign-lfs", handlers.presignLfs)
  .post("/:projectId/files/finalize-lfs", handlers.finalizeLfs)
  .get("/:projectId/files", handlers.getFiles)
  .delete("/:projectId/files", handlers.deleteContents)
  .get("/:projectId/files/content", handlers.getFile);
