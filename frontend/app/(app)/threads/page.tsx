"use server";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar, ThreadsList } from "@/features/chat/threads/components";
import api from "@/lib/api";

export default async function ThreadsPage() {
  const threads = await api.threads.getThreads().catch((err) => {
    console.error(err);
    return [];
  });

  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Threads</h1>
      <SearchBar />

      <div className="h-[calc(100vh-175px)]">
        <ScrollArea className="h-full">
          <div className="px-2">
            <ThreadsList initalThreads={threads} />
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}
