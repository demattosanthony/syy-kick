"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

export default function HeaderActions({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, setMessages] = useAtom(messagesAtom);

  // Don't render on settings page
  if (pathname === "/settings") return null;

  return (
    <div className="flex">
      <div>{children}</div>

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
  );
}
