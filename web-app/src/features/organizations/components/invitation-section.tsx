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
import { Loader, Minus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OrgInvitationRequestItem,
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
  availableSeats: number;
  pendingInvitations: number;
};

export function InvitationSection({
  organizationId,
  transferablePermissions,
  availableSeats,
  pendingInvitations,
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

  const invitationsSchema = z
    .object({
      invitations: z.array(
        z.object({
          roleId: z.string().min(1, "Required"),
          email: z.string().min(1, "Required").email("Wrong format"),
        })
      ),
    })
    .refine(
      (data) => data.invitations.length + pendingInvitations <= availableSeats,
      {
        message: "You don't have enough seats available to invite new users.",
        path: ["invitations"],
      }
    );

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    getValues,
    reset,
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
      setInvitations([{ id: "1", email: "", roleId: "" }]);
      reset();
      toast.success("Invitations sent successfully");
    }

    if (isError) {
      toast.error(error?.message);
    }
  }, [isSuccess, isError, error]);

  if (!transferablePermissions) {
    return null;
  }

  const handleAddMore = () => {
    setInvitations((prev) => [
      ...prev,
      { id: Date.now().toString(), email: "", roleId: "" },
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Members</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={handleSubmit(() => {
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
              <div className="w-12">
                {index > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setInvitations((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {/* Add con button to remove an invitation if it's not the first element of array */}
            </div>
          ))}

          {errors.invitations?.root?.message && (
            <p className="text-red-500 text-sm">
              {errors.invitations?.root?.message}
            </p>
          )}

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
