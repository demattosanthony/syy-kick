import {
  OrganizationMemberRoleResponse,
  OrgInvitationsRequest,
  OrgInvitationsResponse,
  OrgMemberResponse,
  RolesResponse,
  TransferableRolesPermissions,
  UpdateOrgMemberRoleRequest,
} from "@/features/permissions/types";
import { Site } from "@/features/sites/types/sites";
import {
  CustomWorkflowRun,
  CustomWorkflowRuns,
  EnhancedWorkflowResponse,
} from "@/features/workflows/workflows.types";
import { ChatMessage, Thread, UpdateThreadMutationData } from "@/types/chat";
import { Model } from "@/types/model";
import { Organization, User } from "@/types/user";
import { OrganizationAccessLogsResponse } from "@/features/organizations/types/access-logs";
import { Comment } from "@/features/workflows/features/runs/features/comments/types";
import { AccessToken } from "@/features/integrations/types";
import { SyyclopsFile } from "@/features/files/types/files";

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

  async getMicrosoftFilesInit(redirectUri: string, authSource?: string) {
    try {
      let url = `/auth/microsoft-files/init?redirectUrl=${redirectUri}`;
      if (authSource) {
        url += `&auth_source=${authSource}`;
      }
      return await this.request<{ url: string }>(url, "GET");
    } catch (error) {
      throw error;
    }
  }

  async getUploadToken(redirectUri: string) {
    try {
      return await this.request<{
        accessToken: string;
        baseUrl: string;
        pickerToken: string;
      }>(`/auth/me/upload-token?redirectUrl=${redirectUri}`, "GET");
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
    workflowId?: string;
  }): Promise<{ id: string }> {
    try {
      const { organizationId, workflowId } = params;
      return await this.request<{ id: string }>("/threads", "POST", {
        organizationId,
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
    pageSize: number = 10,
    search: string = "",
    workflowId?: string
  ): Promise<Thread[]> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      search: search,
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

  async getPublicThreadMessages(threadId: string): Promise<ChatMessage[]> {
    return await this.request<ChatMessage[]>(
      `/public/threads/${threadId}/messages`
    );
  }

  async updateThread(
    threadId: string,
    data: UpdateThreadMutationData
  ): Promise<Thread> {
    return await this.request<Thread>(`/threads/${threadId}`, "PUT", data);
  }

  async getThreadMessages(threadId: string): Promise<ChatMessage[]> {
    return await this.request<ChatMessage[]>(`/threads/${threadId}/messages`);
  }

  async postMessage(params: {
    threadId: string;
    message: {
      content: string;
      role?: string;
      experimental_attachments?: any[];
    };
    model: string;
    maxTokens?: number;
    instructions?: string;
    thinking?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const { threadId, ...body } = params;
    return await this.request<{ success: boolean; message: string }>(
      `/threads/${threadId}/messages`,
      "POST",
      body
    );
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

  async stopInference(
    threadId: string
  ): Promise<{ success: boolean; stopped: boolean }> {
    return await this.request<{ success: boolean; stopped: boolean }>(
      `/threads/${threadId}/stop`,
      "POST"
    );
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
  async listWorkflows(
    query?: string
  ): Promise<Record<string, EnhancedWorkflowResponse>> {
    return await this.request(`/workflows?${query ? `query=${query}` : ""}`);
  }

  async getWorkflow(id: string): Promise<EnhancedWorkflowResponse> {
    return await this.request(`/workflows/${id}`);
  }

  async createRun(
    workflowId: string,
    input: any
  ): Promise<{
    runId: string;
  }> {
    try {
      return await this.request(`/workflows/${workflowId}/runs`, "POST", input);
    } catch (error) {
      throw error;
    }
  }

  async getRuns(workflowId: string): Promise<CustomWorkflowRuns> {
    return await this.request(`/workflows/${workflowId}/runs`);
  }

  async getRun(workflowId: string, runId: string): Promise<CustomWorkflowRun> {
    return await this.request(`/workflows/${workflowId}/runs/${runId}`);
  }

  async triggerRun(workflowId: string, workflowRunId: string): Promise<void> {
    return await this.request(
      `/workflows/${workflowId}/runs/${workflowRunId}`,
      "POST"
    );
  }

  async getRunComments(
    workflowId: string,
    workflowRunId: string
  ): Promise<Comment[]> {
    return await this.request(
      `/workflows/${workflowId}/runs/${workflowRunId}/comments`
    );
  }

  async createRunComment(
    workflowId: string,
    workflowRunId: string,
    comment: string
  ): Promise<Comment> {
    return await this.request(
      `/workflows/${workflowId}/runs/${workflowRunId}/comments`,
      "POST",
      {
        comment,
      }
    );
  }

  async updateRunComment(
    workflowId: string,
    workflowRunId: string,
    commentId: string,
    comment: string
  ): Promise<Comment> {
    return await this.request(
      `/workflows/${workflowId}/runs/${workflowRunId}/comments/${commentId}`,
      "PUT",
      {
        comment,
      }
    );
  }

  async deleteRunComment(
    workflowId: string,
    workflowRunId: string,
    commentId: string
  ): Promise<void> {
    return await this.request(
      `/workflows/${workflowId}/runs/${workflowRunId}/comments/${commentId}`,
      "DELETE"
    );
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

class IntegrationsApi extends ApiRequest {
  async getTokens(): Promise<AccessToken[]> {
    return await this.request<AccessToken[]>("/integrations", "GET");
  }

  async deleteIntegration(provider: string) {
    return await this.request(`/integrations/${provider}`, "DELETE");
  }

  async getToken(provider: string): Promise<AccessToken> {
    return await this.request(`/integrations/${provider}/token`, "GET");
  }
}

class FilesApi extends ApiRequest {
  async getFiles(options?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    files: SyyclopsFile[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
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

    return await this.request<{
      files: SyyclopsFile[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(`/files?${queryParams.toString()}`);
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
  workflows: WorkflowsApi;
  permissions: PermissionsApi;
  sites: SitesApi;
  integrations: IntegrationsApi;
  files: FilesApi;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.auth = new AuthApi(baseUrl);
    this.organizations = new OrganizationApi(baseUrl);
    this.payments = new PaymentApi(baseUrl);
    this.models = new ModelApi(baseUrl);
    this.uploads = new UploadApi(baseUrl);
    this.threads = new ThreadApi(baseUrl);
    this.workflows = new WorkflowsApi(baseUrl);
    this.permissions = new PermissionsApi(baseUrl);
    this.sites = new SitesApi(baseUrl);
    this.integrations = new IntegrationsApi(baseUrl);
    this.files = new FilesApi(baseUrl);
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
