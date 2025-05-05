/** Express */
import { Request, Response } from "express";

/** Types */
import { WorkflowRequestBody, WorkflowRequestBodySchema } from "./requests.types";

/** Operations */
import { requestsOps } from "./requests.ops";

export const requestsHandlers = {
    create: async (req: Request, res: Response) => {

        const body = req.body as WorkflowRequestBody;

        const validationResult = WorkflowRequestBodySchema.safeParse(body);

        if (!validationResult.success) {
            res.status(400).json({ error: validationResult.error.message });
            return;
        }

        if (!req.dbUser) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        await requestsOps.create(body, req.dbUser.id);

        res.status(201).json({ message: "Request created successfully" });
    }
}