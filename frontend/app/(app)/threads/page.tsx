"use server";

import { SearchBar, ThreadsList } from "@/features/chat/threads/components";

export default async function ThreadsPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Threads</h1>
      <SearchBar />
      <ThreadsList />
    </main>
  );
}
