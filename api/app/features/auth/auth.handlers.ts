import { Request, Response } from "express";
import { DbUser, sendAuthCookies, checkTokens } from "../../createAuthToken";
import { ops } from "./auth.ops";
import db from "../../config/db";
import { memberRoles, organizationInvites } from "../../config/schema";
import { and, eq } from "drizzle-orm";
import { CONFIG } from "../../config/constants";
import {
  MicrosoftAPI,
  MicrosoftRefreshTokenError,
  MicrosoftRefreshTokenResponse,
} from "../../config/microsoft";
import { generateStateEntry, getStateEntry } from "./auth.utils";
import myPassport from "../../config/passport";
import { jwtDecode } from "jwt-decode";

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

    const microsoftGraph = new MicrosoftAPI({ userId: user.id });
    const microsoftPicker = new MicrosoftAPI({ userId: user.id });

    const result = {
      accessToken: null,
      pickerToken: null,
      baseUrl: null,
    } as {
      accessToken: string | null;
      pickerToken: string | null;
      baseUrl: string | null;
    };

    try {
      const graphToken = await microsoftGraph.getAccessToken(
        "graph",
        "graph.microsoft.com"
      );
      const pickerToken = await microsoftPicker.getAccessToken("picker");

      if (
        graphToken &&
        pickerToken &&
        !microsoftGraph.isAccessTokenExpired(graphToken.accessToken) &&
        !microsoftPicker.isAccessTokenExpired(pickerToken.accessToken)
      ) {
        result.accessToken = graphToken.accessToken;
        result.pickerToken = pickerToken.accessToken;
        result.baseUrl = pickerToken.baseUrl;
      }

      res.json(result);
    } catch (error) {
      const microsoftError = error as MicrosoftRefreshTokenError;

      res.json({ error: microsoftError.error });
    }
  },

  microsoftFilesInit: async (req: Request, res: Response) => {
    const redirectUrl = req.query.redirectUrl as string;
    const { id, rid } = req.cookies;
    const { userId } = await checkTokens(id, rid);

    const origin = new URL(redirectUrl).origin;
    if (!CONFIG.CORS_ORIGINS.includes(origin)) {
      res.status(403).send("Redirect not allowed");
      return;
    }

    const state = generateStateEntry(redirectUrl);

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

    // Check if the user has a picker token
    if (userId) {
      const microsoftApi = new MicrosoftAPI({ userId });
      const pickerToken = await microsoftApi.getUserToken("picker");

      if (!pickerToken) {
        // If no picker token, display account selection
        authUrl.searchParams.set("prompt", "select_account");
      }
    }

    res.json({ url: authUrl.toString() });
  },

  microsoftFilesCallback: async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query;
    const { id, rid } = req.cookies;
    const { userId } = await checkTokens(id, rid);

    const stateEntry = getStateEntry(state as string);

    if (!stateEntry) {
      res.redirect(`${process.env.FRONTEND_URL}?error=missing_state`);
      return;
    }

    if (error) {
      res.redirect(
        `${stateEntry.redirectUrl}?syy-connector=microsoft-files&oauth_success=false&error=${error_description}`
      );
      return;
    }

    const { redirectUrl } = stateEntry;

    if (!redirectUrl) {
      res.redirect(`${process.env.FRONTEND_URL}?error=Missing redirect url`);
      return;
    }

    if (!userId) {
      res.redirect(
        `${redirectUrl}?syy-connector=microsoft-files&oauth_success=false&error=Unauthorized`
      );
      return;
    }

    if (!code) {
      console.log("missing code");
      res.redirect(
        `${redirectUrl}?syy-connector=microsoft-files&oauth_success=false&error=Missing code`
      );
      return;
    }

    const microsoftApi = new MicrosoftAPI({ userId });

    try {
      // start transaction
      await db.transaction(async (tx) => {
        // Generate
        const tokenData = await microsoftApi.getMicrosoftToken(
          "login.microsoftonline.com/organizations",
          {
            code: code as string,
            grant_type: "authorization_code",
            redirect_uri: process.env.MICROSOFT_FILES_CALLBACK_URL!,
            scope: "https://graph.microsoft.com/.default",
          }
        );

        if (!tokenData.access_token) {
          throw new Error("Token exchange failed");
        }

        const { access_token } = tokenData as any;
        const jwt: any = jwtDecode(access_token);

        let refreshedToken: MicrosoftRefreshTokenResponse;

        // Refresh token if expired
        if (microsoftApi.isAccessTokenExpired(access_token)) {
          refreshedToken = await microsoftApi.refreshTokenSilently(
            "graph.microsoft.com",
            tokenData.refresh_token
          );
        } else {
          refreshedToken = tokenData;
        }

        // Get site
        const site = await microsoftApi.getSite(access_token);

        // Get token for sharepoint picker
        const tokenForSharepointData = await microsoftApi.getMicrosoftToken(
          `login.microsoftonline.com/${jwt.tid}`,
          {
            grant_type: "refresh_token",
            refresh_token: refreshedToken.refresh_token,
            scope: `https://${site.siteCollection.hostname}/.default`,
          }
        );

        // Sauvegarder les deux tokens dans la même transaction
        await Promise.all([
          microsoftApi.saveToken(
            tokenData.access_token,
            tokenData.refresh_token,
            "graph.microsoft.com",
            "graph",
            tx
          ),
          microsoftApi.saveToken(
            tokenForSharepointData.access_token,
            tokenForSharepointData.refresh_token,
            site.siteCollection.hostname,
            "picker",
            tx
          ),
        ]);
      });

      res.redirect(
        `${redirectUrl}?syy-connector=microsoft-files&oauth_success=true`
      );
    } catch (err: any) {
      console.log(err, "Error in microsoftFilesCallback");

      res.redirect(
        `${redirectUrl}?syy-connector=microsoft-files&oauth_success=false&error=${err.message}`
      );
    }
  },
};
