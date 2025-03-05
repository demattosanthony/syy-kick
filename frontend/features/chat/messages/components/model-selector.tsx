import { Check, WandSparkles } from "lucide-react";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
<<<<<<< HEAD:frontend/components/ModelSelector.tsx
import { useModelsQuery } from "@/queries/queries";
import { Model } from "@/types/model";
=======
import { getModelIconPath, getModelImage } from "../utils";
import { useModelsQuery } from "@/features/commons/models/api";
>>>>>>> main:frontend/features/chat/messages/components/model-selector.tsx

export interface ModelSelectorProps {
  projectId?: string;
  variant?: "icon-only" | "with-name" | "compact";
  value?: any;
  onChange?: (model: Model) => void;
  showAuto?: boolean;
  className?: string;
  buttonClassName?: string;
  triggerClassName?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  projectId,
  variant = "icon-only",
  value,
  onChange,
  showAuto = true,
  buttonClassName,
  triggerClassName,
}: ModelSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [globalModel, setGlobalModel] = useAtom(modelAtom);
  const { data: models } = useModelsQuery();

  // Use either controlled or global state
  const selectedModel = value || globalModel;
  const handleModelChange = (model: any) => {
    if (onChange) {
      onChange(model);
    } else {
      setGlobalModel(model);
    }
    setOpen(false);
  };

  const [isMounted, setIsMounted] = useState(false);

  // Filter out models with "thinking" in the name if projectId is provided
  const filteredModels = models?.filter((model) => {
    if (projectId) {
      return !model.name.toLowerCase().includes("thinking");
    }
    return true;
  });

  const isMobile = useIsMobile();

  useEffect(() => {
    setIsMounted(true);

    // Reset to AUTO if project ID is provided and current model has "thinking" in its name
    if (
      projectId &&
      selectedModel.name.toLowerCase().includes("thinking") &&
      !value
    ) {
      setGlobalModel(AUTO_MODEL_CONFIG);
    }

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
      <PopoverTrigger asChild className={triggerClassName}>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between gap-0 p-2",
            variant === "compact" && "h-7 px-2 py-1 text-xs",
            buttonClassName
          )}
        >
          <div className="flex items-center">
            {selectedModel.provider === "Auto" ? (
              <WandSparkles
                className={cn("w-4 h-4", variant === "compact" && "w-3 h-3")}
              />
            ) : (
              getModelImage(
                selectedModel.provider,
                variant === "compact" ? "w-3 h-3" : "w-5 h-5"
              )
            )}
            {variant !== "icon-only" && (
              <div
                className={cn(
                  "ml-2 truncate",
                  variant === "compact" && "text-xs"
                )}
              >
                {selectedModel.name || "Select model..."}
              </div>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command>
          {!isMobile && <CommandInput placeholder="Search models..." />}

          <CommandList className="max-h-[450px]">
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {showAuto && (
                <HoverCard openDelay={0.5} closeDelay={0}>
                  <HoverCardTrigger>
                    <CommandItem
                      key={"Auto"}
                      value={"Auto"}
                      onSelect={() => handleModelChange(AUTO_MODEL_CONFIG)}
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
                        with image capabilities for messages containing images,
                        or models optimized for code when discussing
                        programming.
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              )}

              {filteredModels?.map((model) => (
                <HoverCard key={model.name} openDelay={0.5} closeDelay={0}>
                  <HoverCardTrigger>
                    <CommandItem
                      key={model.name}
                      value={model.name}
                      onSelect={() => handleModelChange(model)}
                    >
                      <div className="flex items-center">
                        {getModelImage(model.provider)}
                        <span className="ml-2">{model.name}</span>
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

<<<<<<< HEAD:frontend/components/ModelSelector.tsx
export function getModelImage(provider: string, className = "w-5 h-5 rounded") {
  const iconPath = getModelIconPath(provider);
  if (!iconPath) return null;

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return <img src={iconPath} alt={providerName} className={className} />;
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
=======
>>>>>>> main:frontend/features/chat/messages/components/model-selector.tsx
