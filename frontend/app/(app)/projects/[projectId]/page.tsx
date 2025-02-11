"use client";

import { Plus, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useParams } from "next/navigation";
import { useProjectQuery } from "@/queries/queries";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProjectPage() {
  const { projectId } = useParams();

  const { data: project } = useProjectQuery(projectId as string);

  console.log(project);

  const logo = useMemo(() => {
    // if theres an org then use its logo url, else the users profile picture
    if (project?.organization?.logoUrl) {
      return project.organization.logoUrl;
    }

    return project?.user?.profilePicture;
  }, [project]);

  return (
    <div className="flex flex-col items-center max-w-3xl w-full">
      {/* Project Header */}
      <header className="border-b w-full">
        <div className="container py-6 px-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={logo} />
                <AvatarFallback>{project?.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">{project?.name}</h1>
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
                      onClick={() => {
                        // Handle create new file
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      Create new file
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm"
                      onClick={() => {
                        // Handle upload files
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      Upload files
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </header>

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
