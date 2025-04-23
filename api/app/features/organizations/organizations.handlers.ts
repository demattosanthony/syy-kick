/** Ops */
import { ops } from "./organizations.ops";

/** Schemas */
import { schemas } from "./organizations.schema";

/** Types */
import { Request, Response } from "express";

/** Drizzle */
import { eq, and, isNotNull } from "drizzle-orm";

/** Config */
import db from "../../config/db";
import stripe from "../../config/stripe";
import { memberRoles, organizations } from "../../config/schema";

/** Permissions */
import { Permissions } from "../permissions/permissions.types";
import PermissionsFactory from "../permissions/permissions.factory";
import { permissionsOps } from "../permissions/permissions.ops";
import { PermissionManager } from "../permissions/permissions.tools";

export const handlers = {
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
        const org = await ops.create(data, req.dbUser!);

        await PermissionsFactory.createOrgAccess(
            Permissions.Roles.ORGANIZATION_ADMIN,
            org.id,
            req.dbUser!.id
        );

        res.json(org);
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
        const user = req.dbUser;
        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const members = await ops.listMembers(req.params.id, user);
        res.json(members);
    },

    async removeMember(req: Request, res: Response) {
        await ops.removeMember(req.params.id, req.params.userId);
        res.json({ success: true });
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

    async updateMemberRole(req: Request, res: Response) {
        try {
            const { role } = req.body;
            // Basic zod check or manual check to ensure role is owner/member
            if (role !== "owner" && role !== "member") {
                res.status(400).json({ error: "Invalid role" });
                return;
            }

            const orgId = req.params.id;
            const userId = req.params.userId;

            await ops.updateMemberRole(orgId, userId, role);
            res.json({ success: true });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    },

    async getTransferablePermissions(req: Request, res: Response) {
        const user = req.dbUser;
        const orgId = req.params.id;

        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const permissions = await PermissionManager.getUserTransferableRoles(
            user.id,
            Permissions.Level.ORGANIZATION,
            orgId
        );
        res.json(permissions);
    },

    async getUserRole(req: Request, res: Response) {
        const user = req.dbUser;

        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const orgId = req.params.id;

        // Personnal workspace, give all permissions
        if (user.id === orgId) {
            const formattedRole =
                await PermissionManager.getPersonnalWorkspacePermissions();
            res.json(formattedRole);
            return;
        }

        const role = await permissionsOps.getUserOrganizationRole(user.id, orgId);

        if (!role) {
            res.status(404).json({ error: "User not found in organization" });
            return;
        }

        res.json(PermissionManager.formatUserRole(role));
    },

    async getMemberRole(req: Request, res: Response) {
        const userId = req.params.userId;
        const orgId = req.params.id;

        const role = await permissionsOps.getUserOrganizationRole(userId, orgId);

        if (!role) {
            res.status(404).json({ error: "User not found in organization" });
            return;
        }

        const formattedRole = PermissionManager.formatUserRole(role);

        if (
            [
                Permissions.Roles.PROJECT_MANAGER,
                Permissions.Roles.PROJECT_MEMBER,
            ].includes(role.role.name as Permissions.Roles)
        ) {
            const userProjects = await db.query.memberRoles.findMany({
                where: and(
                    eq(memberRoles.organizationId, orgId),
                    isNotNull(memberRoles.projectId)
                ),
                with: { project: true },
            });

            formattedRole.projects = userProjects.map((p) => ({
                id: p.project!.id,
                name: p.project!.name,
            }));
        }

        res.json(formattedRole);
    },

    async getAccessLogs(req: Request, res: Response) {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const orgId = req.params.id;
        const search = req.query.search as string;
        const resource = req.query.resource as string;
        const action = req.query.action as string;
        const status = req.query.status as string;

        if (!orgId) {
            res.status(400).json({ error: "Organization ID is required" });
            return;
        }

        res.json(await ops.getAccessLogs(orgId, page, limit, {
            search,
            resource,
            action,
            status
        }));
    },
};