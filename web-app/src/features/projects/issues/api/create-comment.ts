import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCreateCommentMutation = (
  projectId: string,
  issueNumber: number
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { comment: string }) =>
      api.issues.createComment(projectId, issueNumber, data),
    onSuccess: (_data, _variables, _context) => {
      // Invalidate and refetch the issue data to show the new comment
      queryClient.invalidateQueries({
        queryKey: ["issue", projectId, issueNumber],
      });
    },
    onError: (error, _variables, _context) => {
      console.error("Error creating comment:", error);
      // Consider adding user feedback, e.g., via toast notifications
    },
  });
};
