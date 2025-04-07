"use client";

import { useGetIssue } from "@/features/projects/issues/api/get-issue";
import { useParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials, getRelativeTimeString } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUpdateIssue } from "@/features/projects/issues/api";
import { Button } from "@/components/ui/button";
import {
  CircleCheck,
  CircleDot,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCcwDot,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { IssueEditor } from "@/features/projects/issues/components/issue-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateCommentMutation } from "@/features/projects/issues/api/create-comment";
import { Separator } from "@/components/ui/separator";
import { useMeQuery } from "@/features/user/api";
import CommentItem from "@/features/projects/issues/components/comment-item";

export default function IssueDetailPage() {
  const params = useParams<{
    projectId: string;
    issueNumber: string;
  }>();
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newCommentHtml, setNewCommentHtml] = useState("");

  // Ensure issueNumber is parsed correctly
  const issueNumberInt = parseInt(params.issueNumber, 10);
  const projectId = params.projectId;

  const { data: user } = useMeQuery();
  const {
    data: issue,
    isLoading,
    error,
  } = useGetIssue(
    projectId,
    isNaN(issueNumberInt) ? undefined : issueNumberInt
  );

  const { mutate: updateIssue, isPending: isUpdating } = useUpdateIssue();

  const { mutate: createComment, isPending: isCreatingComment } =
    useCreateCommentMutation(projectId, issueNumberInt);

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

  const handleCreateComment = () => {
    if (!newCommentHtml || newCommentHtml === "<p></p>") {
      toast.info("Comment cannot be empty.");
      return;
    }
    createComment({ comment: newCommentHtml });
    setNewCommentHtml(""); // Clear the comment input
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

  // Sort comments, e.g., oldest first
  const sortedComments =
    issue.comments?.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ) || [];

  return (
    // Change min-h-screen to h-screen, remove space-y-6
    <div className="container mx-auto p-4 max-w-5xl min-h-screen">
      {/* Add min-h-screen */}
      {/* Issue Header */}
      <div className="pb-4 border-b flex-shrink-0">
        <h1 className="text-3xl font-semibold mb-2">
          {issue.title}{" "}
          <span className="text-gray-500 font-normal">
            #{issue.issueNumber}
          </span>
        </h1>
        <Badge
          className={cn(
            "text-base font-semibold rounded-md text-white gap-1",
            issue.status === "open"
              ? "bg-green-500 hover:bg-green-600"
              : "bg-purple-500 hover:bg-purple-600"
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
      {/* Keep flex-1 overflow-hidden */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main Content (Description) */}
        {/* Keep overflow-y-auto, add padding */}
        <div className="flex-grow flex flex-col pt-4 pr-2">
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
          {/* Comments Section */}
          {sortedComments.length > 0 && (
            <div className="space-y-6 pt-6">
              {/* Keep internal spacing */}
              {/* Added padding top */}
              {/* No Separator before comments list */}
              {sortedComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  projectId={projectId}
                  issueNumber={issueNumberInt}
                  currentUserId={user?.id}
                />
                // No Separator between comments
              ))}
            </div>
          )}
          {/* New Comment Form */}
          {/* Removed Separator */}
          <div className="flex items-start gap-4 pt-4">
            {/* Keep internal spacing */}
            <Avatar className="mt-1 flex-shrink-0">
              <AvatarImage
                src={user?.profilePicture}
                alt="Current User Avatar"
              />
              <AvatarFallback>
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <IssueEditor
                initialContent={newCommentHtml} // Use state for content
                onChange={setNewCommentHtml} // Update state on change
                placeholder="Leave a comment..."
                isLoading={isCreatingComment} // Reflect loading state
                minHeight="100px"
                showControls={false} // Hide Save/Cancel
                // Removed props related to internal submit button
                onCancel={() => setNewCommentHtml("")} // Provide a way to cancel/clear
              />
            </div>
          </div>

          {/* Action Buttons (Moved and combined) */}
          {/* Make sticky */}
          <div className="flex justify-end items-center gap-2 pt-2 mt-2 bg-background pb-4">
            {/* Close/Reopen Button */}
            <Button
              variant="outline"
              onClick={handleToggleIssueStatus}
              disabled={isUpdating || isCreatingComment}
            >
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : issue.status === "open" ? (
                <CircleCheck className="mr-2 h-4 w-4 text-purple-500" />
              ) : (
                <RefreshCcwDot className="mr-2 h-4 w-4 text-green-500" />
              )}
              {issue.status === "open" ? "Close issue" : "Reopen issue"}
            </Button>
            {/* New Comment Submit Button */}
            <Button
              onClick={handleCreateComment}
              disabled={
                isCreatingComment || // Disable if submitting
                isUpdating || // Disable if issue status is changing
                !newCommentHtml // Disable if comment is empty
              }
            >
              {isCreatingComment ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Comment
            </Button>
          </div>
        </div>

        {/* Sidebar (Placeholder) */}
        {/* Add padding */}
        <aside className="w-full md:w-64 lg:w-72 space-y-4 flex-shrink-0 pt-4 pl-2">
          {/* // TODO: Implement sidebar components (Assignees, Labels, Projects, etc.) */}
        </aside>
      </div>
    </div>
  );
}
