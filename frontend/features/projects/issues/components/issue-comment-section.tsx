import { useState } from "react";
import CommentItem from "./comment-item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IssueEditor } from "./issue-editor";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { CircleCheck, Loader2, RefreshCcwDot } from "lucide-react";
import { toast } from "sonner";
import { Issue, IssueComment } from "../issues.types";
import { User } from "@/types/user";

interface IssueCommentSectionProps {
  comments: IssueComment[] | undefined;
  projectId: string;
  issueNumber: number;
  currentUser: User | undefined;
  isCreatingComment: boolean;
  isUpdatingIssue: boolean; // To disable comment button during other updates
  onCreateComment: (commentHtml: string) => Promise<void> | void;
  onToggleIssueStatus: () => void;
  issueStatus: Issue["status"];
}

export function IssueCommentSection({
  comments,
  projectId,
  issueNumber,
  currentUser,
  isCreatingComment,
  isUpdatingIssue,
  onCreateComment,
  onToggleIssueStatus,
  issueStatus,
}: IssueCommentSectionProps) {
  const [newCommentHtml, setNewCommentHtml] = useState("");

  // Sort comments, oldest first
  const sortedComments =
    comments
      ?.slice() // Create a shallow copy before sorting
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ) || [];

  const handleCreateComment = async () => {
    if (!newCommentHtml || newCommentHtml === "<p></p>") {
      toast.info("Comment cannot be empty.");
      return;
    }
    try {
      await onCreateComment(newCommentHtml);
      setNewCommentHtml(""); // Clear the input on success
    } catch (error) {
      console.error("Failed to create comment:", error);
      // Error handled by parent mutation hook
    }
  };

  return (
    <div className="flex-grow flex flex-col pr-2 pb-20">
      {/* Comments List */}
      {sortedComments.length > 0 && (
        <div className="space-y-6 pt-6">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              projectId={projectId}
              issueNumber={issueNumber}
              currentUserId={currentUser?.id}
            />
          ))}
        </div>
      )}

      {/* New Comment Form */}
      <div className="pt-4 mt-4">
        <div className="flex items-start gap-4">
          <Avatar className="flex-shrink-0 mt-1">
            <AvatarImage src={currentUser?.profilePicture} alt="User Avatar" />
            <AvatarFallback>
              {getInitials(currentUser?.name, currentUser?.email)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-grow">
            <h3 className="font-medium mb-2">Add a comment</h3>
            <IssueEditor
              initialContent={newCommentHtml}
              onChange={setNewCommentHtml}
              placeholder="Leave a comment..."
              isLoading={isCreatingComment}
              minHeight="100px"
              showControls={false}
              onCancel={() => setNewCommentHtml("")}
            />
            {/* Buttons container */}
            <div className="flex justify-end items-center gap-2 mt-2">
              <Button
                variant="outline"
                onClick={onToggleIssueStatus}
                disabled={isUpdatingIssue || isCreatingComment} // Disable if any mutation is pending
              >
                {isUpdatingIssue &&
                issueStatus === (issueStatus === "open" ? "closed" : "open") ? ( // Show loader only for this specific action
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : issueStatus === "open" ? (
                  <CircleCheck className="h-4 w-4 text-purple-500 mr-2" />
                ) : (
                  <RefreshCcwDot className="h-4 w-4 text-green-500 mr-2" />
                )}
                {issueStatus === "open" ? "Close issue" : "Reopen issue"}
              </Button>

              {/* Existing Comment Button */}
              <Button
                onClick={handleCreateComment}
                disabled={
                  isCreatingComment || // Disable if submitting this comment
                  isUpdatingIssue || // Disable if issue status/title/desc is changing
                  !newCommentHtml || // Disable if comment is empty
                  newCommentHtml === "<p></p>" // Also check for empty paragraph
                }
              >
                {isCreatingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
