import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useDeleteIssue = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, { issueId: string }>({
    mutationFn: ({ issueId }) => api.issues.deleteIssue(issueId),
    onSuccess: (_, variables) => {
      console.log("Issue deleted successfully:", variables.issueId);
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.removeQueries({
        queryKey: ["issue", variables.issueId],
      });
    },
  });
};
