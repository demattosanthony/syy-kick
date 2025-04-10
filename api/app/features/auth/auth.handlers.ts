import { Request, Response } from "express";
import { DbUser, sendAuthCookies, checkTokens } from "../../createAuthToken";
import { ops } from "./auth.ops";
import db from "../../config/db";
import { memberRoles, organizationInvites, organizations } from "../../config/schema";
import { and, eq } from "drizzle-orm";
import { CONFIG } from "../../config/constants";
import { MicrosoftGraph, MicrosoftRefreshTokenError } from "../../config/microsoft";
export const handlers = {
    oauthCallback: async (req: Request, res: Response) => {
        const user = req.user as DbUser;
        const state = req.query.state as string | undefined;

        sendAuthCookies(res, user);

        // If there's a state parameter containing invite token, process it
        if (state) {
            try {
                // Verify and process invite
                const invite = await ops.checkInvite(state);

                if (!invite?.roleId || !invite.organizationId) {
                    res.status(403).json({ message: "Invalid invite" });
                    return;
                }

                await ops.addOrgMember(
                    invite.organizationId as string,
                    user.id,
                    invite.roleId
                );

                await db
                    .delete(organizationInvites)
                    .where(
                        and(
                            eq(organizationInvites.organizationId, invite.organizationId),
                            eq(organizationInvites.token, invite.token)
                        )
                    );

                res.redirect(
                    `${process.env.FRONTEND_URL}?orgJoined=true&orgId=${invite.organizationId}`
                );
                return;
            } catch (error: any) {
                res.redirect(`${process.env.FRONTEND_URL}?error=${error.message}`);
                return;
            }
        }

        res.redirect(process.env.FRONTEND_URL!);
    },

    samlCallback: (req: Request, res: any) => {
        sendAuthCookies(res, req.user as DbUser);
        res.redirect(process.env.FRONTEND_URL!);
    },

    logout: (req: Request, res: any) => {
        const options = CONFIG.COOKIE_OPTIONS;
        res
            .clearCookie("id", options)
            .clearCookie("rid", options)
            .status(200)
            .send({
                success: true,
                message: "Logged out",
            });
    },

    me: async (req: Request, res: any) => {
        try {
            const { id, rid } = req.cookies;
            if (!id || !rid) {
                res.status(200).json(null);
                return;
            }
            const { userId } = await checkTokens(id, rid);
            const user = await ops.getUserWithOrgs(userId);

            if (!user) {
                res.status(401).json({
                    message: "Authentication required",
                });
                return;
            }

            res.status(200).json(user || null);
        } catch (error) {
            res.status(200).json(null);
        }
    },

    joinWithInvite: async (req: Request, res: Response) => {
        try {
            const invite = await ops.checkInvite(req.params.token);

            if (!req.dbUser) {
                res.status(401).json({
                    message: "Authentication required",
                    inviteToken: req.params.token,
                });
                return;
            }

            if (!invite?.roleId || !invite.organizationId) {
                res.status(403).json({ message: "Invalid invite" });
                return;
            }

            // Check if the user is already a member of this organization
            const existingMembership = await db.query.memberRoles.findFirst({
                where: and(
                    eq(memberRoles.organizationId, invite.organizationId),
                    eq(memberRoles.userId, req.dbUser.id)
                ),
            });

            if (existingMembership) {
                // User is already a member, return success with alreadyMember flag
                res.json({ success: true, alreadyMember: true });
                return;
            }

            if (invite.email !== req.dbUser.email) {
                throw new Error("wrong_email");
            }

            await ops.checkOrgCapacity(invite.organizationId as string);

            await ops.addOrgMember(
                invite.organizationId as string,
                req.dbUser.id,
                invite.roleId
            );

            await db
                .delete(organizationInvites)
                .where(
                    and(
                        eq(organizationInvites.organizationId, invite.organizationId),
                        eq(organizationInvites.token, invite.token)
                    )
                );
            res.json({ success: true });
        } catch (error: any) {
            res.status(403).json({ message: error.message });
        }
    },

    getUploadToken: async (req: Request, res: Response) => {
        const user = req.dbUser;

        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const microsoftGraph = new MicrosoftGraph({ userId: user.id });

        try {
            const token = await microsoftGraph.getAccessToken();

            console.log("token", token);

            if (token) {
                res.json(token);
                return;
            }

            res.json({ error: "no_token_found" });
        } catch (error) {
            const microsoftError = error as MicrosoftRefreshTokenError;

            res.json({ error: microsoftError.error });
        }
    }
}