import { SearchBar } from "@/features/chat/threads/components";
import SitesList from "@/features/sites/components/sites-list";

export default function SitesPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold ">Sites</h1>
      </div>
      <SearchBar />
      <SitesList />
    </main>
  );
}
