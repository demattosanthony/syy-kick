import { Request, Response, Router } from "express";
import { eq, sql } from "drizzle-orm";
import z from "zod";
import db from "../config/db";
import {
  organizationInvites,
  organizationMembers,
  organizations,
  samlConfigs,
} from "../config/schema";
import s3 from "../config/s3";
import { DbUser } from "../createAuthToken";
import { randomBytes } from "crypto";
import stripe from "../config/stripe";
import { isOrgOwner } from "../middleware";

// Core Types
type Role = "owner" | "member";
interface SamlConfig {
  entryPoint?: string;
  issuer?: string;
  cert?: string;
  callbackUrl?: string;
}

// Validation Schemas
const schemas = {
  org: z.object({
    name: z.string().min(1),
    domain: z.string().optional(),
    logo: z.string().optional(),
    seats: z.number().optional(),
    saml: z
      .object({
        entryPoint: z.string().url().optional(),
        issuer: z.string().optional(),
        cert: z.string().optional(),
        callbackUrl: z.string().url().optional(),
      })
      .optional(),
  }),
  member: z.object({
    email: z.string().email(),
    role: z.enum(["owner", "member"]),
  }),
};

// Utility Functions
const crypto = {
  encrypt: (value: string) => {
    const key = process.env.PGCRYPTO_KEY;
    return sql`pgp_sym_encrypt(${value}::text, ${key})`;
  },
  decrypt: (field: string) => {
    const key = process.env.PGCRYPTO_KEY;
    return sql`pgp_sym_decrypt(${field}, ${key})::text`;
  },
};

// Core Operations
const ops = {
  async list(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const [orgs, count] = await Promise.all([
      db.query.organizations.findMany({
        with: { samlConfig: true },
        limit,
        offset,
      }),
      db.select({ count: sql`count(*)` }).from(organizations),
    ]);

    const data = await Promise.all(
      orgs.map(async (org) => ({
        ...org,
        logoUrl: org.logo
          ? s3.file(org.logo).presign({ expiresIn: 3600 })
          : null,
        samlConfig: org.samlConfig
          ? await ops.decryptSaml(org.samlConfig)
          : null,
      }))
    );

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(count[0].count),
        pages: Math.ceil(Number(count[0].count) / limit),
      },
    };
  },

  async create(data: z.infer<typeof schemas.org>, user: DbUser) {
    const slug = data.domain?.split(".")[0].toLowerCase();
    if (
      data.domain &&
      (await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug!),
      }))
    ) {
      throw new Error("Organization already exists");
    }

    return db.transaction(async (tx) => {
      const values = {
        name: data.name,
        ...(data.domain && { domain: data.domain, slug }),
        ...(data.logo && { logo: data.logo }),
        ...(data.seats && { seats: data.seats }),
      };

      const [org] = await tx.insert(organizations).values(values).returning();

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: "owner" as Role,
      });

      if (data.saml) {
        await ops.updateSaml(org.id, data.saml);
      }

      return org;
    });
  },

  async update(orgId: string, data: Partial<z.infer<typeof schemas.org>>) {
    return db.transaction(async (tx) => {
      if (data.name || data.domain || data.logo) {
        await tx
          .update(organizations)
          .set({
            name: data.name,
            domain: data.domain,
            logo: data.logo,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, orgId));
      }

      if (data.saml) {
        await ops.updateSaml(orgId, data.saml);
      }

      return ops.getById(orgId);
    });
  },

  async updateSaml(orgId: string, config: SamlConfig) {
    const existing = await db.query.samlConfigs.findFirst({
      where: eq(samlConfigs.organizationId, orgId),
    });

    const values = {
      organizationId: orgId,
      entryPoint: crypto.encrypt(config.entryPoint || ""),
      issuer: crypto.encrypt(config.issuer || ""),
      cert: crypto.encrypt(config.cert || ""),
      callbackUrl:
        config.callbackUrl || `${process.env.BASE_URL}/auth/saml/callback`,
      updatedAt: new Date(),
    };

    return existing
      ? db
          .update(samlConfigs)
          .set(values)
          .where(eq(samlConfigs.id, existing.id))
      : db.insert(samlConfigs).values(values);
  },

  async decryptSaml(config: any) {
    const decrypted = await db
      .execute(
        sql`
      SELECT 
        ${crypto.decrypt(config.entryPoint)} as entry_point,
        ${crypto.decrypt(config.issuer)} as issuer,
        ${crypto.decrypt(config.cert)} as cert,
        ${config.callbackUrl} as callback_url
    `
      )
      .then((r) => r.rows[0]);

    return {
      entryPoint: decrypted.entry_point,
      issuer: decrypted.issuer,
      cert: decrypted.cert,
      callbackUrl: config.callbackUrl,
    };
  },

  async getById(id: string) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, id),
      with: { samlConfig: true, members: true },
    });
    if (!org) throw new Error("Organization not found");

    // Generate presigned URL for the logo
    const logoUrl = org.logo
      ? s3.file(org.logo).presign({ expiresIn: 3600, method: "GET" })
      : null;

    return {
      ...org,
      logoUrl,
      samlConfig: org.samlConfig ? await ops.decryptSaml(org.samlConfig) : null,
    };
  },

  async delete(id: string) {
    return db.transaction(async (tx) => {
      await tx
        .delete(organizationMembers)
        .where(eq(organizationMembers.organizationId, id));
      await tx.delete(organizations).where(eq(organizations.id, id));
    });
  },

  async listMembers(orgId: string) {
    return db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, orgId),
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            name: true,
            profilePicture: true,
          },
        },
      },
    });
  },

  async removeMember(orgId: string, userId: string) {
    return db
      .delete(organizationMembers)
      .where(sql`organization_id = ${orgId} AND user_id = ${userId}`);
  },

  async getInviteLink(orgId: string) {
    const invite = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.organizationId, orgId),
    });

    return invite ? invite.token : await ops.generateInviteLink(orgId);
  },

  async generateInviteLink(orgId: string) {
    // Delete any existing invite
    await db
      .delete(organizationInvites)
      .where(eq(organizationInvites.organizationId, orgId));

    const token = randomBytes(16).toString("hex");
    await db.insert(organizationInvites).values({
      organizationId: orgId,
      token,
    });

    return token;
  },
};

