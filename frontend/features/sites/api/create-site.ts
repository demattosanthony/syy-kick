import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MutationSiteData } from "../types/sites";

export default function useCreateSiteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MutationSiteData) => api.sites.createSite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["infiniteSites"],
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
