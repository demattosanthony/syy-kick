import { jwtDecode } from "jwt-decode";
import db from "./db";
import { and, eq } from "drizzle-orm";
import { accessTokens } from "./schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import { Client } from "@microsoft/microsoft-graph-client";

export class MicrosoftAPI {
  private userId: string;
  private graphClient?: Client;
  private currentAccessToken?: string;

  constructor({ userId }: { userId: string }) {
    this.userId = userId;
  }

  /**
   * Get an authenticated Microsoft Graph client
   * @param type The type of token to use ('picker' or 'graph')
   * @param tx Optional database transaction
   * @returns Promise<Client | null> - The Graph client or null if authentication fails
   */
  async getGraphClient(
    type: "picker" | "graph" = "graph",
    tx?: NodePgDatabase<typeof import("./schema")>
  ): Promise<Client | null> {
    const tokenData = await this.getAccessToken(type, tx);

    if (!tokenData) {
      console.warn(
        `Failed to get access token for type: ${type}, userId: ${this.userId}`
      );
      return null;
    }

    // Create new client if we don't have one or if the token changed
    if (
      !this.graphClient ||
      this.currentAccessToken !== tokenData.accessToken
    ) {
      this.graphClient = Client.init({
        authProvider: (done) => done(null, tokenData.accessToken),
      });
      this.currentAccessToken = tokenData.accessToken;
    }

    return this.graphClient;
  }

  /**
   * Get a fresh access token, refreshing if necessary
   * @param type The type of token to retrieve
   * @param tx Optional database transaction
   * @returns Promise with access token and base URL, or undefined if unavailable
   */
  async getAccessToken(
    type: "picker" | "graph",
    tx?: NodePgDatabase<typeof import("./schema")>
  ): Promise<{ accessToken: string; baseUrl: string } | undefined> {
    const storedToken = await this.getUserToken(type, tx);

    if (!storedToken || !storedToken.domain) {
      console.warn(
        `No stored token or domain missing for type: ${type}, userId: ${this.userId}`
      );
      return undefined;
    }

    if (
      this.isAccessTokenExpired(storedToken.accessToken) &&
      storedToken.refreshToken
    ) {
      console.log(
        `Access token expired for type: ${type}, userId: ${this.userId}. Attempting refresh.`
      );
      const jwt = jwtDecode(storedToken.accessToken) as any;

      if (!jwt.tid) {
        console.error(
          `Invalid access token for type: ${type}, userId: ${this.userId}. Missing tenant ID (tid).`
        );
        throw new Error("Invalid access token: missing tenant ID (tid)");
      }

      const tokenEndpointAuthority = `login.microsoftonline.com/${jwt.tid}`;
      const resourceForScope = storedToken.domain; // e.g. graph.microsoft.com or TENANT.sharepoint.com

      try {
        const refreshedTokenData = await this.refreshTokenSilently(
          tokenEndpointAuthority,
          storedToken.refreshToken,
          resourceForScope
        );

        // console.log(
        //   `Refreshed token data for type ${type}, userId: ${this.userId}:`,
        //   refreshedTokenData
        // );

        if (!refreshedTokenData.access_token) {
          const errorResponse =
            refreshedTokenData as MicrosoftRefreshTokenResponse &
              MicrosoftRefreshTokenError;
          const errorInfo =
            errorResponse.error_description ||
            errorResponse.error ||
            JSON.stringify(refreshedTokenData);
          console.error(
            `Failed to refresh token for type ${type}, userId: ${this.userId}. API returned error: ${errorInfo}`
          );
          return undefined;
        }

        // Save the new tokens
        await this.saveToken(
          refreshedTokenData.access_token,
          refreshedTokenData.refresh_token || storedToken.refreshToken, // Use new refresh token if provided
          resourceForScope,
          type,
          tx // Pass the transaction here
        );
        // console.log(
        //   `Successfully refreshed and saved token for type ${type}, userId: ${this.userId}`
        // );

        // Clear the current client so it gets recreated with the new token
        this.graphClient = undefined;
        this.currentAccessToken = undefined;

        return {
          accessToken: refreshedTokenData.access_token,
          baseUrl: resourceForScope,
        };
      } catch (error: any) {
        console.error(
          `Exception during token refresh or save for type ${type}, userId: ${this.userId}. Error:`,
          error.message || error
        );
        return undefined;
      }
    }

    return {
      accessToken: storedToken.accessToken,
      baseUrl: storedToken.domain,
    };
  }

