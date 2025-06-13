interface GraphSite {
  id: string;
  webUrl: string;
  name?: string;
  displayName?: string;
}

interface GraphDrive {
  id: string;
  webUrl: string;
  name?: string;
  driveType?: string;
}

interface GraphDriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string; hashes?: any };
  webUrl: string;
  parentReference?: {
    driveId: string;
    path?: string;
  };
  "@microsoft.graph.downloadUrl"?: string;
  size?: number;
}

interface GraphApiError {
  error: {
    code: string;
    message: string;
  };
}

class MicrosoftGraphApi {
  private readonly baseUrl = "https://graph.microsoft.com/v1.0";

  private async makeRequest<T>(
    url: string,
    accessToken: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorMessage = await this.getErrorMessage(response);
      throw new Error(errorMessage);
    }

    return response.json();
  }

  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const errorData: GraphApiError = await response.json();
      return `Graph API error (${response.status}): ${
        errorData.error?.message || response.statusText
      }`;
    } catch {
      return `Graph API error: ${response.status} ${response.statusText}`;
    }
  }

  async getSite(accessToken: string): Promise<GraphSite> {
    return this.makeRequest<GraphSite>(
      `${this.baseUrl}/sites/root`,
      accessToken
    );
  }

  async getFile(
    driveId: string,
    fileId: string,
    accessToken: string
  ): Promise<GraphDriveItem> {
    return this.makeRequest<GraphDriveItem>(
      `${this.baseUrl}/drives/${driveId}/items/${fileId}`,
      accessToken
    );
  }

  async getOrgDrive(accessToken: string): Promise<GraphDrive | null> {
    try {
      const drive = await this.makeRequest<GraphDrive>(
        `${this.baseUrl}/me/drive`,
        accessToken
      );

      if (!drive?.id || !drive?.webUrl) {
        console.error("Drive data is missing required fields:", drive);
        return null;
      }

      return drive;
    } catch (error) {
      console.error("Error fetching org drive:", error);
      return null;
    }
  }

  async getFolderContent(
    driveId: string,
    folderPath: string,
    accessToken: string
  ): Promise<GraphDriveItem[]> {
    try {
      const url = this.buildFolderUrl(driveId, folderPath);
      const response = await this.makeRequest<{ value: GraphDriveItem[] }>(
        url,
        accessToken
      );
      return response.value || [];
    } catch (error) {
      console.error("Error fetching folder content:", error);
      return [];
    }
  }

  async getDrives(accessToken: string, siteId: string): Promise<GraphDrive[]> {
    try {
      const response = await this.makeRequest<{ value: GraphDrive[] }>(
        `${this.baseUrl}/sites/${siteId}/drives`,
        accessToken
      );
      return response.value || [];
    } catch (error) {
      console.error("Error fetching drives:", error);
      return [];
    }
  }

  async searchFiles(
    driveId: string,
    searchText: string,
    accessToken: string
  ): Promise<GraphDriveItem[]> {
    if (!searchText.trim()) {
      return [];
    }

    try {
      const encodedSearch = encodeURIComponent(searchText);
      const response = await this.makeRequest<{ value: GraphDriveItem[] }>(
        `${this.baseUrl}/drives/${driveId}/root/search(q='${encodedSearch}')`,
        accessToken
      );
      return response.value || [];
    } catch (error) {
      console.error("Error searching files:", error);
      return [];
    }
  }

  private buildFolderUrl(driveId: string, folderPath: string): string {
    if (!folderPath) {
      return `${this.baseUrl}/drives/${driveId}/root/children`;
    }

    const encodedPath = encodeURIComponent(folderPath);
    return `${this.baseUrl}/drives/${driveId}/root:/${encodedPath}:/children`;
  }
}

export default new MicrosoftGraphApi();
export type { GraphSite, GraphDrive, GraphDriveItem };
