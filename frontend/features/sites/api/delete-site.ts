import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function useDeleteSiteMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (siteId: string) => api.sites.deleteSite(siteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["me"] });
            queryClient.invalidateQueries({ queryKey: ["infiniteSites"] });
        },
    });
}