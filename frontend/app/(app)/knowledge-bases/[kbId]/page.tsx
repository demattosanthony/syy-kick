"use server";

import {
  ProjectContent,
  ProjectFooter,
  ProjectLayout,
  ProjectSidebar,
} from "@/features/projects/components";
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

  return (
    <>
      <ProjectLayout type="knowledge-base" knowledgeBase={kb}>
        <ProjectContent type="knowledge-base" knowledgeBaseId={kb.id} />
        <ProjectSidebar type="knowledge-base" knowledgeBase={kb} />
      </ProjectLayout>
      <ProjectFooter type="knowledge-base" knowledgeBaseId={kb.id} />
    </>
  );
}
