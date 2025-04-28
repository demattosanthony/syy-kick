import React from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, Settings } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface MemberOption {
  label: string;
  value: string;
  avatar?: string;
}

interface AssigneeSelectorProps {
  memberOptions: MemberOption[];
  isLoadingMembers: boolean;
  currentAssigneeIds: string[];
  onAssigneesChange: (selectedAssigneeIds: string[]) => void;
  isUpdating?: boolean;
  triggerText?: string;
  popoverWidth?: string;
  showSelectedInline?: boolean;
}

export function AssigneeSelector({
  memberOptions,
  isLoadingMembers,
  currentAssigneeIds,
  onAssigneesChange,
  isUpdating = false,
  triggerText = "Assignees",
  popoverWidth = "w-64",
  showSelectedInline = true,
}: AssigneeSelectorProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const handleAssigneesUpdate = (selectedAssigneeIds: string[]) => {
    const sortedCurrent = [...currentAssigneeIds].sort();
    const sortedSelected = [...selectedAssigneeIds].sort();
    if (JSON.stringify(sortedCurrent) === JSON.stringify(sortedSelected)) {
      return; // No change
    }
    onAssigneesChange(selectedAssigneeIds);
  };

  const selectedAssigneesDetails = currentAssigneeIds
    .map((id) => memberOptions.find((m) => m.value === id))
    .filter((m): m is MemberOption => !!m);

  return (
    <div className="space-y-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex justify-between items-center px-1 text-sm font-bold text-muted-foreground"
            disabled={isUpdating || isLoadingMembers}
          >
            {triggerText}
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("p-0", popoverWidth)} align="start">
          {isLoadingMembers ? (
            <p className="p-4 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Command>
              <CommandInput
                placeholder={`Select ${triggerText.toLowerCase()}...`}
              />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {memberOptions.map((option) => {
                    const isSelected = currentAssigneeIds.includes(
                      option.value
                    );
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label} // For filtering
                        onSelect={() => {
                          handleAssigneesUpdate(
                            isSelected
                              ? currentAssigneeIds.filter(
                                  (id) => id !== option.value
                                )
                              : [...currentAssigneeIds, option.value]
                          );
                          // Keep popover open after selection if needed
                          // setPopoverOpen(false);
                        }}
                        disabled={isUpdating}
                        className="cursor-pointer"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </div>
                        {option.avatar && (
                          <Avatar className="h-5 w-5 mr-2">
                            <AvatarImage
                              src={option.avatar}
                              alt={option.label}
                            />
                            <AvatarFallback className="text-xs">
                              {option.label.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <span>{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {showSelectedInline && (
        <div className="flex flex-col gap-2 px-2">
          {isLoadingMembers ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : selectedAssigneesDetails.length > 0 ? (
            selectedAssigneesDetails.map((assignee) => (
              <div key={assignee.value} className="flex items-center space-x-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={assignee.avatar}
                    alt={assignee.label}
                    className="h-6 w-6"
                  />
                  <AvatarFallback className="text-xs h-6 w-6">
                    {assignee.label.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{assignee.label}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No one assigned</p>
          )}
        </div>
      )}
    </div>
  );
}
