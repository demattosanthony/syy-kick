"use client";

import {
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { User } from "@/types/user";
import { Button } from "../ui/button";
import { useAtom } from "jotai";
import { pricingPlanDialogOpenAtom } from "../PricingDialog";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useWorkspace } from "./workspace-context";

export function NavUser({ user }: { user: User }) {
  const [, setShowPricingPlanDialog] = useAtom(pricingPlanDialogOpenAtom);
  const { isMobile } = useSidebar();
  const { logOut } = useAuth();
  const { setTheme } = useTheme();
  const { activeWorkspace } = useWorkspace();

  const handleBillingPortal = async () => {
    try {
      //   setIsLoading(true);
      const url = await api.payments.createPortalSession();

      // Redirect to Stripe Portal
      window.location.href = url;
    } catch (error) {
      console.error("Error:", error);
      // You might want to show an error toast here
    } finally {
      //   setIsLoading(false);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-full">
                <AvatarImage src={user.profilePicture} alt={user.name} />
                <AvatarFallback className="rounded-full">
                  {user.name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "top"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage src={user.profilePicture} alt={user.name} />
                  <AvatarFallback className="rounded-full">
                    {user.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {activeWorkspace?.type === "personal" && (
              <>
                {user.subscriptionStatus !== "active" ? (
                  <DropdownMenuGroup>
                    <Button
                      className="w-full"
                      variant={"default"}
                      onClick={(e) => {
                        console.log("Upgrade to Pro");
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPricingPlanDialog(true);
                      }}
                    >
                      Upgrade to Pro
                    </Button>
                  </DropdownMenuGroup>
                ) : (
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={handleBillingPortal}>
                      <CreditCard />
                      Billing
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                )}
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuGroup>
              <Link href="/settings">
                <DropdownMenuItem>
                  <Settings />
                  Settings
                </DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <div className="flex items-center justify-between px-2 py-0.5">
                <span className="text-sm font-medium">Theme</span>
                <div className="flex gap-1">
                  <Button
                    variant={
                      useTheme().theme === "light" ? "secondary" : "ghost"
                    }
                    size="icon"
                    className="size-8"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="size-4" />
                    <span className="sr-only">Light theme</span>
                  </Button>
                  <Button
                    variant={
                      useTheme().theme === "dark" ? "secondary" : "ghost"
                    }
                    size="icon"
                    className="size-8"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="size-4" />
                    <span className="sr-only">Dark theme</span>
                  </Button>
                  <Button
                    variant={
                      useTheme().theme === "system" ? "secondary" : "ghost"
                    }
                    size="icon"
                    className="size-8"
                    onClick={() => setTheme("system")}
                  >
                    <Monitor className="size-4" />
                    <span className="sr-only">System theme</span>
                  </Button>
                </div>
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
