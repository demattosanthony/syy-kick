import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MutationSiteData } from "../types/sites";

export default function useUpdateSiteMutation() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ siteId, data }: { siteId: string; data: MutationSiteData }) =>
      api.sites.updateSite(siteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["infiniteSites"],
      });
    },
  });
}
