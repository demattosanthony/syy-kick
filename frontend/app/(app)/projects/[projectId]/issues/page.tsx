"use client";

import { IssuesList } from "@/features/projects/issues/components/issues-list";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import useDebounce from "@/hooks/use-debounce";
import { Search, X } from "lucide-react";

export default function ProjectIssuesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchTermFromParams = searchParams.get("search") || "";

  const [inputValue, setInputValue] = useState(searchTermFromParams);
  const debouncedSearchTerm = useDebounce(inputValue, 300);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearchTerm) {
      params.set("search", debouncedSearchTerm);
    } else {
      params.delete("search");
    }

    router.replace(`?${params.toString()}`);
  }, [debouncedSearchTerm, searchParams, router]);

  useEffect(() => {
    setInputValue(searchTermFromParams);
  }, [searchTermFromParams]);

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            className="pl-8 pr-10"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          {inputValue && (
            <X
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
              onClick={() => setInputValue("")}
            />
          )}
        </div>
        <Link href={`/projects/${projectId}/issues/new`}>
          <Button>New Issue</Button>
        </Link>
      </div>
      <IssuesList projectId={projectId} searchTerm={searchTermFromParams} />
    </div>
  );
}
