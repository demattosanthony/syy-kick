"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useThreadsQuery } from "@/queries/queries";
import { Thread } from "@/types/chat";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { getModelIconPath } from "../ModelSelector";
import { Skeleton } from "../ui/skeleton";

export default function ThreadsList() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useThreadsQuery(search);

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
    <ScrollArea className="h-[calc(100vh-175px)] px-2">
      {threads?.map((thread, i) => (
        <ThreadItem key={i} thread={thread} />
      ))}

      <div ref={scrollRef} className="h-10">
        {(isFetchingNextPage || isLoading) && (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ThreadSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function ThreadItem({ thread }: { thread: Thread }) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  const provider = lastMessage?.provider;
  const model = lastMessage?.model;
  const title = thread.title;
  if (
    !lastMessage ||
    !lastMessage.content.text ||
    typeof lastMessage.content.text !== "string"
  )
    return null;

  return (
    <Link href={`/threads/${thread.id}`} prefetch>
      <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="flex-shrink-0 w-6 h-6">
            <AvatarImage
              src={
                provider ? getModelIconPath(provider) || "" : "/ai-avatar.png"
              }
            />
            <AvatarFallback />
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {title
                ? title
                : lastMessage.role === "user"
                ? "You"
                : model
                ? model
                : "AI Assistant"}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-[calc(100vw-8rem)] md:max-w-full">
              {lastMessage.content.text}
            </p>
            <time className="text-xs text-muted-foreground">
              {new Date(lastMessage.createdAt).toLocaleDateString()}
            </time>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ThreadSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/4 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
