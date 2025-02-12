import { Thread } from "@/types/chat";
import { Model } from "@/types/model";
import { Project, ProjectContent } from "@/types/project";
import { Organization, User } from "@/types/user";

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
    headers?: HeadersInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const fetchHeaders: HeadersInit = {
      "Content-Type": "application/json",
      ...headers,
    };
    const config: RequestInit = {
      method,
      credentials: "include",
      headers: fetchHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP error! status: ${response.status}` };
      }
      throw new ApiError(
        response.status,
        errorData?.message || `Request failed with status ${response.status}`
      );
    }

    return response.json() as Promise<T>; // Explicitly cast for better type safety
  }

  protected async uploadFormData<T>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
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
 * Custom ApiError class for better error handling
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError"; // Explicitly set name for better error identification
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
  }> {
    try {
      return await this.request<{
        success?: boolean;
        requiresAuth?: boolean;
        error?: string;
        insufficientSeats?: boolean;
        inactiveSubscription?: boolean;
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
        }
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
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

  async listOrganizationMembers(organizationId: string): Promise<
    Array<{
      user: {
        id: string;
        email: string;
        name: string;
        profilePicture: string;
      };
      role: "owner" | "member";
    }>
  > {
    return await this.request<
      Array<{
        user: {
          id: string;
          email: string;
          name: string;
          profilePicture: string;
        };
        role: "owner" | "member";
      }>
    >(`/organizations/${organizationId}/members`);
  }

  async removeOrganizationMember(
    organizationId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    return await this.request<{ success: boolean }>(
      `/organizations/${organizationId}/members/${userId}`,
      "DELETE"
    );
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
    return await this.request<{ success: boolean; error?: string }>(
      `/organizations/${organizationId}/seats/validate`,
      "POST",
      { seats }
    );
  }

  async updateOrganizationSeats(
    organizationId: string,
    seats: number
  ): Promise<{ success: boolean; error?: string }> {
    return await this.request<{ success: boolean; error?: string }>(
      `/organizations/${organizationId}/seats`,
      "PUT",
      { seats }
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
    size: number
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
    }>(`/presigned-url`, "POST", { filename, mime_type, size });
  }
}

/**
 * Thread API Module
 */
class ThreadApi extends ApiRequest {
  async createThread(organizationId?: string): Promise<{ id: string }> {
    try {
      return await this.request<{ id: string }>("/threads", "POST", {
        organizationId,
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
    organizationId?: string
  ): Promise<Thread[]> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      search: search,
      ...(organizationId && { organizationId }),
    });
    const endpoint = `/threads?${queryParams.toString()}`;

    try {
      return await this.request<Thread[]>(endpoint);
    } catch {
      return []; // Return empty array for other errors as well, adjust as needed
    }
  }

  async getThread(threadId: string, organizationId?: string): Promise<Thread> {
    const endpoint = organizationId
      ? `/threads/${threadId}?organizationId=${organizationId}`
      : `/threads/${threadId}`;
    return await this.request<Thread>(endpoint);
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
}

/**
 * Projects API Module
 */
class ProjectsApi extends ApiRequest {
  async createProject(data: {
    name: string;
    description?: string;
    organizationId?: string;
  }): Promise<Project> {
    return await this.request("/projects", "POST", data);
  }

  async getProject(projectId: string): Promise<Project> {
    return await this.request(`/projects/${projectId}`);
  }

  async listProjects(
    organizationId?: string,
    search?: string
  ): Promise<Project[]> {
    const queryParams = new URLSearchParams();
    if (organizationId) {
      queryParams.append("organizationId", organizationId);
    }
    if (search) {
      queryParams.append("search", search);
    }
    return await this.request(`/projects?${queryParams.toString()}`);
  }

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    return await this.request(`/projects/${projectId}`, "DELETE");
  }

  async uploadFile(
    projectId: string,
    file: File,
    path?: string
  ): Promise<{ success: boolean }> {
    const formData = new FormData();
    formData.append("file", file);

    const queryParams = new URLSearchParams();
    if (path) queryParams.append("path", path);

    return this.uploadFormData(
      `/projects/${projectId}/files${
        queryParams.toString() ? "?" + queryParams.toString() : ""
      }`,
      formData
    );
  }

  async getFiles(projectId: string, path?: string): Promise<ProjectContent[]> {
    const queryParams = new URLSearchParams();
    if (path) {
      queryParams.append("path", path);
    }
    return await this.request(
      `/projects/${projectId}/files${
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
    return await this.request(
      `/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
      "DELETE"
    );
  }

  async updateProject(
    projectId: string,
    data: {
      name?: string;
      description?: string;
    }
  ): Promise<Project> {
    return await this.request(`/projects/${projectId}`, "PATCH", data);
  }

  /**
   * Fetches file metadata and content. The server response can include:
   * - isLfsPointer + s3Url (for large/binary files in S3),
   * - content (for text files),
   * - base64Content (for small/binary files directly in Gitea).
   */
  async getFileContent(projectId: string, path: string): Promise<FileResponse> {
    // URL-encode path to ensure proper handling of spaces, etc.
    const encodedPath = encodeURIComponent(path);
    return await this.request(
      `/projects/${projectId}/files/content?path=${encodedPath}`
    );
  }

  // Helper function to calculate SHA256 of a file
  private async calculateSha256(file: File): Promise<string> {
    // Use Web Crypto API for better performance than pure JS implementations
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);

    // Convert hash to hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async uploadFileToProject(projectId: string, file: File, path?: string) {
    // Calculate SHA256 hash first
    const sha256 = await this.calculateSha256(file);

    // 1) Ask server if this file triggers LFS
    const presignResp = await fetch(
      `${this.baseUrl}/projects/${projectId}/files/presign-lfs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          sha256, // Include the hash in the request
        }),
      }
    ).then((r) => r.json());

    if (!presignResp.isLfs) {
      // LFS not needed -> do the old route with multipart form
      const formData = new FormData();
      formData.append("file", file);
      if (path) formData.append("path", path);
      await fetch(`${this.baseUrl}/projects/${projectId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      return;
    }

    // 2) For LFS:
    // Verify the returned fileKey matches our calculated SHA256
    if (presignResp.fileKey !== sha256) {
      throw new Error("SHA256 mismatch with server response");
    }

    // Upload direct to S3 using the returned presigned URL
    await fetch(presignResp.presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "Content-Length": file.size.toString(),
      },
      body: file,
    });

    // 3) Finalize (commit pointer in Gitea)
    await fetch(`${this.baseUrl}/projects/${projectId}/files/finalize-lfs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileKey: sha256, // Use SHA256 as the fileKey
        filePath: path || file.name,
        size: file.size,
        mimeType: file.type,
        sha256, // Include hash for verification
      }),
    });
  }
}

/**
 * FileResponse shape matches what the server now sends back.
 */
export interface FileResponse {
  name: string;
  path: string;
  size: number;
  type: "text" | "pdf" | "image" | "binary";
  sha: string;

  /**
   * True if this file is actually an LFS pointer and large content lives in S3.
   */
  isLfsPointer?: boolean;

  /**
   * For normal text-based files, server returns raw text here.
   */
  content?: string;

  /**
   * For non-text but small files, server returns base64-encoded content directly.
   */
  base64Content?: string;

  /**
   * For LFS-pointer files, server returns a presigned S3 URL here.
   */
  s3Url?: string;
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

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.auth = new AuthApi(baseUrl);
    this.organizations = new OrganizationApi(baseUrl);
    this.payments = new PaymentApi(baseUrl);
    this.models = new ModelApi(baseUrl);
    this.uploads = new UploadApi(baseUrl);
    this.threads = new ThreadApi(baseUrl);
    this.projects = new ProjectsApi(baseUrl);
  }
}

// Initialize ApiClient with base URL
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL!);

export default api;
