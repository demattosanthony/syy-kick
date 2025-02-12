"use client";

import { Plus, FolderClosed, FileUp, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useParams } from "next/navigation";
import {
  useProjectFileQuery,
  useProjectFilesQuery,
  useProjectQuery,
  useUpdateProjectMutation,
  useUploadFileMutation,
} from "@/queries/queries";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { InlineEdit } from "@/components/inline-edit";
import { Card, CardContent } from "@/components/ui/card";
import { ReadmeSection } from "@/components/projects/readme-section";
import { Input } from "@/components/ui/input";
import ChatInputForm from "@/components/chat/ChatInputForm";

export default function ProjectPage() {
  const { projectId } = useParams();

  const { data: project } = useProjectQuery(projectId as string);

  const { data: projectContents, isLoading: projectContentsIsLoading } =
    useProjectFilesQuery(projectId as string);

  const uploadMutation = useUploadFileMutation();

  console.log(projectContents);

  const logo = useMemo(() => {
    // if theres an org then use its logo url, else the users profile picture
    if (project?.organization?.logoUrl) {
      return project.organization.logoUrl;
    }

    return project?.user?.profilePicture;
  }, [project]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      for (const file of files) {
        await uploadMutation.mutateAsync({
          projectId: projectId as string,
          file,
          path: file.name,
        });
      }
    } catch (error) {
      console.error("Failed to upload files:", error);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      for (const file of files) {
        await uploadMutation.mutateAsync({
          projectId: projectId as string,
          file,
          path: file.webkitRelativePath,
        });
      }
    } catch (error) {
      console.error("Failed to upload folder:", error);
    }
  };

  const updateProject = useUpdateProjectMutation();

  const handleUpdateName = async (newName: string) => {
    await updateProject.mutateAsync({
      projectId: projectId as string,
      data: { name: newName },
    });
  };

  const { data: readmeFile } = useProjectFileQuery(
    projectId as string,
    "README.md"
  );

  return (
    <div className="flex flex-col items-center max-w-3xl w-full overflow-y-auto h-screen">
      {/* Project Header */}
      <div className="border-b w-full ">
        <div className="container pb-6 px-6 flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src={logo} />
                <AvatarFallback>{project?.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">
                  {project?.name}
                  {/* <InlineEdit
                    value={project?.name || ""}
                    onSave={handleUpdateName}
                  /> */}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {project?.description}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Input placeholder="Search files" className="w-60" />

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="default"
                    className="px-2 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add file
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                    >
                      <label className="flex items-center gap-2 cursor-pointer w-full">
                        <FolderClosed className="h-5 w-5 fill-blue-400 text-blue-400" />
                        <input
                          type="file"
                          webkitdirectory=""
                          multiple
                          className="hidden"
                          onChange={handleFolderUpload}
                        />
                        Upload folder
                      </label>
                    </Button>
                    <label>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 text-sm cursor-pointer"
                        asChild
                      >
                        <span>
                          <File className="h-4 w-4 text-muted-foreground" />
                          Upload files
                        </span>
                      </Button>
                    </label>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto w-full px-4 pb-20">
        <Card className="w-full mt-4 shadow-none mb-4">
          <CardContent className="p-2">
            <ProjectFileExplorer
              contents={projectContents || []}
              projectId={project?.id || ""}
              isLoading={projectContentsIsLoading}
            />
          </CardContent>
        </Card>

        <ReadmeSection content={readmeFile?.content || ""} />
      </div>

      <div className="absolute bottom-2 inset-x-0 w-full flex items-center justify-center transition-all duration-300 ease-in-out hover:bottom-20">
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
  );
}
