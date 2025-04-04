import { useQuery } from "@tanstack/react-query";
import { Issue } from "../issues.types";
import api from "@/lib/api";

export const useGetIssue = (projectId?: string, issueNumber?: number) => {
  return useQuery<Issue, Error>({
    queryKey: ["issue", projectId, issueNumber],
    queryFn: () => api.issues.getIssue(projectId!, issueNumber!),
    enabled: !!projectId && !!issueNumber,
  });
};
