import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import ProjectChatInput from "@/components/projects/project-chat-input";
import ProjectHeader from "@/components/projects/project-header";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const pid = (await params).projectId;

  return (
    <div className="h-screen w-full flex justify-center pt-14">
      <div className="flex flex-col items-center max-w-3xl w-full flex-1">
        <ProjectHeader pid={pid} />

        <main className="flex-1 h-full w-full px-4">
          <Card className="w-full mt-4 shadow-none mb-4 max-h-[calc(100vh-375px)] overflow-y-auto">
            <CardContent className="p-2">
              <ProjectFileExplorer projectId={pid} />
            </CardContent>
          </Card>
          {/* {readmeFile && <ReadmeSection content={readmeFile.content || ""} />} */}
        </main>

        <footer className="absolute bottom-4 inset-x-0 w-full group">
          <div className="w-full flex items-center justify-center transition-all duration-300 ease-in-out">
            <div className="w-full max-w-3xl px-4">
              <ProjectChatInput projectId={pid} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
