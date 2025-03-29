import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function useLinkProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      siteId,
      data,
    }: {
      siteId: string;
      data: {
        projectsIds: string[];
      };
    }) => api.sites.linkProjects(siteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["unlink-projects"],
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
