import * as React from "react";
import { type Workspace } from "@/types/workspace";
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
}: {
  children: React.ReactNode;
}) => {
  const initialWorkspace = React.useMemo(() => {
    try {
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("activeWorkspace="))
        ?.split("=")[1];

      if (!cookieValue) return null;

      // Decode the URI component before parsing
      const decodedValue = decodeURIComponent(cookieValue);
      return JSON.parse(decodedValue);
    } catch (error) {
      console.error("Error parsing activeWorkspace cookie:", error);
      return null;
    }
  }, []);

  const [activeWorkspace, setActiveWorkspaceState] =
    React.useState<Workspace | null>(initialWorkspace);
  const { data: user } = useMeQuery();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);

  // Function to update both client state and cookie using react-cookie
  const setActiveWorkspace = React.useCallback((workspace: Workspace) => {
    // Also set the cookie on the client side for immediate effect
    const encodedValue = encodeURIComponent(JSON.stringify(workspace));
    document.cookie = `activeWorkspace=${encodedValue}; path=/; max-age=2147483647; secure${
      import.meta.env.NODE_ENV === "production"
        ? "; domain=.syykick.com; samesite=lax"
        : "; samesite=lax"
    }`;

    setActiveWorkspaceState(workspace);
  }, []);

  // Effect to synchronize with user data and validate/update cookie value
  React.useEffect(() => {
    if (user) {
      // Save user data to local storage
      localStorage.setItem("me", JSON.stringify(user));

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

      // Determine the default workspace: first organization or personal if none exist
      const defaultWorkspace =
        organizationWorkspaces.find((org) => org.type === "organization") ||
        personalWorkspace; // Prefer first org, fallback to personal

      // Check if the current activeWorkspace (from state, initialized from cookie) is valid
      const currentWorkspaceFromState = activeWorkspace; // Capture state variable
      let workspaceToSet: Workspace | null = null;

      if (currentWorkspaceFromState) {
        const updatedWorkspaceData = organizationWorkspaces.find(
          (w) => w.id === currentWorkspaceFromState.id
        );
        if (updatedWorkspaceData) {
          // Workspace from state is valid, use the updated data
          workspaceToSet = updatedWorkspaceData;
        }
      }

      // If no valid workspace found from state, set the default
      if (!workspaceToSet) {
        workspaceToSet = defaultWorkspace;
      }

      // Update the state and cookie only if the workspace is changing
      // Or if the initial state was null (meaning cookie was initially empty/invalid)
      // and we are setting the default
      if (
        workspaceToSet &&
        (workspaceToSet.id !== currentWorkspaceFromState?.id ||
          !currentWorkspaceFromState) // Check if state was initially null
      ) {
        setActiveWorkspace(workspaceToSet);
      } else if (
        workspaceToSet &&
        currentWorkspaceFromState && // Ensure current state is not null before comparing logo
        workspaceToSet.logo !== currentWorkspaceFromState.logo
      ) {
        // Special case: Update if only the logo (presigned URL) changed
        setActiveWorkspace(workspaceToSet);
      }
    }
  }, [user, activeWorkspace, setActiveWorkspace]); // Dependencies remain the same

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
