import { useCallback } from "react";

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
    const openPicker = useCallback(() => {
        const width = 600;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2.5;

        const popup = window.open(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft-files`,
            "Microsoft File Picker",
            `width=${width},height=${height},top=${top},left=${left}`
        );

        if (!popup) return;

        const interval = setInterval(() => {
            if (popup.closed) {
                clearInterval(interval);
                console.log("Popup fermée sans réponse");
            }
        }, 1000);

        window.addEventListener("message", async (event) => {
            if (event.origin !== window.origin) return;

            const { accessToken } = event.data;
            if (accessToken && window.OneDrive) {
                console.log("Token reçu:", accessToken);

                window.OneDrive.open({
                    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID,
                    action: "query",
                    multiSelect: true,
                    advanced: {
                        accessToken,
                        redirectUri: window.location.origin + "/",
                    },
                    success: (files: any) => {
                        console.log("Fichiers sélectionnés:", files);
                    },
                    cancel: () => {
                        console.log("Sélection annulée");
                    },
                    error: (e: any) => {
                        console.error("Erreur lors du File Picker:", e);
                    },
                });
            }
        });
    }, []);

    return {
        openPicker,
    };
}

export default useMicrosoftPicker;
