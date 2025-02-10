import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  useDeleteOrganizationMutation,
  useMeQuery,
  useOrganizationInviteTokenQuery,
  useOrganizationMembersQuery,
  useOrgQuery,
  useRemoveOrganizationMemberMutation,
  useResetOrganizationInviteTokenMutation,
  useUpdateOrganizationMutation,
} from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Input } from "../ui/input";
import { Camera, Check, Copy, Ellipsis } from "lucide-react";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
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
} from "../ui/alert-dialog";
import OrgManageSeats from "./org-manage-seats";

export function OrganizationSettings({ orgId }: { orgId: string }) {
  const { data: user } = useMeQuery();
  const { data: org } = useOrgQuery(orgId);
  const updateOrgMutation = useUpdateOrganizationMutation();
  const { data: members } = useOrganizationMembersQuery(orgId);

  const { data: inviteLinkData } = useOrganizationInviteTokenQuery(orgId);
  const regenerateTokenLinkMutation = useResetOrganizationInviteTokenMutation();
  const removeMemberMutation = useRemoveOrganizationMemberMutation();
  const deleteOrgMutation = useDeleteOrganizationMutation();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (org?.logoUrl) {
      setImagePreview(org.logoUrl);
    }
  }, [org?.logoUrl]);

  if (!org) return null;

  return (
    <div className="space-y-6 pb-10">
      {/* Organization Details Section */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Organization Details</h2>
          <p className="text-sm text-muted-foreground">
            Manage your organization&apos;s profile and settings.
          </p>
        </div>

        <Card className="p-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              let file_key = undefined;
              if (newLogoFile) {
                const file = newLogoFile;
                const { url, file_metadata } =
                  await api.uploads.getPresignedUrl(
                    file.name,
                    file.type,
                    file.size
                  );

                const res = await fetch(url, {
                  method: "PUT",
                  body: file,
                });

                if (!res.ok) {
                  throw new Error("Failed to upload logo");
                }

                file_key = file_metadata.file_key;
              }

              await updateOrgMutation.mutateAsync({
                id: orgId,
                data: {
                  name: formData.get("name") as string,
                  domain: formData.get("domain") as string,
                  ...(file_key && { logo: file_key }),
                },
              });

              toast("Organization updated successfully");
            }}
          >
            <div className="flex items-center gap-4">
              <label className="relative w-20 h-20 rounded-full bg-accent flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-200 transition-colors">
                {imagePreview ? (
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={imagePreview} alt={org.name} />
                    <AvatarFallback className="text-xl">
                      {org.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="text-gray-400">
                    <Camera size={24} />
                  </div>
                )}
                <input
                  type="file"
                  name="logo"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewLogoFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>

              <div className="space-y-4 flex-1">
                <div>
                  <Label className="text-muted-foreground text-sm">Name</Label>
                  <Input name="name" defaultValue={org.name} />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">
                    Domain
                  </Label>
                  <Input name="domain" defaultValue={org.domain} />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Card>
      </section>

      <OrgManageSeats org={org} members={members} />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Invite Link</h2>
          <p className="text-sm text-muted-foreground">
            Share this secret link to invite new members to your organization.
          </p>
        </div>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <Input
              type="text"
              readOnly
              value={`${window.location.origin}/onboarding/orgs/join/${inviteLinkData?.token}`}
              className="w-full border border-gray-300 rounded p-2 mr-2"
            />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/onboarding/orgs/join/${inviteLinkData?.token}`
                );
                setCopied(true);

                setTimeout(() => {
                  setCopied(false);
                }, 2000);
              }}
              size={"icon"}
              variant={"ghost"}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={async () => {
                await regenerateTokenLinkMutation.mutateAsync(orgId);
              }}
              className=" ml-2"
            >
              Regenerate
            </Button>
          </div>
        </Card>
      </section>

      {/* Members Section */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Members</h2>
          <p className="text-sm text-muted-foreground">
            Manage your organization&apos;s members and their roles.
          </p>
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            {members?.map((member) => (
              <div
                key={member.user.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={member.user.profilePicture}
                      alt={member.user.name}
                    />
                    <AvatarFallback>
                      {member.user.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm capitalize">{member.role}</span>
                  {member.user.id !== user?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="flex items-center justify-center"
                          size="sm"
                          variant="ghost"
                        >
                          <Ellipsis size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-red-600"
                              onSelect={(e) => {
                                e.preventDefault();
                              }}
                            >
                              Remove
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove member?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this member from
                                the organization?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  try {
                                    await removeMemberMutation.mutateAsync({
                                      organizationId: orgId,
                                      userId: member.user.id,
                                    });
                                    toast.success(
                                      "Member removed successfully"
                                    );
                                  } catch {
                                    toast.error("Failed to remove member");
                                  }
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove Member
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

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
}
