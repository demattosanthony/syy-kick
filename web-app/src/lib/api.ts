import {
  OrganizationMemberRoleResponse,
  OrgInvitationsRequest,
  OrgInvitationsResponse,
  OrgMemberResponse,
  RolesResponse,
  TransferableProjectsResponse,
  TransferableRolesPermissions,
  UpdateOrgMemberRoleRequest,
} from "@/features/permissions/types";
import { Site } from "@/features/sites/types/sites";
import {
  Step,
  Workflow,
  WorkflowRun,
  WorkflowRunRequest,
  WorkflowUpdateRequest,
} from "@/features/workflows/workflows.types";
import { Thread, UpdateThreadMutationData } from "@/types/chat";
import { Model } from "@/types/model";
import { DocumentContent, Project } from "@/types/project";
import { Organization, User } from "@/types/user";
import { FileUploadMixin } from "./file-upload-mixin";
import { KnowledgeBase } from "@/features/knowledge-bases/types";
import {
  ProjectAccessLogFilters,
  ProjectAccessLogsResponse,
  SortOption,
} from "@/features/projects/types";
import { OrganizationAccessLogsResponse } from "@/features/organizations/types/access-logs";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Custom ApiError class for error handling
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Common headers for all requests
const getCommonHeaders = () => ({
  "Content-Type": "application/json",
});

import {
  CreateIssueData,
  Issue,
  IssueStatus,
  PaginatedIssues,
  UpdateIssueData,
} from "@/features/projects/issues/issues.types";
import {
  KnowledgeBaseAccessLogFilters,
  KnowledgeBaseAccessLogsResponse,
} from "@/features/knowledge-bases/types";
import { Agent, Tool } from "@/features/workflows/features/agents/types";

