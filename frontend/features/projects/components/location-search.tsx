"use client";

import { useState, useEffect, useRef } from "react";
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
import { Check, MapPin, Plus } from "lucide-react";
import { useLoadScript, Libraries } from "@react-google-maps/api";

const libraries: Libraries = ["places"];

type LocationData = {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
};

type LocationSearchProps = {
  value: LocationData;
  onChange: (value: LocationData) => void;
};

const LocationSearch = ({ value, onChange }: LocationSearchProps) => {
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
    latitude: "",
    longitude: "",
  });
  const autocompleteService =
    useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
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
  }, [value.address]);

  useEffect(() => {
    // Initialize manual location with current values when toggling to manual entry
    if (showManualEntry) {
      setManualLocation({
        address: value.address || "",
        city: value.city || "",
        state: value.state || "",
        country: value.country || "",
        postalCode: value.postalCode || "",
        latitude: value.latitude || "",
        longitude: value.longitude || "",
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

        const locationData: LocationData = {
          // Use the extracted street address instead of the full formatted address
          address: streetAddress,
          latitude: place.geometry?.location?.lat().toString(),
          longitude: place.geometry?.location?.lng().toString(),
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

        onChange(locationData);
        // Still display the full formatted address in the input field for user convenience
        setInput(place.formatted_address || "");
        setOpen(false);
      }
    );
  };

  const displayValue = value.address
    ? value.address +
      (value.city ? `, ${value.city}` : "") +
      (value.state ? `, ${value.state}` : "") +
      (value.postalCode ? `, ${value.postalCode}` : "")
    : "";

  return (
    <div className="flex flex-col w-full maxm-w-full">
      {/* Hidden div for PlacesService */}
      <div ref={mapRef} style={{ display: "none" }}></div>

      <Popover open={open} onOpenChange={setOpen}>
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
        <PopoverContent className="p-0 w-[400px]" align="start">
          {!showManualEntry ? (
            <Command>
              <CommandInput
                placeholder="Search for address..."
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
                <div className="border-t p-2 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-center gap-2 py-2"
                    onClick={() => setShowManualEntry(true)}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Enter location manually</span>
                  </Button>
                </div>
              </CommandList>
            </Command>
          ) : (
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
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default LocationSearch;
