import { ProjectSettings } from "@/features/projects/components";
import { useParams } from "react-router";

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return <ProjectSettings pid={projectId as string} />;
}
