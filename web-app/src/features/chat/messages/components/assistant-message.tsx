import React from "react";
import { Message } from "ai/react";
import ArtifactPreview from "./artifact-preview";
import MarkdownViewer from "./viewers/markdown-viewer";
import { useAtom, useSetAtom } from "jotai";
import {
  alreadyAutoSelectedArtifactAtom,
  selectedArtifactAtom,
} from "@/atoms/chat";
import {
  extractSpecialContent,
  getArtifactVersionInfo,
} from "@/lib/artifact-utils";
import ThinkingDropdown from "./thinking-dropdown";
import ToolCallMessageContent from "./tool-call-result";
import logo from "@/assets/logo192.png";

const TextContent: React.FC<{
  text: string;
  messages: Message[];
  index: number;
  hasArtifactTool?: boolean;
}> = ({ text, messages, index, hasArtifactTool = false }) => {
  // If there's an artifact tool call in this message, don't extract artifacts from text
  const shouldExtractArtifacts = !hasArtifactTool;
  const { artifact, cleanContent } = shouldExtractArtifacts
    ? extractSpecialContent(text)
    : { artifact: null, cleanContent: text };

  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const [alreadyAutoSelected, setAlreadyAutoSelected] = useAtom(
    alreadyAutoSelectedArtifactAtom
  );
  const processedRef = React.useRef(false);

  React.useEffect(() => {
    if (artifact && !processedRef.current && shouldExtractArtifacts) {
      processedRef.current = true;
      const { version } = getArtifactVersionInfo(artifact, messages);
      const artifactKey = `${artifact.identifier}-v${version}`;
      if (alreadyAutoSelected !== artifactKey) {
        // Create a new object to ensure state update is triggered
        const artifactWithVersion = {
          ...artifact,
          version,
          key: Date.now(), // Add a unique key to force re-render
        };
        setSelectedArtifact(artifactWithVersion);
        setAlreadyAutoSelected(artifactKey);
      }
    }
  }, [
    artifact,
    messages,
    setSelectedArtifact,
    alreadyAutoSelected,
    setAlreadyAutoSelected,
    shouldExtractArtifacts,
  ]);

  const elements = [];
  if (artifact && shouldExtractArtifacts) {
    // First, clean the text by removing thinking and artifact tags
    const cleanedText = text
      .replace(/<antThinking>[\s\S]*?(?:<\/antThinking>|$)/g, "")
      .replace(
        /<antArtifact[\s\S]*?>[\s\S]*?(?:<\/antArtifact>|$)/g,
        "{{ARTIFACT}}"
      );

    // Split by the artifact placeholder
    const parts = cleanedText.split("{{ARTIFACT}}");

    // Add the text before the artifact if it exists
    if (parts[0].trim()) {
      elements.push(
        <MarkdownViewer key={`before-${index}`} content={parts[0].trim()} />
      );
    }

    // Add the artifact preview
    elements.push(
      <ArtifactPreview
        key={`artifact-${index}`}
        artifact={artifact}
        messages={messages}
      />
    );

    // Add the text after the artifact if it exists
    if (parts[1]?.trim()) {
      elements.push(
        <MarkdownViewer key={`after-${index}`} content={parts[1].trim()} />
      );
    }
  } else if (cleanContent) {
    elements.push(
      <MarkdownViewer key={`text-${index}`} content={cleanContent} />
    );
  }

  return <>{elements}</>;
};

const MessageContent: React.FC<{ message: Message; messages: Message[] }> =
  React.memo(({ message, messages }) => {
    // Determine if we should auto-close the thinking dropdown
    const shouldAutoCloseThinking = React.useMemo(() => {
      if (!message.parts?.length) return false;

      // Check if there are any non-reasoning parts
      // If there are tool invocations or text content, we should auto-close thinking
      return message.parts.some(
        (part) =>
          part.type === "tool-invocation" ||
          (part.type === "text" && part.text?.trim().length > 0)
      );
    }, [message.parts]);

    // Check if this message has create_artifact tool invocations
    const hasArtifactTool = React.useMemo(() => {
      if (!message.parts?.length && !message.toolInvocations?.length)
        return false;

      // Check in parts
      const hasInParts = message.parts?.some(
        (part) =>
          part.type === "tool-invocation" &&
          part.toolInvocation?.toolName === "create_artifact"
      );

      // Check in toolInvocations
      const hasInToolInvocations = message.toolInvocations?.some(
        (tool) => tool.toolName === "create_artifact"
      );

      return hasInParts || hasInToolInvocations;
    }, [message.parts, message.toolInvocations]);

    if (message.parts?.length) {
      return (
        <div className="flex flex-col gap-2">
          {message.parts.map((part, index) =>
            part.type === "reasoning" ? (
              <ThinkingDropdown
                key={`reasoning-${index}`}
                autoClose={shouldAutoCloseThinking}
              >
                <MarkdownViewer content={part.reasoning} />
              </ThinkingDropdown>
            ) : part.type === "tool-invocation" ? (
              <ToolCallMessageContent
                key={`tool-${index}`}
                tool={part.toolInvocation}
              />
            ) : part.type === "text" ? (
              <TextContent
                key={`text-${index}`}
                text={part.text}
                messages={messages}
                index={index}
                hasArtifactTool={hasArtifactTool}
              />
            ) : null
          )}
        </div>
      );
    }
    return typeof message.content === "string" ? (
      <TextContent
        text={message.content}
        messages={messages}
        index={0}
        hasArtifactTool={hasArtifactTool}
      />
    ) : (
      <MarkdownViewer content={message.content} />
    );
  });
MessageContent.displayName = "MessageContent";

const AssistantMessage: React.FC<{
  message: Message;
  showEye: boolean;
  messages: Message[];
}> = ({ message, showEye, messages }) => (
  <div className="flex flex-col justify-start">
    <div className="flex">
      <div className="mr-[1px] mt-1 w-[32px] h-[32px] min-h-[32px] min-w-[32px]">
        {showEye && <img src={logo} width={22} height={22} alt="" />}
      </div>

      <div className="max-w-full md:max-w-[750px] overflow-hidden bg-background break-words mt-[1px] flex flex-col gap-2">
        <MessageContent message={message} messages={messages} />
      </div>
    </div>
  </div>
);
AssistantMessage.displayName = "AssistantMessage";

export default AssistantMessage;
