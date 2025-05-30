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
        url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folderPath}:/children`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "omit",
      });

      if (!response.ok) {
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
}

export default new MicrosoftGraphApi();
