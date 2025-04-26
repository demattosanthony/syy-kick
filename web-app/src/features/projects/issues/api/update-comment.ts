import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useUpdateCommentMutation = (
  projectId: string,
  issueNumber: number,
  commentId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { comment: string }) =>
      api.issues.updateComment(projectId, issueNumber, commentId, data),
    onSuccess: (_data, _variables, _context) => {
      // Invalidate and refetch the issue data to show the updated comment
      queryClient.invalidateQueries({
        queryKey: ["issue", projectId, issueNumber],
      });
    },
    onError: (error, _variables, _context) => {
      console.error("Error updating comment:", error);
      // Consider adding user feedback
    },
  });
};