// Client-side fetch
async function clientFetch<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown,
  options: RequestInit = {}
): Promise<T> {
  const config: RequestInit = {
    method,
    credentials: "include",
    headers: {
      ...getCommonHeaders(),
      ...(options.headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (
    response.status === 403 &&
    !window.location.pathname.startsWith("/forbidden")
  ) {
    window.location.href = "/forbidden";
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `HTTP error! status: ${response.status}` };
    }
    throw new ApiError(
      response.status,
      errorData?.message ||
        errorData?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

// Main fetch function that detects environment
const apiFetch = <T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown,
  options: RequestInit = {}
): Promise<T> => {
  return clientFetch<T>(endpoint, method, body, options);
};

/**
 * Base ApiRequest class to handle common request logic
 */
class ApiRequest {
  protected baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  protected async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" = "GET",
    body?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    return apiFetch<T>(endpoint, method, body, options);
  }

  protected async uploadFormData<T>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    // For client-side uploads
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Upload failed with status ${response.status}`
      );
    }

    return response.json();
  }
}

/**
 * Auth API Module
 */
class AuthApi extends ApiRequest {
  async logout() {
    try {
      await this.request("/auth/logout", "POST");
    } catch (error) {
      console.error("Logout failed:", error);
      throw error; // Re-throwing for the caller to handle if needed
    }
  }

  async me(): Promise<User | null> {
    try {
      return await this.request<User | null>("/auth/me");
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      return null;
    }
  }

  async joinWithInvite(token: string): Promise<{
    success?: boolean;
    requiresAuth?: boolean;
    error?: string;
    insufficientSeats?: boolean;
    inactiveSubscription?: boolean;
    alreadyMember?: boolean;
  }> {
    try {
      return await this.request<{
        success?: boolean;
        requiresAuth?: boolean;
        error?: string;
        insufficientSeats?: boolean;
        inactiveSubscription?: boolean;
        alreadyMember?: boolean;
      }>(`/auth/invite/${token}`, "POST");
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          return { requiresAuth: true };
        }
        if (error.status === 403) {
          if (error.message === "insufficient_seats") {
            return { insufficientSeats: true };
          }
          if (error.message === "inactive_subscription") {
            return { inactiveSubscription: true };
          }
          if (error.message === "wrong_email") {
            return {
              error:
                "This e-mail address is not linked to this invitation link",
            };
          }
        }
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  async getMicrosoftFilesInit(redirectUri: string) {
    try {
      return await this.request<{ url: string }>(
        `/auth/microsoft-files/init?redirectUrl=${redirectUri}`,
        "GET"
      );
    } catch (error) {
      throw error;
    }
  }

  async getIntegrationToken(provider: string) {
    try {
      return await this.request<{
        accessToken: string;
        baseUrl: string;
        pickerToken: string;
      }>(`/auth/integrations/${provider}/token`, "GET");
    } catch (error) {
      throw error;
    }
  }

  async deleteIntegration(provider: string) {
    try {
      return await this.request<{
        success: boolean;
      }>(`/auth/integrations/${provider}`, "DELETE");
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Organization API Module
 */
class OrganizationApi extends ApiRequest {
  async getOrg(id: string): Promise<Organization> {
    return await this.request<Organization>(`/organizations/${id}`);
  }

  async getOrgFromInviteToken(token: string): Promise<{
    organization: Organization;
    seatsUsed: number;
  }> {
    return await this.request<{
      organization: Organization;
      seatsUsed: number;
    }>(`/organizations/invite/${token}`);
  }

  async listOrganizations(
    page = 1,
    limit = 10
  ): Promise<{
    data: Organization[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    return await this.request<{
      data: Organization[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/organizations?page=${page}&limit=${limit}`);
  }

  async createOrganization(data: {
    name: string;
    domain?: string;
    logo?: string;
    ownerEmail?: string;
    ownerName?: string;
    seats?: number;
    saml?: {
      entryPoint: string;
      issuer: string;
      cert: string;
      callbackUrl: string;
    };
  }): Promise<Organization> {
    return await this.request<Organization>(`/organizations`, "POST", data);
  }

  async updateOrganization(
    id: string,
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
    }>
  ): Promise<Organization> {
    return await this.request<Organization>(
      `/organizations/${id}`,
      "PUT",
      data
    );
  }

  async deleteOrganization(id: string): Promise<{ success: boolean }> {
    return await this.request<{ success: boolean }>(
      `/organizations/${id}`,
      "DELETE"
    );
  }

  async getOrgMembers(orgId: string): Promise<OrgMemberResponse> {
    try {
      return await this.request<OrgMemberResponse>(
        `/organizations/${orgId}/members`
      );
    } catch (error) {
      throw error;
    }
  }

  async getOrganizationInviteToken(
    organizationId: string
  ): Promise<{ token: string }> {
    return await this.request<{ token: string }>(
      `/organizations/${organizationId}/invite`
    );
  }

  async resetOrganizationInviteToken(
    organizationId: string
  ): Promise<{ token: string }> {
    return await this.request<{ token: string }>(
      `/organizations/${organizationId}/invite/reset`,
      "POST"
    );
  }

  async validateSeatUpdate(
    organizationId: string,
    seats: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.request<{ success: boolean; error?: string }>(
        `/organizations/${organizationId}/seats/validate`,
        "POST",
        { seats }
      );
    } catch (error) {
      throw error;
    }
  }

  async updateOrganizationSeats(
    organizationId: string,
    seats: number
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/organizations/${organizationId}/seats`,
        "PUT",
        { seats }
      );
    } catch (error) {
      throw error;
    }
  }

  async getTransferablePermissions(
    organizationId: string
  ): Promise<TransferableRolesPermissions> {
    try {
      return await this.request<TransferableRolesPermissions>(
        `/permissions/organizations/${organizationId}/transferable-permissions`
      );
    } catch (error) {
      throw error;
    }
  }

  async getUserRole(
    organizationId: string
  ): Promise<OrganizationMemberRoleResponse> {
    try {
      return await this.request<OrganizationMemberRoleResponse>(
        `/organizations/${organizationId}/user-role`
      );
    } catch (error) {
      throw error;
    }
  }

  async getOrgMember(
    organizationId: string,
    memberId: string
  ): Promise<OrganizationMemberRoleResponse> {
    try {
      return await this.request<OrganizationMemberRoleResponse>(
        `/organizations/${organizationId}/members/${memberId}`
      );
    } catch (error) {
      throw error;
    }
  }

  async getAccessLogs(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    filters: {
      search: string;
      resource: string;
      action: string;
      status: string;
    }
  ): Promise<OrganizationAccessLogsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(filters.search && { search: filters.search }),
      ...(filters.resource !== "all" && { resource: filters.resource }),
      ...(filters.action !== "all" && { action: filters.action }),
      ...(filters.status !== "all" && { status: filters.status }),
    });

    return await this.request(
      `/organizations/${organizationId}/access-logs?${queryParams.toString()}`
    );
  }
}

/**
 * Payment API Module
 */
class PaymentApi extends ApiRequest {
  async createCheckoutSession(
    lookupKey: string,
    seats?: number,
    organization_id?: string
  ): Promise<string> {
    const data = await this.request<{ url: string }>(
      `/payments/create-checkout-session`,
      "POST",
      { lookup_key: lookupKey, seats, organization_id }
    );
    return data.url;
  }

  async syncAfterSuccess(sessionId: string, organizationId?: string) {
    await this.request(`/payments/sync-after-success`, "POST", {
      session_id: sessionId,
      organization_id: organizationId,
    });
  }

  async createPortalSession(
    organizationId?: string,
    returnUrl?: string
  ): Promise<string> {
    const data = await this.request<{ url: string }>(
      `/payments/create-portal-session`,
      "POST",
      { organization_id: organizationId, return_url: returnUrl }
    );
    return data.url;
  }
}

/**
 * Model API Module
 */
class ModelApi extends ApiRequest {
  async getAvailableModels(): Promise<Model[]> {
    return await this.request<Model[]>("/models");
  }
}

/**
 * Upload API Module
 */
class UploadApi extends ApiRequest {
  async getPresignedUrl(
    filename: string,
    mime_type: string,
    size: number,
    file_key: string
  ): Promise<{
    url: string;
    viewUrl: string;
    file_metadata: {
      filename: string;
      mime_type: string;
      file_key: string;
      size: number;
    };
  }> {
    return await this.request<{
      url: string;
      viewUrl: string;
      file_metadata: {
        filename: string;
        mime_type: string;
        file_key: string;
        size: number;
      };
    }>(`/presigned-url`, "POST", { filename, mime_type, size, file_key });
  }
}

/**
 * Thread API Module
 */
class ThreadApi extends ApiRequest {
  async createThread(params: {
    organizationId?: string;
    projectId?: string;
    knowledgeBaseId?: string;
    workflowId?: string;
  }): Promise<{ id: string }> {
    try {
      const { organizationId, projectId, knowledgeBaseId, workflowId } = params;
      return await this.request<{ id: string }>("/threads", "POST", {
        organizationId,
        projectId,
        knowledgeBaseId,
        workflowId,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 402) {
        throw new Error("subscription_required"); // Re-throw specific error for subscription
      }
      throw error; // Re-throw other errors
    }
  }

  async getThreads(
    page: number = 1,
    search: string = "",
    projectId?: string,
    knowledgeBaseId?: string,
    workflowId?: string
  ): Promise<Thread[]> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      search: search,
      ...(projectId && { projectId }),
      ...(knowledgeBaseId && { knowledgeBaseId }),
      ...(workflowId && { workflowId }),
    });
    const endpoint = `/threads?${queryParams.toString()}`;

    try {
      return await this.request<Thread[]>(endpoint);
    } catch {
      return []; // Return empty array for other errors as well, adjust as needed
    }
  }

  async getThread(threadId: string): Promise<Thread> {
    return await this.request<Thread>(`/threads/${threadId}`);
  }

  async getPublicThread(threadId: string): Promise<Thread> {
    return await this.request<Thread>(`/public/threads/${threadId}`);
  }

  async updateThread(
    threadId: string,
    data: UpdateThreadMutationData
  ): Promise<Thread> {
    return await this.request<Thread>(`/threads/${threadId}`, "PUT", data);
  }

  async deleteThread(
    threadId: string,
    organizationId?: string
  ): Promise<{ success: boolean }> {
    const queryParams = new URLSearchParams({
      ...(organizationId && { organizationId }),
    });
    const endpoint = `/threads/${threadId}?${queryParams.toString()}`;
    return await this.request<{ success: boolean }>(endpoint, "DELETE");
  }

  async cloneThread(threadId: string): Promise<{ id: string }> {
    return await this.request<{ id: string }>(
      `/threads/${threadId}/clone`,
      "POST"
    );
  }
}

/**
 * Projects API Module
 */
class ProjectsApi extends ApiRequest {
  private fileUploadMixin = new FileUploadMixin();

  async createProject(data: {
    siteId?: string;
    organizationId?: string | null;
    name: string;
    description?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    project_number?: string;
    estimated_start_date?: string;
    estimated_end_date?: string;
  }): Promise<Project> {
    return await this.request("/projects", "POST", data);
  }

  async getProject(projectId: string): Promise<Project> {
    const queryParams = new URLSearchParams();

    return await this.request(
      `/projects/${projectId}${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`
    );
  }

  async listProjects(options?: {
    search?: string;
    page?: number;
    limit?: number;
    siteId?: string;
    sort?: SortOption;
  }): Promise<{
    data: Project[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();

    if (options?.siteId) {
      queryParams.append("siteId", options.siteId);
    }

    if (options?.search) {
      queryParams.append("search", options.search);
    }

    if (options?.page !== undefined) {
      queryParams.append("page", options.page.toString());
    }

    if (options?.limit !== undefined) {
      queryParams.append("limit", options.limit.toString());
    }

    if (options?.sort) {
      queryParams.append("sort", options.sort);
    }

    try {
      return await this.request(`/projects?${queryParams.toString()}`);
    } catch (error) {
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    const queryParams = new URLSearchParams();

    return await this.request(
      `/projects/${projectId}${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`,
      "DELETE"
    );
  }

  async getDocuments(
    projectId: string,
    path?: string
  ): Promise<DocumentContent[]> {
    const queryParams = new URLSearchParams();
    if (path) {
      queryParams.append("path", path);
    }

    return await this.request(
      `/projects/${projectId}/documents${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`
    );
  }

  async deleteContents(
    projectId: string,
    path: string
  ): Promise<{
    success: boolean;
  }> {
    const queryParams = new URLSearchParams();
    queryParams.append("path", path);

    return await this.request(
      `/projects/${projectId}/documents?${queryParams.toString()}`,
      "DELETE"
    );
  }

  async updateProject(
    projectId: string,
    data: {
      name?: string;
      description?: string;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      postalCode?: string | null;
      latitude?: number;
      longitude?: number;
      project_number?: string;
      estimated_start_date?: string;
      estimated_end_date?: string;
    }
  ): Promise<Project> {
    try {
      return await this.request(`/projects/${projectId}`, "PATCH", data);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetches file metadata and content. The server response can include:
   * - isLfsPointer + s3Url (for large/binary files in S3),
   * - content (for text files),
   * - base64Content (for small/binary files directly in Gitea).
   */
  async getDocument(projectId: string, path: string): Promise<DocumentContent> {
    const queryParams = new URLSearchParams();
    queryParams.append("path", path);

    return await this.request(
      `/projects/${projectId}/document?${queryParams.toString()}`
    );
  }

  public async uploadFiles(
    projectId: string,
    files: File[],
    basePath: string = "",
    onProgress?: (progress: number) => void
  ): Promise<{
    success: boolean;
  }> {
    try {
      // Use the mixin to prepare files and get entries
      const payload = await this.fileUploadMixin.prepareFilesForUpload(
        projectId,
        "projects",
        files,
        basePath,
        onProgress
      );

      // Make the actual API request with the prepared data
      return this.request(`/projects/${projectId}/documents`, "POST", payload);
    } catch (error) {
      throw error;
    }
  }

  async getProjectMembers(projectId: string): Promise<User[]> {
    return await this.request<User[]>(`/projects/${projectId}/members`);
  }

  async getAccessLogs(
    projectId: string,
    page: number,
    limit: number,
    filters: ProjectAccessLogFilters
  ): Promise<ProjectAccessLogsResponse> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.resource !== "all" && { resource: filters.resource }),
        ...(filters.action !== "all" && { action: filters.action }),
        ...(filters.status !== "all" && { status: filters.status }),
      });
      return await this.request<ProjectAccessLogsResponse>(
        `/projects/${projectId}/access-logs?${queryParams.toString()}`
      );
    } catch (error) {
      throw error;
    }
  }
}

class PermissionsApi extends ApiRequest {
  async getRoles(): Promise<RolesResponse> {
    return await this.request<RolesResponse>(`/permissions/roles`);
  }

  async createOrgInvitations(
    orgId: string,
    invitations: OrgInvitationsRequest
  ): Promise<void> {
    try {
      return await this.request<void>(
        `/permissions/organizations/${orgId}/invitations`,
        "POST",
        {
          invitations,
        }
      );
    } catch (error) {
      throw error;
    }
  }

  async getOrgInvitations(orgId: string): Promise<OrgInvitationsResponse> {
    try {
      return await this.request<OrgInvitationsResponse>(
        `/permissions/organizations/${orgId}/invitations`
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteOrgInvitations(
    orgId: string,
    invitationsIds: string[]
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/permissions/organizations/${orgId}/invitations`,
        "DELETE",
        {
          invitationsIds,
        }
      );
    } catch (error) {
      throw error;
    }
  }

  async getTransferableOrgProjects(
    organizationId: string
  ): Promise<TransferableProjectsResponse> {
    try {
      return await this.request<TransferableProjectsResponse>(
        `/permissions/organizations/${organizationId}/transferable-projects`
      );
    } catch (error) {
      throw error;
    }
  }

  async updateOrgMemberRole(
    organizationId: string,
    memberId: string,
    data: UpdateOrgMemberRoleRequest
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/permissions/organizations/${organizationId}/members/${memberId}`,
        "PUT",
        data
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteOrgMembers(
    organizationId: string,
    membersIds: string[]
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/permissions/organizations/${organizationId}/members`,
        "DELETE",
        {
          membersIds,
        }
      );
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Workflows API Module
 */
class WorkflowsApi extends ApiRequest {
  async listWorkflows(): Promise<Workflow[]> {
    return await this.request("/workflows");
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return await this.request(`/workflows/${id}`);
  }

  async createWorkflow(data: {
    name: string;
    description: string;
    workflowSteps: Step[];
  }): Promise<{ message: string }> {
    try {
      return await this.request("/workflows", "POST", data);
    } catch (error) {
      throw error;
    }
  }

  async updateWorkflow(
    workflowId: string,
    data: WorkflowUpdateRequest
  ): Promise<{ message: string; id: string }> {
    try {
      return await this.request<{ message: string; id: string }>(
        `/workflows/${workflowId}`,
        "PUT",
        data
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteWorkflow(workflowId: string): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/workflows/${workflowId}`,
        "DELETE"
      );
    } catch (error) {
      throw error;
    }
  }

  async createRun(data: WorkflowRunRequest): Promise<{
    id: string;
  }> {
    try {
      return await this.request(
        `/workflows/${data.workflowId}/runs`,
        "POST",
        data
      );
    } catch (error) {
      throw error;
    }
  }

  async getRuns(workflowId: string): Promise<WorkflowRun[]> {
    return await this.request(`/workflows/${workflowId}/runs`);
  }

  async getRun(workflowId: string, runId: string): Promise<WorkflowRun> {
    return await this.request(`/workflows/${workflowId}/runs/${runId}`);
  }

  async triggerRun(workflowId: string, workflowRunId: string): Promise<void> {
    return await this.request(
      `/workflows/${workflowId}/runs/${workflowRunId}`,
      "POST"
    );
  }

  async getAgents(): Promise<Agent[]> {
    return await this.request("/workflows/agents");
  }

  async getTools(): Promise<Tool[]> {
    return await this.request("/tools");
  }
}

class SitesApi extends ApiRequest {
  async listSites(options?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Site[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();

    if (options?.search) {
      queryParams.append("search", options.search);
    }

    if (options?.page !== undefined) {
      queryParams.append("page", options.page.toString());
    }

    if (options?.limit !== undefined) {
      queryParams.append("limit", options.limit.toString());
    }

    return await this.request(`/sites?${queryParams.toString()}`);
  }

  async getSite(siteId: string): Promise<Site> {
    try {
      return await this.request<Site>(`/sites/${siteId}`);
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Knowledge Bases API Module
 */
export class KnowledgeBasesApi extends ApiRequest {
  private fileUploadMixin = new FileUploadMixin();

  async createKnowledgeBase(data: {
    name: string;
    description?: string;
  }): Promise<KnowledgeBase> {
    return await this.request("/knowledge-bases", "POST", data);
  }

  async getKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeBase> {
    return await this.request(`/knowledge-bases/${knowledgeBaseId}`);
  }

  async listKnowledgeBases(
    page: number = 1,
    pageSize: number = 10,
    search?: string
  ): Promise<{
    data: KnowledgeBase[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", page.toString());
    queryParams.append("pageSize", pageSize.toString());
    if (search) queryParams.append("search", search);

    return await this.request(`/knowledge-bases?${queryParams.toString()}`);
  }

  async deleteKnowledgeBase(
    knowledgeBaseId: string
  ): Promise<{ success: boolean }> {
    return await this.request(`/knowledge-bases/${knowledgeBaseId}`, "DELETE");
  }

  async updateKnowledgeBase(
    knowledgeBaseId: string,
    data: {
      name?: string;
      description?: string;
    }
  ): Promise<KnowledgeBase> {
    return await this.request(
      `/knowledge-bases/${knowledgeBaseId}`,
      "PATCH",
      data
    );
  }

  async getDocuments(
    knowledgeBaseId: string,
    path?: string
  ): Promise<DocumentContent[]> {
    const queryParams = new URLSearchParams();
    if (path) queryParams.append("path", path);
    return await this.request(
      `/knowledge-bases/${knowledgeBaseId}/documents${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`
    );
  }

  async uploadFiles(
    knowledgeBaseId: string,
    files: File[],
    basePath: string = "",
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean }> {
    // Use the mixin to prepare files and get entries
    const payload = await this.fileUploadMixin.prepareFilesForUpload(
      knowledgeBaseId,
      "knowledge-bases",
      files,
      basePath,
      onProgress
    );

    // Make the actual API request with the prepared data
    return this.request(
      `/knowledge-bases/${knowledgeBaseId}/documents`,
      "POST",
      payload
    );
  }

  async deleteDocs(
    knowledgeBaseId: string,
    path: string
  ): Promise<{ success: boolean }> {
    const queryParams = new URLSearchParams();
    queryParams.append("path", path);

    return await this.request(
      `/knowledge-bases/${knowledgeBaseId}/documents?${queryParams.toString()}`,
      "DELETE"
    );
  }

  async getDocument(
    knowledgeBaseId: string,
    path: string
  ): Promise<DocumentContent> {
    const queryParams = new URLSearchParams();
    queryParams.append("path", path);

    return await this.request(
      `/knowledge-bases/${knowledgeBaseId}/document?${queryParams.toString()}`
    );
  }

  async getAccessLogs(
    knowledgeBaseId: string,
    page: number,
    limit: number,
    filters: KnowledgeBaseAccessLogFilters
  ): Promise<KnowledgeBaseAccessLogsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(filters.search && { search: filters.search }),
      ...(filters.resource !== "all" && { resource: filters.resource }),
      ...(filters.action !== "all" && { action: filters.action }),
      ...(filters.status !== "all" && { status: filters.status }),
    });
    try {
      return await this.request(
        `/knowledge-bases/${knowledgeBaseId}/access-logs?${queryParams.toString()}`
      );
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Issues API Module
 */
class IssuesApi extends ApiRequest {
  async listIssues(
    projectId: string,
    options?: {
      status?: IssueStatus;
      page?: number;
      limit?: number;
      searchTerm?: string;
    }
  ): Promise<PaginatedIssues> {
    const queryParams = new URLSearchParams();
    if (options?.status) {
      queryParams.append("status", options.status);
    }
    if (options?.page !== undefined) {
      queryParams.append("page", options.page.toString());
    }
    if (options?.limit !== undefined) {
      queryParams.append("limit", options.limit.toString());
    }
    if (options?.searchTerm) {
      queryParams.append("searchTerm", options.searchTerm);
    }

    const endpoint = `/projects/${projectId}/issues?${queryParams.toString()}`;
    try {
      return await this.request<PaginatedIssues>(endpoint, "GET");
    } catch (error) {
      console.error(`Failed to list issues for project ${projectId}:`, error);
      throw error;
    }
  }

  async createIssue(
    projectId: string,
    data: CreateIssueData
  ): Promise<{ message: string; issueId: string }> {
    try {
      return await this.request<{ message: string; issueId: string }>(
        `/projects/${projectId}/issues`,
        "POST",
        data
      );
    } catch (error) {
      console.error(`Failed to create issue in project ${projectId}:`, error);
      throw error;
    }
  }

  async getIssue(projectId: string, issueNumber: number): Promise<Issue> {
    try {
      return await this.request<Issue>(
        `/projects/${projectId}/issues/${issueNumber}`,
        "GET"
      );
    } catch (error) {
      console.error(`Failed to get issue ${issueNumber}:`, error);
      throw error;
    }
  }

  async updateIssue(
    projectId: string,
    issueNumber: number,
    data: UpdateIssueData
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/projects/${projectId}/issues/${issueNumber}`,
        "PATCH",
        data
      );
    } catch (error) {
      console.error(`Failed to update issue ${issueNumber}:`, error);
      throw error;
    }
  }

  async deleteIssue(
    projectId: string,
    issueNumber: number
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/projects/${projectId}/issues/${issueNumber}`,
        "DELETE"
      );
    } catch (error) {
      console.error(`Failed to delete issue ${issueNumber}:`, error);
      throw error;
    }
  }

  // --- Comment API Methods ---
  async createComment(
    projectId: string,
    issueNumber: number,
    data: { comment: string }
  ): Promise<{ message: string; commentId: string }> {
    try {
      return await this.request<{ message: string; commentId: string }>(
        `/projects/${projectId}/issues/${issueNumber}/comments`,
        "POST",
        data
      );
    } catch (error) {
      console.error(`Failed to add comment to issue ${issueNumber}:`, error);
      throw error;
    }
  }

  async updateComment(
    projectId: string,
    issueNumber: number,
    commentId: string,
    data: { comment: string }
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/projects/${projectId}/issues/${issueNumber}/comments/${commentId}`,
        "PATCH",
        data
      );
    } catch (error) {
      console.error(`Failed to update comment ${commentId}:`, error);
      throw error;
    }
  }

  async deleteComment(
    projectId: string,
    issueNumber: number,
    commentId: string
  ): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>(
        `/projects/${projectId}/issues/${issueNumber}/comments/${commentId}`,
        "DELETE"
      );
    } catch (error) {
      console.error(`Failed to delete comment ${commentId}:`, error);
      throw error;
    }
  }
}

