"use client";

import { Button } from "@/components/ui/button";
import { SiteDeleteDialog, SiteMutationDialog } from ".";
import { useMemo } from "react";
import { EllipsisVertical, Trash, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/features/permissions/context";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Site } from "../types/sites";

export default function SiteHeader({ site }: { site: Site }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const { canDeleteOrgSites, canUpdateOrgSites } = usePermissions();

  const mapUrl = useMemo(() => {
    if (!site) {
      return undefined;
    }

    return `https://maps.googleapis.com/maps/api/staticmap?center=${site.address.latitude},${site.address.longitude}&zoom=17&size=400x200&maptype=satellite&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
  }, [site]);

  if (!site) {
    return null;
  }

  return (
    <div className="relative h-[160px] w-full bg-muted rounded-lg overflow-hidden">
      <img
        src={mapUrl}
        alt={site.name}
        className="object-cover w-full h-full"
        loading="lazy"
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"></div>
      <div className="absolute inset-0 flex items-start justify-between">
        <div className="relative flex flex-1 flex-col items-start justify-start p-4">
          <p className="text-xl font-bold text-muted-foreground text-white">
            {site.name}
          </p>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-muted-foreground text-white">
              {site.address.address}
            </p>
            <p className="text-sm font-medium text-muted-foreground text-white">
              {site.address.city}, {site.address.state}{" "}
              {site.address.postalCode}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end justify-end p-4">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="text-primary">
                <EllipsisVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <SiteMutationDialog
                trigger={
                  <DropdownMenuItem
                    disabled={!canUpdateOrgSites}
                    onSelect={(e) => e.preventDefault()}
                    className="hover:cursor-pointer"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Update
                  </DropdownMenuItem>
                }
                onUpdate={() => {
                  router.refresh();
                }}
                mode="update"
                site={site}
                organizationId={site.organizationId}
              />
              <DropdownMenuItem
                disabled={!canDeleteOrgSites}
                onSelect={() => setShowDeleteDialog(true)}
                className="text-destructive hover:cursor-pointer"
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SiteDeleteDialog
            showDeleteDialog={showDeleteDialog}
            setShowDeleteDialog={setShowDeleteDialog}
            site={site}
          />
        </div>
      </div>
    </div>
  );
}
