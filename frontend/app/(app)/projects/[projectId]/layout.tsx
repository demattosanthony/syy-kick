import { ProjectsHeader } from "@/features/projects/components";

export default async function ProjectPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center flex-col relative">
      <ProjectsHeader />
      {children}
    </div>
  );
}
