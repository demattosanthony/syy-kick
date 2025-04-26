import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, MapPin, MapPinIcon, Plus } from "lucide-react";
import { useLoadScript, Libraries } from "@react-google-maps/api";
import { Site } from "@/features/sites/types/sites";
import useInfiniteGetSitesQuery from "@/features/sites/api/get-sites";
import { Skeleton } from "@/components/ui/skeleton";
import useDebounce from "@/hooks/use-debounce";

const libraries: Libraries = ["places"];

type LocationData = {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

type LocationSearchProps = {
  value: LocationData;
  onChange: (value: LocationData) => void;
  site?: Site;
  onSiteSelect?: (site: Site) => void;
};

const LocationSearch = ({
  value,
  onChange,
  site,
  onSiteSelect,
}: LocationSearchProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualLocation, setManualLocation] = useState<LocationData>({
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    placeId: undefined,
    latitude: undefined,
    longitude: undefined,
  });

  const [showSites, setShowSites] = useState(false);
  const autocompleteService =
    useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries,
  });

  useEffect(() => {
    if (isLoaded && !autocompleteService.current) {
      autocompleteService.current =
        new google.maps.places.AutocompleteService();
    }

    if (isLoaded && !placesService.current && mapRef.current) {
      // We need a DOM element to create the PlacesService
      placesService.current = new google.maps.places.PlacesService(
        mapRef.current
      );
    }
  }, [isLoaded]);

  useEffect(() => {
    // Set input field to display the current address if available
    if (value.address && input === "") {
      setInput(value.address);
    }
  }, [value?.address]);

  useEffect(() => {
    // Initialize manual location with current values when toggling to manual entry
    if (showManualEntry) {
      setManualLocation({
        address: value.address || "",
        city: value.city || "",
        state: value.state || "",
        country: value.country || "",
        postalCode: value.postalCode || "",
        placeId: value.placeId,
        latitude: value.latitude,
        longitude: value.longitude,
      });
    }
  }, [showManualEntry, value]);

  const handleInputChange = (query: string) => {
    setInput(query);

    if (query.length > 2 && autocompleteService.current) {
      autocompleteService.current.getPlacePredictions(
        { input: query },
        (predictions, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions
          ) {
            setPredictions([]);
            return;
          }
          setPredictions(predictions);
        }
      );
    } else {
      setPredictions([]);
    }
  };

  const handleManualChange = (
    field: keyof LocationData,
    fieldValue: string
  ) => {
    setManualLocation((prev) => ({
      ...prev,
      [field]: fieldValue,
    }));
  };

  const saveManualEntry = () => {
    onChange(manualLocation);
    setOpen(false);
    setShowManualEntry(false);

    // Update the display value in the input field
    const displayAddress =
      manualLocation.address +
      (manualLocation.city ? `, ${manualLocation.city}` : "") +
      (manualLocation.state ? `, ${manualLocation.state}` : "") +
      (manualLocation.postalCode ? ` ${manualLocation.postalCode}` : "");

    setInput(displayAddress);
  };

  const handleSelectPlace = (placeId: string) => {
    if (!placesService.current) return;

    placesService.current.getDetails(
      {
        placeId,
        fields: ["address_component", "formatted_address", "geometry"],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place)
          return;

        // Extract the street address only, not the full formatted address
        let streetAddress = "";
        place.address_components?.forEach((component) => {
          const types = component.types;

          // Street number
          if (types.includes("street_number")) {
            streetAddress = component.long_name;
          }

          // Street name - append to street number
          if (types.includes("route")) {
            streetAddress = streetAddress
              ? `${streetAddress} ${component.long_name}`
              : component.long_name;
          }
        });

        const locationData: Partial<LocationData> = {
          // Use the extracted street address instead of the full formatted address
          placeId: placeId,
          address: streetAddress,
          latitude: place.geometry?.location?.lat(),
          longitude: place.geometry?.location?.lng(),
        };

        // Extract other address components
        place.address_components?.forEach((component) => {
          const types = component.types;

          if (types.includes("locality")) {
            locationData.city = component.long_name;
          } else if (types.includes("administrative_area_level_1")) {
            locationData.state = component.long_name;
          } else if (types.includes("country")) {
            locationData.country = component.long_name;
          } else if (types.includes("postal_code")) {
            locationData.postalCode = component.long_name;
          }
        });

        onChange(locationData as LocationData);
        // Still display the full formatted address in the input field for user convenience
        setInput(place.formatted_address || "");
        setOpen(false);
      }
    );
  };

  const handleSelectSite = useCallback(
    (site: Site) => {
      onSiteSelect?.(site);
      setOpen(false);
    },
    [onSiteSelect]
  );

  const displayValue = useMemo(() => {
    if (site) {
      return `${site.address}, ${site.city}, ${site.state}, ${site.postalCode}`;
    }

    return value.address
      ? value.address +
          (value.city ? `, ${value.city}` : "") +
          (value.state ? `, ${value.state}` : "") +
          (value.postalCode ? `, ${value.postalCode}` : "")
      : "";
  }, [site, value]);

  return (
    <div className="flex flex-col w-full maxm-w-full">
      {/* Hidden div for PlacesService */}
      <div ref={mapRef} style={{ display: "none" }}></div>

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full text-left"
          >
            <div className="flex items-center w-full overflow-hidden">
              <MapPin className="mr-2 h-4 w-4 shrink-0" />
              {displayValue ? (
                <span className="truncate">{displayValue}</span>
              ) : (
                <span className="text-muted-foreground font-normal">
                  Search for a location...
                </span>
              )}
            </div>
          </Button>
        </PopoverTrigger>

        {/* Sites selection */}
        {showSites && (
          <PopoverContent
            className="p-0 overflow-visible w-[400px] pointer-events-auto"
            align="start"
          >
            <SitesLocationSearch
              value={site?.id || null}
              onSelect={handleSelectSite}
              onGoBack={() => setShowSites(false)}
            />
          </PopoverContent>
        )}

        {/* Manual entry */}
        {showManualEntry && (
          <PopoverContent
            className="p-0 overflow-visible w-[400px] pointer-events-auto"
            align="start"
          >
            <div className="p-4 space-y-3">
              <h3 className="font-medium">Manual Location Entry</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <input
                  className="w-full p-2 border rounded-md text-sm"
                  value={manualLocation.address}
                  onChange={(e) =>
                    handleManualChange("address", e.target.value)
                  }
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <input
                    className="w-full p-2 border rounded-md text-sm"
                    value={manualLocation.city}
                    onChange={(e) => handleManualChange("city", e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State/Province</label>
                  <input
                    className="w-full p-2 border rounded-md text-sm"
                    value={manualLocation.state}
                    onChange={(e) =>
                      handleManualChange("state", e.target.value)
                    }
                    placeholder="State/Province"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Postal Code</label>
                  <input
                    className="w-full p-2 border rounded-md text-sm"
                    value={manualLocation.postalCode}
                    onChange={(e) =>
                      handleManualChange("postalCode", e.target.value)
                    }
                    placeholder="Postal code"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <input
                    className="w-full p-2 border rounded-md text-sm"
                    value={manualLocation.country}
                    onChange={(e) =>
                      handleManualChange("country", e.target.value)
                    }
                    placeholder="Country"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Latitude (optional)
                  </label>
                  <input
                    className="w-full p-2 border rounded-md text-sm"
                    value={manualLocation.latitude}
                    onChange={(e) =>
                      handleManualChange("latitude", e.target.value)
                    }
                    placeholder="Latitude"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Longitude (optional)
                  </label>
                  <input
                    className="w-full p-2 border rounded-md text-sm"
                    value={manualLocation.longitude}
                    onChange={(e) =>
                      handleManualChange("longitude", e.target.value)
                    }
                    placeholder="Longitude"
                  />
                </div>
              </div>
              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManualEntry(false)}
                >
                  Back to Search
                </Button>
                <Button size="sm" onClick={saveManualEntry}>
                  Save Location
                </Button>
              </div>
            </div>
          </PopoverContent>
        )}

        {/* Search address */}
        {!showSites && !showManualEntry && (
          <PopoverContent
            className="p-0 overflow-visible w-[400px] pointer-events-auto"
            align="start"
          >
            <Command className="pointer-events-auto">
              <CommandInput
                placeholder="Search for address..."
                className="pointer-events-auto"
                value={input}
                onValueChange={handleInputChange}
                disabled={!isLoaded}
              />
              <CommandList>
                <CommandEmpty>
                  <div className="py-2 px-4 text-center">
                    <p>No results found.</p>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {predictions.map((prediction) => (
                    <CommandItem
                      key={prediction.place_id}
                      value={prediction.description}
                      onSelect={() => handleSelectPlace(prediction.place_id)}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      <span>{prediction.description}</span>
                      {prediction.description === displayValue && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <div className="border-t p-2 text-center flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2 py-2"
                    onClick={() => setShowManualEntry(true)}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Enter location manually</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 flex items-center justify-center gap-2 py-2 ${
                      site?.id ? "bg-accent text-accent-foreground" : ""
                    }`}
                    onClick={() => setShowSites(true)}
                  >
                    <MapPinIcon className="h-3 w-3" />
                    <span>Existing location</span>
                  </Button>
                </div>
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};

export default LocationSearch;

const SitesLocationSearch = ({
  value,
  onSelect,
  onGoBack,
}: {
  value: string | null;
  onSelect: (site: Site) => void;
  onGoBack: () => void;
}) => {
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteGetSitesQuery({
      search: debouncedSearch,
      limit: 50,
    });

  const sites = useMemo(() => {
    return data?.pages?.[0]?.data || [];
  }, [data]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSelectSite = useCallback(
    (site: Site) => {
      onSelect(site);
      onGoBack();
    },
    [onSelect, onGoBack]
  );

  return (
    <div className="flex flex-col w-full maxm-w-full p-4 space-y-3 max-h-[400px] overflow-y-auto">
      <Command>
        <CommandInput
          placeholder="Search for site..."
          className="pointer-events-auto"
          value={search}
          onValueChange={setSearch}
        />
        <CommandEmpty>No sites found.</CommandEmpty>
        <CommandList>
          {sites.map((site: Site) => (
            <CommandItem
              key={site.id}
              value={`${site.address}, ${site.city}, ${site.state}, ${site.postalCode}`}
              onSelect={() => handleSelectSite(site)}
              className={`cursor-pointer ${
                value === site.id ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <MapPin className="mr-2 h-4 w-4" />
              <span>
                {site.address}, {site.city}, {site.state}, {site.postalCode}
              </span>
            </CommandItem>
          ))}
        </CommandList>
        <div ref={scrollRef} className="h-10">
          {(isFetchingNextPage || isLoading) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SitesSkeleton key={i} />
              ))}
            </div>
          )}
        </div>
      </Command>
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onGoBack}>
          Back to Search
        </Button>
      </div>
    </div>
  );
};

function SitesSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-6 h-6 rounded flex-shrink-0" />
        <div className="flex-1"></div>
      </div>
    </div>
  );
}
