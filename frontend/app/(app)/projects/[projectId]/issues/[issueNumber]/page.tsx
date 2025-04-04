"use client";

import { useGetIssue } from "@/features/projects/issues/api/get-issue";
import { useParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn, getRelativeTimeString } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUpdateIssue } from "@/features/projects/issues/api";
import { Button } from "@/components/ui/button";
import {
  CircleCheck,
  CircleDot,
  MoreHorizontal,
  Pencil,
  RefreshCcwDot,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IssueEditor } from "@/features/projects/issues/components/issue-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function IssueDetailPage() {
  const params = useParams<{
    projectId: string;
    issueNumber: string;
  }>();
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Ensure issueNumber is parsed correctly
  const issueNumberInt = parseInt(params.issueNumber, 10);
  const projectId = params.projectId;

  const {
    data: issue,
    isLoading,
    error,
  } = useGetIssue(
    projectId,
    isNaN(issueNumberInt) ? undefined : issueNumberInt
  );

  const { mutate: updateIssue, isPending: isUpdating } = useUpdateIssue();

  const handleToggleIssueStatus = () => {
    if (!issue) return;

    const newStatus = issue.status === "open" ? "closed" : "open";
    updateIssue({
      projectId,
      issueNumber: issue.issueNumber,
      data: { status: newStatus },
    });
  };

  // Handler for saving the edited description
  const handleSaveDescription = (newDescriptionHtml: string) => {
    if (!issue) return;

    updateIssue(
      {
        projectId,
        issueNumber: issue.issueNumber,
        data: { description: newDescriptionHtml },
      },
      {
        onSuccess: () => {
          toast.success("Description updated successfully!");
          setIsEditingDescription(false);
        },
        onError: (err) => {
          toast.error(`Failed to update description: ${err.message}`);
          // Optionally leave edit mode open or provide feedback
        },
      }
    );
  };

  // Handler for canceling the edit
  const handleCancelEditDescription = () => {
    setIsEditingDescription(false);
  };

  if (isLoading) {
    // TODO: Replace with a proper loading skeleton component
    return <div>Loading issue details...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error?.message || "Could not load the issue details."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!issue) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      {/* Issue Header */}
      <div className="pb-4 border-b">
        <h1 className="text-3xl font-semibold mb-2">
          {issue.title}{" "}
          <span className="text-gray-500 font-normal">
            #{issue.issueNumber}
          </span>
        </h1>
        <Badge
          className={cn(
            "text-base font-semibold rounded-md text-white gap-1",
            issue.status === "open" ? "bg-green-500" : "bg-purple-500"
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

      {/* Issue Body */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main Content (Description) */}
        <div className="flex-grow flex flex-col">
          {/* Wrap Avatar and Description box in a flex container */}
          <div className="flex items-start gap-4">
            <Avatar className="mt-1 flex-shrink-0">
              <AvatarImage
                src={issue.creator.profilePicture}
                alt="User Avatar"
              />
              <AvatarFallback />
            </Avatar>

            {/* Description Box / Editor */}
            {isEditingDescription ? (
              <div className="flex-grow">
                <IssueEditor
                  initialContent={issue.description || ""}
                  onSave={handleSaveDescription}
                  onCancel={handleCancelEditDescription}
                  isLoading={isUpdating}
                  placeholder="Add a description..."
                />
              </div>
            ) : (
              <div className="border rounded-md bg-card text-card-foreground flex-grow">
                {/* Header for the description box */}
                <div className="flex items-center justify-between p-3 border-b bg-muted/50 rounded-t-md">
                  <span className="text-sm font-semibold text-muted-foreground">
                    <strong>{issue.creator.name || issue.creator.email}</strong>{" "}
                    commented {getRelativeTimeString(issue.createdAt)}
                  </span>
                  {/* Edit Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setIsEditingDescription(true)}
                        disabled={isUpdating} // Disable if an update is already pending
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {/* Add other options like Delete later if needed */}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Content */}
                <div className="p-4 max-w-none">
                  {issue.description ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: issue.description }}
                    />
                  ) : (
                    <p className="italic text-gray-500">
                      No description provided.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* // TODO: Add comment section */}

          <Button
            variant="outline"
            className="mt-4 ml-auto" // Use auto margins to push to bottom-right
            onClick={handleToggleIssueStatus}
            disabled={isUpdating}
          >
            {issue.status === "open" ? (
              <>
                <CircleCheck className="h-4 w-4 text-purple-500" /> Close issue
              </>
            ) : (
              <>
                <RefreshCcwDot className="h-4 w-4 text-green-500" /> Reopen
                issue
              </>
            )}
          </Button>
        </div>

        {/* Sidebar (Placeholder) */}
        <aside className="w-full md:w-64 lg:w-72 space-y-4">
          {/* // TODO: Implement sidebar components (Assignees, Labels, Projects, etc.) */}
        </aside>
      </div>
    </div>
  );
}
