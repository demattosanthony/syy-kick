"use client";

import { History } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname } from "next/navigation";

export function ThreadsLink() {
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isThreadsPage = pathname === "/threads";

  return (
    <Link
      href={"/threads"}
      prefetch
      onMouseDown={() => isMobile && toggleSidebar()}
    >
      <Button
        variant={"ghost"}
        className={`w-full px-2 ${
          state === "collapsed" && !isMobile
            ? "justify-center"
            : "justify-start"
        }
                    ${isThreadsPage ? "bg-accent text-accent-foreground" : ""}
                    `}
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
