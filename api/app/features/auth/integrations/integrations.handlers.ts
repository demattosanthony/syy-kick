import { Request, Response } from "express";
import { integrationsOps } from "./integrations.ops";
import { MicrosoftAPI, MicrosoftRefreshTokenError } from "../../../config/microsoft";


export const integrationsHandlers = {
    deleteIntegration: async (req: Request, res: Response) => {
        const { provider } = req.params;
        const user = req.dbUser;

        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        await integrationsOps.deleteIntegration(
            provider as "microsoft" | "google",
            user.id
        );

        res.status(200).json({ message: "Integration deleted" });
    },
    getToken: async (req: Request, res: Response) => {

        const user = req.dbUser;

        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const microsoftGraph = new MicrosoftAPI({ userId: user.id });
        const microsoftPicker = new MicrosoftAPI({ userId: user.id });

        const result = {
            accessToken: null,
            pickerToken: null,
            baseUrl: null,
        } as {
            accessToken: string | null;
            pickerToken: string | null;
            baseUrl: string | null;
        };

        try {
            const graphToken = await microsoftGraph.getAccessToken(
                "graph",
                "graph.microsoft.com"
            );
            const pickerToken = await microsoftPicker.getAccessToken("picker");

            if (
                graphToken &&
                pickerToken &&
                !microsoftGraph.isAccessTokenExpired(graphToken.accessToken) &&
                !microsoftPicker.isAccessTokenExpired(pickerToken.accessToken)
            ) {
                result.accessToken = graphToken.accessToken;
                result.pickerToken = pickerToken.accessToken;
                result.baseUrl = pickerToken.baseUrl;
            }

            res.json(result);
        } catch (error) {
            const microsoftError = error as MicrosoftRefreshTokenError;

            res.json({ error: microsoftError.error });
        }
    }
}