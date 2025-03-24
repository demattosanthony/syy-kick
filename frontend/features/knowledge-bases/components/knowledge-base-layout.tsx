"use client";

import { ReactNode } from "react";
import { KnowledgeBase } from "../types/knowledge-bases";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectFileExplorer } from "@/features/projects/components";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KnowledgeBaseLayoutProps {
  kb: KnowledgeBase;
  children: ReactNode;
}

export default function KnowledgeBaseLayout({
  kb,
  children,
}: KnowledgeBaseLayoutProps) {
  return (
    <div className="h-screen w-full flex justify-center pt-14 overflow-x-hidden">
      <div className="flex flex-col items-center max-w-5xl w-full flex-1 min-w-0">
        <header className="border-b w-full">
          <div className="container px-6 py-4">
            <h2 className="text-2xl font-bold">{kb.name}</h2>
          </div>
        </header>

        <div className="flex-1 h-full w-full px-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_265px] gap-4 w-full mt-4 max-w-full">
            <div className="flex flex-col gap-4">
              <Card className="w-full min-w-0 shadow-none h-[max-content] max-h-[calc(100vh*0.65)]">
                <CardContent className="p-2 h-full">
                  <ScrollArea className="h-full w-full">
                    <ProjectFileExplorer
                      contentSource="knowledge-base"
                      knowledgeBaseId={kb.id}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
