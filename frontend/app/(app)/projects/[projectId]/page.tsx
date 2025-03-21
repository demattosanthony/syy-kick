"use server";

import {
  ProjectContent,
  ProjectFooter,
  ProjectLayout,
  ProjectSidebar,
} from "@/features/projects/components";
import api from "@/lib/api";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const pid = (await params).projectId;
  const project = await api.projects.getProject(pid);

  if (!project) {
    return null;
  }

  return (
    <>
      <ProjectLayout project={project}>
        <ProjectContent projectId={pid} />
        <ProjectSidebar project={project} projectId={pid} />
      </ProjectLayout>
      <ProjectFooter projectId={pid} />
    </>
  );
}
