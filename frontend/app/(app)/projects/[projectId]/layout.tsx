import { ProjectsHeader } from "@/features/projects/components";
import api from "@/lib/api";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;

  const project = await api.projects.getProject(projectId);
  const logo = project?.organization?.logoUrl ?? project?.user?.profilePicture;

  return {
    title: project.name + " - Syykick",
    description: project.description,
    openGraph: {
      title: project.name + " - Syykick",
      description: project.description,
      images: logo ? [{ url: logo }] : [],
    },
  };
}

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
