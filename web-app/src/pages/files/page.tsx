import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "@/features/chat/threads/components";
import { FilesList } from "@/features/files/components";

export function FilesPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Files</h1>
      <SearchBar placeholder="Search files..." />

      <div className="h-[calc(100vh-175px)]">
        <ScrollArea className="h-full">
          <div className="px-2">
            <FilesList />
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}
