import { OrganizationAccessLog, OrganizationAccessLogFilters } from "@/features/organizations/types/access-logs";

export type ProjectAccessLog = Omit<OrganizationAccessLog, "organization" | "knowledgeBase">;

export type ProjectAccessLogFilters = OrganizationAccessLogFilters;

export type ProjectAccessLogsResponse = {
    data: ProjectAccessLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
};
