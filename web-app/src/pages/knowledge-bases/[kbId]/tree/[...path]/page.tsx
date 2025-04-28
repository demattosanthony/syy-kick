import ProjectFileLayout from "@/features/projects/components/files/project-file-layout";
import ProjectFileExplorer from "@/features/projects/components/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { useDecodedPathParams } from "@/features/projects/hooks/use-decoded-path-param";

export function KnowledgeBaseTreePage() {
  const { knowledgeBaseId, decodedPathArray, currentPath } =
    useDecodedPathParams();

  const rightContent = (
    <Card className="max-h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent">
      <CardContent className="p-2">
        <ProjectFileExplorer
          knowledgeBaseId={knowledgeBaseId}
          contentSource="knowledge-base"
          currentPath={currentPath}
          variant="detailed"
        />
      </CardContent>
    </Card>
  );

  return (
    <ProjectFileLayout
      contentSource="knowledge-base"
      knowledgeBaseId={knowledgeBaseId}
      pathArray={decodedPathArray}
      rightContent={rightContent}
    />
  );
}
