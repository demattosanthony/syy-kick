"use client";

import { Check, MenuIcon, Plus, Share, Slash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import React from "react";
import api from "@/lib/api";
import { useThreadQuery } from "../api";

export default function ThreadHeader() {
  const params = useParams();
  const router = useRouter();
  const [shareLinkCopied, setShareLinkCopied] = React.useState(false);
  const { toggleSidebar } = useSidebar();

  const threadId = params.threadId as string;

  const [, setMessages] = useAtom(messagesAtom);

  const { data: thread } = useThreadQuery(threadId, false);

  const handleCopyShareLink = async () => {
    if (!thread) return;

    try {
      await api.threads.updateThread(thread.id, { isPublic: true });
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${thread.id}`
      );
      setShareLinkCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => {
        setShareLinkCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy share link", error);
      toast.error("Failed to create share link");
    }
  };

  // Determine parent entity and link
  let parentName: string | undefined;
  let parentLink: string | undefined;

  if (thread?.project) {
    parentName = thread.project.name;
    parentLink = `/projects/${thread.project.id}`;
  } else if (thread?.knowledgeBase) {
    parentName = thread.knowledgeBase.name;
    parentLink = `/knowledge-bases/${thread.knowledgeBase.id}`;
  }

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-[5] flex h-14 items-center bg-background md:bg-background/50 px-4 md:backdrop-blur-xl transition-all"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 md:justify-start">
          <div className="md:hidden">
            <Button variant={"ghost"} size={"icon"} onClick={toggleSidebar}>
              <MenuIcon />
            </Button>
          </div>

          <div>
            {parentName && parentLink && (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link
                      href={parentLink}
                      className="hover:text-blue-500 hover:underline"
                    >
                      {parentName}
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <Slash />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <span className="font-bold">{thread?.title}</span>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 mr-1">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => {
              setMessages([]);
              router.push("/");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={"ghost"}
                size={"icon"}
                onClick={handleCopyShareLink}
              >
                {shareLinkCopied ? <Check /> : <Share />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy Share Link</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
