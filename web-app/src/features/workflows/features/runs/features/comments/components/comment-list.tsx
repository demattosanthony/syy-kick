import { useGetCommentsQuery } from "../api/get-comments";
import { CommentListItem } from "./comment-list-item";
import { Skeleton } from "@/components/ui/skeleton";

interface CommentListProps {
    workflowId: string;
    runId: string;
    currentUserId: string;
}

export function CommentList({ workflowId, runId, currentUserId }: CommentListProps) {
    const { data: comments, isLoading } = useGetCommentsQuery(workflowId, runId);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                        <Skeleton className="h-20 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    if (!comments?.length) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No comments yet. Add one!
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {comments.map((comment) => (
                <CommentListItem
                    key={comment.id}
                    workflowId={workflowId}
                    runId={runId}
                    comment={comment}
                    currentUserId={currentUserId}
                />
            ))}
        </div>
    );
}
