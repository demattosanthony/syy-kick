"use client";

import { CreateProjectDialog, ProjectsList } from "@/features/projects/components";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/features/chat/threads/components";

export default function ProjectsPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold ">Projects</h1>

        <CreateProjectDialog trigger={<Button>Create Project</Button>} />
      </div>
      <SearchBar />
      <ProjectsList />
    </main>
  );
}
