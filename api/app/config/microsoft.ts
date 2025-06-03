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
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/root`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return (await response.json()) as MicrosoftSite;
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
  }

  async getAccessToken(
    type: "picker" | "graph"
  ): Promise<{ accessToken: string; baseUrl: string } | undefined> {
    const storedToken = await this.getUserToken(type);

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

        console.log(
          `Refreshed token data for type ${type}, userId: ${this.userId}:`,
          refreshedTokenData
        );

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
          type
        );
        console.log(
          `Successfully refreshed and saved token for type ${type}, userId: ${this.userId}`
        );

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

  async getUserToken(
    type: "picker" | "graph"
  ): Promise<typeof accessTokens.$inferSelect | undefined> {
    const accessToken = await db.query.accessTokens.findFirst({
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

  /**
   * Search files and folders in a user's SharePoint drive using Microsoft Graph API.
   * @param driveId The ID of the drive to search in.
   * @param searchText The text to search for.
   * @param accessToken The access token for Microsoft Graph API.
   * @returns Array of drive items matching the search.
   */
  async searchFiles(
    driveId: string,
    searchText: string,
    accessToken: string,
    limit: number = 25
  ): Promise<any[]> {
    if (!searchText.trim()) {
      return [];
    }

    const encodedSearch = encodeURIComponent(searchText);
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodedSearch}')?$top=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Microsoft Graph API error (${response.status}): ${error?.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Get the user's default (org) drive from Microsoft Graph API.
   * @param accessToken The access token for Microsoft Graph API.
   * @returns The drive object or null if not found.
   */
  async getOrgDrive(accessToken: string): Promise<any | null> {
    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("Error fetching org drive:", error);
        return null;
      }

      const drive = await response.json();
      if (!drive?.id || !drive?.webUrl) {
        console.error("Drive data is missing required fields:", drive);
        return null;
      }
      return drive;
    } catch (error) {
      console.error("Error fetching org drive:", error);
      return null;
    }
  }

  async getFolderContent(
    driveId: string,
    folderPath: string,
    accessToken: string
  ): Promise<GraphDriveItem[]> {
    try {
      const url = this.buildFolderUrl(driveId, folderPath);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Microsoft Graph API error (${response.status}): ${error?.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.error("Error fetching folder content:", error);
      return [];
    }
  }

  async getFile(
    driveId: string,
    fileId: string,
    accessToken: string
  ): Promise<GraphDriveItem> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Microsoft Graph API error (${response.status}): ${error?.error?.message || response.statusText}`
      );
    }

    return (await response.json()) as GraphDriveItem;
  }

  private buildFolderUrl(driveId: string, folderPath: string): string {
    if (!folderPath) {
      return `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
    }

    const encodedPath = encodeURIComponent(folderPath);
    return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/children`;
  }
}

export interface GraphDriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string; hashes?: any };
  webUrl: string;
  parentReference?: {
    driveId: string;
    path?: string;
  };
  lastModifiedDateTime?: string;
  "@microsoft.graph.downloadUrl"?: string;
  size?: number;
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
  };
};

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
