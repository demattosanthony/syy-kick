import { SearchBar } from "@/features/chat/threads/components";
import { WorkflowsList } from "@/features/workflows/components";

export function WorkflowsPage() {
  return (
    <div className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex w-full items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workflows</h1>
      </div>
      <SearchBar />

      <WorkflowsList />
    </div>
  );
}
