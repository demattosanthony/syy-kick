"use client";

import * as React from "react";
import { type Workspace } from "@/types/workspace";
import { useMeQuery } from "@/queries/queries";
import { atomWithStorage } from "jotai/utils";
import { useAtom } from "jotai";

type WorkspaceContextType = {
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace) => void;
  workspaces: Workspace[];
};

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(
  undefined
);

const activeWorkspaceAtom = atomWithStorage<Workspace | null>(
  "activeWorkspace",
  null
);

export const WorkspaceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [activeWorkspace, setActiveWorkspace] = useAtom(activeWorkspaceAtom);
  const { data: user } = useMeQuery();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);

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
        user?.organizationMembers || []
      ).map((member) => ({
        id: member.organization.id,
        name: member.organization.name,
        type: "organization" as const,
        logo: member.organization.logo,
        subscriptionStatus: member.organization.subscriptionStatus,
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
