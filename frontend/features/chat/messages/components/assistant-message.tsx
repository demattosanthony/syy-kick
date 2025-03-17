import React from "react";
import { Message } from "ai/react";
import ArtifactPreview from "./artifact-preview";
import MarkdownViewer from "./viewers/markdown-viewer";
import Syyclops3dEye from "@/features/chat/messages/components/syy-eye";
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

const TextContent: React.FC<{
  text: string;
  messages: Message[];
  index: number;
}> = ({ text, messages, index }) => {
  const { artifact, cleanContent } = extractSpecialContent(text);
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const [alreadyAutoSelected, setAlreadyAutoSelected] = useAtom(
    alreadyAutoSelectedArtifactAtom
  );
  const processedRef = React.useRef(false);

  React.useEffect(() => {
    if (artifact && !processedRef.current) {
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
  ]);

  const elements = [];
  if (artifact) {
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
    if (message.parts?.length) {
      return (
        <React.Fragment>
          {message.parts
            .sort((a, b) =>
              a.type === "reasoning" ? -1 : b.type === "reasoning" ? 1 : 0
            )
            .map((part, index) =>
              part.type === "reasoning" ? (
                <ThinkingDropdown key={`reasoning-${index}`}>
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
                />
              ) : null
            )}
        </React.Fragment>
      );
    }
    return typeof message.content === "string" ? (
      <TextContent text={message.content} messages={messages} index={0} />
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
        {showEye && <Syyclops3dEye size={22} animate={false} />}
      </div>

      <div className="max-w-full md:max-w-[750px] overflow-hidden bg-background break-words mt-[1px] flex flex-col gap-2">
        <MessageContent message={message} messages={messages} />
      </div>
    </div>
  </div>
);
AssistantMessage.displayName = "AssistantMessage";

export default AssistantMessage;
