import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [, setMessages] = useAtom(messagesAtom);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "h") {
        e.preventDefault();
        router.push("/threads");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "m") {
        e.preventDefault();
        setMessages([]);
        router.push("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, setMessages]);
}
