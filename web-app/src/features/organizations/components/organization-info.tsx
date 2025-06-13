"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useUpdateOrganizationMutation } from "../api";
import api from "@/lib/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Organization } from "@/types/user";

export default function OrganizationInfo({ org }: { org?: Organization }) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);

  const { mutate: updateOrg } = useUpdateOrganizationMutation();

  useEffect(() => {
    if (!org) {
      return;
    }

    if (org.logoUrl) {
      setImagePreview(org.logoUrl);
    }
  }, [org]);

  if (!org) {
    return null;
  }

  return (
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
              const { uploadUrl, fileKey } =
                await api.uploads.getPresignedUrlForOrganization(
                  file.name,
                  file.type,
                  file.size
                );

              const res = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
              });

              if (!res.ok) {
                throw new Error("Failed to upload logo");
              }

              file_key = fileKey;
            }

            updateOrg({
              id: org.id,
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
                <Label className="text-muted-foreground text-sm">Domain</Label>
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
  );
}
