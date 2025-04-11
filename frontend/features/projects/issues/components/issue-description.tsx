import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil } from "lucide-react";
import { IssueEditor } from "./issue-editor";
import { getRelativeTimeString } from "@/lib/utils";
import { Issue } from "../issues.types";
interface IssueDescriptionProps {
  issue: Issue;
  isUpdating: boolean;
  onSaveDescription: (newDescription: string) => Promise<void> | void;
}

export function IssueDescription({
  issue,
  isUpdating,
  onSaveDescription,
}: IssueDescriptionProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  const handleSave = async (newDescriptionHtml: string) => {
    try {
      await onSaveDescription(newDescriptionHtml);
      setIsEditingDescription(false);
    } catch (error) {
      console.error("Failed to save description:", error);
      // Error handled by parent mutation hook
    }
  };

  const handleCancel = () => {
    setIsEditingDescription(false);
  };

  return (
    <div className="flex items-start gap-4 pt-4">
      <Avatar className="mt-1 flex-shrink-0">
        <AvatarImage src={issue.creator.profilePicture} alt="Creator Avatar" />
        <AvatarFallback /> {/* // TODO: Add initials */}
      </Avatar>

      {isEditingDescription ? (
        <div className="flex-grow">
          <IssueEditor
            initialContent={issue.description || ""}
            onSave={handleSave}
            onCancel={handleCancel}
            isLoading={isUpdating}
            placeholder="Add a description..."
            minHeight="200px"
          />
        </div>
      ) : (
        <div className="border rounded-md bg-card text-card-foreground flex-grow">
          <div className="flex items-center justify-between p-3 border-b bg-muted/50 rounded-t-md">
            <span className="text-sm font-semibold text-muted-foreground">
              <strong>{issue.creator.name || issue.creator.email}</strong>{" "}
              commented {getRelativeTimeString(issue.createdAt)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setIsEditingDescription(true)}
                  disabled={isUpdating}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="p-4 max-w-none">
            {issue.description ? (
              <div dangerouslySetInnerHTML={{ __html: issue.description }} />
            ) : (
              <p className="italic text-gray-500">No description provided.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
