import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { AccessLogsResponse, Filters } from "../../types/access-logs";

export const useGetAccessLogsQuery = (
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    filters: Filters
) => {
    return useQuery<AccessLogsResponse>({
        queryKey: ["accessLogs", organizationId, page, limit, filters],
        queryFn: async () => {
            const response = await api.organizations.getAccessLogs(
                organizationId,
                page,
                limit,
                filters
            );
            return response;
        },
        enabled: !!organizationId,
    });
};
