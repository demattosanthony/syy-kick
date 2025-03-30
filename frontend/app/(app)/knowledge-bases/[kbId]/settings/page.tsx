"use server";

import KnowledgeBaseSettings from "@/features/knowledge-bases/components/knowledge-base-settings";

export default async function KnowledgeBaseSettingsPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;

  return <KnowledgeBaseSettings kbId={kbId} />;
}
