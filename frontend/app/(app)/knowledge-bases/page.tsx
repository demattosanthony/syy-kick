"use server";

import api from "@/lib/api";
import KnowledgeBasesList from "@/features/knowledge-bases/components/knowledge-bases-list";
import { SearchBar } from "@/features/chat/threads/components";
import CreateKnowledgeBaseDialog from "@/features/knowledge-bases/components/create-knowledge-base-dialog";
import { Button } from "@/components/ui/button";

export default async function KnowledgeBasesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  // Get search parameter from URL
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams.search || "";

  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold ">Knowledge Bases</h1>

        <CreateKnowledgeBaseDialog
          trigger={<Button>Create Knowledge Base</Button>}
        />
      </div>

      <SearchBar initialSearch={search} />
      <KnowledgeBasesList />
    </main>
  );
}
