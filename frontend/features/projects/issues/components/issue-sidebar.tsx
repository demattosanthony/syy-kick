import { Issue } from "@/features/projects/issues/issues.types";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { User } from "@/types/user";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/features/user/api/get-me";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface IssueSidebarProps {
  issue: Issue;
  projectMembers: User[];
  isLoadingMembers: boolean;
  isUpdating: boolean;
  onAssigneesChange: (assigneeIds: string[]) => Promise<void> | void;
  onDeleteIssue: () => Promise<void> | void;
}

export function IssueSidebar({
  issue,
  projectMembers,
  isLoadingMembers,
  isUpdating,
  onAssigneesChange,
  onDeleteIssue,
}: IssueSidebarProps) {
  const { data: currentUser } = useMeQuery();

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
    }
  };

  return (
    <aside className="w-64 space-y-4 flex-shrink-0 pt-4 pl-2">
      <div className="space-y-2">
        <Label className="text-sm font-bold">Assignees</Label>
        {isLoadingMembers ? (
          <p />
        ) : (
          <MultiSelect
            options={memberOptions}
            onValueChange={handleAssigneesUpdate}
            defaultValue={currentAssigneeIds}
            placeholder="Select assignees..."
            className="bg-background/50 w-full shadow-none"
            disabled={isUpdating}
            animation={0}
          />
        )}
      </div>

      {currentUser?.id === issue.creatorId && (
        <div className="pt-2 border-t border-border">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-red-500 justify-start"
                disabled={isUpdating}
              >
                <Trash2 className="h-4 w-4" />
                Delete Issue
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  this issue.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteIssue}
                  className="bg-red-500 text-white hover:bg-red-600"
                  disabled={isUpdating}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </aside>
  );
}
