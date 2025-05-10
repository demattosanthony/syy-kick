import { and, eq } from "drizzle-orm"
import db from "../../../config/db"
import { accessTokens } from "../../../config/schema"


export const integrationsOps = {
    deleteIntegration: async (provider: "microsoft" | "google", userId: string) => {
        await db.delete(accessTokens).where(
            and(
                eq(accessTokens.provider, provider),
                eq(accessTokens.userId, userId)
            )
        )
    }
}