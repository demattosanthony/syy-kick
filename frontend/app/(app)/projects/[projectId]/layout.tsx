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

      {children}
    </div>
  );
}
