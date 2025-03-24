"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getRelativeTimeString } from "@/lib/utils";
import { FolderClosed, FolderOpen } from "lucide-react";
import { useInfiniteKnowledgeBasesQuery } from "../api/get-knowledge-bases";
import { KnowledgeBase } from "../types/knowledge-bases";

const KnowledgeBasesList = () => {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use the infinite query hook instead of the regular query
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteKnowledgeBasesQuery({
      search,
      limit: 10,
    });

  // Flatten the pages into a single array of knowledge bases
  const knowledgeBases = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  // Ensure we have unique knowledge bases (in case of overlaps between pages)
  const uniqueKnowledgeBases = useMemo(() => {
    if (!knowledgeBases.length) return [];
    const kbMap = new Map<string, KnowledgeBase>();
    knowledgeBases.forEach((kb) => kbMap.set(kb.id, kb));
    return Array.from(kbMap.values());
  }, [knowledgeBases]);

  // Infinite loading effect
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

    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <ScrollArea className="h-[calc(100vh-175px)] px-2">
      {uniqueKnowledgeBases.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No knowledge bases found</p>
        </div>
      ) : (
        <>
          {uniqueKnowledgeBases.map((kb) => (
            <KnowledgeBaseItem key={kb.id} knowledgeBase={kb} />
          ))}

          <div ref={scrollRef} className="h-10">
            {(isFetchingNextPage || isLoading) && (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <KnowledgeBaseSkeleton key={i} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </ScrollArea>
  );
};

function KnowledgeBaseItem({
  knowledgeBase,
}: {
  knowledgeBase: KnowledgeBase;
}) {
  return (
    <Link href={`/knowledge-bases/${knowledgeBase.id}`} prefetch>
      <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full group">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-muted-foreground relative">
            <FolderClosed className="w-6 h-6 absolute text-blue-400 fill-blue-400 transition-opacity duration-200 group-hover:opacity-0" />
            <FolderOpen className="w-6 h-6 text-blue-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xl font-medium">{knowledgeBase.name}</p>
            <p className="text-xs text-muted-foreground">
              Updated {getRelativeTimeString(knowledgeBase.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function KnowledgeBaseSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-6 h-6 rounded flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 w-1/3 mb-2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default KnowledgeBasesList;
