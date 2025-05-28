import { Button } from "@/components/ui/button";
import { useDeleteCommentMutation, useUpdateCommentMutation } from "../api";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { Comment } from "../types";

interface CommentListItemProps {
    workflowId: string;
    runId: string;
    comment: Comment;
    currentUserId: string;
}

export function CommentListItem({
    workflowId,
    runId,
    comment,
    currentUserId
}: CommentListItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedComment, setEditedComment] = useState(comment.comment);
    const updateComment = useUpdateCommentMutation();
    const deleteComment = useDeleteCommentMutation();

    const handleUpdate = async () => {
        try {
            await updateComment.mutateAsync({
                workflowId,
                runId,
                commentId: comment.id,
                comment: editedComment
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update comment:", error);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this comment?")) return;

        try {
            await deleteComment.mutateAsync({
                workflowId,
                runId,
                commentId: comment.id
            });
        } catch (error) {
            console.error("Failed to delete comment:", error);
        }
    };

    const isOwner = comment.user.id === currentUserId;

    return (
        <div className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-medium">{comment.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>
                </div>
                {isOwner && !isEditing && (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            className="text-red-500 hover:text-red-600"
                        >
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-2">
                    <Textarea
                        value={editedComment}
                        onChange={(e) => setEditedComment(e.target.value)}
                        className="min-h-[100px]"
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setIsEditing(false);
                                setEditedComment(comment.comment);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={!editedComment.trim() || updateComment.isPending}
                        >
                            {updateComment.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="whitespace-pre-wrap">{comment.comment}</p>
            )}
        </div>
    );
}
