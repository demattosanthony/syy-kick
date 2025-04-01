import { Skeleton } from "@/components/ui/skeleton";
// Import necessary components
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
// Remove SitesList import
// import { SitesList } from "@/features/sites/components";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

export default function Loading() {
  // Mimic the layout of the SitesPage component using actual elements where possible
  return (
    <main className="flex-1 w-full mx-auto h-full">
      <div className="flex flex-col lg:flex-row h-full">
        {/* Map Placeholder - Keep Skeleton for complex visual */}
        <div className="w-full lg:w-1/2 relative lg:h-full flex justify-center items-center rounded-xl p-0">
          <Skeleton className="h-full w-full" />
        </div>
        {/* List and Controls Placeholder */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6 py-8 px-12">
          {/* Header with actual elements */}
          <div className="flex items-center justify-between">
            {/* Actual Title */}
            <h1 className="text-2xl font-bold">Sites</h1>
            {/* Actual Button, but disabled */}
            <Button disabled={true}>Create Site</Button>
          </div>
          {/* Actual Search Bar */}
          <SearchBar />
          {/* Skeleton placeholder for Sites List */}
          {/* Wrap skeletons in ScrollArea to mimic SitesList layout */}
          <ScrollArea className="h-[calc(100vh-175px)] px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mimic a few list items using Skeletons */}
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full" /> // Adjust height to resemble SiteItem
              ))}
            </div>
          </ScrollArea>
          {/* Remove actual SitesList component */}
          {/* <SitesList onSiteHover={() => {}} isLoading={true} /> */}
          {/* If SitesList doesn't handle isLoading, fallback to skeleton: */}
          {/* <Skeleton className="h-64 w-full" /> */}
        </div>
      </div>
    </main>
  );
}
