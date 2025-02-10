import { Router } from "express";
import { organizationInvites } from "./config/schema";
import db from "./config/db";
import { eq } from "drizzle-orm";
import s3 from "./config/s3";
import { handle } from "./utils";
import { auth, checkSub } from "./middleware";

// Routes
import authRoutes from "./features/auth";
import modelRoutes from "./features/models";
import threadRoutes from "./features/threads";
import paymentRoutes, { webhook } from "./features/payments";
import organizationRoutes from "./features/organizations";

export default Router()
  .use("/auth", authRoutes)
  .use("/models", modelRoutes)
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
  .post(
    "/presigned-url",
    auth,
    handle(async (req) => {
      const { filename, mime_type, size } = req.body;
      const file_key = `uploads/${Date.now()}-${filename}`;
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
  );
