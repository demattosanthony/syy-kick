"use client";

import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
import { WorkflowsList } from "@/features/workflows/components";
import Link from "next/link";

export default function WorkflowsPage() {
  return (
    <div className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex w-full items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workflows</h1>
        <Link
          href={
            "https://docs.google.com/forms/d/e/1FAIpQLSemgsKiKIv5Y5i6caXIFByJbGC2wTcSRiDuKytbRUY5ai_iYQ/viewform?usp=sharing"
          }
          target="_blank"
        >
          <Button>Request Workflow</Button>
        </Link>
      </div>
      <SearchBar />

      <WorkflowsList />
    </div>
  );
}
