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
  const project = await api.projects.getProject(pid).catch(() => null);

  if (!project) {
    return null;
  }

  return (
    <>
      <ProjectLayout project={project} type="project">
        <ProjectContent projectId={pid} type="project" />
        <ProjectSidebar project={project} type="project" />
      </ProjectLayout>
      <ProjectFooter projectId={pid} type="project" />
    </>
  );
}
