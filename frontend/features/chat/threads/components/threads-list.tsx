"use client";

import { Thread } from "@/types/chat";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreadsQuery } from "@/features/chat/threads/api";
import { getModelIconPath } from "../../messages/utils";
import { cn, getRelativeTimeString } from "@/lib/utils";

export default function ThreadsList({
  projectId,
  compact = false,
  knowledgeBaseId,
}: {
  projectId?: string;
  compact?: boolean;
  knowledgeBaseId?: string;
}) {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useThreadsQuery({
      search,
      projectId,
      knowledgeBaseId,
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
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          No threads found
        </div>
      ) : (
        <>
          {threads?.map((thread, i) => (
            <ThreadItem key={i} thread={thread} compact={compact} />
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
}: {
  thread: Thread;
  compact?: boolean;
}) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  const provider = lastMessage?.provider;
  const model = lastMessage?.model;
  const title = thread.title;
  if (!lastMessage || !lastMessage.text) return null;

  return (
    <Link href={`/threads/${thread.id}`} prefetch={false}>
      <div
        className={`hover:bg-accent ${
          compact ? "p-2" : "p-4"
        } rounded-lg transition-colors max-w-full`}
      >
        <div className="flex items-center gap-4 min-w-0">
          {!compact && (
            <Avatar className="flex-shrink-0 w-6 h-6">
              <AvatarImage
                src={
                  provider ? getModelIconPath(provider) || "" : "/ai-avatar.png"
                }
              />
              <AvatarFallback />
            </Avatar>
          )}

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
            <p
              className={cn(
                "text-sm text-muted-foreground line-clamp-2",
                compact ? "max-w-[230px]" : "max-w-[calc(100vw-8rem)]",
                compact ? "md:max-w-[230px]" : "md:max-w-[calc(100vw-12rem)]"
              )}
            >
              {lastMessage.text}
            </p>
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
