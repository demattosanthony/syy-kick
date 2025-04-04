import { ProjectsHeader } from "@/features/projects/components";
import ProjectNavigationTabs from "@/features/projects/components/project-nav-tabs";

export default function ProjectPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center flex-col relative">
      <ProjectsHeader />

      <ProjectNavigationTabs />

      <div className="pt-2 w-full flex flex-1 justify-center">{children}</div>
    </div>
  );
}
