import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MutationSiteData } from "../types/sites";

export default function useUpdateSiteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ siteId, data }: { siteId: string; data: MutationSiteData }) =>
      api.sites.updateSite(siteId, data),
    onSuccess: (_, { siteId }) => {
      queryClient.invalidateQueries({
        queryKey: ["site", siteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["infiniteSites"],
      });
    },
  });
}
