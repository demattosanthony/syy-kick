"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function NewThreadButton() {
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Link
      href={"/"}
      prefetch={true}
      onMouseDown={() => isMobile && toggleSidebar()}
    >
      <Button
        className="w-full"
        size={state === "collapsed" && !isMobile ? "icon" : "default"}
      >
        <PlusIcon
          className={state === "collapsed" && !isMobile ? "size-2" : "size-4"}
        />
        {state === "expanded" && !isMobile && "New Thread"}
      </Button>
    </Link>
  );
}
