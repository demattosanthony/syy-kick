import { Router } from "express";

/** Auth */
import { handlers } from "./auth.handlers";
import { middlewares } from "./auth.middlewares";

/** Config */
import myPassport from "../../config/passport";

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
  .get("/microsoft-files/callback", handlers.microsoftFilesCallback)
  .post("/logout", handlers.logout)
  .post("/invite/:token", middlewares.optionalAuth, handlers.joinWithInvite)
  .get("/me", handlers.me)
  .get("/me/upload-token", middlewares.auth, handlers.getUploadToken);
