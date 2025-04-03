import { useQuery } from "@tanstack/react-query";
import { Issue } from "../issues.types";
import api from "@/lib/api";

export const useGetIssue = (issueId: string | undefined) => {
  return useQuery<Issue, Error>({
    queryKey: ["issue", issueId],
    queryFn: () => api.issues.getIssue(issueId!),
    enabled: !!issueId,
  });
};
