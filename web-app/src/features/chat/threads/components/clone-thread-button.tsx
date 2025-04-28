import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router";
import api from "@/lib/api";
import { toast } from "sonner";

interface CloneThreadButtonProps {
  threadId: string;
  className?: string;
}

export function CloneThreadButton({
  threadId,
  className,
}: CloneThreadButtonProps) {
  const navigate = useNavigate();
  const [isCloning, setIsCloning] = useState(false);

  const handleCloneThread = async () => {
    setIsCloning(true);
    try {
      const { id: newThreadId } = await api.threads.cloneThread(threadId);
      navigate(`/threads/${newThreadId}`);
    } catch (error) {
      toast.error("Failed to clone thread. Please try again.");
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Button
      onClick={handleCloneThread}
      disabled={isCloning}
      className={className}
    >
      Continue Conversation
    </Button>
  );
}
