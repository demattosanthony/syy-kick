import { useProjectQuery } from "@/features/projects/api";
import {
  ProjectContent,
  ProjectFooter,
  ProjectLayout,
  ProjectSidebar,
} from "@/features/projects/components";
import { useParams } from "react-router";

export function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const pid = params.projectId;
  const { data: project } = useProjectQuery(pid as string);

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
