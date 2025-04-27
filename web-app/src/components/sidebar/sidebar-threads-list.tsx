import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { User } from "@/types/user";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { SidebarItem } from "./sidebar-item";
import { useParams, useLocation, useNavigate } from "react-router";
import { ChevronRight, History } from "lucide-react";
import {
  useDeleteThreadMutation,
  useThreadsQuery,
} from "@/features/chat/threads/api";

interface ThreadsListProps {
  user: User;
}

export function ThreadsList({ user }: ThreadsListProps) {
  const params = useParams();
  const pathname = useLocation().pathname;
  const navigate = useNavigate();

  // Only set currentThreadId if we're actually on a thread route
  const currentThreadId = pathname.startsWith("/threads/")
    ? typeof params?.threadId === "string"
      ? params.threadId
      : null
    : null;
  const { data, isLoading } = useThreadsQuery();
  const threads = data?.pages[0]?.threads ?? [];

  const deleteThreadMutation = useDeleteThreadMutation();

  const handleThreadDelete = async (id: string) => {
    await deleteThreadMutation.mutateAsync(id);
    navigate("/");
  };

  if (threads.length === 0) {
    return null;
  }

  return (
    <SidebarGroup key={"Recents"}>
      <SidebarGroupLabel className="gap-1">
        <History className="max-h-[12px] max-w-[12px]" />
        {"Recent Threads"}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton asChild>
                    <div className="h-6 w-full bg-muted animate-pulse rounded" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            : threads.map(
                (thread) =>
                  thread.title && (
                    <SidebarItem
                      key={thread.id}
                      id={thread.id}
                      title={thread.title}
                      href={`/threads/${thread.id}`}
                      currentId={currentThreadId as string}
                      onDelete={handleThreadDelete}
                      itemType="thread"
                      canDeleteItem
                    />
                  )
              )}

          {user && (
            <Link to={"/threads"}>
              <Button
                variant={"link"}
                className="justify-start px-2 gap-1 text-muted-foreground"
                size={"sm"}
              >
                View All
                <ChevronRight className="max-h-[10px] max-w-[10px]" />
              </Button>
            </Link>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
