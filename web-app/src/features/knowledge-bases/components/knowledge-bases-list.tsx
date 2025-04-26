"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getRelativeTimeString } from "@/lib/utils";
import { BookMarked, BookOpen, MoreHorizontal, Trash } from "lucide-react";
import { useInfiniteKnowledgeBasesQuery } from "../api/get-knowledge-bases";
import { KnowledgeBase } from "../types";
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

const KnowledgeBasesList = () => {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteKnowledgeBasesQuery({
      search,
      limit: 10,
    });

  const knowledgeBases = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  const uniqueKnowledgeBases = useMemo(() => {
    if (!knowledgeBases.length) return [];
    const kbMap = new Map<string, KnowledgeBase>();
    knowledgeBases.forEach((kb) => kbMap.set(kb.id, kb));
    return Array.from(kbMap.values());
  }, [knowledgeBases]);

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {isLoading &&
        uniqueKnowledgeBases.length === 0 &&
        Array.from({ length: 4 }).map((_, i) => (
          <KnowledgeBaseSkeleton key={i} />
        ))}

      {!isLoading && uniqueKnowledgeBases.length === 0 && (
        <div className="col-span-1 md:col-span-2 flex items-center justify-center h-full py-10">
          <p className="text-muted-foreground">No knowledge bases found</p>
        </div>
      )}

      {uniqueKnowledgeBases.map((kb) => (
        <KnowledgeBaseItem key={kb.id} knowledgeBase={kb} />
      ))}

      <div ref={scrollRef} className="h-1 col-span-1 md:col-span-2"></div>
      {isFetchingNextPage && (
        <>
          <KnowledgeBaseSkeleton />
          <KnowledgeBaseSkeleton />
        </>
      )}
    </div>
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

  return (
    <>
      <div className="relative group">
        <Link
          href={`/knowledge-bases/${knowledgeBase.id}`}
          prefetch={false}
          className="block p-6 rounded-lg bg-card hover:bg-accent border transition-colors h-full"
        >
          <div className="flex flex-col gap-4 h-full">
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border flex-shrink-0">
              <BookMarked className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <p className="text-lg font-semibold text-card-foreground mb-1 line-clamp-2">
                  {knowledgeBase.name}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Updated {getRelativeTimeString(knowledgeBase.updatedAt)}
              </p>
            </div>
          </div>
        </Link>

        {canDeleteOrgKnowledgeBaseDocs && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                  className="text-destructive hover:!text-destructive focus:!text-destructive hover:!bg-destructive/10 focus:!bg-destructive/10 cursor-pointer flex items-center gap-2"
                  onClick={handleDelete}
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trash className="h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
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
    <div className="p-6 rounded-lg bg-card border">
      <div className="flex flex-col gap-4">
        <Skeleton className="w-10 h-10 rounded-md bg-muted" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2 bg-muted" />
          <Skeleton className="h-4 w-full mb-1 bg-muted" />
          <Skeleton className="h-4 w-5/6 bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default KnowledgeBasesList;
