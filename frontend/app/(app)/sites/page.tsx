"use client";

import { useWorkspace } from "@/components/sidebar/workspace-context";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
import { usePermissions } from "@/features/permissions/context";
// Import the new map component and potentially a modified query hook
import {
  SitesList,
  SiteMutationDialog,
  SitesMap,
} from "@/features/sites/components";
// Assuming you have or create a hook to get *all* sites, or adjust the existing one
// import useGetAllSitesQuery from "@/features/sites/api/get-all-sites"; // Example hook
import useInfiniteGetSitesQuery from "@/features/sites/api/get-sites"; // Using existing hook for demo
import { useSearchParams } from "next/navigation"; // Import useSearchParams
import { useState, useMemo, useEffect } from "react"; // Import useEffect

export default function SitesPage() {
  const { activeWorkspace } = useWorkspace();
  const { canCreateOrgSites } = usePermissions();
  const [showCreateSiteDialog, setShowCreateSiteDialog] = useState(false);
  const searchParams = useSearchParams(); // Get search params
  const search = useMemo(
    () => searchParams.get("search") || "",
    [searchParams]
  );
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null);

  // Fetching data for both Map and List
  // NOTE: Using infinite query here is NOT ideal for the map which needs all data.
  // Ideally, use a separate query like `useGetAllSitesQuery` without pagination,
  // or fetch all pages of the infinite query if the total number is manageable.
  // This example fetches *all* pages of the infinite query for simplicity.
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading: isLoadingList, // Rename to avoid conflict if using separate queries
    isFetchingNextPage,
  } = useInfiniteGetSitesQuery({ search, limit: 50 }); // Increase limit or fetch all

  const [isFetchingAll, setIsFetchingAll] = useState(true);

  // Effect to fetch all pages for the map
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    } else if (!hasNextPage && !isFetchingNextPage) {
      // Once all pages are fetched, set loading state to false
      setIsFetchingAll(false);
    }
  }, [data, hasNextPage, fetchNextPage, isFetchingNextPage]);

  // Combine all pages for the map and list
  const allSites = useMemo(() => {
    return data?.pages.flatMap((page) => page.data);
  }, [data]);

  // Overall loading state considers initial load and fetching all pages
  const isLoading = isLoadingList || isFetchingAll;

  return (
    <main className="flex-1 w-full mx-auto h-full">
      <div className="flex flex-col lg:flex-row lg:gap-0 h-full">
        {/* Left Column: Map */}
        <div className="w-full lg:w-1/2 lg:mb-0 relative lg:h-full flex justify-center items-center rounded-xl p-0">
          <div className="h-full w-full rounded-xl overflow-hidden relative">
            <SitesMap
              sites={allSites}
              isLoading={isLoading}
              hoveredSiteId={hoveredSiteId}
            />
          </div>
        </div>

        {/* Right Column: Header, Search, List */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6 py-8 px-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Sites</h1>
            <Button
              disabled={!canCreateOrgSites}
              onClick={() => setShowCreateSiteDialog(true)}
            >
              Create Site
            </Button>
          </div>
          {/* Search Bar */}
          <SearchBar />
          {/* Sites List */}
          <SitesList onSiteHover={setHoveredSiteId} />
        </div>
      </div>

      {/* Dialog remains outside the main layout flex container */}
      <SiteMutationDialog
        organizationId={
          activeWorkspace?.type === "organization"
            ? // ... existing code ...
              activeWorkspace.id
            : undefined
        }
        mode="create"
        showDialog={showCreateSiteDialog}
        setShowDialog={setShowCreateSiteDialog}
      />
    </main>
  );
}
