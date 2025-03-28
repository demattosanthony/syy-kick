// Temporary request to get projects that are not related to any site

import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function useGetUnlinkedProjectsQuery() {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["unlink-projects", activeWorkspace?.id],
    queryFn: () => api.projects.getUnlinkedProjects()
  });
}
