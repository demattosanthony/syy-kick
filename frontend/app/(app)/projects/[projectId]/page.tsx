"use client";

import { useParams } from "next/navigation";
import {
  useProjectFileQuery,
  useProjectFilesQuery,
  useProjectQuery,
  useUpdateProjectMutation,
} from "@/queries/queries";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { ReadmeSection } from "@/components/projects/readme-section";
import ChatInputForm from "@/components/chat/ChatInputForm";
import { ProjectContent } from "@/types/project";
import { ProjectAddFileButton } from "@/components/projects/project-add-file-button";

interface ProjectPageProps {
  initalProjectFiles: ProjectContent[];
}

export default function ProjectPage({ initalProjectFiles }: ProjectPageProps) {
  const { projectId } = useParams();

  const { data: project } = useProjectQuery(projectId as string);

  const { data: projectContents, isLoading: projectContentsIsLoading } =
    useProjectFilesQuery(projectId as string);

  console.log(projectContents);

  const logo = useMemo(() => {
    // if theres an org then use its logo url, else the users profile picture
    if (project?.organization?.logoUrl) {
      return project.organization.logoUrl;
    }

    return project?.user?.profilePicture;
  }, [project]);

  const updateProject = useUpdateProjectMutation();

  const { data: readmeFile } = useProjectFileQuery(
    projectId as string,
    "README.md"
  );

  return (
    <div className="flex flex-col items-center max-w-3xl w-full overflow-y-auto h-screen mt-16">
      {/* Project Header */}
      <div className="border-b w-full">
        <div className="container pb-4 pt-1 px-6 flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src={logo} />
                <AvatarFallback>{project?.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">{project?.name}</h2>
                <span className="text-sm text-muted-foreground">
                  {project?.description}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <ProjectAddFileButton projectId={projectId as string} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto w-full px-4 pb-40">
        <Card className="w-full mt-4 shadow-none mb-4">
          <CardContent className="p-2">
            <ProjectFileExplorer
              contents={projectContents || []}
              projectId={project?.id || ""}
              isLoading={projectContentsIsLoading}
            />
          </CardContent>
        </Card>

        {readmeFile && <ReadmeSection content={readmeFile?.content || ""} />}
      </div>

      <div className="absolute bottom-2 inset-x-0 w-full group">
        <div className="w-full flex items-center justify-center transition-all duration-300 ease-in-out group-hover:translate-y-[-4.5rem]">
          <div className="w-full max-w-3xl px-4">
            <ChatInputForm
              input={""}
              setInput={() => {}}
              handleInputChange={() => {}}
              onSubmit={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
