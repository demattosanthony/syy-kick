import { useKnowledgeBase } from "@/features/knowledge-bases/api";
import { useParams } from "react-router";
import { Outlet } from "react-router";

export function KnowledgeBaseLayout() {
  const { kbId } = useParams<{ kbId: string }>();
  const { data: kb } = useKnowledgeBase(kbId ?? "");

  if (!kb) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center flex-col relative">
      <div className="h-14 flex items-center justify-between w-full px-4">
        <div>
          {/* <ResourceNavBreadcrumbs resource={kb} contentType="knowledge-base" /> */}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
