"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchBar, ThreadsList } from "@/features/chat/threads/components";
import { Project } from "@/types/project";
import { Search } from "lucide-react";
import ProjectStatusCard from "./project-status-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectSidebarProps {
  project: Project;
  projectId: string;
}

export default function ProjectSidebar({
  project,
  projectId,
}: ProjectSidebarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  return (
    <div className="hidden md:flex flex-col gap-4 w-full">
      <ProjectStatusCard project={project} />

      <Card className="overflow-hidden">
        <CardHeader className="px-4 pt-2 pb-1">
          <CardTitle className="text-base font-semibold flex items-center justify-between gap-2">
            <div
              className="flex items-center transition-opacity duration-300"
              style={{
                opacity: isSearchExpanded ? 0 : 1,
                width: isSearchExpanded ? 0 : "auto",
                overflow: "hidden",
              }}
            >
              <span>Threads</span>
            </div>

            <div className="flex items-center flex-1">
              {isSearchExpanded ? (
                <SearchBar
                  className={`flex-1 transition-all duration-300 ${
                    isSearchExpanded ? "max-w-full" : "max-w-[200px]"
                  }`}
                  onClose={() => setIsSearchExpanded(false)}
                />
              ) : (
                <Button
                  onClick={() => setIsSearchExpanded(true)}
                  className="ml-auto p-1"
                  variant={"ghost"}
                  size={"icon"}
                >
                  <Search className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="px-2 pt-0 h-[min(calc(100vh-400px),calc(100vh*0.42))] min-h-[300px] max-h-[800px] overflow-hidden">
          <ScrollArea className="h-full w-full">
            <ThreadsList projectId={projectId} compact />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
