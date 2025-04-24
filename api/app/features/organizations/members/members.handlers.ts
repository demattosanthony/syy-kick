/** Express */
import { Request, Response } from "express";

/** Ops */
import { ops } from "./members.ops";

export const handlers = {
    async listMembers(req: Request, res: Response) {
        const user = req.dbUser;
        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const members = await ops.listMembers(req.params.id, user);
        res.json(members);
    },

    async getMemberRole(req: Request, res: Response) {
        const memberId = req.params.memberId;
        const orgId = req.params.id;

        const formattedRole = await ops.getMemberRole(memberId, orgId);

        res.json(formattedRole);
    }
}