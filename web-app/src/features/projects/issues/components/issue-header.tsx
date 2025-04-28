import { useState, memo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CircleCheck, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { Issue } from "../issues.types";

interface IssueHeaderProps {
  issue: Issue;
  isUpdating: boolean;
  onSaveTitle: (newTitle: string) => Promise<void> | void;
}

export function IssueHeader({
  issue,
  isUpdating,
  onSaveTitle,
}: IssueHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(issue.title);

  const handleSave = async () => {
    if (!editedTitle || editedTitle === issue.title) {
      setIsEditingTitle(false);
      if (!editedTitle) {
        toast.info("Title cannot be empty.");
        setEditedTitle(issue.title); // Reset if empty
      }
      return;
    }

    try {
      await onSaveTitle(editedTitle);
      setIsEditingTitle(false);
    } catch (error) {
      // Error is handled by the mutation hook in the parent, just log maybe
      console.error("Failed to save title:", error);
      // Keep editing mode open
    }
  };

  const handleCancel = () => {
    setIsEditingTitle(false);
    setEditedTitle(issue.title); // Reset on cancel
  };

  return (
    <div className="pb-4 border-b">
      <div className="flex justify-between items-start gap-2 mb-2">
        {isEditingTitle ? (
          <div className="flex-grow flex items-center gap-2">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              disabled={isUpdating}
            />
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isUpdating}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isUpdating || !editedTitle}
              size="sm"
            >
              Save
            </Button>
          </div>
        ) : (
          <div className="flex-grow flex items-center gap-2">
            <div className="flex flex-col flex-1 gap-2">
              <h1 className="text-3xl font-semibold flex-grow">
                {issue.title}{" "}
                <span className="text-gray-500 font-normal">
                  #{issue.issueNumber}
                </span>
              </h1>
              <Badge
                className={cn(
                  "text-base font-semibold rounded-lg text-white gap-1 w-fit shadow-none",
                  issue.status === "open"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-purple-600 hover:bg-purple-700"
                )}
              >
                {issue.status === "open" ? (
                  <CircleDot className="h-4 w-4 text-white" />
                ) : (
                  <CircleCheck className="h-4 w-4 text-white" />
                )}
                {issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditedTitle(issue.title); // Set initial value for input
                setIsEditingTitle(true);
              }}
              disabled={isUpdating} // Disable edit if another update is in progress
            >
              Edit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap the component with React.memo
export const MemoizedIssueHeader = memo(IssueHeader);
