import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateIssueData } from "../issues.types";
import api from "@/lib/api";

export const useCreateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string; issueId: string },
    Error,
    { projectId: string; data: CreateIssueData }
  >({
    mutationFn: ({ projectId, data }) =>
      api.issues.createIssue(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["issues", variables.projectId],
      });
    },
  });
};
