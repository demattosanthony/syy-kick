import { History } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "react-router";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";

export function ThreadsLink() {
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = useLocation().pathname;
  const isThreadsPage = pathname === "/threads";

  return (
    <Link to={"/threads"} onMouseDown={() => isMobile && toggleSidebar()}>
      <Button
        variant={"ghost"}
        className={cn(
          "w-full px-2",
          state === "collapsed" && !isMobile
            ? "justify-center"
            : "justify-start",
          isThreadsPage && "bg-accent text-accent-foreground"
        )}
      >
        {state === "collapsed" && !isMobile ? (
          <History />
        ) : (
          <>
            <History />
            Threads
          </>
        )}
      </Button>
    </Link>
  );
}
