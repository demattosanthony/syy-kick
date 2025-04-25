import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { ProjectAccessLogsResponse, ProjectAccessLogFilters } from "@/features/projects/types";

export const useGetProjectAccessLogsQuery = (
    page: number = 1,
    limit: number = 10,
    filters: ProjectAccessLogFilters,
    projectId?: string,
    skip: boolean = false
) => {
    return useQuery<ProjectAccessLogsResponse>({
        queryKey: ["projectAccessLogs", projectId, page, limit, filters],
        queryFn: async () => {
            if (!projectId) {
                throw new Error("Project ID is required");
            }

            const response = await api.projects.getAccessLogs(
                projectId,
                page,
                limit,
                filters
            );
            return response;
        },
        enabled: !!projectId && !skip,
    });
};
