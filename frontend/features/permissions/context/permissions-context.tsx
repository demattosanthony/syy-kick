import { createContext, useContext, useMemo } from "react";
import { Permissions } from "../types";
import { UserPermissionsFactory } from "../utils";
import { useGetOrganizationRole } from "../api";

type PermissionsContextType = {
  canReadOrg: boolean;
  canUpdateOrg: boolean;
  canDeleteOrg: boolean;
  canReadOrgMembers: boolean;
  canCreateOrgMembers: boolean;
  canUpdateOrgMembers: boolean;
  canDeleteOrgMembers: boolean;
  canReadOrgInvitations: boolean;
  canCreateOrgInvitations: boolean;
  canUpdateOrgInvitations: boolean;
  canDeleteOrgInvitations: boolean;
  canCreateOrgProjects: boolean;
  canUpdateOrgProjects: boolean;
  canDeleteOrgProjects: boolean;
  canReadOrgSeats: boolean;
  canUpdateOrgSeats: boolean;
  isLoading: boolean;
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
);

export const PermissionsProvider = ({
  orgId,
  userId,
  children,
}: {
  orgId: string;
  userId?: string;
  children: React.ReactNode;
}) => {
  const { data: userRole, isLoading } = useGetOrganizationRole(orgId);

  const userPermissions = useMemo(() => {
    return userRole ? UserPermissionsFactory.create(userRole) : null;
  }, [userRole]);

  const [
    canReadOrg,
    canUpdateOrg,
    canDeleteOrg,
    canReadOrgMembers,
    canCreateOrgMembers,
    canUpdateOrgMembers,
    canDeleteOrgMembers,
    canReadOrgInvitations,
    canCreateOrgInvitations,
    canUpdateOrgInvitations,
    canDeleteOrgInvitations,
    canCreateOrgProjects,
    canUpdateOrgProjects,
    canDeleteOrgProjects,
    canReadOrgSeats,
    canUpdateOrgSeats,
  ] = useMemo(() => {
    if (userId === orgId) {
      return [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
      ];
    }

    if (!userPermissions) {
      return [
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ];
    }
    return [
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION,
        Permissions.Actions.DELETE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_MEMBERS,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_MEMBERS,
        Permissions.Actions.CREATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_MEMBERS,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_MEMBERS,
        Permissions.Actions.DELETE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_INVITATIONS,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_INVITATIONS,
        Permissions.Actions.CREATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_INVITATIONS,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_INVITATIONS,
        Permissions.Actions.DELETE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_PROJECTS,
        Permissions.Actions.CREATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_PROJECTS,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_PROJECTS,
        Permissions.Actions.DELETE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_SEATS,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_SEATS,
        Permissions.Actions.UPDATE
      ),
    ];
  }, [userPermissions, userId, orgId]);

  return (
    <PermissionsContext.Provider
      value={{
        canReadOrg,
        canUpdateOrg,
        canDeleteOrg,
        canReadOrgMembers,
        canCreateOrgMembers,
        canUpdateOrgMembers,
        canDeleteOrgMembers,
        canReadOrgInvitations,
        canCreateOrgInvitations,
        canUpdateOrgInvitations,
        canDeleteOrgInvitations,
        canCreateOrgProjects,
        canUpdateOrgProjects,
        canDeleteOrgProjects,
        canReadOrgSeats,
        canUpdateOrgSeats,
        isLoading,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
};
