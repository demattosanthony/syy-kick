import { jwtDecode } from "jwt-decode";
import db from "./db";
import { and, eq } from "drizzle-orm";
import { accessTokens } from "./schema";

export class MicrosoftGraph {
    private accessToken?: string;
    private payload: any;
    private userId: string;
    private domain?: string | null;

    constructor({ userId }: { userId: string }) {
        this.userId = userId;
    }

    async getSite(): Promise<MicrosoftSite> {
        const response = await fetch(`https://graph.microsoft.com/v1.0/sites/root`, {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
            },
        });

        return await response.json() as MicrosoftSite;
    }

    async saveToken(accessToken: string, refreshToken: string, domain: string) {

        const existingToken = await db.query.accessTokens.findFirst({
            where: and(
                eq(accessTokens.userId, this.userId),
                eq(accessTokens.provider, "microsoft"),
            )
        });

        if (existingToken) {
            this.accessToken = accessToken;

            await db.update(accessTokens).set({
                accessToken,
                refreshToken,
                domain,
                updatedAt: new Date()
            }).where(eq(accessTokens.id, existingToken.id));
        } else {
            this.accessToken = accessToken;

            await db.insert(accessTokens).values({
                userId: this.userId,
                provider: "microsoft",
                accessToken,
                refreshToken,
                domain,
            });
        }

        this.accessToken = accessToken;
        this.payload = jwtDecode(accessToken);
    }

    async getAccessToken(): Promise<{ accessToken: string, baseUrl: string | null } | undefined> {

        if (!this.accessToken) {
            const userToken = await this.getUserToken();
            if (!userToken) {
                return undefined;
            }

            console.log("userToken", userToken);

            this.accessToken = userToken.accessToken;
            this.payload = jwtDecode(userToken.accessToken);
            this.domain = userToken.domain;
        }

        if (this.isAccessTokenExpired()) {
            await this.refreshTokenSilently();
        }

        return {
            accessToken: this.accessToken,
            baseUrl: this.domain ?? null
        };
    }

    async getUserToken(): Promise<typeof accessTokens.$inferSelect | undefined> {
        const accessToken = await db.query.accessTokens.findFirst({
            where: and(
                eq(accessTokens.userId, this.userId),
                eq(accessTokens.provider, "microsoft"),
            )
        })

        return accessToken;
    }

    isAccessTokenExpired() {
        const currentTime = Date.now() / 1000;

        if (!this.payload.exp) {
            throw new Error('Invalid access token');
        }

        return this.payload.exp < currentTime;
    }

    async refreshTokenSilently(): Promise<void> {
        const params = new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: this.payload.refresh_token,
            redirect_uri: process.env.MICROSOFT_FILES_CALLBACK_URL!,
            scope: `https://${this.domain}/.default`
        });

        try {
            const response = await fetch(`https://${this.domain}/oauth2/v2.0/token`, {
                method: "POST",
                body: params,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            const data = await response.json() as MicrosoftRefreshTokenResponse;

            this.accessToken = data.access_token;
            this.payload = jwtDecode(data.access_token);

        } catch (error) {
            console.error(error);
            throw error as MicrosoftRefreshTokenError;
        }
    }

    setAccessToken(accessToken: string) {
        this.accessToken = accessToken;
        this.payload = jwtDecode(accessToken);
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

type MicrosoftRefreshTokenResponse = {
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
