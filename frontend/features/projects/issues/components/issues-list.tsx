"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useGetIssues } from "../api";
import React, { useEffect } from "react";
import { useInView } from "react-intersection-observer";

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

  return (
    <div className="divide-y divide-border rounded-lg border">
      {data?.pages.map((page, i) => (
        <React.Fragment key={i}>
          {page.data.map(
            (
              issue // Make sure this property name is correct
            ) => (
              <div
                key={issue.id}
                className="flex items-center gap-4 p-4 hover:bg-muted/50"
              >
                {/* ... existing issue rendering code ... */}
                <Checkbox />
                <div className="relative flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        issue.status === "open" ? "secondary" : "outline"
                      }
                      className={
                        issue.status === "open"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                          : ""
                      }
                    >
                      {issue.status === "open" ? "Open" : "Closed"}
                    </Badge>
                    <Link
                      href={`/projects/${projectId}/${issue.id}`}
                      replace={false}
                      className="font-medium hover:underline"
                    >
                      {issue.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {/* #{is.server_assigned_id} */}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    opened {new Date(issue.createdAt).toLocaleDateString()} by{" "}
                    {/* {topic.creation_author} */}
                  </p>
                </div>
                {/* ... end of existing issue rendering code ... */}
              </div>
            )
          )}
        </React.Fragment>
      ))}

      {hasNextPage && <div ref={ref} style={{ height: "1px" }} />}

      {/* Optional: Show loading indicator at the bottom */}
      {isFetchingNextPage && (
        <div className="p-4 text-center text-muted-foreground">
          Loading more...
        </div>
      )}

      {/* Optional: Show message when all issues are loaded */}
      {!hasNextPage && !isLoading && !isFetchingNextPage && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No more issues
        </div>
      )}
    </div>
  );
}
