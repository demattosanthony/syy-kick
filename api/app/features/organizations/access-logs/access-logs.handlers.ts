/** Express */
import { Request, Response } from "express";

/** Ops */
import { ops } from "./access-logs.ops";

export const handlers = {
    async getAccessLogs(req: Request, res: Response) {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const orgId = req.params.id;
        const search = req.query.search as string;
        const resource = req.query.resource as string;
        const action = req.query.action as string;
        const status = req.query.status as string;

        if (!orgId) {
            res.status(400).json({ error: "Organization ID is required" });
            return;
        }

        res.json(await ops.getAccessLogs(orgId, page, limit, {
            search,
            resource,
            action,
            status
        }));
    },
}