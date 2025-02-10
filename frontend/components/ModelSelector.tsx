"use client";

import { Check, ChevronsUpDown, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { AUTO_MODEL_CONFIG, modelAtom } from "@/atoms/chat";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useModelsQuery } from "@/queries/queries";

const ModelSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useAtom(modelAtom);
  const { data: models } = useModelsQuery();

  const [isMounted, setIsMounted] = useState(false); // Add mounted state because selected model atom loads async

  const isMobile = useIsMobile();

  useEffect(() => {
    setIsMounted(true); // Set mounted when component loads

    // Add keyboard shortcut listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    if (typeof window === "undefined") return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Don't show until selected model is loaded in
  if (!isMounted) {
    return <></>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="h-[36px] justify-between gap-0 p-1"
        >
          <div className="flex items-center">
            {selectedModel.provider === "Auto" ? (
              <WandSparkles className="w-4 h-4 mr-2" />
            ) : (
              getModelImage(selectedModel.provider)
            )}
            <div className="hidden md:flex truncate ">
              {selectedModel.name || "Select model..."}
            </div>
          </div>
          <ChevronsUpDown className="md:ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 ">
        <Command>
          {!isMobile && <CommandInput placeholder="Search models..." />}

          <CommandList className="max-h-[450px]">
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              <HoverCard openDelay={0.5} closeDelay={0}>
                <HoverCardTrigger>
                  <CommandItem
                    key={"Auto"}
                    value={"Auto"}
                    onSelect={() => {
                      setSelectedModel(AUTO_MODEL_CONFIG);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center">
                      <WandSparkles className="w-5 h-5 mr-2 p-[2px]" />
                      <span>Auto</span>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedModel.name === "auto"
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                </HoverCardTrigger>
                <HoverCardContent
                  side="left"
                  align="center"
                  className="w-[400px]"
                >
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center">
                      <WandSparkles className="w-4 h-4 mr-2" />
                      Auto Model Selection
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Automatically selects the most suitable model based on
                      your message content. For example, it will choose models
                      with image capabilities for messages containing images, or
                      models optimized for code when discussing programming.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>

              {models?.map((model) => (
                <HoverCard key={model.name} openDelay={0.5} closeDelay={0}>
                  <HoverCardTrigger>
                    <CommandItem
                      key={model.name}
                      value={model.name}
                      onSelect={() => {
                        setSelectedModel(model);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center">
                        {getModelImage(model.provider)}
                        <span>{model.name}</span>
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedModel.name === model.name
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="left"
                    align="center"
                    className="w-[400px]"
                  >
                    <div className="flex justify-between space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={getModelIconPath(model.provider || "") || ""}
                        />
                        <AvatarFallback>
                          {model.provider.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-3">
                        <h4 className="text-sm">
                          {model.provider.charAt(0).toUpperCase() +
                            model.provider.slice(1)}{" "}
                          / <span className="font-semibold">{model.name}</span>
                        </h4>

                        <p className="text-xs text-muted-foreground">
                          {model.description}
                        </p>

                        <div className="flex gap-1">
                          {model.supportedMimeTypes?.some((type) =>
                            type.startsWith("image/")
                          ) && <Badge>Image Upload</Badge>}
                          {model.supportedMimeTypes?.some(
                            (type) => type === "application/pdf"
                          ) && <Badge>File Upload</Badge>}
                          {(model.name.includes("online") ||
                            model.name.includes("sonar")) && (
                            <Badge>Web Search </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ModelSelector;

export function getModelImage(provider: string) {
  const iconPath = getModelIconPath(provider);
  if (!iconPath) return null;

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <img src={iconPath} alt={providerName} className="w-5 h-5 mr-2 rounded" />
  );
}

export function getModelIconPath(provider: string) {
  switch (provider) {
    case "openai":
      return "/logos/openai.ico";
    case "anthropic":
      return "/logos/anthropic.ico";
    case "perplexity":
      return "/logos/perplexity.ico";
    case "google":
      return "/logos/google.svg";
    case "xai":
      return "/logos/xai.svg";
    case "mistral":
      return "/logos/mistral.svg";
    case "groq":
      return "/logos/meta.svg";
    case "meta":
      return "/logos/meta.svg";
    case "deepseek":
      return "/logos/deepseek.ico";
    default:
      return null;
  }
}
