"use client";

import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { Workspace } from "@/types/workspace";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const useAuth = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setActiveWorkspace, workspaces } = useWorkspace();

  async function logOut() {
    await api.auth.logout();

    queryClient.invalidateQueries({ queryKey: ["me"] });

    navigate("/");
    window.location.reload();
  }

  const handleGoogleLogin = () => {
    window.location.href = `${
      import.meta.env.VITE_API_URL || "http://localhost:4000"
    }/auth/google`;
  };

  const handleMicrosoftLogin = () => {
    window.location.href = `${
      import.meta.env.VITE_API_URL || "http://localhost:4000"
    }/auth/microsoft`;
  };

  const handleSSOLogin = (slug: string) => {
    window.location.href = `${
      import.meta.env.VITE_API_URL || "http://localhost:4000"
    }/auth/saml/${slug}`;
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

      if (result.alreadyMember) {
        // User is already a member, redirect to home page
        queryClient.invalidateQueries({ queryKey: ["me"] });
        navigate("/");
        return { success: true, alreadyMember: true };
      }

      if (result.error) {
        return result;
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
        const orgWorkspace = workspaces?.find((w) => w.id === orgId);

        if (orgWorkspace) {
          const workspace: Workspace = {
            id: orgWorkspace.id,
            name: orgWorkspace.name,
            type: "organization" as const,
            logo: orgWorkspace.logo,
            subscriptionStatus: orgWorkspace.subscriptionStatus,
            slug: orgWorkspace.slug || "",
            sites: orgWorkspace.sites || [],
          };
          setActiveWorkspace(workspace);
        }

        // Only clear orgId param
        const params = new URLSearchParams(window.location.search);
        params.delete("orgId");
        params.delete("orgJoined");
        const newUrl = `${window.location.pathname}${
          params.toString() ? `?${params.toString()}` : ""
        }`;
        window.history.replaceState({}, "", newUrl);
      }, 1000); // Add 1 second delay
    }
  }, [queryClient]);

  return {
    logOut,
    handleGoogleLogin,
    handleSSOLogin,
    handleJoinOrg,
    handleMicrosoftLogin,
  };
};

export default useAuth;
