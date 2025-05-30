import { useKnowledgeBase } from "@/features/knowledge-bases/api";
import { useParams } from "react-router";

export function KnowledgeBasePage() {
  const params = useParams<{ kbId: string }>();
  const kbId = params.kbId;
  const { data: kb } = useKnowledgeBase(kbId ?? "");

  if (!kb) {
    return null;
  }

  return <></>;
}
