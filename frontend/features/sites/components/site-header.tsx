"use client";

import { SiteDropdownActions } from ".";
import { useMemo } from "react";
import { usePermissions } from "@/features/permissions/context";
import { Site } from "../types/sites";

export default function SiteHeader({ site }: { site: Site }) {
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
          <SiteDropdownActions
            site={site}
            canUpdateOrgSites={canUpdateOrgSites}
            canDeleteOrgSites={canDeleteOrgSites}
          />
        </div>
      </div>
    </div >
  );
}
