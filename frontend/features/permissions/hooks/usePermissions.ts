import { useMemo } from "react";
import {
  OrganizationMemberRoleResponse,
  Permissions,
} from "../types";
import { UserPermissionsFactory } from "../utils";

const usePermissions = (
  userRole: OrganizationMemberRoleResponse | undefined
) => {
  const userPermissions = useMemo(() => {
    return userRole ? UserPermissionsFactory.create(userRole) : null;
  }, [userRole]);

  const [
    canReadOrgMembers,
    canCreateOrgMembers,
    canUpdateOrgMembers,
    canDeleteOrgMembers,
    canReadOrgInvitations,
    canCreateOrgInvitations,
    canUpdateOrgInvitations,
    canDeleteOrgInvitations,
  ] = useMemo(() => {
    if (!userPermissions) {
      return [false, false, false, false, false, false, false, false];
    }
    return [
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
    ];
  }, [userPermissions]);
  
  return {
    canReadOrgMembers,
    canCreateOrgMembers,
    canUpdateOrgMembers,
    canDeleteOrgMembers,
    canReadOrgInvitations,
    canCreateOrgInvitations,
    canUpdateOrgInvitations,
    canDeleteOrgInvitations,
  };
};

export default usePermissions;
