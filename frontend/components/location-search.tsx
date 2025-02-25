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
import { Check, MapPin } from "lucide-react";
import { useLoadScript } from "@react-google-maps/api";

const libraries = ["places"];

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

export function LocationSearch({ value, onChange }: LocationSearchProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const autocompleteService =
    useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries as any,
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
    <div className="flex flex-col">
      {/* Hidden div for PlacesService */}
      <div ref={mapRef} style={{ display: "none" }}></div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full"
          >
            {displayValue ? (
              <div className="flex items-center">
                <MapPin className="mr-2 h-4 w-4" />
                <span className="truncate">{displayValue}</span>
              </div>
            ) : (
              <span>Search for a location...</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[400px]" align="start">
          <Command>
            <CommandInput
              placeholder="Search for address..."
              value={input}
              onValueChange={handleInputChange}
              disabled={!isLoaded}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
