"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import useInfiniteGetSitesQuery from "../api/get-sites";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Site } from "../types/sites";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteDialog from "./site-mutation-dialog";

const SitesList = () => {
  const searchParams = useSearchParams();
  const search = useMemo(
    () => searchParams.get("search") || "",
    [searchParams]
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteGetSitesQuery({ search, limit: 10 });

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

  const sites = useMemo(() => {
    return data?.pages.flatMap((page) => page.data);
  }, [data]);

  if (!sites) {
    return null;
  }

  return (
    <ScrollArea className="h-[calc(100vh-175px)] px-2">
      {sites.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No sites found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sites.map((site) => (
            <SiteItem key={site.id} site={site} />
          ))}

          <div ref={scrollRef} className="h-10">
            {(isFetchingNextPage || isLoading) && (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SitesSkeleton key={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </ScrollArea>
  );
};

export default SitesList;

function SitesSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-6 h-6 rounded flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 w-1/3 mb-2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </div>
  );
}

function SiteItem({ site }: { site: Site }) {
  const { name, description, address, createdAt, updatedAt } = site;
  const formattedAddress = `${address.address}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;

  const createdDate = new Date(createdAt);
  const updatedDate = new Date(updatedAt);
  const createdTimeAgo = useMemo(() => {
    const now = new Date();
    const diffInMs = now.getTime() - createdDate.getTime();
    const diffInYears = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));
    const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
    if (diffInYears >= 1) {
      return diffInYears > 1
        ? `Created over ${diffInYears} years ago`
        : `Created about ${diffInYears} year ago`;
    }
    return diffInMonths > 1
      ? `Created about ${diffInMonths} months ago`
      : `Created less than a month ago`;
  }, [createdDate]);

  const updatedTimeAgo = useMemo(() => {
    const now = new Date();
    const diffInMs = now.getTime() - updatedDate.getTime();
    const diffInYears = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));
    const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
    if (diffInYears >= 1) {
      return diffInYears > 1
        ? `Updated over ${diffInYears} years ago`
        : `Updated about ${diffInYears} year ago`;
    }
    return diffInMonths > 1
      ? `Updated about ${diffInMonths} months ago`
      : `Updated less than a month ago`;
  }, [updatedDate]);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{name}</CardTitle>
            {description && (
              <CardDescription className="mt-1 line-clamp-2">
                {description}
              </CardDescription>
            )}
          </div>
          <Badge variant="outline" className="bg-primary/10">
            Site
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm">{formattedAddress}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Created {createdTimeAgo}</span>
            </div>
            {updatedAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Updated {updatedTimeAgo}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <div className="flex w-full gap-2">
          <Link href={`/projects?siteId=${site.id}`}>
            <Button
              variant="outline"
              size="lg"
              className="w-40"
              onClick={() => {}}
            >
              View Details
            </Button>
          </Link>
          <SiteDialog
            trigger={
              <Button
                variant="default"
                size="lg"
                className="w-40"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                Edit Site
              </Button>
            }
            mode="update"
            site={site}
          />
        </div>
      </CardFooter>
    </Card>
  );
}
