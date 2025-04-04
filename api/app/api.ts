import { Router, Request, Response } from "express";
import { organizationInvites, projects } from "./config/schema";
import db from "./config/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import s3 from "./config/s3";
import { getOrgIdOrUnedfined, handle } from "./utils";
import { auth, checkSub } from "./middleware";
import threadsOps from "./features/threads/threads.ops";

// Routes
import authRoutes from "./features/auth";
import modelRoutes from "./features/models";
import threadRoutes from "./features/threads/threads.routes";
import paymentRoutes, { webhook } from "./features/payments";
import organizationRoutes from "./features/organizations";
import workflowRoutes from "./features/workflows/workflows.routes";
import permissionsRoutes from "./features/permissions/permissions.routes";
import analyticsRoutes from "./features/analytics";
import knowledgeBasesRoutes from "./features/knowledge-bases/knowledge-bases.routes";
import sitesRoutes from "./features/sites/sites.routes";
import issuesRoutes from "./features/issues/issues.routes";
import { PermissionManager } from "./features/permissions/permissions.tools";
import projectsRoutes from "./features/projects/projects.routes";

export default Router()
  .use("/auth", authRoutes)
  .use("/models", modelRoutes)
  // Add a public endpoint for accessing shared threads
  .get(
    "/public/threads/:threadId",
    handle(async (req) => {
      return threadsOps.getThread(req.params.threadId);
    })
  )
  .use("/threads", auth, checkSub, threadRoutes)
  .post("/payments/webhook", webhook)
  .use("/payments", auth, paymentRoutes)
  .get(
    "/organizations/invite/:inviteToken",
    handle(async (req) => {
      const { inviteToken } = req.params;
      const invite = await db.query.organizationInvites.findFirst({
        where: eq(organizationInvites.token, inviteToken),
        with: {
          organization: {
            columns: {
              id: true,
              name: true,
              slug: true,
              seats: true,
              logo: true,
            },
            with: {
              members: true, // Include members to count seats used
            },
          },
        },
      });

      if (!invite) {
        return { error: "Invalid invite token" };
      }

      const seatsUsed = invite.organization?.members.length;

      const logoUrl = invite.organization?.logo
        ? s3.presign(invite.organization.logo, {
            expiresIn: 3600,
            method: "GET",
          })
        : null;

      return {
        organization: {
          ...invite.organization,
          seatsUsed,
          logoUrl,
        },
      };
    })
  )
  .use("/organizations", auth, organizationRoutes)
  .use("/sites", auth, checkSub, sitesRoutes)
  .use("/projects", auth, checkSub, projectsRoutes)
  .use("", auth, checkSub, issuesRoutes)
  .use("/workflows", auth, workflowRoutes)
  .use("/knowledge-bases", auth, knowledgeBasesRoutes)
  .post(
    "/presigned-url",
    auth,
    handle(async (req) => {
      const { filename, mime_type, size, file_key } = req.body;
      const url = s3.presign(file_key, {
        expiresIn: 3600, // 1 hour
        type: mime_type,
        method: "PUT",
      });
      const viewUrl = s3.file(file_key).presign({
        expiresIn: 3600,
        method: "GET",
      });

      return {
        url,
        viewUrl,
        file_metadata: {
          filename,
          mime_type,
          file_key,
          size,
        },
      };
    })
  )
  .use("/permissions", auth, permissionsRoutes)
  .use("/analytics", analyticsRoutes)

  // Temporary (projects with no site associated)
  .get("/unlinked-projects", auth, async (req: Request, res: Response) => {
    const orgId = getOrgIdOrUnedfined(req.workspace);

    const conditions = [isNull(projects.siteId)];

    if (orgId && req.dbUser!.id) {
      const orgProjectsIds = await PermissionManager.getUserOrgProjectsIds(
        req.dbUser!.id,
        orgId
      );

      conditions.push(inArray(projects.id, orgProjectsIds));
    } else if (req.dbUser!.id) {
      conditions.push(eq(projects.userId, req.dbUser!.id));
    }

    const projectsList = await db.query.projects.findMany({
      where: and(...conditions),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    res.json(projectsList);
  });
