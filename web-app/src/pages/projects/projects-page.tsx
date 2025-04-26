import { ProjectsList } from "@/features/projects/components";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
import { CreateProjectDialog } from "@/features/projects/components";
import { SiteHeader } from "@/features/sites/components";
import ProjectsFilters from "@/features/projects/components/projects-filters";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import { Slash } from "lucide-react";
import { useSearchParams } from "react-router";
import { useGetSiteQuery } from "@/features/sites/api";
import { useWorkspace } from "@/workspace-context";

export function ProjectsPage() {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const siteId = searchParams.get("siteId");

  const { data: site } = useGetSiteQuery({
    siteId,
  });
  const { activeWorkspace } = useWorkspace();

  return (
    <div className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      {site && (
        <>
          <Breadcrumb className="absolute top-4 left-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link
                  to="/sites"
                  className="hover:text-blue-500 hover:underline"
                >
                  Sites
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash className="w-4 h-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <span className="font-bold">{site?.address}</span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <SiteHeader site={site} />
        </>
      )}
      <div className="flex items-center justify-between my-6">
        <h1 className="text-2xl font-bold ">Projects</h1>

        <CreateProjectDialog
          trigger={<Button>Create Project</Button>}
          site={site}
          organizationId={
            activeWorkspace?.type === "organization"
              ? activeWorkspace.id
              : undefined
          }
        />
      </div>
      <div className="flex items-center justify-between mb-6 mt-6 gap-2">
        <SearchBar initialSearch={search} className="flex-1" />
        <ProjectsFilters />
      </div>
      <ProjectsList />
    </div>
  );
}
