import KnowledgeBaseSettings from "@/features/knowledge-bases/components/knowledge-base-settings";
import { useParams } from "react-router";

export function KnowledgeBaseSettingsPage() {
  const { kbId } = useParams<{ kbId: string }>();

  return <KnowledgeBaseSettings kbId={kbId ?? ""} />;
}
