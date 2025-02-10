"use client";

import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { Workspace } from "@/types/workspace";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export const useAuth = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setActiveWorkspace } = useWorkspace();

  async function logOut() {
    await api.auth.logout();

    queryClient.invalidateQueries({ queryKey: ["me"] });

    router.push("/");
    window.location.reload();
  }

  const handleGoogleLogin = () => {
    router.push(`${
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
    }/auth/google 
    `);
  };

  const handleSSOLogin = (slug: string) => {
    router.push(`${
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
    }/auth/saml/${slug}
    `);
  };

  const handleJoinOrg = async (token: string) => {
    try {
      const result = await api.auth.joinWithInvite(token);

      if (result.insufficientSeats) {
        return { insufficientSeats: true };
      }

      if (result.inactiveSubscription) {
        return { inactiveSubscription: true };
      }

      if (result.requiresAuth) {
        return { requiresAuth: true };
      }

      // Success case
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      return { success: true };
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const orgId = params.get("orgId");

    if (error === "unauthorized") {
      toast("You do not have access", {
        description: "This app is whitelist only for now.",
      });
    }

    if (orgId) {
      // Find the org workspace and set it as active
      setTimeout(async () => {
        const workspaces = queryClient.getQueryData<any>([
          "me",
        ])?.organizationMembers;
        const orgWorkspace = workspaces?.find(
          (w: any) => w.organization.id === orgId
        );

        if (orgWorkspace) {
          const workspace: Workspace = {
            id: orgWorkspace.organization.id,
            name: orgWorkspace.organization.name,
            type: "organization" as const,
            logo: orgWorkspace.organization.logo,
            subscriptionStatus: orgWorkspace.organization.subscriptionStatus,
          };
          setActiveWorkspace(workspace);
        }

        // Only clear orgId param
        const params = new URLSearchParams(window.location.search);
        params.delete("orgId");
        const newUrl = `${window.location.pathname}${
          params.toString() ? `?${params.toString()}` : ""
        }`;
        window.history.replaceState({}, "", newUrl);
      }, 1000); // Add 1 second delay
    }
  }, [queryClient]);

  return { logOut, handleGoogleLogin, handleSSOLogin, handleJoinOrg };
};
