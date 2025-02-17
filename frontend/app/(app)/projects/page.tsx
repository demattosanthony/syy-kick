"use client";

import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import ProjectsList from "@/components/projects/projects-list";
import SearchBar from "@/components/threads/threads-search";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold ">Projects</h1>

        <CreateProjectDialog
          trigger={<Button variant={"ghost"}>Create Project</Button>}
        />
      </div>
      <SearchBar />
      <ProjectsList />
    </main>
  );
}
