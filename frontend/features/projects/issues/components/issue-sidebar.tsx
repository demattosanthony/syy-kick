import { Issue, IssueAssignee } from "@/features/projects/issues/issues.types";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { User } from "@/types/user";

interface IssueSidebarProps {
  issue: Issue;
  projectMembers: User[];
  isLoadingMembers: boolean;
  isUpdating: boolean;
  onAssigneesChange: (assigneeIds: string[]) => Promise<void> | void;
}

export function IssueSidebar({
  issue,
  projectMembers,
  isLoadingMembers,
  isUpdating,
  onAssigneesChange,
}: IssueSidebarProps) {
  console.log("projectMembers", projectMembers);
  const memberOptions =
    projectMembers?.map((member) => ({
      label: member.name || member.email,
      value: member.id,
    })) || [];

  const currentAssigneeIds = issue.assignees?.map((a) => a.user.id) || [];

  const handleAssigneesUpdate = async (selectedAssigneeIds: string[]) => {
    const sortedCurrent = [...currentAssigneeIds].sort();
    const sortedSelected = [...selectedAssigneeIds].sort();
    if (JSON.stringify(sortedCurrent) === JSON.stringify(sortedSelected)) {
      return; // No change
    }

    try {
      await onAssigneesChange(selectedAssigneeIds);
    } catch (error) {
      console.error("Failed to update assignees:", error);
      // Error handled by parent mutation hook
      // Consider reverting MultiSelect state visually if needed
    }
  };

  return (
    <aside className="w-64 space-y-4 flex-shrink-0 pt-4 pl-2">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Assignees</Label>
        {isLoadingMembers ? (
          <p>Loading members...</p>
        ) : (
          <MultiSelect
            options={memberOptions}
            onValueChange={handleAssigneesUpdate}
            defaultValue={currentAssigneeIds}
            placeholder="Select assignees..."
            className="bg-background/50 w-full"
            disabled={isUpdating}
          />
        )}
      </div>
      {/* TODO: Implement other sidebar components (Labels, Projects, etc.) */}
    </aside>
  );
}
