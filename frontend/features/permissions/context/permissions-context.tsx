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
  canReadOrgProjectDocs: boolean;
  canCreateOrgProjectDocs: boolean;
  canUpdateOrgProjectDocs: boolean;
  canDeleteOrgProjectDocs: boolean;
  canCreateOrgSites: boolean;
  canUpdateOrgSites: boolean;
  canDeleteOrgSites: boolean;
  canReadOrgSites: boolean;
  canCreateOrgKnowledgeBases: boolean;
  canReadOrgKnowledgeBases: boolean;
  canUpdateOrgKnowledgeBases: boolean;
  canDeleteOrgKnowledgeBases: boolean;
  canCreateOrgKnowledgeBaseDocs: boolean;
  canReadOrgKnowledgeBaseDocs: boolean;
  canUpdateOrgKnowledgeBaseDocs: boolean;
  canDeleteOrgKnowledgeBaseDocs: boolean;
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
    canReadOrgProjectDocs,
    canCreateOrgProjectDocs,
    canUpdateOrgProjectDocs,
    canDeleteOrgProjectDocs,
    canCreateOrgSites,
    canUpdateOrgSites,
    canDeleteOrgSites,
    canReadOrgSites,
    canCreateOrgKnowledgeBases,
    canReadOrgKnowledgeBases,
    canUpdateOrgKnowledgeBases,
    canDeleteOrgKnowledgeBases,
    canCreateOrgKnowledgeBaseDocs,
    canReadOrgKnowledgeBaseDocs,
    canUpdateOrgKnowledgeBaseDocs,
    canDeleteOrgKnowledgeBaseDocs,
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
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
        Permissions.Actions.CREATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
        Permissions.Actions.DELETE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_SITES,
        Permissions.Actions.CREATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_SITES,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_SITES,
        Permissions.Actions.DELETE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_SITES,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
        Permissions.Actions.CREATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
        Permissions.Actions.DELETE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS,
        Permissions.Actions.CREATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS,
        Permissions.Actions.READ
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS,
        Permissions.Actions.UPDATE
      ),
      userPermissions.hasAccess(
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS,
        Permissions.Actions.DELETE
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
        canReadOrgProjectDocs,
        canCreateOrgProjectDocs,
        canUpdateOrgProjectDocs,
        canDeleteOrgProjectDocs,
        canCreateOrgSites,
        canUpdateOrgSites,
        canDeleteOrgSites,
        canReadOrgSites,
        canCreateOrgKnowledgeBases,
        canReadOrgKnowledgeBases,
        canUpdateOrgKnowledgeBases,
        canDeleteOrgKnowledgeBases,
        canCreateOrgKnowledgeBaseDocs,
        canReadOrgKnowledgeBaseDocs,
        canUpdateOrgKnowledgeBaseDocs,
        canDeleteOrgKnowledgeBaseDocs,
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
    return {
      canReadOrg: false,
      canUpdateOrg: false,
      canDeleteOrg: false,
      canReadOrgMembers: false,
      canCreateOrgMembers: false,
      canUpdateOrgMembers: false,
      canDeleteOrgMembers: false,
      canReadOrgInvitations: false,
      canCreateOrgInvitations: false,
      canUpdateOrgInvitations: false,
      canDeleteOrgInvitations: false,
      canCreateOrgProjects: false,
      canUpdateOrgProjects: false,
      canDeleteOrgProjects: false,
      canReadOrgSeats: false,
      canUpdateOrgSeats: false,
      canReadOrgProjectDocs: false,
      canCreateOrgProjectDocs: false,
      canUpdateOrgProjectDocs: false,
      canDeleteOrgProjectDocs: false,
      canCreateOrgSites: false,
      canUpdateOrgSites: false,
      canDeleteOrgSites: false,
      canReadOrgSites: false,
      canCreateOrgKnowledgeBases: false,
      canReadOrgKnowledgeBases: false,
      canUpdateOrgKnowledgeBases: false,
      canDeleteOrgKnowledgeBases: false,
      canCreateOrgKnowledgeBaseDocs: false,
      canReadOrgKnowledgeBaseDocs: false,
      canUpdateOrgKnowledgeBaseDocs: false,
      canDeleteOrgKnowledgeBaseDocs: false,
      isLoading: true,
    };
  }
  return context;
};