  async saveToken(
    accessToken: string,
    refreshToken: string,
    domain: string,
    type: "picker" | "graph",
    tx?: NodePgDatabase<typeof import("./schema")>
  ) {
    const dbInstance = tx || db;

    const existingToken = await dbInstance.query.accessTokens.findFirst({
      where: and(
        eq(accessTokens.userId, this.userId),
        eq(accessTokens.provider, "microsoft"),
        eq(accessTokens.type, type)
      ),
    });

    if (existingToken) {
      await dbInstance
        .update(accessTokens)
        .set({
          accessToken,
          refreshToken,
          domain,
          type,
          updatedAt: new Date(),
        })
        .where(eq(accessTokens.id, existingToken.id));
    } else {
      await dbInstance.insert(accessTokens).values({
        userId: this.userId,
        provider: "microsoft",
        accessToken,
        refreshToken,
        domain,
        type,
      });
    }

    // Clear the current client so it gets recreated with the new token
    this.graphClient = undefined;
    this.currentAccessToken = undefined;
  }

  async getUserToken(
    type: "picker" | "graph",
    tx?: NodePgDatabase<typeof import("./schema")>
  ): Promise<typeof accessTokens.$inferSelect | undefined> {
    const dbInstance = tx || db;
    const accessToken = await dbInstance.query.accessTokens.findFirst({
      where: and(
        eq(accessTokens.userId, this.userId),
        eq(accessTokens.provider, "microsoft"),
        eq(accessTokens.type, type)
      ),
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

  async getMicrosoftToken(
    domain: string,
    options: {
      refresh_token?: string;
      code?: string;
      grant_type: "refresh_token" | "authorization_code";
      redirect_uri?: string;
      scope: string;
      client_id?: string;
      client_secret?: string;
    }
  ): Promise<MicrosoftRefreshTokenResponse> {
    try {
      const params = new URLSearchParams();
      if (options.client_id) {
        params.append("client_id", options.client_id);
      }
      if (options.client_secret) {
        params.append("client_secret", options.client_secret);
      }
      // Append other options, filtering out client_id and client_secret if they were handled
      Object.entries(options).forEach(([key, value]) => {
        if (
          value !== undefined &&
          key !== "client_id" &&
          key !== "client_secret"
        ) {
          params.append(key, value as string);
        }
      });

      // Default client_id and client_secret if not provided in options
      if (!options.client_id) {
        params.append("client_id", process.env.MICROSOFT_CLIENT_ID!);
      }
      if (!options.client_secret) {
        params.append("client_secret", process.env.MICROSOFT_CLIENT_SECRET!);
      }

      const response = await fetch(`https://${domain}/oauth2/v2.0/token`, {
        method: "POST",
        body: params,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const data = (await response.json()) as MicrosoftRefreshTokenResponse;

      return data;
    } catch (error) {
      console.error(error);
      throw error as MicrosoftRefreshTokenError;
    }
  }

  async refreshTokenSilently(
    tokenEndpointAuthority: string,
    refreshToken: string,
    resourceForScope: string
  ): Promise<MicrosoftRefreshTokenResponse> {
    return this.getMicrosoftToken(tokenEndpointAuthority, {
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: process.env.MICROSOFT_FILES_CALLBACK_URL!,
      scope: `https://${resourceForScope}/.default`,
    });
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

export type MicrosoftRefreshTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token: string;
  id_token: string;
};

export type MicrosoftRefreshTokenError = {
  error: string;
  error_description: string;
  error_codes: number[];
  timestamp: string;
  trace_id: string;
  correlation_id: string;
};
