import * as React from "react";
import { type Workspace } from "@/types/workspace";
import { useMeQuery } from "@/features/user/api";
import { PermissionsProvider } from "@/features/permissions/context/permissions-context";

// Helper function to get workspace from cookie
// This should only run client-side
function getActiveWorkspaceFromCookie(): Workspace | null {
  if (typeof document === "undefined") {
    return null; // Return null on server-side
  }
  const cookies = document.cookie.split("; ");
  const workspaceCookie = cookies.find((row) =>
    row.startsWith("activeWorkspace=")
  );
  if (!workspaceCookie) {
    return null;
  }
  try {
    return JSON.parse(decodeURIComponent(workspaceCookie.split("=")[1]));
  } catch (error) {
    console.error("Error parsing workspace cookie:", error);
    // Optionally clear the invalid cookie
    document.cookie =
      "activeWorkspace=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    return null;
  }
}

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
}: // initialWorkspace is no longer needed here
{
  children: React.ReactNode;
  // initialWorkspace?: Workspace | null; // Removed prop
}) => {
  // Initialize state lazily from cookie on client-side
  const [activeWorkspace, setActiveWorkspaceState] =
    React.useState<Workspace | null>(() => getActiveWorkspaceFromCookie());
  const { data: user } = useMeQuery();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);

  // Function to update both client state and cookie
  const setActiveWorkspace = React.useCallback((workspace: Workspace) => {
    // Also set the cookie on the client side for immediate effect
    // Encode the JSON string before storing it in the cookie
    const encodedWorkspace = encodeURIComponent(JSON.stringify(workspace));
    document.cookie = `activeWorkspace=${encodedWorkspace}; path=/; max-age=2147483647; secure${
      process.env.NODE_ENV === "production"
        ? "; domain=.syykick.com; samesite=lax"
        : "; samesite=lax"
    }`;

    setActiveWorkspaceState(workspace);
  }, []);

  // Effect to synchronize with user data and validate/update cookie value
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

      // Determine the default workspace: first organization or personal if none exist
      const defaultWorkspace =
        organizationWorkspaces.find((org) => org.type === "organization") ||
        personalWorkspace; // Prefer first org, fallback to personal

      // Check if the current activeWorkspace (potentially from cookie) is valid
      const currentWorkspaceFromState = activeWorkspace; // Capture state variable
      let workspaceToSet: Workspace | null = null;

      if (currentWorkspaceFromState) {
        const updatedWorkspaceData = organizationWorkspaces.find(
          (w) => w.id === currentWorkspaceFromState.id
        );
        if (updatedWorkspaceData) {
          // Workspace from cookie/state is valid, use the updated data
          workspaceToSet = updatedWorkspaceData;
        }
      }

      // If no valid workspace found from state/cookie, set the default
      if (!workspaceToSet) {
        workspaceToSet = defaultWorkspace;
      }

      // Update the state and cookie only if the workspace is changing
      // Or if the initial state was null and we are setting the default
      if (
        workspaceToSet &&
        (workspaceToSet.id !== currentWorkspaceFromState?.id ||
          !currentWorkspaceFromState) // Add check for initial null state
      ) {
        setActiveWorkspace(workspaceToSet);
      } else if (
        workspaceToSet &&
        workspaceToSet.logo !== currentWorkspaceFromState?.logo
      ) {
        // Special case: Update if only the logo (presigned URL) changed
        setActiveWorkspace(workspaceToSet);
      }
    }
  }, [user, activeWorkspace, setActiveWorkspace]); // Add activeWorkspace and setActiveWorkspace dependencies

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
