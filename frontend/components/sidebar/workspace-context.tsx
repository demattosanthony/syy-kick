"use client";

import * as React from "react";
import { type Workspace } from "@/types/workspace";
import { setActiveWorkspaceCookie } from "@/app/workspace-actions";
import { useMeQuery } from "@/features/user/api";

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
      const personalWorkspace: Workspace = {
        id: user.id,
        name: "Personal",
        logo: user.profilePicture,
        type: "personal",
      };

      const organizationWorkspaces: Workspace[] = (
        user?.organizations || []
      ).map((organization) => ({
        id: organization.id,
        name: organization.name,
        type: "organization" as const,
        logo: organization.logo,
        subscriptionStatus: organization.subscriptionStatus,
      }));

      const allWorkspaces = [personalWorkspace, ...organizationWorkspaces];
      setWorkspaces(allWorkspaces);

      // Update active workspace with fresh data if it exists, otherwise set to personal
      // Need to do this because logo is a presigned URL that expires
      if (activeWorkspace) {
        const updatedWorkspace = allWorkspaces.find(
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
      {children}
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
