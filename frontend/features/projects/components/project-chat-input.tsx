"use client";

import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { initalInputAtom } from "@/atoms/chat";
import api from "@/lib/api";
import { useWorkspace } from "@/components/sidebar/workspace-context";
import { ChatInputForm } from "@/features/chat/messages/components";

const ProjectChatInput = ({ projectId }: { projectId: string }) => {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (initalInput.trim() === "") return;

    try {
      const { id: threadId } = await api.threads.createThread(
        activeWorkspace?.type === "organization"
          ? activeWorkspace.id
          : undefined,
        projectId
      );
      router.prefetch(`/threads/${threadId}?new=true`);
      router.push(`/threads/${threadId}?new=true`);
    } catch (error: unknown) {
      console.error("Failed to create thread:", error);
    }
  };

  return (
    <ChatInputForm
      input={initalInput}
      setInput={setInitalInput}
      handleInputChange={handleInputChange}
      onSubmit={handleSubmit}
      showContextSelector={true}
      projectId={projectId}
    />
  );
}

export default ProjectChatInput;