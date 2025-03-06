"use client";

import { useParams } from "next/navigation";
import { useProjectQuery } from "@/features/projects/api";
import {
  ProjectContent,
  ProjectFooter,
  ProjectLayout,
  ProjectSidebar,
} from "@/features/projects/components";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { data: project } = useProjectQuery(projectId);

  if (!project) {
    return null;
  }

  return (
    <>
      <ProjectLayout project={project}>
        <ProjectContent projectId={projectId} />
        <ProjectSidebar project={project} projectId={projectId} />
      </ProjectLayout>
      <ProjectFooter projectId={projectId} />
    </>
  );
}
