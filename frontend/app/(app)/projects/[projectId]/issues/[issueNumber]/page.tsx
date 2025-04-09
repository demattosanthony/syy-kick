"use client";

import { useGetIssue } from "@/features/projects/issues/api/get-issue";
import { useParams, useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDeleteIssue, useUpdateIssue } from "@/features/projects/issues/api";
import { toast } from "sonner";
import { useCreateCommentMutation } from "@/features/projects/issues/api/create-comment";
import { useMeQuery } from "@/features/user/api";
import { useProjectMembersQuery } from "@/features/projects/api/get-project-members";
import { IssueHeader } from "@/features/projects/issues/components/issue-header";
import { IssueDescription } from "@/features/projects/issues/components/issue-description";
import { IssueSidebar } from "@/features/projects/issues/components/issue-sidebar";
import { IssueCommentSection } from "@/features/projects/issues/components/issue-comment-section";
import { UpdateIssueData } from "@/features/projects/issues/issues.types";

export default function IssueDetailPage() {
  const router = useRouter();
  const params = useParams<{
    projectId: string;
    issueNumber: string;
  }>();

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
  const { data: members, isLoading: isLoadingMembers } =
    useProjectMembersQuery(projectId);

  const { mutateAsync: updateIssue, isPending: isUpdating } = useUpdateIssue();

  const { mutateAsync: createComment, isPending: isCreatingComment } =
    useCreateCommentMutation(projectId, issueNumberInt);

  const { mutateAsync: deleteIssue } = useDeleteIssue();

  // --- Handlers that call mutations ---

  const handleUpdateIssue = async (data: UpdateIssueData) => {
    if (!issue) return;
    try {
      await updateIssue({
        projectId,
        issueNumber: issue.issueNumber,
        data,
      });
      toast.success("Issue updated successfully!");
    } catch (err: any) {
      toast.error(`Failed to update issue: ${err.message}`);
      throw err;
    }
  };

  const handleSaveTitle = (newTitle: string) => {
    return handleUpdateIssue({ title: newTitle });
  };

  const handleSaveDescription = (newDescription: string) => {
    return handleUpdateIssue({ description: newDescription });
  };

  const handleAssigneesChange = (assigneeIds: string[]) => {
    return handleUpdateIssue({ assignees: assigneeIds });
  };

  const handleToggleIssueStatus = () => {
    if (!issue) return;
    const newStatus = issue.status === "open" ? "closed" : "open";
    handleUpdateIssue({ status: newStatus });
  };

  const handleCreateComment = async (commentHtml: string) => {
    try {
      await createComment({ comment: commentHtml });
    } catch (err: any) {
      toast.error(`Failed to create comment: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteIssue = async () => {
    try {
      await deleteIssue({ projectId, issueNumber: issueNumberInt });
      router.push(`/projects/${projectId}/issues`);
    } catch (err: any) {
      toast.error(`Failed to delete issue: ${err.message}`);
      throw err;
    }
  };

  // --- Render Logic ---

  if (isLoading) {
    return null;
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-5xl h-full w-full">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error?.message || "Could not load the issue details."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!issue) {
    return null;
  }

  return (
    // Use flex container for layout
    <div className="container mx-auto p-4 max-w-5xl h-full w-full flex flex-1 flex-col">
      <IssueHeader
        issue={issue}
        isUpdating={isUpdating}
        onSaveTitle={handleSaveTitle}
      />

      <div className="flex flex-1 mt-4 gap-6">
        <div className="flex-1 flex flex-col pr-4">
          <IssueDescription
            issue={issue}
            isUpdating={isUpdating}
            onSaveDescription={handleSaveDescription}
          />
          <IssueCommentSection
            comments={issue.comments}
            projectId={projectId}
            issueNumber={issueNumberInt}
            currentUser={user || undefined}
            isCreatingComment={isCreatingComment}
            isUpdatingIssue={isUpdating}
            onCreateComment={handleCreateComment}
            issueStatus={issue.status}
            onToggleIssueStatus={handleToggleIssueStatus}
          />
        </div>
        {/* Sidebar */}
        <IssueSidebar
          issue={issue}
          projectMembers={members || []}
          isLoadingMembers={isLoadingMembers}
          isUpdating={isUpdating}
          onAssigneesChange={handleAssigneesChange}
          onDeleteIssue={handleDeleteIssue}
        />
      </div>
    </div>
  );
}
