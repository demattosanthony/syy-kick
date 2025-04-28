import { useMemo } from "react";
import { Site } from "../types/sites";
import { MapPin } from "lucide-react";

export default function SiteHeader({ site }: { site: Site }) {
  const mapUrl = useMemo(() => {
    if (!site.latitude || !site.longitude) {
      return undefined;
    }

    return `https://maps.googleapis.com/maps/api/staticmap?center=${
      site.latitude
    },${site.longitude}&zoom=17&size=400x200&maptype=satellite&key=${
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    }`;
  }, [site]);

  if (!site) {
    return null;
  }

  return (
    <div className="relative h-[160px] w-full bg-muted rounded-lg overflow-hidden">
      {mapUrl && (
        <img
          src={mapUrl}
          alt={site.address}
          className="object-cover w-full h-full"
          loading="lazy"
        />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"></div>
      <div className="absolute inset-0 flex items-start justify-between">
        <div className="relative flex flex-1 items-center justify-start p-4 gap-2">
          <MapPin color="white" className="w-4 h-4 text-muted-foreground" />
          <p className="text-xl font-bold text-white">
            {site.address} {site.city}, {site.state} {site.postalCode},{" "}
            {site.country}
          </p>
        </div>
      </div>
    </div>
  );
}
