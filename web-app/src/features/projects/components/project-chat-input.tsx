import { useAtom } from "jotai";
import { initalInputAtom } from "@/atoms/chat";
import api from "@/lib/api";
import { useWorkspace } from "@/workspace-context";
import { ChatInputForm } from "@/features/chat/messages/components";
import { useNavigate } from "react-router";

interface ProjectChatInputProps {
  type: "project" | "knowledge-base";
  projectId?: string;
  knowledgeBaseId?: string;
}

const ProjectChatInput = ({
  projectId,
  type,
  knowledgeBaseId,
}: ProjectChatInputProps) => {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (initalInput.trim() === "") return;

    try {
      const { id: threadId } = await api.threads.createThread({
        organizationId:
          activeWorkspace?.type === "organization"
            ? activeWorkspace.id
            : undefined,
        projectId: type === "project" ? projectId : undefined,
        knowledgeBaseId:
          type === "knowledge-base" ? knowledgeBaseId : undefined,
      });
      navigate(`/threads/${threadId}?isNew=true`);
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
      showContextSelector={projectId ? true : false}
      projectId={projectId}
    />
  );
};

export default ProjectChatInput;
