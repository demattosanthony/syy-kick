import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
