import ProjectNavBreadcrumbs from "@/features/projects/components/project-nav-breadcrumbs";
import { useParams, useLocation } from "react-router";
import { ProjectAddFileButton } from "@/features/projects/components";
import { useProjectQuery } from "../api";

export default function ProjectsHeader() {
  const params = useParams();
  const pathname = useLocation().pathname;
  const pid = params.projectId as string;

  // Check if we're on a project page
  const isProjectSettingsPage = pathname === `/projects/${pid}/settings`;

  const { data: project } = useProjectQuery(pid);

  return (
    <div className="h-12 flex items-center justify-between w-full px-4">
      <div>{project && <ProjectNavBreadcrumbs project={project} />}</div>

      {!isProjectSettingsPage && pathname !== `/projects/${pid}` && (
        <ProjectAddFileButton projectId={pid} contentSource="project" />
      )}
    </div>
  );
}
