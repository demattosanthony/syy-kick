// import { useState } from "react";
// import { Label } from "@/components/ui/label";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
// import { Check } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { Badge } from "@/components/ui/badge";
// import { getModelIconPath } from "@/features/chat/messages/utils";
// import { ModelSelectorProps } from "../../workflows.types";
// import { Button } from "@/components/ui/button";
// import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// const getModelImage = (provider: string) => {
//     const iconPath = getModelIconPath(provider);
//     if (iconPath) {
//         return <img src={iconPath} alt={provider} className="h-4 w-4" />;
//     }
//     return null;
// };

// const ModelSelector = ({ step, models, onModelChange, hasError, errorMessage }: ModelSelectorProps) => {
//     const [isOpen, setIsOpen] = useState(false);

//     return (
//         <div>
//             <Label>Model</Label>
//             <Popover open={isOpen} onOpenChange={setIsOpen}>
//                 <PopoverTrigger asChild>
//                     <Button variant="outline" role="combobox" aria-expanded={isOpen} className={cn(
//                         "w-full justify-between",
//                         hasError && "border-destructive"
//                     )}>
//                         {models.find((m) => m.name === step.model) ? (
//                             <div className="flex items-center">
//                                 {getModelImage(models.find((m) => m.name === step.model)?.provider || "")}
//                                 <span className="ml-2">{models.find((m) => m.name === step.model)?.name}</span>
//                             </div>
//                         ) : (
//                             "Select model..."
//                         )}
//                     </Button>
//                 </PopoverTrigger>
//                 <PopoverContent className="w-[400px] h-[300px] p-0">
//                     <Command className="h-full">
//                         <CommandInput placeholder="Search model..." />
//                         <CommandEmpty>No model found.</CommandEmpty>
//                         <CommandGroup className="overflow-y-auto max-h-[calc(300px-40px)]">
//                             {models.map((model) => (
//                                 <HoverCard key={model.name} openDelay={0.5} closeDelay={0}>
//                                     <HoverCardTrigger>
//                                         <CommandItem
//                                             value={model.name}
//                                             onSelect={() => {
//                                                 onModelChange(model.name);
//                                                 setIsOpen(false);
//                                             }}
//                                         >
//                                             <div className="flex items-center">
//                                                 {getModelImage(model.provider || "")}
//                                                 <span className="ml-2">{model.name}</span>
//                                             </div>
//                                             <Check
//                                                 className={cn(
//                                                     "ml-auto h-4 w-4",
//                                                     step.model === model.name
//                                                         ? "opacity-100"
//                                                         : "opacity-0"
//                                                 )}
//                                             />
//                                         </CommandItem>
//                                     </HoverCardTrigger>
//                                     <HoverCardContent side="left" align="center" className="w-[400px]">
//                                         <div className="flex justify-between space-x-2">
//                                             <Avatar className="h-6 w-6">
//                                                 <AvatarImage src={getModelIconPath(model.provider || "") || ""} />
//                                                 <AvatarFallback>{model.provider.charAt(0).toUpperCase()}</AvatarFallback>
//                                             </Avatar>
//                                             <div className="space-y-3">
//                                                 <h4 className="text-sm">
//                                                     {model.provider.charAt(0).toUpperCase() + model.provider.slice(1)} / <span className="font-semibold">{model.name}</span>
//                                                 </h4>
//                                                 <p className="text-xs text-muted-foreground">{model.description}</p>
//                                                 <div className="flex gap-1">
//                                                     {model.supportedMimeTypes?.some((type: string) => type.startsWith("image/")) && <Badge>Image Upload</Badge>}
//                                                     {model.supportedMimeTypes?.some((type: string) => type === "application/pdf") && <Badge>File Upload</Badge>}
//                                                     {(model.name.includes("online") || model.name.includes("sonar")) && <Badge>Web Search</Badge>}
//                                                 </div>
//                                             </div>
//                                         </div>
//                                     </HoverCardContent>
//                                 </HoverCard>
//                             ))}
//                         </CommandGroup>
//                     </Command>
//                 </PopoverContent>
//             </Popover>
//             {hasError && <p className="text-sm text-destructive mt-1">{errorMessage}</p>}
//         </div>
//     );
// };

// export default ModelSelector;