"use client";

import { Button } from "./ui/button";
import Link from "next/link";
import { SidebarTrigger } from "./ui/sidebar";
import { User } from "@/types/user";
import { useWorkspace } from "./sidebar/workspace-context";
import { ArrowRight, Plus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";

export default function Header({ user }: { user: User | null }) {
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const [, setMessages] = useAtom(messagesAtom);

  const showFinishOrganizationSetup =
    activeWorkspace?.type === "organization" &&
    activeWorkspace?.subscriptionStatus !== "active";

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-[5] flex h-14 items-center bg-background md:bg-background/50 px-4 md:backdrop-blur-xl transition-all",
        showFinishOrganizationSetup && "flex-col"
      )}
    >
      {showFinishOrganizationSetup && (
        <div className="flex w-full items-center gap-2 p-2">
          <Link href="/settings?tab=organization" className="w-full">
            <Button className="w-full" variant={"secondary"}>
              <TriangleAlert size={16} />
              Please complete the payment process to use Teams Pro features
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      )}

      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 justify-between w-full md:justify-start">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>

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

        <div className="flex items-center gap-2">
          {!user && (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button>Login</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
