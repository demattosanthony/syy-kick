"use client";

import { useEffect, useState } from "react";
import { InvitationSection } from "./invitation-section";
import { MembersTable } from "./members-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OrganizationMemberRoleResponse,
  OrgInvitationsResponse,
  OrgMemberResponse,
  TransferableRolesPermissions,
} from "@/features/permissions/types";
import { usePermissions } from "@/features/permissions/context/permissions-context";

export default function MembersManagement({
  orgId,
  availableSeats,
  invitationsList,
  userRole,
  transferablePermissions,
  members,
  userId,
}: {
  orgId: string;
  availableSeats: number;
  invitationsList?: OrgInvitationsResponse;
  userRole?: OrganizationMemberRoleResponse;
  transferablePermissions?: TransferableRolesPermissions;
  members?: OrgMemberResponse;
  userId?: string;
}) {
  const [activeTab, setActiveTab] = useState<"members" | "pending">("members");

  const {
    canReadOrgMembers,
    canCreateOrgMembers,
    canUpdateOrgMembers,
    canDeleteOrgMembers,
    canReadOrgInvitations,
    canCreateOrgInvitations,
    canUpdateOrgInvitations,
    canDeleteOrgInvitations,
  } = usePermissions();

  useEffect(() => {
    if (!canReadOrgMembers) {
      setActiveTab("pending");
    }

    if (!canReadOrgInvitations) {
      setActiveTab("members");
    }
  }, [canReadOrgInvitations, canReadOrgMembers]);

  if (!userRole) {
    return null;
  }

  if (!canReadOrgMembers && !canReadOrgInvitations) {
    return null;
  }

  return (
    <div className="space-y-8">
      {canCreateOrgInvitations && (
        <InvitationSection
          organizationId={orgId}
          transferablePermissions={transferablePermissions}
          availableSeats={availableSeats}
          pendingInvitations={invitationsList?.length ?? 0}
        />
      )}

      <div className="mt-12">
        <Tabs
          value={activeTab}
          defaultValue="members"
          onValueChange={(value) =>
            setActiveTab(value as "members" | "pending")
          }
        >
          <TabsList className="mb-2">
            {canReadOrgMembers && (
              <TabsTrigger value="members">Team members</TabsTrigger>
            )}
            {canReadOrgInvitations && (
              <TabsTrigger value="pending">Pending Invitations</TabsTrigger>
            )}
          </TabsList>

          {canReadOrgMembers && (
            <TabsContent value="members">
              <MembersTable
                type="members"
                userId={userId}
                permissions={{
                  canRead: canReadOrgMembers,
                  canCreate: canCreateOrgMembers,
                  canUpdate: canUpdateOrgMembers,
                  canDelete: canDeleteOrgMembers,
                }}
                data={members}
                orgId={orgId}
                userRole={userRole}
                transferablePermissions={transferablePermissions}
              />
            </TabsContent>
          )}

          {canReadOrgInvitations && (
            <TabsContent value="pending">
              <MembersTable
                type="pending"
                userId={userId}
                permissions={{
                  canRead: canReadOrgInvitations,
                  canCreate: canCreateOrgInvitations,
                  canUpdate: canUpdateOrgInvitations,
                  canDelete: canDeleteOrgInvitations,
                }}
                data={invitationsList}
                orgId={orgId}
                userRole={userRole}
                transferablePermissions={transferablePermissions}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
