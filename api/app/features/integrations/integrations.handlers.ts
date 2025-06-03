import { Request, Response } from "express";
import { integrationsOps } from "./integrations.ops";
import {
  MicrosoftAPI,
  MicrosoftRefreshTokenError,
} from "../../config/microsoft";
import db from "../../config/db";
import { accessTokens } from "../../config/schema";
import { eq } from "drizzle-orm";

export const integrationsHandlers = {
  getTokens: async (req: Request, res: Response) => {
    const user = req.dbUser;

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const tokens = await db.query.accessTokens.findMany({
        where: eq(accessTokens.userId, user.id),
      });

      res.json(tokens);
    } catch (error) {
      console.error("Error fetching access tokens:", error);
      res.status(500).json({
        error: "Failed to fetch access tokens",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

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
      const graphToken = await microsoftGraph.getAccessToken("graph");
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
  },
};
