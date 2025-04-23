import { actions, documents, knowledgeBases, organizations, projects, resources, sites, users, accessLogs } from "../../config/schema";
import { InferSelectModel } from "drizzle-orm";

export type Role = "owner" | "member";
export type AccessLogStatus = "authorized" | "unauthorized";
export interface SamlConfig {
    entryPoint?: string;
    issuer?: string;
    cert?: string;
    callbackUrl?: string;
}