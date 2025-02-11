import z from "zod";
import db from "../config/db";
import { and, eq, ilike, like } from "drizzle-orm";
import { organizations, projects, users } from "../config/schema";
import gitea from "../config/gitea";
import e, { Router, Request, Response } from "express";
import s3 from "../config/s3";
import multer from "multer";

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

async function uploadFileToProject(
  projectId: string,
  filePath: string,
  content: string,
  message: string = "Add file via API"
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const repoName = toGitSafeName(project.name);

  // Create or update file in repository
  await gitea.repos.repoCreateFile("admin", repoName, filePath, {
    content: content,
    message: message,
  });

  return true;
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

  console.log(params);

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

  // Add logo URL if organization exists and has a logo
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

    // gitea.repos.repoGetContents()

    return contents.data;
  } catch (error) {
    throw new Error("Failed to fetch repository contents");
  }
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
    const projects = await listProjects({
      organizationId: organizationId as string | undefined,
      userId: req.dbUser?.id,
      search: search as string,
    });
    res.json(projects);
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

  uploadFile: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { path } = req.query;

    if (!req.file) {
      throw new Error("No file provided");
    }

    await uploadFileToProject(
      projectId,
      (path as string) || req.file.originalname,
      req.file.buffer.toString("base64"),
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
};

export default Router()
  .post("/", handlers.createProject)
  .get("/", handlers.listProjects)
  .get("/:projectId", handlers.getProject)
  .delete("/:projectId", handlers.deleteProject)
  .post("/:projectId/files", upload.single("file"), handlers.uploadFile)
  .get("/:projectId/files", handlers.getFiles);
