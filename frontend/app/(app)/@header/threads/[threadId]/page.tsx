"use client";

import { Plus, Slash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useThreadQuery } from "@/queries/queries";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";

export default function ThreadHeader() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();

  // Return null if not on a threads page
  if (!pathname.includes("/threads/")) {
    return null;
  }

  const threadId = params.threadId as string;
  const [, setMessages] = useAtom(messagesAtom);

  const { data: thread } = useThreadQuery(threadId, false);

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-[5] flex h-14 items-center bg-background md:bg-background/50 px-4 md:backdrop-blur-xl transition-all"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 justify-between w-full md:justify-start">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>

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
      </div>
    </header>
  );
}
