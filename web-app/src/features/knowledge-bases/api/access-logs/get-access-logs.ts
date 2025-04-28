import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { KnowledgeBaseAccessLogFilters, KnowledgeBaseAccessLogsResponse } from "../../types";

export const useGetKnowledgeBaseAccessLogsQuery = (
    page: number = 1,
    limit: number = 10,
    filters: KnowledgeBaseAccessLogFilters,
    knowledgeBaseId?: string,
    skip: boolean = false
) => {
    return useQuery<KnowledgeBaseAccessLogsResponse>({
        queryKey: ["knowledgeBaseAccessLogs", knowledgeBaseId, page, limit, filters],
        queryFn: async () => {
            if (!knowledgeBaseId) {
                throw new Error("Knowledge base ID is required");
            }

            const response = await api.knowledgeBases.getAccessLogs(
                knowledgeBaseId,
                page,
                limit,
                filters
            );
            return response;
        },
        enabled: !!knowledgeBaseId && !skip,
    });
};
