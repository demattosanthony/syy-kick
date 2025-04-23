"use client";

import { Button } from "../../../components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
  useOrgQuery,
  useOrganizationMembersQuery,
  useDeleteOrganizationMutation,
} from "../api";
import { useMeQuery } from "@/features/user/api";
import {
  useGetOrganizationRole,
  useGetOrganizationTransferablePermission,
  useGetOrgInvitationsQuery,
} from "@/features/permissions/api";
import OrganizationInfo from "./organization-info";
import OrgManageSeats from "./org-manage-seats";
import MembersManagement from "./members-management";
import { usePermissions } from "@/features/permissions/context";
import AccessLogs from "./access-logs";
import { Permissions } from "@/types/permissions";
import { AccessLogStatus } from "../types/access-logs";

const OrganizationSettings = ({ orgId }: { orgId: string }) => {
  const { data: user } = useMeQuery();
  const { data: org } = useOrgQuery(orgId);
  const { data: members } = useOrganizationMembersQuery(orgId);
  const { data: invitationsList } = useGetOrgInvitationsQuery(orgId);
  const { data: userRole } = useGetOrganizationRole(orgId);
  const { data: transferablePermissions } =
    useGetOrganizationTransferablePermission(orgId);

  const deleteOrgMutation = useDeleteOrganizationMutation();

  const { canReadOrgSeats, canDeleteOrg, canReadOrgAccessLogs } = usePermissions();

  if (!org) return null;

  return (
    <div className="space-y-6 pb-10 px-2">
      {/* Organization Info Section */}
      <OrganizationInfo org={org} />

      {/* Manage Seats Section */}

      {canReadOrgSeats && (
        <OrgManageSeats org={org} occupiedSeats={members?.length ?? 0} />
      )}

      {/* Members Management Section */}
      <MembersManagement
        orgId={orgId}
        invitationsList={invitationsList}
        userRole={userRole}
        transferablePermissions={transferablePermissions}
        members={members}
        userId={user?.id}
        availableSeats={org.seats - (members?.length ?? 1)}
      />

      {/* Access Logs Section */}
      {canReadOrgAccessLogs && user && (
        <AccessLogs
          organizationId={orgId}
          resources={Object.entries(Permissions.Resources).filter(([_, value]) => value !== Permissions.Resources.ORGANIZATION_ACCESS_LOGS)}
          actions={Object.entries(Permissions.Actions)}
          status={Object.entries(AccessLogStatus)}
          user={user}
        />
      )}

      {/* Danger Zone Section */}
      <section className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Delete your organization and all its data permanently.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!canDeleteOrg} variant="destructive">
              Delete Organization
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                organization and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await deleteOrgMutation.mutateAsync(orgId);
                    toast.success("Organization deleted successfully");

                    // Redirect to home
                    window.location.href = "/";
                  } catch {
                    toast.error("Failed to delete organization");
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Organization
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
};

export default OrganizationSettings;
