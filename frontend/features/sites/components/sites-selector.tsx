"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useInfiniteGetSitesQuery from "../api/get-sites";
import { useEffect, useMemo, useRef } from "react";
import { Site } from "../types/sites";
import { Skeleton } from "@/components/ui/skeleton";

export default function SitesSelector({
  value,
  onValueChange,
  disabled,
}: {
  value?: string | null;
  onValueChange: (value: string) => void;
  disabled: boolean;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteGetSitesQuery({
      search: "",
      limit: 10,
    });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = scrollRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sites: Site[] | undefined = useMemo(() => {
    return data?.pages.flatMap((page) => page.data);
  }, [data]);

  if (!sites) {
    return null;
  }

  return (
    <Select
      value={value ?? ""}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger id="site-select" className="w-full mt-1">
        <SelectValue placeholder="Select a site" />
      </SelectTrigger>
      <SelectContent>
        {sites.map((site) => (
          <SelectItem
            key={site.id}
            value={site.id}
            className="hover:cursor-pointer hover:bg-gray-100"
          >
            {site.name}
          </SelectItem>
        ))}
        {sites.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-4">No sites found</p>
        )}
        <div ref={scrollRef} className="h-10">
          {(isFetchingNextPage || isLoading) && (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} />
              ))}
            </div>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
