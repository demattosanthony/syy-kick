import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Link, Loader, MoreHorizontal, Search } from "lucide-react";
import { useGetRoles } from "@/features/permissions/api/get-roles";
import {
  OrganizationMemberRoleResponse,
  OrgInvitationsResponse,
  OrgMember,
  TransferableRolesPermissions,
} from "@/features/permissions/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { membersTableTranslations } from "@/features/permissions/utils";
import useDeleteOrgInvitationsMutation from "@/features/permissions/api/organizations/delete-org-invitations";
import { toast } from "sonner";
import EditRoleDialog from "./edit-role-dialog";
import useDeleteOrgMembersMutation from "@/features/permissions/api/organizations/delete-org-members";

type MembersTableProps = {
  type: "members" | "pending";
  orgId: string;
  userRole?: OrganizationMemberRoleResponse;
  userId?: string;
  permissions: {
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  data?: OrgInvitationsResponse | OrgMember[];
  transferablePermissions?: TransferableRolesPermissions;
};

type DialogMode = "deleteOne" | "deleteMultiple" | "none";

export function MembersTable({
  type,
  orgId,
  userId,
  permissions,
  data,
  transferablePermissions,
}: MembersTableProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("none");
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [copiedId, setCopiedId] = useState<string>("");

  const { data: roles } = useGetRoles();
  const { mutate: deleteInvitations, isPending: isDeletingInvitations } =
    useDeleteOrgInvitationsMutation();

  const { mutate: deleteOrgMembers, isPending: isDeletingMembers } =
    useDeleteOrgMembersMutation();

  const isDeleting = useMemo(
    () => isDeletingInvitations || isDeletingMembers,
    [isDeletingInvitations, isDeletingMembers]
  );

  const mutationResult = {
    onSuccess: (data: { message: string }) => {
      toast.success(data.message ?? "Success");
    },
    onError: (error: any) => {
      toast.error(
        error.message ?? "Internal server error, please try again later"
      );
    },
    onSettled: () => {
      setSelectedRows([]);
      setDialogOpen(false);
      setDialogMode("none");
    },
  };

  const filteredData = useMemo(() => {
    if (!data) return [];

    return data.filter((member) => {
      const matchesSearch =
        member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole =
        roleFilter === "all" || member.role.name === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [data, searchQuery, roleFilter]);

  const isAllSelected = useMemo(
    () =>
      filteredData.length > 0 && selectedRows.length === filteredData.length,
    [filteredData, selectedRows]
  );

  const higherMemberRoleSelected = useMemo(() => {
    const higherRole = selectedRows.some((rowId) => {
      const member = filteredData.find((member) => member.id === rowId);
      return member?.canDelete === false;
    });

    return higherRole;
  }, [selectedRows, filteredData]);

  if (!roles) return null;

  if (!data) return null;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredData.map((member) => member.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter((rowId) => rowId !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };

  const getInitials = (email: string, name?: string) => {
    if (!name) {
      return email[0].toUpperCase();
    }

    return name?.split(" ").map((n) => n[0]);
  };

  const handleEditRole = (member: OrgMember) => {
    setSelectedMember(member);
    setEditRoleDialogOpen(true);
  };

  const handleDeleteAction = () => {
    if (type === "pending") {
      deleteInvitations(
        {
          organizationId: orgId,
          invitationsIds: selectedRows,
        },
        mutationResult
      );
    }

    if (type === "members") {
      deleteOrgMembers(
        {
          organizationId: orgId,
          membersIds: selectedRows,
        },
        mutationResult
      );
    }
  };

  const openDialog = (mode: DialogMode) => {
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const getDialogContent = () => {
    switch (dialogMode) {
      case "deleteOne":
        return (
          <DialogHeader>
            <DialogTitle style={{ marginBottom: 10 }}>
              {membersTableTranslations[type].deleteRowConfirmation.title}
            </DialogTitle>
            <DialogDescription style={{ marginBottom: 20 }}>
              {membersTableTranslations[type].deleteRowConfirmation.body}
            </DialogDescription>
            <Button
              disabled={isDeleting || higherMemberRoleSelected}
              variant="destructive"
              className="max-w-32 hover:cursor-pointer"
              onClick={handleDeleteAction}
            >
              {isDeleting ? (
                <Loader className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                membersTableTranslations[type].deleteRowConfirmation.confirm
              )}
            </Button>
          </DialogHeader>
        );
      case "deleteMultiple":
        return (
          <DialogHeader>
            <DialogTitle style={{ marginBottom: 10 }}>
              {membersTableTranslations[type].deleteRowsConfirmation.title}
            </DialogTitle>
            <DialogDescription style={{ marginBottom: 20 }}>
              {membersTableTranslations[type].deleteRowsConfirmation.body}
            </DialogDescription>
            <Button
              variant="destructive"
              className="max-w-32 hover:cursor-pointer"
              disabled={isDeleting}
              onClick={handleDeleteAction}
            >
              {isDeleting ? (
                <Loader className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                membersTableTranslations[type].deleteRowsConfirmation.confirm
              )}
            </Button>
          </DialogHeader>
        );
      default:
        return null;
    }
  };

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles?.map((role) => (
              <SelectItem key={role.id} value={role.name}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">
                {selectedRows.length > 0 && permissions.canDelete && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={higherMemberRoleSelected}
                      >
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={higherMemberRoleSelected}
                        className="text-destructive hover:cursor-pointer"
                        onClick={() => openDialog("deleteMultiple")}
                      >
                        {membersTableTranslations[type].deleteRows}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  {membersTableTranslations[type].emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    {member.canUpdate && (
                      <Checkbox
                        checked={selectedRows.includes(member.id)}
                        onCheckedChange={() => toggleSelectRow(member.id)}
                        aria-label={`Select ${member.name}`}
                        disabled={member.id === userId}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={member.profilePicture}
                          alt={member.name}
                        />
                        <AvatarFallback>
                          {getInitials(member.email, member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {member.name} {userId === member.id && "(You)"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {member.role.name}
                    </span>
                  </TableCell>
                  {/** Copy invitation link */}
                  {"link" in member && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(member.link as string)
                            .then(() => {
                              setCopiedId(member.id);
                            });
                          toast.success("Link copied to clipboard");
                        }}
                      >
                        {copiedId === member.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Link className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {member.id !== userId && // The current user is the member row
                      member.canUpdate && // The current user can update the member row
                      (permissions.canUpdate || permissions.canDelete) && ( // The user permissions allow to update or delete the member row
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {type === "members" && permissions.canUpdate && (
                              <DropdownMenuItem
                                className="hover:cursor-pointer"
                                onClick={() => handleEditRole(member)}
                              >
                                {membersTableTranslations[type].editRow}
                              </DropdownMenuItem>
                            )}
                            {permissions.canDelete &&
                              !higherMemberRoleSelected && (
                                <DropdownMenuItem
                                  className="text-destructive hover:cursor-pointer"
                                  onClick={() => {
                                    setSelectedRows([member.id]);
                                    openDialog("deleteOne");
                                  }}
                                >
                                  {membersTableTranslations[type].deleteRow}
                                </DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogMode("none");
        }}
      >
        <DialogContent>{getDialogContent()}</DialogContent>
      </Dialog>

      {selectedMember && (
        <EditRoleDialog
          open={editRoleDialogOpen}
          onOpenChange={(openStatus) => {
            if (!openStatus) {
              setSelectedMember(null);
            }
            setEditRoleDialogOpen(openStatus);
          }}
          member={selectedMember}
          transferablePermissions={transferablePermissions}
          organizationId={orgId}
        />
      )}
    </div>
  );
}
