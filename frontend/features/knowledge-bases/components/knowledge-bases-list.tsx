"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getRelativeTimeString } from "@/lib/utils";
import { BookMarked, BookOpen, MoreHorizontal, Trash } from "lucide-react";
import { useInfiniteKnowledgeBasesQuery } from "../api/get-knowledge-bases";
import { KnowledgeBase } from "../types/knowledge-bases";
import { useDeleteKnowledgeBase } from "../api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/features/permissions/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const KnowledgeBasesList = ({
  initalData,
}: {
  initalData: {
    data: KnowledgeBase[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
}) => {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use the infinite query hook instead of the regular query
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteKnowledgeBasesQuery({
      search,
      limit: 10,
      initalData: {
        pages: [initalData],
        pageParams: [1],
      },
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { canDeleteOrgKnowledgeBaseDocs } = usePermissions();
  const deleteKnowledgeBaseMutation = useDeleteKnowledgeBase();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    await deleteKnowledgeBaseMutation.mutateAsync(knowledgeBase.id);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDeleteDialogOpen(open);
  };

  return (
    <>
      <Link href={`/knowledge-bases/${knowledgeBase.id}`} prefetch>
        <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full group">
          <div className="flex items-center gap-4 min-w-0">
            <div className="text-muted-foreground relative">
              <BookMarked className="w-6 h-6 absolute transition-opacity duration-200 group-hover:opacity-0" />
              <BookOpen className="w-6 h-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xl font-medium">{knowledgeBase.name}</p>
              <p className="text-xs text-muted-foreground">
                Updated {getRelativeTimeString(knowledgeBase.updatedAt)}
              </p>
            </div>

            {canDeleteOrgKnowledgeBaseDocs && (
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-fit">
                      <DropdownMenuItem
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        onClick={handleDelete}
                      >
                        <Trash className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Alert Dialog placed outside the Link component */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the knowledge base "
              {knowledgeBase.name}" and all its contents. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
