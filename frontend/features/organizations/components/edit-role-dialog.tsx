"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  OrganizationMemberRoleResponse,
  OrgMember,
  Permissions,
  TransferableRolesPermissions,
} from "@/features/permissions/types";
import useGetMemberQuery from "../api/members/get-member";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useGetTransferableOrgProjectsQuery } from "@/features/permissions/api";
import { Badge } from "@/components/ui/badge";
import useUpdateOrgMemberRoleMutation from "@/features/permissions/api/organizations/update-org-member-role";
import { toast } from "sonner";
import {
  editRoleActions,
  editRoleTranslations,
} from "@/features/permissions/utils";

type EditRoleDialogProps = {
  open: boolean;
  organizationId: string;
  member: OrgMember;
  transferablePermissions?: TransferableRolesPermissions;
  onOpenChange: (open: boolean) => void;
};

export default function EditRoleDialog({
  open,
  onOpenChange,
  member,
  transferablePermissions,
  organizationId,
}: EditRoleDialogProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [selectedProjects, setSelectedProjects] = useState<
    { id: string; name: string }[]
  >([]);
  const [projectsOpen, setProjectsOpen] = useState(false);

  const { data: memberRole, isLoading } = useGetMemberQuery({
    organizationId,
    memberId: member.id,
  });

  const { data: projects } = useGetTransferableOrgProjectsQuery({
    organizationId,
  });

  const { mutate: updateOrgMemberRole } = useUpdateOrgMemberRoleMutation();

  useEffect(() => {
    if (!memberRole) return;

    if (member && open && memberRole && !isLoading) {
      const initialRoleId = memberRole.role.id;
      setSelectedRoleId(initialRoleId);

      initializePermissionsFromResponse(memberRole);
    } else if (member && open && !isLoading) {
      const initialRoleId = memberRole.role.id;
      setSelectedRoleId(initialRoleId);
      initializePermissions(initialRoleId);
    }
  }, [member, open, memberRole, isLoading, transferablePermissions]);

  // Initialize permissions from the API response
  const initializePermissionsFromResponse = (
    response: OrganizationMemberRoleResponse
  ) => {
    const newPermissions: Record<string, Record<string, boolean>> = {};

    response.resources.forEach((resource) => {
      newPermissions[resource.id] = {};
      resource.actions.forEach((action) => {
        // Set permission to true if the action exists in the response
        newPermissions[resource.id][action.id] = true;
      });
    });

    // User has a project role, set selected projects
    if (response?.projects) {
      setSelectedProjects(response.projects);
    }

    setPermissions(newPermissions);
  };

  // Initialize permissions based on the selected role's defaults
  const initializePermissions = (roleId: string) => {
    if (!transferablePermissions) return;

    const role = transferablePermissions.find((r) => r.id === roleId);

    if (!role) {
      setPermissions({});
      return;
    }

    const newPermissions: Record<string, Record<string, boolean>> = {};

    role.resources.forEach((resource) => {
      newPermissions[resource.id] = {};
      resource.actions.forEach((action) => {
        // If action has default property, use it, otherwise default to false
        newPermissions[resource.id][action.id] = action.default || false;
      });
    });

    setPermissions(newPermissions);
  };

  // Handle role change
  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    initializePermissions(roleId);
  };

  // Handle permission toggle
  const handlePermissionChange = (
    resourceId: string,
    actionId: string,
    checked: boolean
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [resourceId]: {
        ...prev[resourceId],
        [actionId]: checked,
      },
    }));
  };

  // Handle save
  const handleSave = () => {
    if (member) {
      const resources: Record<string, string[]> = {};

      Object.entries(permissions).forEach(([resourceId, actions]) => {
        resources[resourceId] = Object.entries(actions)
          .filter(([_, checked]) => checked)
          .map(([actionId]) => actionId);
      });

      updateOrgMemberRole(
        {
          organizationId,
          memberId: member.id,
          data: {
            resources,
            projectIds: selectedProjects.map((p) => p.id),
            roleId: selectedRoleId,
          },
        },
        {
          onSuccess: (data) => {
            if (data) {
              toast.success(data.message);
            }
          },
          onError: (error) => {
            toast.error(error.message);
          },
          onSettled: () => {
            onOpenChange(false);
            setTimeout(() => {
              document.body.style.pointerEvents = "";
            }, 100);
          },
        }
      );
    }
  };

  // Get the selected role object
  const selectedRole = useMemo(() => {
    if (!transferablePermissions) return null;

    return transferablePermissions.find((r) => r.id === selectedRoleId) || null;
  }, [selectedRoleId, transferablePermissions]);

  // Check if an action is configurable
  const isActionConfigurable = (resourceId: string, actionId: string) => {
    if (!transferablePermissions) return false;

    const role = transferablePermissions.find((r) => r.id === selectedRoleId);
    if (!role) return false;

    const resource = role.resources.find((r) => r.id === resourceId);
    if (!resource) return false;

    const action = resource.actions.find((a) => a.id === actionId);
    return action?.configurable || false;
  };

  const isProjectRole = (roleName?: string): boolean => {
    if (!roleName) return false;
    return (
      roleName === Permissions.Roles.PROJECT_MANAGER ||
      roleName === Permissions.Roles.PROJECT_MEMBER
    );
  };

  const toggleProject = (project: { id: string; name: string }) => {
    setSelectedProjects((current) => {
      const exists = current.some((p) => p.id === project.id);

      if (exists) {
        return current.filter((p) => p.id !== project.id);
      } else {
        return [...current, project];
      }
    });
  };

  const removeProject = (projectId: string) => {
    setSelectedProjects((current) => current.filter((p) => p.id !== projectId));
  };

  const getConfigBadge = (resourceName: Permissions.Resources) => {
    if (!selectedRole) return null;

    if (
      Permissions.Roles.PROJECT_MEMBER === selectedRole.name &&
      [
        Permissions.Resources.ORGANIZATION_PROJECTS,
        Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
      ].includes(resourceName)
    ) {
      return <Badge>config</Badge>;
    }

    if (
      Permissions.Roles.PROJECT_MANAGER === selectedRole.name &&
      Permissions.Resources.ORGANIZATION_PROJECTS === resourceName
    ) {
      return <Badge>config</Badge>;
    }
    return null;
  };

  if (!transferablePermissions) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Role & Permissions</DialogTitle>
          <DialogDescription>
            {member
              ? `Update role and permissions for ${member.name}`
              : "Select a role and configure permissions"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="py-4">
            <Label htmlFor="role-select">Role</Label>
            {isLoading ? (
              <Skeleton className="h-10 w-full mt-1" />
            ) : (
              <Select
                value={selectedRoleId}
                onValueChange={handleRoleChange}
                disabled={isLoading}
              >
                <SelectTrigger id="role-select" className="w-full mt-1">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {transferablePermissions.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name.split("_").join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedRole && isProjectRole(selectedRole.name) && projects && (
            <div>
              <Label htmlFor="projects-select">Projects</Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full mt-1" />
              ) : (
                <div className="mt-1">
                  <Popover open={projectsOpen} onOpenChange={setProjectsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={projectsOpen}
                        className="w-full justify-between"
                      >
                        {selectedProjects.length > 0
                          ? `${selectedProjects.length} project${
                              selectedProjects.length > 1 ? "s" : ""
                            } selected`
                          : "Select projects"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search projects..." />
                        <CommandList>
                          <CommandEmpty>No projects found.</CommandEmpty>
                          <CommandGroup>
                            {projects.map((project) => {
                              const isSelected = selectedProjects.some(
                                (p) => p.id === project.id
                              );
                              return (
                                <CommandItem
                                  key={project.id}
                                  value={project.id}
                                  onSelect={() => toggleProject(project)}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    className="mr-2"
                                  />
                                  {project.name}
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4",
                                      isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Display selected projects as badges */}
                  {selectedProjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedProjects.map((project) => (
                        <Badge
                          key={project.id}
                          className="flex items-center gap-1"
                        >
                          {project.name}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => removeProject(project.id)}
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">
                              Remove {project.name}
                            </span>
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <ScrollArea className="flex-1 pr-4 my-4">
          {isLoading ? (
            // Skeleton loading state for permissions
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="pl-4 space-y-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="flex items-center space-x-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : selectedRole ? (
            <Accordion type="multiple" className="w-full">
              {selectedRole.resources.map((resource) => (
                <AccordionItem key={resource.id} value={resource.id}>
                  <AccordionTrigger className="text-sm font-medium">
                    {
                      editRoleTranslations[
                        resource.name as Permissions.Resources
                      ]
                    }
                    {getConfigBadge(resource.name as Permissions.Resources)}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pl-2">
                      {resource.actions.map((action) => {
                        const isConfigurable =
                          action.configurable !== undefined
                            ? action.configurable
                            : isActionConfigurable(resource.id, action.id);

                        return (
                          <div
                            key={action.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`${resource.id}-${action.id}`}
                              checked={
                                permissions[resource.id]?.[action.id] || false
                              }
                              onCheckedChange={(checked: boolean) => {
                                handlePermissionChange(
                                  resource.id,
                                  action.id,
                                  checked
                                );
                              }}
                              disabled={!isConfigurable}
                            />
                            <Label
                              htmlFor={`${resource.id}-${action.id}`}
                              className={
                                !isConfigurable ? "text-muted-foreground" : ""
                              }
                            >
                              {
                                editRoleActions[
                                  action.name as Permissions.Actions
                                ]
                              }
                              {!isConfigurable && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (Not configurable)
                                </span>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Select a role to view permissions
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
