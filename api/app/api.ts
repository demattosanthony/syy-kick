import { Router } from "express";
import { organizationInvites } from "./config/schema";
import db from "./config/db";
import { eq } from "drizzle-orm";
import s3 from "./config/s3";
import { auth, checkSub } from "./middleware";
import threadsOps from "./features/threads/threads.ops";
import { messagesOps } from "./features/threads/messages/messages.ops";

// Routes
import authRoutes from "./features/auth/auth.routes";
import modelRoutes from "./features/models";
import threadRoutes from "./features/threads/threads.routes";
import paymentRoutes, { webhook } from "./features/payments";
import organizationRoutes from "./features/organizations/organizations.routes";
import workflowRoutes from "./features/workflows/workflows.routes";
import permissionsRoutes from "./features/permissions/permissions.routes";
import analyticsRoutes from "./features/analytics/analytics.routes";
import toolsRoutes from "./features/tools/tools.routes";
import integrationsRoutes from "./features/integrations/integrations.routes";
import filesRoutes from "./features/files/files.routes";

export default Router()
  .use("/auth", authRoutes)
  .use("/models", modelRoutes)
  // Add a public endpoint for accessing shared threads
  .get("/public/threads/:threadId", async (req, res) => {
    try {
      const thread = await threadsOps.getThread(req.params.threadId);
      res.json(thread);
    } catch (error) {
      console.error("Error getting thread:", error);
      res.status(500).json({ error: "Failed to get thread" });
    }
  })
  .get("/public/threads/:threadId/messages", async (req, res) => {
    try {
      const messages = await messagesOps.getMessages(req.params.threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting thread messages:", error);
      res.status(500).json({ error: "Failed to get thread messages" });
    }
  })
  .use("/threads", auth, checkSub, threadRoutes)
  .post("/payments/webhook", webhook)
  .use("/payments", auth, paymentRoutes)
  .get("/organizations/invite/:inviteToken", async (req, res) => {
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
      res.status(404).json({ error: "Invalid invite token" });
      return;
    }

    const seatsUsed = invite.organization?.members.length;

    const logoUrl = invite.organization?.logo
      ? s3.presign(invite.organization.logo, {
          expiresIn: 3600,
          method: "GET",
        })
      : null;

    res.json({
      organization: {
        ...invite.organization,
        seatsUsed,
        logoUrl,
      },
    });
  })
  .use("/organizations", auth, organizationRoutes)
  .use("/workflows", auth, workflowRoutes)
  .use("/tools", auth, toolsRoutes)
  .use("/files", auth, filesRoutes)
  .use("/permissions", auth, permissionsRoutes)
  .use("/analytics", analyticsRoutes)
  .use("/integrations", auth, integrationsRoutes);