/**
 *  Centralized ApiClient class that uses the modules
 */
class ApiClient {
  public baseUrl: string;
  auth: AuthApi;
  organizations: OrganizationApi;
  payments: PaymentApi;
  models: ModelApi;
  uploads: UploadApi;
  threads: ThreadApi;
  projects: ProjectsApi;
  workflows: WorkflowsApi;
  permissions: PermissionsApi;
  sites: SitesApi;
  knowledgeBases: KnowledgeBasesApi;
  issues: IssuesApi;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.auth = new AuthApi(baseUrl);
    this.organizations = new OrganizationApi(baseUrl);
    this.payments = new PaymentApi(baseUrl);
    this.models = new ModelApi(baseUrl);
    this.uploads = new UploadApi(baseUrl);
    this.threads = new ThreadApi(baseUrl);
    this.projects = new ProjectsApi(baseUrl);
    this.workflows = new WorkflowsApi(baseUrl);
    this.permissions = new PermissionsApi(baseUrl);
    this.sites = new SitesApi(baseUrl);
    this.knowledgeBases = new KnowledgeBasesApi(baseUrl);
    this.issues = new IssuesApi(baseUrl);
  }
}

class MicrosoftGraphApi {
  async getFile(driveId: string, fileId: string, accessToken: string) {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`,
      {
        credentials: "omit",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Graph request failed: ${response.status}`);
    }

    const data = await response.json();

    return data;
  }

  async getOrgDrive(accessToken: string): Promise<{ webUrl: string }> {
    try {
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/drive",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch org drive URL");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching org drive URL:", error);
      return { webUrl: "" };
    }
  }
}

class MicrosoftApi {
  graph: MicrosoftGraphApi;

  constructor() {
    this.graph = new MicrosoftGraphApi();
  }
}

// Initialize ApiClient with base URL
const api = new ApiClient(import.meta.env.VITE_API_URL!);
export const microsoftApi = new MicrosoftApi();

export default api;
