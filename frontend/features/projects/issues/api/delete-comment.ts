import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useDeleteCommentMutation = (
  projectId: string,
  issueNumber: number,
  commentId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.issues.deleteComment(projectId, issueNumber, commentId),
    onSuccess: (_data, _variables, _context) => {
      // Invalidate and refetch the issue data to remove the deleted comment
      // OPTIONAL: Implement optimistic update for better UX
      // See: https://tanstack.com/query/v5/docs/react/guides/optimistic-updates
      queryClient.invalidateQueries({
        queryKey: ["issue", projectId, issueNumber],
      });
    },
    onError: (error, _variables, _context) => {
      console.error("Error deleting comment:", error);
    },
  });
};