// Request Handlers
const handle = {
  async get(req: Request, res: Response) {
    res.json(await ops.getById(req.params.id));
  },

  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    res.json(await ops.list(page, limit));
  },

  async create(req: Request, res: Response) {
    const data = schemas.org.parse(req.body);
    res.json(await ops.create(data, req.dbUser!));
  },

  async update(req: Request, res: Response) {
    const data = schemas.org.partial().parse(req.body);
    res.json(await ops.update(req.params.id, data));
  },

  async delete(req: Request, res: Response) {
    await ops.delete(req.params.id);
    res.json({ success: true });
  },

  async listMembers(req: Request, res: Response) {
    const members = await ops.listMembers(req.params.id);
    res.json(members);
  },

  async getInvite(req: Request, res: Response) {
    const token = await ops.getInviteLink(req.params.id);
    res.json({ token });
  },

  async removeMember(req: Request, res: Response) {
    await ops.removeMember(req.params.id, req.params.userId);
    res.json({ success: true });
  },

  async resetInvite(req: Request, res: Response) {
    const token = await ops.generateInviteLink(req.params.id);
    res.json({ token });
  },

  async validateSeatUpdate(req: Request, res: Response) {
    const { seats } = req.body;
    const orgId = req.params.id;

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      with: { members: true },
    });

    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    // Don't allow reducing seats below current member count
    if (seats < (org.members?.length || 0)) {
      res.status(400).json({
        error: "Cannot reduce seats below current member count",
      });
      return;
    }

    res.json({ success: true });
  },

  async updateSeats(req: Request, res: Response) {
    try {
      const { seats } = req.body;
      const orgId = req.params.id;

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: {
          stripeCustomerId: true,
        },
      });

      // If there's a Stripe customer, update their subscription
      if (org?.stripeCustomerId) {
        const subscription = await stripe.subscriptions.list({
          customer: org.stripeCustomerId,
          limit: 1,
        });

        if (subscription.data.length) {
          await stripe.subscriptions.update(subscription.data[0].id, {
            items: [
              {
                quantity: seats,
                id: subscription.data[0].items.data[0].id,
              },
            ],
          });
        }
      }

      // Update seats in database regardless of subscription status
      await db
        .update(organizations)
        .set({ seats, updatedAt: new Date() })
        .where(eq(organizations.id, orgId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating seats:", error);
      res.status(500).json({ error: "Failed to update seats" });
    }
  },
};

// Router
export default Router()
  .get("", isOrgOwner, handle.list)
  .post("", handle.create)
  .get("/:id", isOrgOwner, handle.get)
  .put("/:id", isOrgOwner, handle.update)
  .delete("/:id", isOrgOwner, handle.delete)
  .get("/:id/members", isOrgOwner, handle.listMembers)
  .delete("/:id/members/:userId", isOrgOwner, handle.removeMember)
  .get("/:id/invite", isOrgOwner, handle.getInvite)
  .post("/:id/invite/reset", isOrgOwner, handle.resetInvite)
  .post("/:id/seats/validate", isOrgOwner, handle.validateSeatUpdate)
  .put("/:id/seats", isOrgOwner, handle.updateSeats);
