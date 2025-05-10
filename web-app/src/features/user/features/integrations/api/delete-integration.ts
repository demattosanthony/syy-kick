import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteIntegrationMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (provider: "microsoft" | "google") => {
            return await api.auth.deleteIntegration(provider);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["me"],
            });
        }
    })
}