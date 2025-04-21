import { Router, Request, Response } from "express";

/** Drizzle */
import { eq } from "drizzle-orm";

/** Auth */
import { handlers } from "./auth.handlers";
import { middlewares } from "./auth.middlewares";

/** Config */
import db from "../../config/db";
import { organizations } from "../../config/schema";
import myPassport, { authenticateSaml } from "../../config/passport";

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
  .get("/microsoft-files/init", handlers.microsoftFilesInit)
  .get("/microsoft-files", handlers.microsoftFilesAuth)
  .get("/microsoft-files/callback", handlers.microsoftFilesCallback)
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
  .get("/me/upload-token", middlewares.auth, handlers.getUploadToken);
