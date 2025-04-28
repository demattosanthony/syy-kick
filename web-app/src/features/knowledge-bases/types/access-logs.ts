import { OrganizationAccessLog, OrganizationAccessLogFilters } from "@/features/organizations/types";

export type KnowledgeBaseAccessLogFilters = OrganizationAccessLogFilters;

export type KnowledgeBaseAccessLog = Omit<OrganizationAccessLog, "organization" | "project">;

export type KnowledgeBaseAccessLogsResponse = {
    data: KnowledgeBaseAccessLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}