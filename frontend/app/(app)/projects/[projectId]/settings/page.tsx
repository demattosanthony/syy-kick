import ProjectSettings from "@/components/projects/project-settings";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectSettings pid={projectId} />;
}
