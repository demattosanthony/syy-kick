import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAtom } from "jotai";
import { messagesAtom } from "@/atoms/chat";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [, setMessages] = useAtom(messagesAtom);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "h") {
        e.preventDefault();
        navigate("/threads");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "m") {
        e.preventDefault();
        setMessages([]);
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, setMessages]);
}
