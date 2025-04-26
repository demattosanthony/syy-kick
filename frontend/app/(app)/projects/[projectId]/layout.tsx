import { ProjectsHeader } from "@/features/projects/components";
import ProjectNavigationTabs from "@/features/projects/components/project-nav-tabs";

export default function ProjectPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-background flex-1 items-center relative">
      <ProjectsHeader />

      <ProjectNavigationTabs />

      <div className="pt-2 w-full flex flex-1 justify-center overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
