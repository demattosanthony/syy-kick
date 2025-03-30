import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThreadSkeleton } from "@/features/chat/threads/components/threads-list";
import { Search } from "lucide-react";

export default function WorkflowsLoading() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Workflows</h1>

      <div className={`relative `}>
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4" />
        <Input
          type="search"
          placeholder={"Search..."}
          className="w-full pl-9 py-2 border-none bg-accent"
        />
      </div>

      <div className="h-[calc(100vh-175px)] mt-6">
        <ScrollArea className="h-full">
          <div className="px-2">
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ThreadSkeleton key={i} compact={false} />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}
