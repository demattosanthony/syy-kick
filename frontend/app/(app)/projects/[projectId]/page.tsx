"use client";

import { Plus, FolderClosed, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useParams } from "next/navigation";
import {
  useProjectFilesQuery,
  useProjectQuery,
  useUpdateProjectMutation,
  useUploadFileMutation,
} from "@/queries/queries";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { InlineEdit } from "@/components/inline-edit";

export default function ProjectPage() {
  const { projectId } = useParams();

  const { data: project } = useProjectQuery(projectId as string);

  const { data: projectContents } = useProjectFilesQuery(projectId as string);

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

  return (
    <div className="flex flex-col items-center max-w-3xl w-full">
      {/* Project Header */}
      <header className="border-b w-full">
        <div className="container py-6 px-6 flex items-center justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={logo} />
                <AvatarFallback>{project?.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">
                  <InlineEdit
                    value={project?.name || ""}
                    onSave={handleUpdateName}
                  />
                </h1>
                <span className="text-sm text-muted-foreground">
                  {project?.description}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4" />
                    Add file
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                    >
                      <label className="flex items-center gap-2 cursor-pointer w-full">
                        <FolderClosed className="h-4 w-4" />
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
                        className="w-full justify-start gap-2 text-sm"
                        asChild
                      >
                        <span>
                          <FileUp className="h-4 w-4" />
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
      </header>

      <div className="border rounded-lg w-[80%] mt-4 ">
        <ProjectFileExplorer
          contents={projectContents || []}
          projectId={project?.id || ""}
        />
      </div>

      {/* <div className="w-full flex items-center justify-center mx-auto p-6 pb-8 md:pb-4 md:p-2">
        <ChatInputForm
          input=""
          setInput={() => {}}
          onSubmit={() => {}}
          handleInputChange={() => {}}
        />
      </div> */}

      {/* <div className="container py-6 px-6">
        <div className="grid lg:grid-cols-[1fr,300px] gap-6">
          <div className="space-y-6">
            <div className="border rounded-lg">
              <div className="p-3 flex items-center justify-between border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-muted" />
                  <div>
                    <span className="font-medium">Sarah Chen</span>
                    <span className="text-muted-foreground mx-2">
                      Updated structural calculations for floor system
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">
                      3206e05
                    </span>
                  </div>
                </div>
                <Link href={`/projects/1/commits`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                  >
                    yesterday
                  </Button>
                </Link>
              </div>
              <ProjectFileExplorer />
            </div>
            <ReadmeSection />
          </div>
          <div className="hidden lg:block">
            <ProjectSidebar />
          </div>
        </div>
      </div> */}
    </div>
  );
}
