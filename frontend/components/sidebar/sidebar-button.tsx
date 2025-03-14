"use client";

import { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SidebarButtonProps {
  href: string;
  icon: LucideIcon;
  hoverIcon?: LucideIcon;
  label: string;
  actionTrigger?: ReactNode;
}

export function SidebarButton({
  href,
  icon: Icon,
  hoverIcon: HoverIcon,
  label,
  actionTrigger,
}: SidebarButtonProps) {
  const router = useRouter();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <div className="relative group/button">
      <Button
        variant={"ghost"}
        onClick={() => {
          if (isMobile) {
            toggleSidebar();
          }
          router.push(href);
        }}
        className={cn(
          "w-full px-2 transition-all",
          state === "collapsed" && !isMobile
            ? "justify-center"
            : "justify-start",
          isActive && "bg-accent text-accent-foreground"
        )}
      >
        {state === "collapsed" && !isMobile ? (
          <Icon />
        ) : (
          <>
            <Icon className={cn(HoverIcon && "group-hover/button:hidden")} />
            {HoverIcon && (
              <HoverIcon className="hidden group-hover/button:block" />
            )}
            {label}
          </>
        )}
      </Button>

      {state === "expanded" && !isMobile && actionTrigger && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/button:opacity-100">
          {actionTrigger}
        </div>
      )}
    </div>
  );
}
