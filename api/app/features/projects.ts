import z from "zod";
import db from "../config/db";
import { eq } from "drizzle-orm";
import { organizations, projects, users } from "../config/schema";
import gitea from "../config/gitea";
import { Router, Request, Response } from "express";

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
    name: data.name,
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

async function listProjects(params: {
  organizationId?: string;
  userId?: string;
}) {
  if (!params.organizationId && !params.userId) {
    throw new Error("Either organizationId or userId must be provided");
  }

  const whereClause = params.organizationId
    ? eq(projects.organizationId, params.organizationId as string)
    : eq(projects.userId, params.userId as string);

  const projs = await db.query.projects.findMany({
    where: whereClause,
  });

  return projs;
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
    const { organizationId } = req.params;
    const projects = await listProjects({
      organizationId,
      userId: req.dbUser?.id,
    });
    res.json(projects);
  },
};

export default Router()
  .post("/", handlers.createProject)
  .get("/", handlers.listProjects);
