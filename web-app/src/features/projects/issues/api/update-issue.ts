import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UpdateIssueData } from "../issues.types";
import api from "@/lib/api";

export const useUpdateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    {
      projectId: string;
      issueNumber: number;
      data: UpdateIssueData;
    }
  >({
    mutationFn: ({ projectId, issueNumber, data }) =>
      api.issues.updateIssue(projectId, issueNumber, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({
        queryKey: ["issue", variables.projectId, variables.issueNumber],
      });
    },
  });
};
