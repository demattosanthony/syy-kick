"use client";

import * as React from "react";
import { type Workspace } from "@/types/workspace";
import { setActiveWorkspaceCookie } from "@/app/workspace-actions";
import { useMeQuery } from "@/features/user/api";
import { PermissionsProvider } from "@/features/permissions/context/permissions-context";

type WorkspaceContextType = {
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace) => void;
  workspaces: Workspace[];
};

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(
  undefined
);

export const WorkspaceProvider = ({
  children,
  initialWorkspace,
}: {
  children: React.ReactNode;
  initialWorkspace?: Workspace | null;
}) => {
  // Check jotai's storage key for existing workspace
  const [activeWorkspace, setActiveWorkspaceState] =
    React.useState<Workspace | null>(() => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("activeWorkspace");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Clean up jotai storage
            localStorage.removeItem("activeWorkspace");
            return parsed;
          } catch {
            return initialWorkspace || null;
          }
        }
      }
      return initialWorkspace || null;
    });
  const { data: user } = useMeQuery();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);

  // Function to update both client state and cookie
  const setActiveWorkspace = React.useCallback((workspace: Workspace) => {
    setActiveWorkspaceCookie(workspace); // Call the server action

    // Also set the cookie on the client side for immediate effect
    document.cookie = `activeWorkspace=${JSON.stringify(
      workspace
    )}; path=/; max-age=2147483647; secure${
      process.env.NODE_ENV === "production"
        ? "; domain=.syyclops.com; samesite=lax"
        : "; samesite=lax"
    }`;

    setActiveWorkspaceState(workspace);
  }, []);

  // Set up workspaces and ensure active workspace is valid
  React.useEffect(() => {
    if (user) {
      const personalOrg = user.organizations.find(
        (org) => org.type === "personal"
      );

      if (!personalOrg) {
        throw new Error("User must have a personal organization");
      }

      const personalWorkspace: Workspace = {
        id: personalOrg.id,
        name: personalOrg.name,
        slug: personalOrg.slug,
        type: "personal",
        logo: personalOrg.logo,
        sites: personalOrg.sites,
      };

      const organizationWorkspaces: Workspace[] = (
        user?.organizations || []
      ).map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        type: organization.type,
        logo: organization.logo,
        subscriptionStatus: organization.subscriptionStatus,
        sites: organization.sites,
      }));

      setWorkspaces(organizationWorkspaces);

      // Update active workspace with fresh data if it exists, otherwise set to personal
      // Need to do this because logo is a presigned URL that expires
      if (activeWorkspace) {
        const updatedWorkspace = organizationWorkspaces.find(
          (w) => w.id === activeWorkspace.id
        );
        if (updatedWorkspace) {
          setActiveWorkspace(updatedWorkspace);
        } else {
          setActiveWorkspace(personalWorkspace);
        }
      } else {
        setActiveWorkspace(personalWorkspace);
      }
    }
  }, [user]); // Depend on user data

  const contextValue = {
    activeWorkspace,
    setActiveWorkspace,
    workspaces,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {activeWorkspace ? (
        <PermissionsProvider orgId={activeWorkspace.id} userId={user?.id}>
          {children}
        </PermissionsProvider>
      ) : (
        <>{children}</>
      )}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = React.useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};
