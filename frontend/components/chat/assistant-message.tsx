import React from "react";
import { Message } from "ai/react";
import { ThinkingDropdown } from "./ThinkingDropdown";
import { ToolCallMessageContent } from "./ToolCallResult";
import ArtifactPreview from "./artifact-preview";
import MarkdownViewer from "../viewers/markdown-viewer";
import Syyclops3dEye from "../syy-eye";
import { useAtom, useSetAtom } from "jotai";
import {
  alreadyAutoSelectedArtifactAtom,
  selectedArtifactAtom,
} from "@/atoms/chat";
import {
  extractSpecialContent,
  getArtifactVersionInfo,
} from "@/lib/artifact-utils";
import { useSidebar } from "../ui/sidebar";

const TextContent: React.FC<{
  text: string;
  messages: Message[];
  index: number;
}> = ({ text, messages, index }) => {
  const { artifact, cleanContent } = extractSpecialContent(text);
  const { open, setOpen } = useSidebar();
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
        setSelectedArtifact({ ...artifact, version });
        setAlreadyAutoSelected(artifactKey);
        if (open) setOpen(false);
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
    const parts = text
      .replace(/<antThinking>[\s\S]*?(?:<\/antThinking>|$)/g, "")
      .replace(
        /<antArtifact[\s\S]*?>[\s\S]*?(?:<\/antArtifact>|$)/g,
        "{{ARTIFACT}}"
      )
      .split("{{ARTIFACT}}");

    if (parts[0].trim())
      elements.push(
        <MarkdownViewer key={`before-${index}`} content={parts[0].trim()} />
      );
    elements.push(
      <ArtifactPreview
        key={`artifact-${index}`}
        artifact={artifact}
        messages={messages}
      />
    );
    if (parts[1]?.trim())
      elements.push(
        <MarkdownViewer key={`after-${index}`} content={parts[1].trim()} />
      );
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
          {message.parts.map((part, index) =>
            part.type === "tool-invocation" ? (
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
            ) : part.type === "reasoning" ? (
              <ThinkingDropdown key={`reasoning-${index}`}>
                <MarkdownViewer content={part.reasoning} />
              </ThinkingDropdown>
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

const AssistantMessage: React.FC<{
  message: Message;
  showEye: boolean;
  messages: Message[];
}> = ({ message, showEye, messages }) => (
  <div className="my-2 flex flex-col justify-start">
    <div className="flex">
      {showEye && (
        <div className="mr-1 w-[32px] h-[32px]">
          {showEye && <Syyclops3dEye size={32} animate={false} />}
        </div>
      )}
      <div className="max-w-full md:max-w-[750px] overflow-hidden bg-background break-words mt-[1px] flex flex-col gap-2">
        <MessageContent message={message} messages={messages} />
      </div>
    </div>
  </div>
);

export default AssistantMessage;
