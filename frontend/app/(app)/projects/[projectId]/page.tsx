"use client";

import { useParams } from "next/navigation";
import {
  useProjectFileQuery,
  useProjectFilesQuery,
  useProjectQuery,
  // Removed: useUpdateProjectMutation since it's not used
} from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { ReadmeSection } from "@/components/projects/readme-section";
import ChatInputForm from "@/components/chat/ChatInputForm";
import { ProjectContent } from "@/types/project";
import { ProjectAddFileButton } from "@/components/projects/project-add-file-button";

interface ProjectPageProps {
  // Use optional prop if needed; updated the name to "initialProjectFiles"
  initialProjectFiles?: ProjectContent[];
}

export default function ProjectPage({ initialProjectFiles }: ProjectPageProps) {
  const { projectId } = useParams();
  const pid = projectId as string;

  const { data: project, isLoading: projectIsLoading } = useProjectQuery(pid);
  const { data: projectContents, isLoading: projectContentsIsLoading } =
    useProjectFilesQuery(pid);
  const { data: readmeFile } = useProjectFileQuery(pid, "README.md");

  // Use nullish coalescing for a simple fallback
  const logo = project?.organization?.logoUrl ?? project?.user?.profilePicture;

  return (
    <div className="h-screen w-full flex justify-center overflow-y-auto mt-16">
      <div className="flex flex-col items-center max-w-3xl w-full flex-1">
        {/* Project Header */}
        <header className="border-b w-full">
          <div className="container pb-4 pt-1 px-6 flex items-center justify-between">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={logo} />
                  <AvatarFallback>{project?.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold">{project?.name}</h2>
                </div>
              </div>
              <div className="flex gap-2">
                <ProjectAddFileButton projectId={pid} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 h-full w-full px-4 pb-40">
          <Card className="w-full mt-4 shadow-none mb-4">
            <CardContent className="p-2">
              <ProjectFileExplorer
                contents={projectContents || []}
                projectId={project?.id || ""}
                isLoading={projectContentsIsLoading}
              />
            </CardContent>
          </Card>
          {readmeFile && <ReadmeSection content={readmeFile.content || ""} />}
        </main>

        <footer className="absolute bottom-2 inset-x-0 w-full group">
          <div className="w-full flex items-center justify-center transition-all duration-300 ease-in-out group-hover:translate-y-[-4.5rem]">
            <div className="w-full max-w-3xl px-4">
              <ChatInputForm
                input=""
                setInput={() => {}}
                handleInputChange={() => {}}
                onSubmit={() => {}}
              />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
