import { Router } from "express";

/** Auth */
import authHandlers from "./auth.handlers";

/** Config */
import myPassport from "../../config/passport";
import { authConfig } from "./auth.utils";
import authMiddlewares from "./auth.middlewares";

const authRouter = Router({ mergeParams: true })
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
    authHandlers.oauthCallback
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
    authHandlers.oauthCallback
  )
  .get("/microsoft-files/init", authHandlers.microsoftFilesInit)
  .get("/microsoft-files/callback", authHandlers.microsoftFilesCallback)
  .post("/logout", authHandlers.logout)
  .post(
    "/invite/:token",
    authMiddlewares.optionalAuth,
    authHandlers.joinWithInvite
  )
  .get("/me", authHandlers.me)
  .post("/migrate-cookies", authHandlers.migrateCookies)
  .get("/me/upload-token", authMiddlewares.auth, authHandlers.getUploadToken);

export default authRouter;
