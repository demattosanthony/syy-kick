"use client";

import { SearchBar } from "@/features/chat/threads/components";
import { WorkflowsList } from "@/features/workflows/components";

export default function WorkflowsPage() {
  return (
    <div className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Workflows</h1>
      <SearchBar />

      <WorkflowsList />
    </div>
  );
}
