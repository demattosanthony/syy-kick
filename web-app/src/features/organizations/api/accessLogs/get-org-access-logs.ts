import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { OrganizationAccessLogsResponse, OrganizationAccessLogFilters } from "../../types/access-logs";

export const useGetOrgAccessLogsQuery = (
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    filters: OrganizationAccessLogFilters,
    skip: boolean = false
) => {
    return useQuery<OrganizationAccessLogsResponse>({
        queryKey: ["orgAccessLogs", organizationId, page, limit, filters],
        queryFn: async () => {
            const response = await api.organizations.getAccessLogs(
                organizationId,
                page,
                limit,
                filters
            );
            return response;
        },
        enabled: !!organizationId && !skip,
    });
};
