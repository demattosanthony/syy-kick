"use client";

import Link from "next/link";
import { CircleDot, Settings, ChevronsLeftRight, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useParams, usePathname } from "next/navigation";
import { usePermissions } from "@/features/permissions/context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  count?: number;
}

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "",
    icon: <ChevronsLeftRight className="h-4 w-4" />,
  },
  {
    label: "Issues",
    href: "/issues",
    icon: <CircleDot className="h-4 w-4" />,
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: <Workflow className="h-4 w-4" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

export default function ProjectNavigationTabs() {
  const { projectId } = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const { canUpdateOrgProjects } = usePermissions();

  const filteredNavItems = navItems.filter((item) => {
    if (item.label === "Settings") {
      return canUpdateOrgProjects;
    }
    return true;
  });

  return (
    <nav className="border-b w-full flex items-start">
      <div className="flex h-12 items-center gap-1 px-4 overflow-x-auto">
        {filteredNavItems.map((item) => {
          const itemPath = `/projects/${projectId}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === itemPath
              : pathname.startsWith(itemPath);

          return (
            <Button
              key={item.label}
              variant="ghost"
              className={cn(
                "border-0", // Remove default border from button variant
                "h-full rounded-none border-b-2 px-4 hover:bg-transparent", // Base styles: only bottom border
                "flex items-center gap-2 flex-shrink-0",
                isActive
                  ? "border-b-primary  font-semibold hover:border-b-primary" // Active state: primary bottom border
                  : "border-b-transparent text-muted-foreground hover:border-b-border" // Inactive state: transparent bottom border, default border color on hover
              )}
              asChild
            >
              <Link href={itemPath} prefetch={false}>
                {item.icon}
                <span>{item.label}</span>
                {item.count && (
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-2 py-0.5 text-sm font-medium",
                      isActive
                        ? "bg-secondary text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
