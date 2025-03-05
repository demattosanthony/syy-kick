import { ProjectSettings } from "@/features/projects/components";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectSettings pid={projectId} />;
}
