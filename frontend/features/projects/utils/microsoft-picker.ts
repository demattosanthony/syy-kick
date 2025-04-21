/** Api */
import api, { microsoftApi } from "@/lib/api";

/** Types */
import { SharePointFile } from "../types";

interface Token {
  accessToken: string;
  pickerToken: string;
  baseUrl: string;
}

export interface PickerOptions {
  mode: "files" | "folder";
  selectionMode?: "single" | "multiple" | "pick";
  mimeTypes?: string[];
}

export class MicrosoftPicker {
  private token: Token | null = null;
  private loading: boolean = false;
  private channelId: string | null = null;

  constructor(
    private readonly onFilesSelected: (files: SharePointFile[]) => void
  ) {}

  public getLoadingState(): boolean {
    return this.loading;
  }

  public setLoading(loading: boolean): void {
    this.loading = loading;
  }

  public setToken(token: Token): void {
    this.token = token;
  }

  public async openPicker(options: PickerOptions): Promise<void> {
    this.setLoading(true);
    const redirectUri = encodeURIComponent(window.location.href);

    const userToken = await api.auth.getUploadToken(redirectUri);

    if (!userToken.accessToken) {
      const authUrl = await api.auth.getMicrosoftFilesInit(redirectUri);
      window.location.href = authUrl.url;
      return;
    }

    this.setToken(userToken);

    if (
      !userToken.accessToken ||
      !userToken.pickerToken ||
      !userToken.baseUrl
    ) {
      const initRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft-files/init?redirectUrl=${redirectUri}`
      );
      const { url } = await initRes.json();
      window.location.href = url;
      return;
    }

    const sharePointConfig = await this.getSharePointConfig(options, userToken);
    const pickerOptions = this.createPickerOptions(options, sharePointConfig);
    await this.displayPicker(pickerOptions, userToken);
  }

  private async getSharePointConfig(
    options: PickerOptions,
    userToken: Token
  ): Promise<object> {
    if (options.mode === "folder") {
      const orgDrive = await microsoftApi.graph.getOrgDrive(
        userToken.accessToken
      );
      if (orgDrive.webUrl) {
        return {
          byPath: {
            list: orgDrive.webUrl,
          },
        };
      }
    }
    return {};
  }

  private createPickerOptions(
    options: PickerOptions,
    sharePointConfig: object
  ): object {
    const channelId = crypto.randomUUID();
    this.channelId = channelId;

    const getExtFilter = (mimeType: string) => {
      if (mimeType.startsWith("image/"))
        return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
      if (mimeType.startsWith("video/"))
        return [".mp4", ".mov", ".avi", ".wmv", ".flv"];
      if (mimeType.startsWith("audio/"))
        return [".mp3", ".wav", ".ogg", ".m4a"];
      if (mimeType === "application/pdf") return [".pdf"];
      if (mimeType === "application/msword") return [".doc"];
      if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
        return [".docx"];
      if (mimeType === "application/vnd.ms-excel") return [".xls"];
      if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
        return [".xlsx"];
      if (mimeType === "application/vnd.ms-powerpoint") return [".ppt"];
      if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
        return [".pptx"];
      return [".*"];
    };

    return {
      sdk: "8.0",
      entry: {
        sharePoint: sharePointConfig,
      },
      authentication: {},
      messaging: {
        origin: window.location.origin,
        channelId,
      },
      selection: {
        mode: options.selectionMode || "multiple",
      },
      typesAndSources: {
        mode: options.mode,
        filters: options?.mimeTypes?.map(getExtFilter).flat() || undefined,
      },
      search: {
        enabled: true,
      },
    };
  }

  private async displayPicker(
    pickerOptions: object,
    userToken: Token
  ): Promise<void> {
    const iframe = document.getElementById(
      "microsoft-picker-iframe"
    ) as HTMLIFrameElement;
    if (!iframe?.contentWindow) return;

    const tenant = userToken?.baseUrl?.split(".")[0];
    const pickerUrl = `https://${tenant}-my.sharepoint.com/_layouts/15/FilePicker.aspx?filePicker=${encodeURIComponent(
      JSON.stringify(pickerOptions)
    )}&locale=en-us`;

    iframe.style.display = "block";

    const form = document.createElement("form");
    form.setAttribute("method", "POST");
    form.setAttribute("action", pickerUrl);
    form.setAttribute("target", "microsoftPickerFrame");

    const tokenInput = document.createElement("input");
    tokenInput.setAttribute("type", "hidden");
    tokenInput.setAttribute("name", "access_token");
    tokenInput.setAttribute("value", userToken.pickerToken);
    form.appendChild(tokenInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    this.setLoading(false);
  }

  public async pickerSelectionsToFiles(
    pickerFiles: SharePointFile[]
  ): Promise<File[]> {
    if (!this.token) return [];

    const results: File[] = [];

    for (const pickerObj of pickerFiles) {
      const { parentReference, id, name } = pickerObj;

      if (!parentReference?.driveId || !id) {
        console.warn("Missing driveId or id, skipping:", pickerObj);
        continue;
      }

      try {
        const file = await this.downloadFile(pickerObj);
        if (file) results.push(file);
      } catch (err) {
        console.warn("❌ Error processing picker file:", pickerObj.name, err);
      }
    }

    return results;
  }

  private async downloadFile(pickerObj: SharePointFile): Promise<File | null> {
    if (!this.token) return null;

    const { parentReference, id, name } = pickerObj;
    if (!parentReference?.driveId || !id) {
      throw new Error("Missing driveId or id");
    }

    const data = await microsoftApi.graph.getFile(
      parentReference.driveId,
      id,
      this.token.accessToken
    );
    const downloadUrl = data["@microsoft.graph.downloadUrl"];

    if (!downloadUrl) {
      throw new Error("No download URL found in Graph response");
    }

    const blobResponse = await fetch(downloadUrl);
    const blob = await blobResponse.blob();
    const type =
      blobResponse.headers.get("Content-Type") || "application/octet-stream";

    return new File([blob], name, { type });
  }

  public handleMessage(event: MessageEvent): void {
    const { data } = event;

    if (data?.channelId !== this.channelId) {
      return;
    }

    if (data?.type === "initialize") {
      const port = event.ports[0];
      port.onmessage = async (message) => {
        const payload = message.data;

        if (
          payload.type === "command" &&
          payload.data?.command === "authenticate"
        ) {
          this.handleAuthentication(port, message);
        }

        if (payload.type === "command" && payload.data?.command === "pick") {
          this.handlePick(port, message);
        }

        if (payload.type === "command" && payload.data?.command === "close") {
          this.handleClose();
        }
      };

      port.start();
      port.postMessage({ type: "activate" });
    }
  }

  private handleAuthentication(port: MessagePort, message: MessageEvent): void {
    if (!this.token) {
      port.postMessage({
        type: "result",
        id: message.data.id,
        data: { result: "error", error: "No token" },
      });
      return;
    }

    port.postMessage({
      type: "result",
      id: message.data.id,
      data: {
        result: "token",
        token: this.token?.pickerToken,
      },
    });
  }

  private handlePick(port: MessagePort, message: MessageEvent): void {
    this.onFilesSelected(message.data?.data?.items || []);

    const iframe = document.getElementById(
      "microsoft-picker-iframe"
    ) as HTMLIFrameElement;
    iframe.style.display = "none";

    port.postMessage({
      type: "result",
      id: message.data.id,
      data: { result: "success" },
    });
  }

  private handleClose(): void {
    const iframe = document.getElementById(
      "microsoft-picker-iframe"
    ) as HTMLIFrameElement;
    iframe.style.display = "none";
  }
}
