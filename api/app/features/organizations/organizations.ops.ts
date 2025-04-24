/** Schemas */
import { schemas } from "./organizations.schema";
import { organizations, samlConfigs, memberRoles, users, roles, organizationMembers, accessLogs, resources, actions, documents, knowledgeBases, projects, sites } from "../../config/schema";

/** Utils */
import { z } from "zod";
import { crypto } from "./organizations.utils";
import { slugify } from "../../utils";

/** Types */
import { DbUser } from "../../createAuthToken";
import { Role, SamlConfig } from "./organizations.types";

/** Permissions */
import { permissionsOps } from "../permissions/permissions.ops";
import { PermissionManager } from "../permissions/permissions.tools";
import { Permissions } from "../permissions/permissions.types";

/** Config */
import db from "../../config/db";
import s3 from "../../config/s3";

/** Drizzle */
import { sql, eq, and, isNull, asc, desc, ne, or, ilike, SQL } from "drizzle-orm";

export const ops = {
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
                        slug: data.name ? slugify(data.name) : organizations.slug,
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

    async listMembers(orgId: string, user: DbUser) {
        if (!orgId) {
            throw new Error("Please select an organization");
        }

        if (!user) {
            throw new Error("Unauthorized");
        }

        const userRole = await permissionsOps.getUserOrganizationRole(
            user.id,
            orgId
        );

        if (!userRole) {
            throw new Error("User not found in organization");
        }

        const members = await db
            .select({
                id: memberRoles.userId,
                email: users.email,
                profilePicture: users.profilePicture,
                name: users.name,
                role: roles,
                createdAt: memberRoles.createdAt,
            })
            .from(memberRoles)
            .innerJoin(users, eq(users.id, memberRoles.userId))
            .innerJoin(roles, eq(roles.id, memberRoles.roleId))
            .where(
                and(
                    eq(memberRoles.organizationId, orgId),
                    isNull(memberRoles.projectId)
                )
            );

        return members.map((member) => {
            const hasSuperiorRole = PermissionManager.hasSuperiorRole(
                userRole?.role.name as Permissions.Roles,
                member.role.name as Permissions.Roles
            );
            return {
                ...member,
                canUpdate: hasSuperiorRole,
                canDelete: hasSuperiorRole,
            };
        });
    },

    async removeMember(orgId: string, userId: string) {
        await db
            .delete(organizationMembers)
            .where(sql`organization_id = ${orgId} AND user_id = ${userId}`);
        await permissionsOps.removeOrgPermissions(orgId, userId);
    },

    async updateMemberRole(orgId: string, userId: string, newRole: Role) {
        // 1. Fetch membership record we want to update.
        const membership = await db.query.organizationMembers.findFirst({
            where: sql`organization_id = ${orgId} AND user_id = ${userId}`,
        });

        if (!membership) {
            throw new Error(
                "Member not found or does not belong to this organization."
            );
        }

        // 2. Fetch the *earliest* owner record to identify the original org creator.
        const [firstOwner] = await db.query.organizationMembers.findMany({
            where: eq(organizationMembers.organizationId, orgId),
            orderBy: asc(organizationMembers.createdAt),
            limit: 1,
        });

        // 3. If the user we are trying to update is that *very first* owner and
        //    we are attempting to set them to "member", block the operation.
        if (
            firstOwner &&
            firstOwner.userId === userId &&
            firstOwner.role === "owner" &&
            newRole === "member"
        ) {
            throw new Error(
                "You cannot downgrade the original organization creator from owner to member."
            );
        }

        // 4. Otherwise, perform the role update.
        await db
            .update(organizationMembers)
            .set({ role: newRole, updatedAt: new Date() })
            .where(sql`id = ${membership.id}`);

        return true;
    },
};