import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export function useMeQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
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

  return useQuery({
    queryKey: ["thread", threadId, activeWorkspace?.id],
    queryFn: () =>
      api.threads.getThread(
        threadId,
        activeWorkspace?.type === "organization"
          ? activeWorkspace.id
          : undefined
      ),
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
