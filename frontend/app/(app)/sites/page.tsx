"use client";

import { useWorkspace } from "@/components/sidebar/workspace-context";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
import { usePermissions } from "@/features/permissions/context";
import {
  SitesList,
  SiteMutationDialog,
  SitesMap,
} from "@/features/sites/components";
import useInfiniteGetSitesQuery from "@/features/sites/api/get-sites";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SitesPage() {
  const { activeWorkspace } = useWorkspace();
  const { canCreateOrgSites } = usePermissions();
  const [showCreateSiteDialog, setShowCreateSiteDialog] = useState(false);
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteGetSitesQuery({ search, limit: 50 });
  const [isFetchingAll, setIsFetchingAll] = useState(true);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    else if (!hasNextPage && !isFetchingNextPage) setIsFetchingAll(false);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <main className="flex-1 w-full mx-auto h-full">
      <div className="flex flex-col lg:flex-row h-full">
        <div className="w-full lg:w-1/2 relative lg:h-full flex justify-center items-center rounded-xl p-0">
          <div className="h-full w-full relative">
            <SitesMap
              sites={data?.pages?.flatMap((page) => page.data)}
              isLoading={isLoading || isFetchingAll}
              hoveredSiteId={hoveredSiteId}
            />
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex flex-col gap-6 py-8 px-12">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Sites</h1>
            <Button
              disabled={!canCreateOrgSites}
              onClick={() => setShowCreateSiteDialog(true)}
            >
              Create Site
            </Button>
          </div>
          <SearchBar />
          <SitesList onSiteHover={setHoveredSiteId} />
        </div>
      </div>
      <SiteMutationDialog
        organizationId={
          activeWorkspace?.type === "organization"
            ? activeWorkspace.id
            : undefined
        }
        mode="create"
        showDialog={showCreateSiteDialog}
        setShowDialog={setShowCreateSiteDialog}
      />
    </main>
  );
}
