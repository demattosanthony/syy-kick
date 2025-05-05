/** Express */
import { Request, Response } from "express";

/** Operations */
import { agentsOps } from "./agents.ops";

export const handlers = {
    list: async (req: Request, res: Response) => {
        const agents = await agentsOps.list();
        res.json(agents);
    },
}
