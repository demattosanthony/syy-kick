"use client";

import { useParams, useRouter } from "next/navigation";
import { useProjectQuery } from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { ReadmeSection } from "@/components/projects/readme-section";
import ChatInputForm from "@/components/chat/ChatInputForm";
import { ProjectAddFileButton } from "@/components/projects/project-add-file-button";
import api from "@/lib/api";
import { useAtom } from "jotai";
import { initalInputAtom } from "@/atoms/chat";
import { useWorkspace } from "@/components/sidebar/workspace-context";

export default function ProjectPage() {
  const router = useRouter();
  const { projectId } = useParams();
  const pid = projectId as string;

  const { data: project } = useProjectQuery(pid);
  //   const { data: readmeFile } = useProjectDocQuery(pid, "README.md");

  const { activeWorkspace } = useWorkspace();

  // Use nullish coalescing for a simple fallback
  const logo = project?.organization?.logoUrl ?? project?.user?.profilePicture;

  const [initalInput, setInitalInput] = useAtom(initalInputAtom);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    try {
      // Create thread in background
      const { id: threadId } = await api.threads.createThread(
        activeWorkspace?.type === "organization"
          ? activeWorkspace.id
          : undefined,
        pid
      );
      router.prefetch(`/threads/${threadId}?new=true`);
      router.push(`/threads/${threadId}?new=true`);
    } catch (error: unknown) {
      console.error("Failed to create thread:", error);
    }
  };

  return (
    <div className="h-screen w-full flex justify-center overflow-y-auto pt-14">
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
              <ProjectFileExplorer projectId={pid} />
            </CardContent>
          </Card>
          {/* {readmeFile && <ReadmeSection content={readmeFile.content || ""} />} */}
        </main>

        <footer className="absolute bottom-4 inset-x-0 w-full group">
          {/** group-hover:translate-y-[-4.5rem] */}
          <div className="w-full flex items-center justify-center transition-all duration-300 ease-in-out">
            <div className="w-full max-w-3xl px-4">
              <ChatInputForm
                input={initalInput}
                setInput={setInitalInput}
                handleInputChange={handleInputChange}
                onSubmit={handleSubmit}
                showContextSelector={true}
                projectId={pid}
              />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
