import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface EditMessageVariables {
  threadId: string;
  messageId: string;
  content: string;
  attachments?: any[];
}

interface EditMessageResponse {
  messageId: string;
  originalMessageId: string;
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation<EditMessageResponse, Error, EditMessageVariables>({
    mutationFn: async ({ threadId, messageId, content, attachments }) =>
      api.threads.editMessage(threadId, messageId, content, attachments),
    onSuccess: (data, variables) => {
      // Invalidate the thread query to refetch with the new message
      queryClient.invalidateQueries({
        queryKey: ["thread", variables.threadId],
      });
    },
  });
}
