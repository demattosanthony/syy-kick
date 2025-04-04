"use client";

import { useGetIssue } from "@/features/projects/issues/api/get-issue";
import { useParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn, getRelativeTimeString } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function IssueDetailPage() {
  const params = useParams<{
    projectId: string;
    issueNumber: string;
  }>();

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

  if (isLoading) {
    // TODO: Replace with a proper loading skeleton component
    return <div>Loading issue details...</div>;
  }

  if (error || !issue) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error?.message || "Could not load the issue details."}
        </AlertDescription>
      </Alert>
    );
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
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Badge
            variant={issue.status === "open" ? "default" : "destructive"}
            className={cn(
              "text-sm font-medium rounded-md",
              issue.status === "open"
                ? "bg-green-100 text-green-500"
                : "bg-red-100 text-purple-500"
            )}
          >
            {issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
          </Badge>
          {/* <span>
            <strong>{issue.creator.name || issue.creator.email}</strong> opened
            this issue {getRelativeTimeString(issue.createdAt)} ago
          </span> */}
        </div>
      </div>

      {/* Issue Body */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main Content (Description) */}
        <div className="flex-grow">
          {/* Wrap Avatar and Description box in a flex container */}
          <div className="flex items-start gap-4">
            <Avatar className="mt-1 flex-shrink-0">
              <AvatarImage
                src={issue.creator.profilePicture}
                alt="User Avatar"
              />
              <AvatarFallback />
            </Avatar>

            {/* Description Box */}
            <div className="border rounded-md p-4 bg-card text-card-foreground flex-grow">
              {/* Added flex-grow to take remaining space */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b">
                {/* Header for the description box */}
                <span className="text-sm font-semibold text-muted-foreground">
                  <strong>{issue.creator.name || issue.creator.email}</strong>{" "}
                  commented {getRelativeTimeString(issue.createdAt)}
                </span>
                {/* TODO: Add options dropdown (edit, delete, etc.) */}
              </div>
              <div className="p-2 max-w-none">
                {issue.description ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: issue.description /* or safeDescriptionHtml */,
                    }}
                  />
                ) : (
                  <p className="italic text-gray-500">
                    No description provided.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* // TODO: Add comment section */}
        </div>

        {/* Sidebar (Placeholder) */}
        <aside className="w-full md:w-64 lg:w-72 space-y-4">
          {/* // TODO: Implement sidebar components (Assignees, Labels, Projects, etc.) */}
        </aside>
      </div>
    </div>
  );
}
