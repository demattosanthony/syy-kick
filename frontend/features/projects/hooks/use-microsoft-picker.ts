"use client";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useRouter } from 'next/compat/router'
import { useSearchParams } from 'next/navigation'

declare global {
    interface Window {
        OneDrive?: any;
    }
}

export function useMicrosoftPicker({
    onFilesSelected,
}: {
    onFilesSelected: (files: any) => void;
}) {

    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (router && !router.isReady) return;

        // router?.push("/auth/microsoft-files");

        // (async () => {
        //     const userToken = await api.auth.getUploadToken();
        //     if (userToken.accessToken) {
        //         setToken(userToken);
        //     }
        // })();
    }, [router, searchParams]);

    const [token, setToken] = useState<{
        accessToken: string;
        baseUrl: string;
    } | null>(null);

    useEffect(() => {
        (async () => {
            const userToken = await api.auth.getUploadToken();
            if (userToken.accessToken) {
                setToken(userToken);
            }
        })();
    }, []);

    console.log(token, '<--- token');

    const openPicker = useCallback(async () => {

        if (!token) {
            const state = {
                redirectUrl: window.location.href,
            };
            const encodedState = btoa(JSON.stringify(state));
            window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft-files?state=${encodedState}`;
            return;
        }

        const channelId = crypto.randomUUID();
        const options = {
            sdk: "8.0",
            entry: {
                sharePoint: {},
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
                mode: "files",
            },
            search: {
                enabled: true,
            }
        };

        const iframe = document.getElementById("microsoft-picker-iframe") as HTMLIFrameElement;
        if (!iframe?.contentWindow) return;

        const tenant = token?.baseUrl?.split(".")[0];

        console.log("tenant------- ", tenant);

        const pickerUrl = `https://${tenant}-my.sharepoint.com/_layouts/15/FilePicker.aspx?filePicker=${encodeURIComponent(JSON.stringify(options))}&locale=en-us`;

        console.log("pickerUrl", pickerUrl);
        // Display the picker
        iframe.style.display = "block";

        const form = document.createElement("form");
        form.setAttribute("method", "POST");
        form.setAttribute("action", pickerUrl);
        form.setAttribute("target", "microsoftPickerFrame");

        const tokenInput = document.createElement("input");
        tokenInput.setAttribute("type", "hidden");
        tokenInput.setAttribute("name", "access_token");
        tokenInput.setAttribute("value", token.accessToken);
        form.appendChild(tokenInput);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }, [onFilesSelected, token]);


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

                        // 👉 Fournir un token ici si le picker le redemande
                        port.postMessage({
                            type: "result",
                            id: message.data.id,
                            data: {
                                result: "token",
                                token: token?.accessToken, // stocke dans closure si besoin
                            },
                        });
                    }

                    if (payload.type === "command" && payload.data?.command === "pick") {
                        onFilesSelected(payload.data?.items || []);
                        port.postMessage({
                            type: "result",
                            id: message.data.id,
                            data: { result: "success" },
                        });
                    }

                    if (payload.type === "command" && payload.data?.command === "close") {
                        // TODO: close the picker
                        console.log("close picker");
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
    };
}

export default useMicrosoftPicker;
