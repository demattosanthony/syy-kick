"use client";

import { ProjectAddFileButton } from "@/components/projects/project-add-file-button";
import ProjectNavBreadcrumbs from "@/components/projects/project-nav-breadcrumbs";
import { useProjectQuery } from "@/queries/queries";
import { useParams, usePathname } from "next/navigation";

export default function ProjectsHeader() {
  const params = useParams();
  const pathname = usePathname();
  const pid = params.projectId as string;

  // Check if we're on a project page
  const isProjectPath = pathname.startsWith(`/projects/${pid}/`);
  const isProjectSettingsPage = pathname === `/projects/${pid}/settings`;

  const { data: project } = useProjectQuery(pid);

  if (!isProjectPath) return null;

  return (
    <div className="h-14 flex items-center justify-between w-full px-4">
      <div>{project && <ProjectNavBreadcrumbs project={project} />}</div>

      {!isProjectSettingsPage && <ProjectAddFileButton projectId={pid} />}
    </div>
  );
}
