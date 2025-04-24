"use client";

import { SearchBar } from "@/features/chat/threads/components";
import { SitesList, SitesMap } from "@/features/sites/components";
import useInfiniteGetSitesQuery from "@/features/sites/api/get-sites";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function SitesPage() {
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

  const sitesWithCoords = useMemo(() => {
    return data?.pages
      ?.flatMap((page) => page.data)
      .filter((site) => site.latitude && site.longitude);
  }, [data]);

  return (
    <main className="flex-1 w-full mx-auto h-full">
      <div className="flex flex-col lg:flex-row h-full">
        <div className="w-full lg:w-1/2 relative lg:h-full flex justify-center items-center rounded-xl p-0">
          <div className="h-full w-full relative">
            <SitesMap
              sites={sitesWithCoords}
              isLoading={isLoading || isFetchingAll}
              hoveredSiteId={hoveredSiteId}
            />
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex flex-col gap-6 py-8 px-12">
          <h1 className="text-2xl font-bold">Sites</h1>
          <SearchBar className="mb-4" />
          <SitesList onSiteHover={setHoveredSiteId} />
        </div>
      </div>
    </main>
  );
}
