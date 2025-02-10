import api from "@/lib/api";
import { useUpdateOrganizationMutation } from "@/queries/queries";
import { Organization } from "@/types/user";
import { useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Camera,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import {
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  DialogHeader,
  DialogFooter,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import Image from "next/image";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

export default function OrganizationCard({
  org,
  onDelete,
  showSamlSettings = false, // Add new prop with default value
}: {
  org: Organization;
  onDelete: (orgId: string) => void;
  showSamlSettings?: boolean; // Add to type definition
}) {
  const [open, setOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(
    org.logoUrl || null
  );
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);

  const queryClient = useQueryClient();
  const updateOrgMutation = useUpdateOrganizationMutation();

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 text-xs">
            <AvatarImage src={org.logoUrl} alt={org.name} />
            <AvatarFallback>
              {org.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div>
            <h3 className="font-medium">{org.name}</h3>
            <p className="text-sm text-muted-foreground">{org.domain}</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={(newOpen) => setOpen(newOpen)}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DialogTrigger asChild>
                <DropdownMenuItem>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </DropdownMenuItem>
              </DialogTrigger>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-red-600 hover:text-red-700"
                    onSelect={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the organization and all
                      associated data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(org.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete Organization
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);

                // If new logo is uploaded, need to store it in s3 first
                let file_key = undefined;
                if (newLogoFile) {
                  const file = formData.get("logo") as File;
                  // Store file in s3
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

                updateOrgMutation.mutate(
                  {
                    id: org.id,
                    data: {
                      name: formData.get("name") as string,
                      domain: formData.get("domain") as string,
                      ...(file_key && { logo: file_key }),
                      saml: {
                        ...(formData.get("entryPoint") && {
                          entryPoint: formData.get("entryPoint") as string,
                        }),
                        ...(formData.get("issuer") && {
                          issuer: formData.get("issuer") as string,
                        }),
                        ...(formData.get("cert") && {
                          cert: formData.get("cert") as string,
                        }),
                      },
                    },
                  },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({
                        queryKey: ["organizations"],
                      });
                      setOpen(false);
                    },
                  }
                );
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <label className="relative w-14 h-14 rounded-full bg-accent flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-200 transition-colors">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Organization logo"
                        fill
                        className="object-cover"
                      />
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={org.name} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input id="domain" name="domain" defaultValue={org.domain} />
                </div>

                {showSamlSettings && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between"
                      >
                        Advanced Settings
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="entryPoint">SAML Entry Point</Label>
                        <Input
                          id="entryPoint"
                          name="entryPoint"
                          defaultValue={org.samlConfig?.entryPoint}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="issuer">SAML Issuer</Label>
                        <Input
                          id="issuer"
                          name="issuer"
                          defaultValue={org.samlConfig?.issuer}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cert">SAML Certificate</Label>
                        <Textarea
                          id="cert"
                          name="cert"
                          defaultValue={org.samlConfig?.cert}
                          className="h-[100px]"
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
