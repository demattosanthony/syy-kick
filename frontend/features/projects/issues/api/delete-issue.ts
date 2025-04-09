import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useDeleteIssue = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    { projectId: string; issueNumber: number }
  >({
    mutationFn: ({ projectId, issueNumber }) =>
      api.issues.deleteIssue(projectId, issueNumber),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
    },
  });
};
