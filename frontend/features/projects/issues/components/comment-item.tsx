import { useState } from "react";
import { IssueComment } from "../issues.types";
import { useDeleteCommentMutation, useUpdateCommentMutation } from "../api";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, getRelativeTimeString } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IssueEditor } from "./issue-editor";

interface CommentItemProps {
  comment: IssueComment;
  projectId: string;
  issueNumber: number;
  currentUserId?: string;
}

export default function CommentItem({
  comment,
  projectId,
  issueNumber,
  currentUserId,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { mutate: updateComment, isPending: isUpdatingComment } =
    useUpdateCommentMutation(projectId, issueNumber, comment.id);

  const { mutate: deleteComment, isPending: isDeletingComment } =
    useDeleteCommentMutation(projectId, issueNumber, comment.id);

  const handleSaveEdit = (newCommentHtml: string) => {
    if (newCommentHtml === comment.comment) {
      setIsEditing(false);
      return;
    }
    updateComment(
      { comment: newCommentHtml },
      {
        onSuccess: () => {
          toast.success("Comment updated.");
          setIsEditing(false);
        },
        onError: (err) => {
          toast.error(`Failed to update comment: ${err.message}`);
        },
      }
    );
  };

  const handleDelete = () => {
    // Optional: Add confirmation dialog here
    deleteComment(undefined, {
      onSuccess: () => {
        toast.success("Comment deleted.");
        // No need to setIsEditing(false) as the component might unmount
      },
      onError: (err) => {
        toast.error(`Failed to delete comment: ${err.message}`);
      },
    });
  };

  const canEditOrDelete = currentUserId === comment.author.id;

  return (
    <div className="flex items-start gap-4">
      <Avatar className="mt-1 flex-shrink-0">
        <AvatarImage src={comment.author.profilePicture} alt="User Avatar" />
        <AvatarFallback>
          {getInitials(comment.author.name, comment.author.email)}
        </AvatarFallback>
      </Avatar>

      {isEditing ? (
        <div className="flex-grow max-w-none">
          <IssueEditor
            initialContent={comment.comment}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
            isLoading={isUpdatingComment}
            placeholder="Edit your comment..."
            minHeight="125px"
            showControls={true}
          />
        </div>
      ) : (
        <div className="border rounded-md bg-card text-card-foreground flex-grow">
          <div className="flex items-center justify-between p-3 border-b bg-muted/50 rounded-t-md">
            <span className="text-sm font-semibold text-muted-foreground">
              <strong>{comment.author.name || comment.author.email}</strong>{" "}
              commented {getRelativeTimeString(comment.createdAt)}
              {comment.createdAt !== comment.updatedAt && " (edited)"}
            </span>
            {canEditOrDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={isUpdatingComment || isDeletingComment}
                  >
                    {isUpdatingComment || isDeletingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600 focus:bg-red-100"
                    disabled={isDeletingComment}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div
            className="p-4 max-w-none"
            dangerouslySetInnerHTML={{ __html: comment.comment }}
          />
        </div>
      )}
    </div>
  );
}
