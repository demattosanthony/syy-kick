import { Thread } from "@/types/chat";
import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreadsQuery } from "@/features/chat/threads/api";
import { cn, getRelativeTimeString } from "@/lib/utils";

export default function ThreadsList({
  compact = false,
  workflowId,
  showLatestMessage = true,
}: {
  compact?: boolean;
  workflowId?: string;
  showLatestMessage?: boolean;
}) {
  const searchParams = useSearchParams();
  const search = searchParams[0].get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useThreadsQuery({
      search,
      workflowId,
    });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = scrollRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const threads = data?.pages.flatMap((page) => page.threads);

  return (
    <div>
      {threads?.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg
            className="w-12 h-12 mb-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg font-medium text-muted-foreground">
            No threads yet
          </p>
        </div>
      ) : (
        <>
          {threads?.map((thread, i) => (
            <ThreadItem
              key={i}
              thread={thread}
              compact={compact}
              showLatestMessage={showLatestMessage}
            />
          ))}

          <div ref={scrollRef} className="h-10">
            {(isFetchingNextPage || isLoading) && (
              <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ThreadSkeleton key={i} compact={compact} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ThreadItem({
  thread,
  compact = false,
  showLatestMessage = true,
}: {
  thread: Thread;
  compact?: boolean;
  showLatestMessage?: boolean;
}) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  const model = lastMessage?.model;
  const title = thread.title;
  if (!lastMessage || !lastMessage.text) return null;

  return (
    <Link to={`/threads/${thread.id}`}>
      <div
        className={`hover:bg-accent ${
          compact ? "p-2" : "p-4"
        } rounded-lg transition-colors max-w-full`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-1 min-w-0">
            <div
              className={` ${
                compact ? "text-sm font-medium" : "text-base font-semibold"
              }`}
            >
              {title
                ? title
                : lastMessage.role === "user"
                ? "You"
                : model
                ? model
                : "AI Assistant"}
            </div>
            {showLatestMessage && (
              <p
                className={cn(
                  "text-sm text-muted-foreground line-clamp-2",
                  compact
                    ? "max-w-[230px] md:max-w-[230px]"
                    : "max-w-[calc(100vw-8rem)] md:max-w-[650px]"
                )}
              >
                {lastMessage.text}
              </p>
            )}
            <time className="text-xs text-muted-foreground">
              {getRelativeTimeString(lastMessage.createdAt)}
            </time>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ThreadSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${compact ? "p-2" : "p-4"}`}>
      <div className="flex items-start gap-4">
        <Skeleton
          className={`rounded-full flex-shrink-0 ${
            compact ? "w-6 h-6" : "w-10 h-10"
          }`}
        />
        <div className="flex-1">
          <Skeleton className={`h-4 w-1/4 mb-2 ${compact ? "h-3" : "h-4"}`} />
          <Skeleton className={`${compact ? "h-3" : "h-4"} w-3/4`} />
        </div>
      </div>
    </div>
  );
}
