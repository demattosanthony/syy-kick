import { ResourceNavBreadcrumbs } from "@/features/projects/components/project-nav-breadcrumbs";
import api from "@/lib/api";

export default async function KnowledgeBaseHeader({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const kb = await api.knowledgeBases.getKnowledgeBase(kbId).catch(() => null);

  if (!kb) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center flex-col relative">
      <div className="h-14 flex items-center justify-between w-full px-4">
        <div>
          <ResourceNavBreadcrumbs resource={kb} contentType="knowledge-base" />
        </div>
      </div>

      {children}
    </div>
  );
}
