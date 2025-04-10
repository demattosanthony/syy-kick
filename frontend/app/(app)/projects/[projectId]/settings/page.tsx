"use client";

import { ProjectSettings } from "@/features/projects/components";
import { useParams } from "next/navigation";

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return <ProjectSettings pid={projectId} />;
}
