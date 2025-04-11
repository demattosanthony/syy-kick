"use client";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { SharePointFile } from "../types";

interface SharePointLibrary {
    id: string;
    name: string;
    webUrl: string;
}

declare global {
    interface Window {
        OneDrive?: any;
    }
}

export function useMicrosoftPicker({
    onFilesSelected,
}: {
    onFilesSelected: (files: SharePointFile[]) => void;
}) {

    const [token, setToken] = useState<{
        accessToken: string;
        pickerToken: string;
        baseUrl: string;
    } | null>(null);

    const [loading, setLoading] = useState(false);

    const getOrgDriveUrl = useCallback(async (accessToken: string): Promise<string> => {
        try {
            const response = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'omit'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch org drive URL');
            }
            
            const data = await response.json();
            return data.webUrl;
        } catch (error) {
            console.error('Error fetching org drive URL:', error);
            return '';
        }
    }, []);

    const openPicker = useCallback(async (options: {
        mode: "files" | "folder";
    }) => {
        const redirectUri = encodeURIComponent(window.location.href);

        const userToken = await api.auth.getUploadToken(redirectUri);

        console.log("userToken", userToken);
        console.log(!userToken.accessToken, '<--- condition')

        if (!userToken.accessToken) {
            const authUrl = await api.auth.getMicrosoftFilesInit(redirectUri);

            window.location.href = authUrl.url;
            return;
        }

        setToken(userToken);

        setLoading(true);
        if (!userToken.accessToken || !userToken.pickerToken || !userToken.baseUrl) {
            const initRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft-files/init?redirectUrl=${redirectUri}`);
            const { url } = await initRes.json();

            window.location.href = url;
            return;
        }

        let sharePointConfig = {};
        if (options.mode === "folder") {
            const orgDriveUrl = await getOrgDriveUrl(userToken.accessToken);
            if (orgDriveUrl) {
                sharePointConfig = {
                    byPath: {
                        list: orgDriveUrl
                    }
                };
            }
        }

        const channelId = crypto.randomUUID();
        const pickerOptions = {
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
                mode: "multiple",
            },
            typesAndSources: {
                mode: options.mode,
            },
            search: {
                enabled: true,
            }
        };

        const iframe = document.getElementById("microsoft-picker-iframe") as HTMLIFrameElement;
        if (!iframe?.contentWindow) return;

        const tenant = userToken?.baseUrl?.split(".")[0];

        const pickerUrl = `https://${tenant}-my.sharepoint.com/_layouts/15/FilePicker.aspx?filePicker=${encodeURIComponent(JSON.stringify(pickerOptions))}&locale=en-us`;

        // Display the picker
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
        setLoading(false);
    }, [onFilesSelected]);

    const pickerSelectionsToFiles = useCallback(
        async (pickerFiles: SharePointFile[]): Promise<File[]> => {
            if (!token) return [];

            const results: File[] = [];

            for (const pickerObj of pickerFiles) {
                const { parentReference, id, name } = pickerObj;

                if (!parentReference?.driveId || !id) {
                    console.warn("Missing driveId or id, skipping:", pickerObj);
                    continue;
                }

                try {
                    const response = await fetch(
                        `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${id}`,
                        {
                            credentials: "omit",
                            headers: {
                                Authorization: "Bearer " + token.accessToken,
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Graph request failed: ${response.status}`);
                    }

                    const data = await response.json();
                    const downloadUrl = data["@microsoft.graph.downloadUrl"];

                    if (!downloadUrl) {
                        throw new Error("No download URL found in Graph response");
                    }

                    const blobResponse = await fetch(downloadUrl);
                    const blob = await blobResponse.blob();
                    const type = blobResponse.headers.get("Content-Type") || "application/octet-stream";

                    results.push(new File([blob], name, { type }));
                } catch (err) {
                    console.warn("❌ Error processing picker file:", pickerObj.name, err);
                }
            }

            return results;
        },
        [token]
    );


    useEffect(() => {
        const listener = (event: MessageEvent) => {
            const { data } = event;

            if (data?.type === "initialize" && data.channelId) {
                const port = event.ports[0];
                port.onmessage = async (message) => {
                    const payload = message.data;

                    if (payload.type === "command" && payload.data?.command === "authenticate") {

                        if (!token) {
                            port.postMessage({
                                type: "result",
                                id: message.data.id,
                                data: { result: "error", error: "No token" },
                            });
                        }

                        port.postMessage({
                            type: "result",
                            id: message.data.id,
                            data: {
                                result: "token",
                                token: token?.pickerToken,
                            },
                        });
                    }

                    if (payload.type === "command" && payload.data?.command === "pick") {
                        onFilesSelected(payload.data?.items || []);

                        const iframe = document.getElementById("microsoft-picker-iframe") as HTMLIFrameElement;
                        iframe.style.display = "none";

                        port.postMessage({
                            type: "result",
                            id: message.data.id,
                            data: { result: "success" },
                        });
                    }

                    if (payload.type === "command" && payload.data?.command === "close") {
                        const iframe = document.getElementById("microsoft-picker-iframe") as HTMLIFrameElement;
                        iframe.style.display = "none";

                    }
                };

                port.start();
                port.postMessage({ type: "activate" });
            }
        };

        window.addEventListener("message", listener);
        return () => window.removeEventListener("message", listener);
    }, [token]);

    return {
        openPicker,
        pickerSelectionsToFiles,
        loading,
    };
}

export default useMicrosoftPicker;
