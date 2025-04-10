import { Router, Request, Response } from "express";
import myPassport, { authenticateSaml } from "../../config/passport";
import { ops as authOps } from "./auth.ops";
import { MicrosoftGraph } from "../../config/microsoft";
import { handlers } from "./auth.handlers";
import db from "../../config/db";
import { organizations } from "../../config/schema";
import { eq } from "drizzle-orm";
import { middlewares } from "./auth.middlewares";
import { checkTokens } from "../../createAuthToken";
import { jwtDecode } from "jwt-decode";

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

const authConfig = {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
};


export default Router({ mergeParams: true })
    .get("/google", (req, res) => {
        myPassport.authenticate("google", {
            session: false,
            failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
            state: req.query.state as string,
        })(req, res);
    })
    .get(
        "/google/callback",
        myPassport.authenticate("google", authConfig),
        handlers.oauthCallback
    )
    .get("/microsoft", (req, res) => {
        myPassport.authenticate("microsoft", {
            session: false,
            failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
            state: req.query.state as string,
        })(req, res);
    })
    .get(
        "/microsoft/callback",
        myPassport.authenticate("microsoft", authConfig),
        handlers.oauthCallback
    )
    .get("/microsoft-files", (req, res) => {
        myPassport.authenticate("microsoft-files", {
            session: false,
            failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
            state: req.query.state as string,
        })(req, res);
    })
    .get("/microsoft-files/callback", async (req, res) => {
        const { code } = req.query;
        const { id, rid } = req.cookies;
        const { userId } = await checkTokens(id, rid);

        if (!userId) {
            res.status(401).send("Unauthorized");
            return;
        }

        if (!code) {
            res.status(400).send("Missing code");
            return;
        }

        const params = new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            code: code as string,
            redirect_uri: process.env.MICROSOFT_FILES_CALLBACK_URL!,
            grant_type: "authorization_code",
            scope: "https://graph.microsoft.com/.default", // ou SharePoint tenant plus tard
        });

        try {
            const tokenRes = await fetch("https://login.microsoftonline.com/organizations/oauth2/v2.0/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params,
            });

            const tokenData = await tokenRes.json();
            console.log(tokenData, '<--- tokenData');

            if (!tokenRes.ok) {
                console.error("❌ Token error", tokenData);
                res.status(500).json({ error: "Token exchange failed", detail: tokenData });
                return;
            }

            const { access_token, refresh_token, id_token, expires_in } = tokenData as any;

            const jwt: any = jwtDecode(access_token);

            const tenantId = jwt.tid;

            const microsoftGraph = new MicrosoftGraph({ userId });
            microsoftGraph.setAccessToken(access_token);
            const site = await microsoftGraph.getSite();

            console.log(site, '<--- site');

            const tokenForSharepoint = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: process.env.MICROSOFT_CLIENT_ID!,
                    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
                    refresh_token: refresh_token,
                    grant_type: "refresh_token",
                    scope: `https://${site.siteCollection.hostname}/.default`
                }),
            });

            const tokenForSharepointData = await tokenForSharepoint.json() as any;

            console.log(tokenForSharepointData, '<--- tokenForSharepointData');
            await microsoftGraph.saveToken(
                tokenForSharepointData.access_token,
                tokenForSharepointData.refresh_token,
                site.siteCollection.hostname
            );

            res.redirect(`${process.env.FRONTEND_URL}/projects/fd1fd5b4-7c92-40e8-aa32-0ccf24659476`);
        } catch (err) {
            console.error("❌ Fetch error", err);
            res.status(500).send("Erreur lors de la récupération du token");
        }
    })
    .get("/saml/:slug", authenticateSaml)
    .post("/saml/:slug/callback", authenticateSaml, handlers.samlCallback)
    .get("/saml/check/:slug", async (req: Request, res: Response) => {
        const { slug } = req.params;

        const org = await db.query.organizations.findFirst({
            where: eq(organizations.slug, slug),
            with: {
                samlConfig: true,
            },
        });

        if (!org || !org.samlConfig) {
            res.status(404).json({
                error: "Organization not found.",
            });
            return;
        }

        res.status(200).json({ valid: true });
        return;
    })
    .post("/logout", handlers.logout)
    .post("/invite/:token", middlewares.optionalAuth, handlers.joinWithInvite)
    .get("/me", handlers.me)
    .get("/me/upload-token", middlewares.auth, handlers.getUploadToken)
    ;