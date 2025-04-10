import { checkTokens, sendAuthCookies } from "../../createAuthToken";
import { Workspace } from "./auth.types";

export const middlewares = {
    optionalAuth: async (req: any, res: any, next: any) => {
        try {
            const { id, rid } = req.cookies;
            if (id && rid) {
                const { user } = await checkTokens(id, rid);
                if (user) {
                    sendAuthCookies(res, user);
                    req.dbUser = user;
                }
            }
            next();
        } catch {
            // Continue even if auth fails
            next();
        }
    },

    auth: async (req: any, res: any, next: any) => {
        try {
            const { id, rid } = req.cookies;
            if (!id || !rid) throw new Error();

            const { user } = await checkTokens(id, rid);

            if (user) {
                sendAuthCookies(res, user);
                req.dbUser = user;
            }

            // Check the workspace
            const workspace: Workspace = req.cookies?.activeWorkspace
                ? JSON.parse(req.cookies.activeWorkspace)
                : null;
            req.workspace = workspace;

            next();
        } catch {
            res.status(401).json({ error: "Unauthorized" });
        }
    },
}

