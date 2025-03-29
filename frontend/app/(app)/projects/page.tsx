"use server";

import { ProjectsList } from "@/features/projects/components";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
import { CreateProjectDialog } from "@/features/projects/components";
import api from "@/lib/api";
import { SiteHeader } from "@/features/sites/components";
import ProjectsFilters from "@/features/projects/components/projects-filters";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { Slash } from "lucide-react";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; siteId?: string }>;
}) {
  // Get search parameter from URL
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams.search ?? "";

  // Fetch projects server-side
  const projectsData = await api.projects
    .listProjects({
      search,
      page: 1,
      limit: 10,
      siteId: resolvedSearchParams.siteId,
    })
    .catch(() => ({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
    }));

  const siteData = resolvedSearchParams.siteId
    ? await api.sites.getSite(resolvedSearchParams.siteId)
    : null;

  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      {siteData && (
        <>
          <Breadcrumb className="absolute top-4 left-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link
                  href="/sites"
                  className="hover:text-blue-500 hover:underline"
                >
                  Sites
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash className="w-4 h-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <span className="font-bold">{siteData.name}</span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <SiteHeader site={siteData} />
        </>
      )}

      <div className="flex items-center justify-between mb-6 mt-6">
        <h1 className="text-2xl font-bold ">Projects</h1>

        {resolvedSearchParams.siteId && siteData && (
          <CreateProjectDialog
            trigger={<Button>Create Project</Button>}
            siteId={resolvedSearchParams.siteId}
            organizationId={siteData.organizationId}
          />
        )}
      </div>
      <div className="flex items-center justify-between mb-6 mt-6 gap-2">
        <SearchBar initialSearch={search} className="flex-1" />
        <ProjectsFilters />
      </div>
      <ProjectsList initialProjects={projectsData} />
    </main>
  );
}
