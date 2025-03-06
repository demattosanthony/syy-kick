import api from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export function useCreateOrganizationMutation() {
  return useMutation({
    mutationFn: (data: {
      name: string;
      domain?: string;
      logo?: string;
      ownerEmail?: string;
      ownerName?: string;
      saml?: {
        entryPoint: string;
        issuer: string;
        cert: string;
        callbackUrl: string;
      };
    }) => api.organizations.createOrganization(data),
  });
}
