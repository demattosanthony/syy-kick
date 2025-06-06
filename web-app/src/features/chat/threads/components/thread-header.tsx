import { Check, Plus, Share, Slash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams, useNavigate } from "react-router";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import React from "react";
import api from "@/lib/api";
import { useThreadQuery } from "../api";

type WorkflowId = keyof typeof workflowNameMap;

const workflowNameMap = {
  "bod-generator": "Basis of Design Generator",
  "equipment-serving-builder": "Equipment Serving List Builder",
  "rfp-evaluator": "RFP Evaluator",
  "window-door-schedule-gen": "Window and Door Schedule Generator",
  "controls-bom": "Controls BOM Builder",
} as const;

export default function ThreadHeader() {
  const params = useParams();
  const navigate = useNavigate();
  const [shareLinkCopied, setShareLinkCopied] = React.useState(false);

  const threadId = params.threadId as string;
  const isPendingThread = threadId?.startsWith("pending-");

  const [, setMessages] = useAtom(messagesAtom);

  const { data: thread } = useThreadQuery(threadId, {
    enabled: !isPendingThread && !!threadId,
  });

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

  if (thread?.workflowId) {
    parentName = workflowNameMap[thread.workflowId as WorkflowId] || "Workflow";
    parentLink = `/workflows/${thread.workflowId}`;
  }

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-[5] flex h-14 items-center bg-background md:bg-background/50 px-4 md:backdrop-blur-xl transition-all"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 md:justify-start">
          <div>
            {parentName && parentLink && (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link
                      to={parentLink}
                      className="hover:text-blue-500 hover:underline"
                    >
                      {parentName}
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <Slash />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <span className="font-bold max-w-[250px] truncate">
                      {thread?.title}
                    </span>
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
              navigate("/");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <TooltipProvider>
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
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
