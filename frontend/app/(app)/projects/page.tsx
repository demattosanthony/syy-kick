"use server";

import ProjectsList from "@/components/projects/projects-list";
import SearchBar from "@/components/threads/threads-search";

export default async function ProjectsPage() {
  return (
    <main className="flex-1 max-w-3xl mx-auto p-4 pt-14 w-full">
      <h1 className="text-2xl font-bold mb-6">Projects</h1>
      <SearchBar />
      <ProjectsList />
    </main>
  );
}
