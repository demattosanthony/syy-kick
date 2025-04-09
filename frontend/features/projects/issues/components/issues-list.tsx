"use client";

import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useGetIssues } from "../api";
import React, { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { getRelativeTimeString } from "@/lib/utils";
import { CheckCircle, CircleDot, Inbox } from "lucide-react";
import { IssueStatus } from "../issues.types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter, useSearchParams } from "next/navigation";

interface IssuesListProps {
  projectId: string;
  searchTerm?: string;
}

export function IssuesList({ projectId, searchTerm }: IssuesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filterStatus: IssueStatus =
    (searchParams.get("status") as IssueStatus) || "open";

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useGetIssues(projectId, {
      status: filterStatus,
      searchTerm: searchTerm,
    });

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

  // Check if there are any issues after loading and no error
  const hasIssues = data?.pages.some((page) => page.data.length > 0);

  return (
    <div>
      <div className="divide-y divide-border border rounded-lg">
        {/* Filter Buttons Header */}
        <div className="flex items-center px-4 bg-secondary rounded-t-lg h-12">
          <Button
            variant="ghost"
            className={`rounded-none  ${
              filterStatus === "open"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground"
            } px-4 py-2 -mb-px hover:bg-transparent hover:text-primary`}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set("status", "open");
              router.push(`?${params.toString()}`);
            }}
          >
            Open ({data?.pages[0].pagination.totalOpen})
          </Button>
          <Button
            variant="ghost"
            className={`rounded-none  ${
              filterStatus === "closed"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground"
            } px-4 py-2 -mb-px hover:bg-transparent hover:text-primary`}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set("status", "closed");
              router.push(`?${params.toString()}`);
            }}
          >
            Closed ({data?.pages[0].pagination.totalClosed})
          </Button>
        </div>

        {isLoading && (
          <>
            {[...Array(3)].map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-4" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </>
        )}

        {!isLoading && !hasIssues && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mb-4 text-gray-400" />
            {searchTerm ? (
              <p className="text-sm font-medium">
                No issues match your search.
              </p>
            ) : (
              <>
                <p className="text-sm font-medium">No issues yet.</p>
                <p className="text-xs">
                  Be the first to create an issue for this project!
                </p>
              </>
            )}
          </div>
        )}

        {!isLoading && hasIssues && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
