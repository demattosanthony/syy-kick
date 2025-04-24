/** Express */
import { Request, Response } from "express";

/** Ops */
import { ops } from "./seats.ops";

export const handlers = {
    async validateSeatUpdate(req: Request, res: Response) {
        const { seats } = req.body;
        const orgId = req.params.id;

        try {
            await ops.validateSeatUpdate(orgId, seats);
            res.json({ success: true });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateSeats(req: Request, res: Response) {
        try {
            const { seats } = req.body;
            const orgId = req.params.id;

            await ops.updateSeats(orgId, seats);

            res.json({ message: "Seats updated successfully" });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    },
}