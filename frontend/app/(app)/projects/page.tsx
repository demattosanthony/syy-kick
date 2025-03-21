"use server";

import { ProjectsList } from "@/features/projects/components";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";
import { CreateProjectDialog } from "@/features/projects/components";
import api from "@/lib/api";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  // Get search parameter from URL
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams.search || "";

  // Fetch projects server-side
  const projectsData = await api.projects.listProjects({
    search,
    page: 1,
    limit: 10,
  });

  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold ">Projects</h1>

        {/* Client component needs to be wrapped */}
        <div suppressHydrationWarning>
          <CreateProjectDialog trigger={<Button>Create Project</Button>} />
        </div>
      </div>
      <SearchBar initialSearch={search} />
      <ProjectsList initialProjects={projectsData} searchQuery={search} />
    </main>
  );
}
