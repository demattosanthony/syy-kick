class MicrosoftGraphApi {
  async getSite(accessToken: string) {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/root`,
      {
        credentials: "omit",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch site: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }
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

  async getOrgDrive(
    accessToken: string
  ): Promise<{ id: string; webUrl: string } | null> {
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
        console.error(
          "Failed to fetch org drive URL, status:",
          response.status
        );
        // throw new Error("Failed to fetch org drive URL");
        return null;
      }

      const data = await response.json();
      if (data && data.id && data.webUrl) {
        return { id: data.id, webUrl: data.webUrl };
      } else {
        console.error("Org drive data is missing id or webUrl:", data);
        return null;
      }
    } catch (error) {
      console.error("Error fetching org drive URL:", error);
      // return { webUrl: "" };
      return null;
    }
  }

  async getFolderContent(
    driveId: string,
    folderPath: string,
    accessToken: string
  ) {
    try {
      let url;
      if (!folderPath) {
        url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
      } else {
        // Encode the folder path to handle spaces and special characters
        const encodedPath = encodeURIComponent(folderPath);
        url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/children`;
      }

      console.log("getFolderContent: Fetching from URL:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "omit",
      });

      if (!response.ok) {
        console.error(
          `getFolderContent: Failed with status ${response.status} for path: "${folderPath}"`
        );
        throw new Error(`Failed to fetch folder content: ${response.status}`);
      }

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error("Error fetching folder content:", error);
      return [];
    }
  }

  async getDrives(accessToken: string, siteId: string) {
    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch drives: ${response.status}`);
      }

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error("Error fetching drives:", error);
      return [];
    }
  }

  async searchFiles(driveId: string, searchText: string, accessToken: string) {
    if (!searchText) {
      return []; // Or handle as a regular folder browse if search text is empty
    }
    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${searchText}')`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search files: ${response.status}`);
      }

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error("Error searching files:", error);
      return [];
    }
  }
}

export default new MicrosoftGraphApi();
