"use client";

import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function NewThreadButton() {
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Link href={"/"} onMouseDown={() => isMobile && toggleSidebar()}>
      <Button
        variant={"outline"}
        className="w-full"
        size={state === "collapsed" && !isMobile ? "sm" : "default"}
      >
        {state === "collapsed" && !isMobile ? <Plus /> : "New Thread"}
      </Button>
    </Link>
  );
}
