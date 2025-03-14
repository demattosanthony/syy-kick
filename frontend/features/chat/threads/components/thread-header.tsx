"use client";

import { Check, Plus, Share, Slash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { useThreadQuery } from "@/features/chat/threads/api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import React from "react";
import api from "@/lib/api";

export default function ThreadHeader() {
  const params = useParams();
  const router = useRouter();
  const [shareLinkCopied, setShareLinkCopied] = React.useState(false);

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

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-[5] flex h-14 items-center bg-background md:bg-background/50 px-4 md:backdrop-blur-xl transition-all"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 md:justify-start">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>

          <div>
            {thread?.project && (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link
                      href={`/projects/${thread.project.id}`}
                      className="hover:text-blue-500 hover:underline"
                    >
                      {thread.project.name}
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <Slash />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <span className="font-bold">{thread.title}</span>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>

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
        </div>

        <div className="flex-shrink-0 mr-1">
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
