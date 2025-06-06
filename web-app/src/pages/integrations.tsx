import { IntegrationButton } from "@/features/integrations/components/integration-button";
import { useGetIntegrationsQuery } from "@/features/integrations/api/get-integrations";
import { useState } from "react";
import api from "@/lib/api";
import sharepointLogo from "@/assets/logos/sharepoint.svg";

export function IntegrationsPage() {
  const { data: integrations, isLoading, refetch } = useGetIntegrationsQuery();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);

  const handleConnect = async (provider: string) => {
    setIsConnecting(true);
    try {
      if (provider === "microsoft") {
        const redirectUri = encodeURIComponent(window.location.href);
        const userToken = await api.auth.getUploadToken(redirectUri);

        if (!userToken.accessToken) {
          const authUrl = await api.auth.getMicrosoftFilesInit(redirectUri);
          window.location.href = authUrl.url;
          return;
        }

        const { url } = await api.auth.getMicrosoftFilesInit(redirectUri);
        window.location.href = url;

        return;
      }
      // Add other providers here
    } catch (error) {
      console.error("Failed to connect", error);
      // Handle error (e.g., show a notification)
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (provider: string) => {
    setIsDisconnecting(provider);
    try {
      await api.integrations.deleteIntegration(provider);
      refetch();
    } catch (error) {
      console.error("Failed to disconnect", error);
      // Handle error
    } finally {
      setIsDisconnecting(null);
    }
  };

  // Define a static list of available integrations for now
  // This could be fetched from an API in the future
  const availableIntegrations = [
    {
      name: "SharePoint",
      description: "Connect to SharePoint to access your files.",
      logo: sharepointLogo,
      provider: "microsoft",
    },
  ];

  return (
    <div className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Integrations</h1>
      {isLoading && <p>Loading integrations...</p>}
      {!isLoading && (
        <div className="space-y-6">
          {availableIntegrations.map((integration) => {
            const connectedIntegration = integrations?.find(
              (token) =>
                token.provider === integration.provider &&
                token.type === "picker" // Assuming 'picker' type is for file access
            );
            return (
              <IntegrationButton
                key={integration.provider}
                name={integration.name}
                description={integration.description}
                logo={integration.logo}
                isConnected={!!connectedIntegration}
                isLoading={
                  isConnecting || isDisconnecting === integration.provider
                }
                onConnect={() => handleConnect(integration.provider)}
                onDisconnect={() => handleDisconnect(integration.provider)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
