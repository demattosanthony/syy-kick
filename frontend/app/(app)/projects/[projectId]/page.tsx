import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import ProjectChatInput from "@/components/projects/project-chat-input";
import ProjectHeader from "@/components/projects/project-header";
import ProjectStatusCard from "@/components/projects/project-status-card";
import { getProject } from "@/app/actions";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const pid = (await params).projectId;
  const project = await getProject(pid);

  if (!project) {
    return null;
  }

  return (
    <div className="h-screen w-full flex justify-center pt-14 overflow-x-hidden">
      <div className="flex flex-col items-center max-w-5xl w-full flex-1 min-w-0">
        <ProjectHeader project={project} />

        <div className="flex-1 h-full w-full px-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_265px] gap-4 w-full mt-4 max-w-full">
            <Card className="w-full min-w-0 shadow-none max-h-[min(calc(100vh-300px),700px)] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent">
              <CardContent className="p-2 w-full max-w-full overflow-x-hidden">
                <ProjectFileExplorer projectId={pid} />
              </CardContent>
            </Card>

            <div className="hidden md:block w-full">
              <ProjectStatusCard project={project} />
            </div>
          </div>
        </div>

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
