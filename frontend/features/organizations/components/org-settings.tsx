"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import { Input } from "../../../components/ui/input";
import { Camera, Check, Copy, Ellipsis } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
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
import OrgManageSeats from "./org-manage-seats";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  useOrgQuery,
  useOrganizationMembersQuery,
  useDeleteOrganizationMutation,
} from "../api";
import { useMeQuery } from "@/features/user/api";
import { MembersManagement } from "./members-management";
import {
  useGetOrganizationRole,
  useGetOrganizationTransferablePermission,
  useGetOrgInvitationsQuery,
} from "@/features/permissions/api";
import OrganizationInfo from "./organization-info";

const OrganizationSettings = ({ orgId }: { orgId: string }) => {
  const { data: user } = useMeQuery();
  const { data: org } = useOrgQuery(orgId);
  const { data: members } = useOrganizationMembersQuery(orgId);
  const { data: invitationsList } = useGetOrgInvitationsQuery(orgId);
  const { data: userRole } = useGetOrganizationRole(orgId);
  const { data: transferablePermissions } =
    useGetOrganizationTransferablePermission(orgId);

  const deleteOrgMutation = useDeleteOrganizationMutation();

  const [copied, setCopied] = useState(false);

  if (!org) return null;

  return (
    <div className="space-y-6 pb-10 px-2">
      {/* Organization Info Section */}
      <OrganizationInfo org={org} />

      {/* Manage Seats Section */}
      <OrgManageSeats org={org} occupiedSeats={members?.length ?? 0} />

      {/* Members Management Section */}
      <MembersManagement
        orgId={orgId}
        invitationsList={invitationsList}
        userRole={userRole}
        transferablePermissions={transferablePermissions}
        members={members}
        userId={user?.id}
      />
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
            <Button variant="destructive">Delete Organization</Button>
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
