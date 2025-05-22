import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCommentMutation } from "../api/create-comment";
import { useState } from "react";
import { toast } from "sonner";

interface CommentFormProps {
    workflowId: string;
    runId: string;
}

export function CommentForm({ workflowId, runId }: CommentFormProps) {
    const [comment, setComment] = useState("");
    const createComment = useCreateCommentMutation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;

        try {
            await createComment.mutateAsync({
                workflowId,
                runId,
                comment: comment.trim()
            });

            toast.success("Comment created successfully");
            setComment("");
        } catch (error) {
            console.error("Failed to create comment:", error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px]"
            />
            <div className="flex justify-end">
                <Button
                    type="submit"
                    disabled={!comment.trim() || createComment.isPending}
                >
                    {createComment.isPending ? "Posting..." : "Post Comment"}
                </Button>
            </div>
        </form>
    );
}
