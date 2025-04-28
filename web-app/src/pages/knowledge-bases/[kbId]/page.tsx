import { useKnowledgeBase } from "@/features/knowledge-bases/api";
import {
  ProjectContent,
  ProjectFooter,
  ProjectLayout,
  ProjectSidebar,
} from "@/features/projects/components";
import { useParams } from "react-router";

export function KnowledgeBasePage() {
  const params = useParams<{ kbId: string }>();
  const kbId = params.kbId;
  const { data: kb } = useKnowledgeBase(kbId ?? "");

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
