import { jwtDecode } from "jwt-decode";
import db from "./db";
import { and, eq } from "drizzle-orm";
import { accessTokens } from "./schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

export class MicrosoftAPI {
    private userId: string;

    constructor({ userId }: { userId: string }) {
        this.userId = userId;
    }

    async getSite(accessToken: string): Promise<MicrosoftSite> {
        const response = await fetch(`https://graph.microsoft.com/v1.0/sites/root`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        return await response.json() as MicrosoftSite;
    }

    async saveToken(
        accessToken: string,
        refreshToken: string,
        domain: string,
        type: "picker" | "graph",
        tx?: NodePgDatabase<typeof import('./schema')>
    ) {
        const dbInstance = tx || db;

        const existingToken = await dbInstance.query.accessTokens.findFirst({
            where: and(
                eq(accessTokens.userId, this.userId),
                eq(accessTokens.provider, "microsoft"),
                eq(accessTokens.type, type)
            )
        });

        if (existingToken) {
            await dbInstance.update(accessTokens).set({
                accessToken,
                refreshToken,
                domain,
                type,
                updatedAt: new Date()
            }).where(eq(accessTokens.id, existingToken.id));
        } else {
            await dbInstance.insert(accessTokens).values({
                userId: this.userId,
                provider: "microsoft",
                accessToken,
                refreshToken,
                domain,
                type
            });
        }
    }

    async getAccessToken(type: "picker" | "graph", domain?: string,): Promise<{ accessToken: string, baseUrl: string | null } | undefined> {

        const accessToken = await this.getUserToken(type);

        if (!accessToken) {
            return undefined;
        }

        if (this.isAccessTokenExpired(accessToken.accessToken) && accessToken.refreshToken) {
            const jwt = jwtDecode(accessToken.accessToken) as any;

            if (!jwt.tid) {
                throw new Error("Invalid access token");
            }

            const newToken = await this.refreshTokenSilently(domain ?? `login.microsoftonline.com/${jwt.tid}`, accessToken.refreshToken);

            return {
                accessToken: newToken.access_token,
                baseUrl: accessToken.domain ?? domain ?? null
            };
        }

        return {
            accessToken: accessToken.accessToken,
            baseUrl: accessToken.domain ?? domain ?? null
        };
    }

    async getUserToken(type: "picker" | "graph"): Promise<typeof accessTokens.$inferSelect | undefined> {
        const accessToken = await db.query.accessTokens.findFirst({
            where: and(
                eq(accessTokens.userId, this.userId),
                eq(accessTokens.provider, "microsoft"),
                eq(accessTokens.type, type)
            )
        });

        return accessToken;
    }

    isAccessTokenExpired(accessToken: string) {
        const currentTime = Date.now() / 1000;

        const decoded = jwtDecode(accessToken) as any;

        if (!decoded.exp) {
            throw new Error("Invalid access token");
        }

        return decoded.exp < currentTime;
    }

    async getMicrosoftToken(domain: string, options: {
        refresh_token?: string;
        code?: string;
        grant_type: "refresh_token" | "authorization_code";
        redirect_uri?: string;
        scope: string;
    }): Promise<MicrosoftRefreshTokenResponse> {
        try {
            const params = new URLSearchParams({
                client_id: process.env.MICROSOFT_CLIENT_ID!,
                client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
                ...options
            });

            const response = await fetch(`https://${domain}/oauth2/v2.0/token`, {
                method: "POST",
                body: params,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            const data = await response.json() as MicrosoftRefreshTokenResponse;

            return data;
        } catch (error) {
            console.error(error);
            throw error as MicrosoftRefreshTokenError;
        }
    }

    async refreshTokenSilently(domain: string, refreshToken: string): Promise<MicrosoftRefreshTokenResponse> {
        const params = new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            redirect_uri: process.env.MICROSOFT_FILES_CALLBACK_URL!,
            scope: `https://${domain}/.default`
        });

        try {
            const response = await fetch(`https://${domain}/oauth2/v2.0/token`, {
                method: "POST",
                body: params,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            const data = await response.json() as MicrosoftRefreshTokenResponse;

            return data;

        } catch (error) {
            throw error as MicrosoftRefreshTokenError;
        }
    }

    getConsentUrl(state: string) {
        const authUrl = new URL(
            "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize"
        );
        authUrl.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID!);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set(
            "redirect_uri",
            process.env.MICROSOFT_FILES_CALLBACK_URL!
        );
        authUrl.searchParams.set("scope", "openid offline_access Sites.Read.All");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("prompt", "consent");

        return authUrl.toString();
    }
}

type MicrosoftSite = {
    "@odata.context": string;
    createdDateTime: string;
    description: string;
    id: string;
    lastModifiedDateTime: string;
    name: string;
    webUrl: string;
    displayName: string;
    root: any;
    siteCollection: {
        hostname: string;
    }
}

export type MicrosoftRefreshTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    refresh_token: string;
    id_token: string;
}

export type MicrosoftRefreshTokenError = {
    error: string;
    error_description: string;
    error_codes: number[];
    timestamp: string;
    trace_id: string;
    correlation_id: string;
}
