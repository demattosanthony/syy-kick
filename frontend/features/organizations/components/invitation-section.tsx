"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OrgInvitationRequestItem,
  OrgInvitationsRequest,
  TransferableRolesPermissions,
} from "@/features/permissions/types";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateOrgInvitationsMutation } from "@/features/permissions/api";
import { toast } from "sonner";

type InvitationRow = OrgInvitationRequestItem & { id: string };

type InvitationSectionProps = {
  organizationId: string;
  transferablePermissions?: TransferableRolesPermissions;
};

export function InvitationSection({
  organizationId,
  transferablePermissions,
}: InvitationSectionProps) {
  const [invitations, setInvitations] = useState<InvitationRow[]>([
    { id: "1", email: "", roleId: "" },
  ]);

  const roles = useMemo(() => {
    if (!transferablePermissions) return [];
    return transferablePermissions.map((role) => ({
      id: role.id,
      name: role.name,
    }));
  }, [transferablePermissions]);

  const invitationsSchema = z.object({
    invitations: z.array(
      z.object({
        roleId: z.string().min(1, "Required"),
        email: z.string().min(1, "Required").email("Wrong format"),
      })
    ),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    getValues,
  } = useForm({
    resolver: zodResolver(invitationsSchema),
    defaultValues: {
      invitations: invitations,
    },
  });

  const {
    mutate: inviteUsers,
    isPending,
    isSuccess,
    isError,
    error,
  } = useCreateOrgInvitationsMutation();

  useEffect(() => {
    if (isSuccess) {
      console.log('---- on if success ----')
      setInvitations([{ id: "1", email: "", roleId: "" }]);
      toast.success("Invitations sent successfully");
    }

    if (isError) {
      toast.error(error?.message);
    }
  }, [isSuccess, isError, error]);

  if (!transferablePermissions) {
    return null;
  }

  const inviteLink = "https://org.example.com/join/abc123def456";

  const handleAddMore = () => {
    setInvitations((prev) => [
      ...prev,
      { id: Date.now().toString(), email: "", roleId: "" },
    ]);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Members</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((data) => {
            inviteUsers({
              organizationId,
              data: getValues("invitations"),
            });
          })}
        >
          {invitations.map((invitation, index) => (
            <div
              key={invitation.id}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="flex-1">
                <Input
                  placeholder="Email address"
                  {...register(`invitations.${index}.email`)}
                />
                {errors.invitations?.[index]?.email && (
                  <p className="text-red-500 text-sm">
                    {errors.invitations[index]?.email?.message}
                  </p>
                )}
              </div>
              <div className="w-full sm:w-[180px]">
                <Controller
                  control={control}
                  name={`invitations.${index}.roleId`}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) =>
                        setValue(`invitations.${index}.roleId`, value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.invitations?.[index]?.roleId && (
                  <p className="text-red-500 text-sm">
                    {errors.invitations[index]?.roleId?.message}
                  </p>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="mt-2"
            type="button"
            onClick={handleAddMore}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add more
          </Button>

          <div className="flex justify-end mt-6">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                "Invite"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
