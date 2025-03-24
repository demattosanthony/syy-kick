"use server";

import api from "@/lib/api";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const kbId = (await params).kbId;
  const kb = await api.knowledgeBases.getKnowledgeBase(kbId).catch(() => null);

  if (!kb) {
    return null;
  }

  return <>{kb.name}</>;
}
