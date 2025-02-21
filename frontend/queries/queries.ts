import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

export function useMeQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
    refetchOnWindowFocus: false,
  });
}

export function useThreadsQuery(search?: string) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ["threads", search, activeWorkspace?.id],
    queryFn: async ({ pageParam = 1 }) => {
      const threads = await api.threads.getThreads(
        pageParam,
        search,
        activeWorkspace?.type === "organization"
          ? activeWorkspace.id
          : undefined
      );
      return {
        threads,
        nextPage: threads.length === 10 ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });
}

export function useThreadQuery(threadId: string, isNewThread: boolean) {
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useQuery({
    queryKey: ["thread", threadId, orgId],
    queryFn: () => api.threads.getThread(threadId, orgId),
    enabled: !isNewThread, // Only fetch if it's not a new thread
    refetchOnWindowFocus: false,
  });
}

export function useDeleteThreadMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: (threadId: string) =>
      api.threads.deleteThread(
        threadId,
        activeWorkspace?.type === "organization"
          ? activeWorkspace.id
          : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["threads"],
        predicate: (query) => {
          const [key, search, workspaceId] = query.queryKey;
          return key === "threads" && workspaceId === activeWorkspace?.id;
        },
      });
    },
  });
}

export function useModelsQuery() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => api.models.getAvailableModels(),
  });
}

export function useOrganizationsQuery() {
  return useInfiniteQuery({
    queryKey: ["organizations"],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.organizations.listOrganizations(pageParam);
      return {
        organizations: response.data,
        pagination: response.pagination,
        nextPage:
          pageParam < response.pagination.pages ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });
}

export function useCreateOrganizationMutation() {
  return useMutation({
    mutationFn: (data: {
      name: string;
      domain?: string;
      logo?: string;
      ownerEmail?: string;
      ownerName?: string;
      saml?: {
        entryPoint: string;
        issuer: string;
        cert: string;
        callbackUrl: string;
      };
    }) => api.organizations.createOrganization(data),
  });
}

export function useUpdateOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        domain: string;
        logo: string;
        saml: Partial<{
          entryPoint: string;
          issuer: string;
          cert: string;
          callbackUrl: string;
        }>;
      }>;
    }) => api.organizations.updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useDeleteOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.organizations.deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}

export function useOrganizationMembersQuery(organizationId: string) {
  return useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: () => api.organizations.listOrganizationMembers(organizationId),
  });
}

export function useRemoveOrganizationMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
    }: {
      organizationId: string;
      userId: string;
    }) => api.organizations.removeOrganizationMember(organizationId, userId),
    onSuccess: (_, { organizationId }) => {
      // Invalidate org members list
      queryClient.invalidateQueries({
        queryKey: ["organization-members", organizationId],
      });
      // Invalidate org details
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
    },
  });
}

export function useOrganizationInviteTokenQuery(organizationId: string) {
  return useQuery({
    queryKey: ["organization-invite", organizationId],
    queryFn: () => api.organizations.getOrganizationInviteToken(organizationId),
  });
}

export function useResetOrganizationInviteTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) =>
      api.organizations.resetOrganizationInviteToken(organizationId),
    onSuccess: (_, organizationId) => {
      queryClient.invalidateQueries({
        queryKey: ["organization-invite", organizationId],
      });
    },
  });
}

export function useOrgQuery(orgId: string) {
  return useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => api.organizations.getOrg(orgId),
    refetchOnWindowFocus: false,
  });
}

export function useOrgFromInviteToken(token: string) {
  return useQuery({
    queryKey: ["organization-from-invite", token],
    queryFn: () => api.organizations.getOrgFromInviteToken(token),
  });
}

export function useUpdateOrganizationSeatsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, seats }: { orgId: string; seats: number }) =>
      api.organizations.updateOrganizationSeats(orgId, seats),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
    },
  });
}

/**
 * Hook to update an organization member's role
 */
export function useUpdateOrganizationMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      role,
    }: {
      organizationId: string;
      userId: string;
      role: "owner" | "member";
    }) => {
      return await api.organizations.updateMemberRole(
        organizationId,
        userId,
        role
      );
    },
    onSuccess: (_, { organizationId }) => {
      // Invalidate the org-member list so the UI refreshes
      queryClient.invalidateQueries({
        queryKey: ["organization-members", organizationId],
      });
    },
  });
}

export function useProjectsQuery({ search }: { search?: string } = {}) {
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useQuery({
    queryKey: ["projects", search, activeWorkspace?.id],
    queryFn: () => api.projects.listProjects(orgId, search),
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      organizationId?: string;
    }) =>
      api.projects.createProject({
        ...data,
        organizationId: orgId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useMutation({
    mutationFn: (projectId: string) =>
      api.projects.deleteProject(projectId, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useProjectQuery(projectId: string) {
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useQuery({
    queryKey: ["project", projectId, orgId],
    queryFn: () => api.projects.getProject(projectId, orgId),
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  });
}

export function useUploadDocsMutation() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  const mutation = useMutation({
    mutationFn: ({ projectId, files }: { projectId: string; files: File[] }) =>
      api.projects.uploadFiles(
        projectId,
        files,
        "",
        (progress) => {
          setProgress(progress);
        },
        orgId
      ),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["project-docs", projectId] });
      setProgress(0);
    },
    onError: () => {
      setProgress(0);
    },
  });

  return { ...mutation, progress };
}
export function useProjectDocsQuery(projectId: string, path?: string) {
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useQuery({
    queryKey: ["project-docs", projectId, path, orgId],
    queryFn: () => api.projects.getDocuments(projectId, path, orgId),
    enabled: !!projectId,
  });
}

export function useDeleteProjectContentMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useMutation({
    mutationFn: ({ projectId, path }: { projectId: string; path: string }) =>
      api.projects.deleteContents(projectId, path, orgId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["project-docs", projectId] });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: { name?: string; description?: string };
    }) =>
      api.projects.updateProject(projectId, {
        ...data,
        organizationId: orgId,
      }),
    onSuccess: (_, { projectId }) => {
      // Invalidate the specific project query
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      // Invalidate the projects list
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useProjectDocQuery(projectId: string, path: string) {
  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  return useQuery({
    queryKey: ["project-doc", projectId, path, orgId],
    queryFn: () => api.projects.getDocument(projectId, path, orgId),
    refetchOnWindowFocus: false,
  });
}
