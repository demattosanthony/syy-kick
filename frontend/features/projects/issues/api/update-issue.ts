import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UpdateIssueData } from "../issues.types";
import api from "@/lib/api";

export const useUpdateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    { issueId: string; data: UpdateIssueData }
  >({
    mutationFn: ({ issueId, data }) => api.issues.updateIssue(issueId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({
        queryKey: ["issue", variables.issueId],
      });
    },
  });
};
