import { PlusIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "react-router";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function NewThreadButton() {
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Link to={"/"} onMouseDown={() => isMobile && toggleSidebar()}>
      <Button
        className="w-full"
        size={state === "collapsed" && !isMobile ? "icon" : "default"}
      >
        <PlusIcon
          className={state === "collapsed" && !isMobile ? "size-2" : "size-4"}
        />
        {state === "expanded" && "New Chat"}
      </Button>
    </Link>
  );
}
