import { Router } from "express";
import { organizationInvites } from "./config/schema";
import db from "./config/db";
import { eq } from "drizzle-orm";
import s3 from "./config/s3";
import { handle } from "./utils";
import { auth, checkSub } from "./middleware";
import threadsOps from "./features/threads/threads.ops";

// Routes
import authRoutes from "./features/auth/auth.routes";
import modelRoutes from "./features/models";
import threadRoutes from "./features/threads/threads.routes";
import paymentRoutes, { webhook } from "./features/payments";
import organizationRoutes from "./features/organizations/organizations.routes";
import workflowRoutes from "./features/workflows/workflows.routes";
import permissionsRoutes from "./features/permissions/permissions.routes";
import analyticsRoutes from "./features/analytics";
import knowledgeBasesRoutes from "./features/knowledge-bases/knowledge-bases.routes";
import sitesRoutes from "./features/sites/sites.routes";
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
        type: mime_type,
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
  .get("/user-attachments/:file_id", async (req, res) => {
    try {
      const { file_id } = req.params;

      if (!file_id) {
        res.status(400).json({ error: "File key is required" });
        return;
      }

      const file_key = `user-attachments/${file_id}`;
      const file = s3.file(file_key);

      // Check if file exists
      try {
        await file.exists();
      } catch (error) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const presignedUrl = s3.file(file_key).presign({
        expiresIn: 3600,
        method: "GET",
      });

      return res.redirect(presignedUrl);
    } catch (error) {
      console.error("Error serving file:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  })
  .use("/permissions", auth, permissionsRoutes)
  .use("/analytics", analyticsRoutes)
  ;
