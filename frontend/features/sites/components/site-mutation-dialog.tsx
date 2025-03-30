"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LocationSearch } from "@/features/projects/components";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Site, MutationSiteData } from "../types/sites";
import { useCreateSiteMutation, useUpdateSiteMutation } from "../api";
import { PropagationStopper } from "@/components/propagation-stopper";

interface CreateSiteDialogProps {
  mode?: "create" | "update";
  site?: Site;
  organizationId?: string;
  onUpdate?: () => void;
  showDialog: boolean;
  setShowDialog: (showDialog: boolean) => void;
}

export default function SiteMutationDialog({
  mode,
  site,
  organizationId,
  onUpdate,
  showDialog,
  setShowDialog,
}: CreateSiteDialogProps) {
  const [formData, setFormData] = useState<MutationSiteData>({
    name: "",
    description: null,
    type: "organization",
    address: {
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    },
  });

  const {
    mutate: createSite,
    isSuccess: isCreateSuccess,
    data: creationData,
    isError: isCreateError,
    error: creationError,
    isPending: isCreating,
  } = useCreateSiteMutation();

  const {
    mutate: updateSite,
    isSuccess: isUpdateSuccess,
    data: updateData,
    isError: isUpdateError,
    error: updateError,
    isPending: isUpdating,
  } = useUpdateSiteMutation();

  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name,
        description: site.description || "",
        type: organizationId ? "organization" : "personal",
        address: {
          address: site.address.address,
          city: site.address.city,
          state: site.address.state,
          country: site.address.country,
          postalCode: site.address.postalCode,
          placeId: site.address.placeId,
          latitude: site.address.latitude,
          longitude: site.address.longitude,
        },
      });
    }
  }, [site]);

  useEffect(() => {
    if ((isCreateSuccess && creationData) || (isUpdateSuccess && updateData)) {
      const siteResult = creationData || updateData;

      if (!siteResult) {
        return;
      }

      toast.success(siteResult.message);

      setShowDialog(false);
    }

    if ((isCreateError && creationError) || (isUpdateError && updateError)) {
      const error = creationError || updateError;

      if (!error) {
        return;
      }

      toast.error(error.message);
    }

    if (isUpdateSuccess && onUpdate) {
      onUpdate();
    }

  }, [
    isCreateSuccess,
    isCreateError,
    creationData,
    creationError,
    isUpdateSuccess,
    isUpdateError,
    updateData,
    updateError,
  ]);

  const submitButtonLabel = useMemo(() => {
    if (mode === "create") {
      if (isCreating) {
        return "Creating Site...";
      }

      return "Create Site";
    }

    if (isUpdating) {
      return "Updating Site...";
    }

    return "Update Site";
  }, [mode, isCreating, isUpdating]);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="max-w-lg">
        <PropagationStopper>
          <DialogHeader>
            <DialogTitle>{
              mode === "create" ?
                "Create a new Site"
                : "Update your site"
            }</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              e.stopPropagation();
              if (mode === "create") {
                createSite({
                  ...formData,
                  organizationId,
                  type: organizationId ? "organization" : "personal",
                });
              } else {
                if (site) {
                  updateSite({ siteId: site.id, data: formData });
                }
              }
            }}
            className="space-y-4 max-w-[460px]"
          >
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Site name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <LocationSearch
                value={formData.address}
                onChange={(locationData) => {
                  setFormData((prev) => ({
                    ...prev,
                    address: {
                      address: locationData.address || "",
                      city: locationData.city || "",
                      state: locationData.state || "",
                      country: locationData.country || "",
                      postalCode: locationData.postalCode || "",
                      placeId: locationData.placeId,
                      latitude: locationData.latitude,
                      longitude: locationData.longitude,
                    },
                  }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Site description"
                value={formData.description ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isCreating || isUpdating} onClick={(e) => {
                e.stopPropagation();
              }}>
                {submitButtonLabel}
              </Button>
            </DialogFooter>
          </form>
        </PropagationStopper>
      </DialogContent>
    </Dialog>
  );
}
