/** Express */
import { Request, Response } from "express";

/** Handlers */
import { ops } from "./access-logs.ops";

export const handlers = {
    async list(req: Request, res: Response) {
        const { knowledgeBaseId } = req.params;

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const search = req.query.search as string;
        const resource = req.query.resource as string;
        const action = req.query.action as string;
        const status = req.query.status as string;

        const logs = await ops.listKnowledgeBaseAccessLogs(knowledgeBaseId, page, limit, {
            search,
            resource,
            action,
            status
        });

        res.status(200).json(logs);
    }
}