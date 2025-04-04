"use client";

import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useGetIssues } from "../api";
import React, { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { getRelativeTimeString } from "@/lib/utils";
import { CheckCircle, CircleDot, Inbox } from "lucide-react";

interface IssuesListProps {
  projectId: string;
}

export function IssuesList({ projectId }: IssuesListProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useGetIssues(projectId);

  console.log("IssuesList data", data);

  // Setup Intersection Observer
  const { ref, inView } = useInView({
    threshold: 0, // Trigger as soon as the element is visible
  });

  // Effect to fetch next page when the ref element comes into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <div>Loading issues...</div>;
  }

  if (error) {
    return <div>Error loading issues: {error.message}</div>;
  }

  // Check if there are any issues after loading and no error
  const hasIssues = data?.pages.some((page) => page.data.length > 0);

  return (
    <div className="divide-y divide-border rounded-lg border ">
      {!hasIssues && (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mb-4 text-gray-400" />
          <p className="text-sm font-medium">No issues yet.</p>
          <p className="text-xs">
            Be the first to create an issue for this project!
          </p>
        </div>
      )}

      {data?.pages.map((page, i) => (
        <React.Fragment key={i}>
          {page.data.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-4 p-4 hover:bg-muted/50"
            >
              <Checkbox />
              <div className="relative flex-1">
                <div className="flex items-center gap-2">
                  {issue.status === "open" ? (
                    <CircleDot className="h-4 w-4 text-green-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                  )}

                  <Link
                    href={`/projects/${projectId}/issues/${issue.issueNumber}`}
                    replace={false}
                    className="font-medium hover:underline hover:text-blue-500"
                  >
                    {issue.title}
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  {issue.creator.name} opened{" "}
                  {getRelativeTimeString(issue.createdAt)}.
                </p>
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}

      {hasNextPage && <div ref={ref} style={{ height: "1px" }} />}
    </div>
  );
}
