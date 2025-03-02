import { Message } from "ai/react";
import React, { ReactNode } from "react";
import { ThinkingDropdown } from "./ThinkingDropdown";
import { ToolCallMessageContent } from "./ToolCallResult";
import ArtifactPreview from "./artifact-preview";
import MarkdownViewer from "../viewers/markdown-viewer";
import Syyclops3dEye from "../syy-eye";
import { Artifact } from "@/types/chat";
import { useAtom, useSetAtom } from "jotai";
import {
  alreadyAutoSelectedArtifactAtom,
  selectedArtifactAtom,
} from "@/atoms/chat";

interface SpecialContent {
  thinking: string | null;
  artifact: Artifact | null;
  cleanContent: string;
}

// Utility function to extract special content
const extractSpecialContent = (content: string): SpecialContent => {
  const thinkingMatch = content.match(
    /<antThinking>([\s\S]*?)(?:<\/antThinking>|$)/
  );
  const hasThinking = content.includes("<antThinking>");
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;

  // Improved artifact extraction with a single regex that captures all needed parts
  const artifactRegex =
    /<antArtifact\s+identifier="([\s\S]*?)"\s+type="([\s\S]*?)"\s+title="([\s\S]*?)">([\s\S]*?)(?:<\/antArtifact>|$)/;
  const artifactMatch = content.match(artifactRegex);
  const hasArtifact = content.includes("<antArtifact");

  const artifact = artifactMatch
    ? {
        identifier: artifactMatch[1],
        type: artifactMatch[2],
        title: artifactMatch[3],
        content: artifactMatch[4].trim(),
        isComplete: content.includes("</antArtifact>"),
        rawContent: artifactMatch[4].trim(),
      }
    : null;

  let cleanContent = content
    .replace(/<antThinking>[\s\S]*?(?:<\/antThinking>|$)/g, "")
    .replace(/<antArtifact[\s\S]*?>[\s\S]*?(?:<\/antArtifact>|$)/g, "")
    .trim();

  return { thinking, artifact, cleanContent };
};

// Component to render text content
const TextContent: React.FC<{
  text: string;
  messages: Message[];
  index: number;
}> = ({ text, messages, index }) => {
  const { thinking, artifact, cleanContent } = extractSpecialContent(text);
  const elements: ReactNode[] = [];
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const [alreadyAutoSelectedArtifact, setAlreadyAutoSelectedArtifact] = useAtom(
    alreadyAutoSelectedArtifactAtom
  );

  const processedRef = React.useRef(false);

  // Auto-select new artifacts
  React.useEffect(() => {
    if (artifact && !processedRef.current) {
      processedRef.current = true;

      // Calculate artifact version
      let version = 0;
      let foundCurrentArtifact = false;

      for (const message of messages) {
        if (typeof message.content === "string") {
          const artifactRegex = new RegExp(
            `<antArtifact\\s+identifier="${artifact.identifier}"[\\s\\S]*?>(([\\s\\S]*?)(?:<\\/antArtifact>|$))`,
            "g"
          );

          const matches = [...message.content.matchAll(artifactRegex)];

          for (const match of matches) {
            version++;

            if (match[2]?.trim() === artifact.content.trim()) {
              foundCurrentArtifact = true;
            }
          }
        }

        if (foundCurrentArtifact) {
          break;
        }
      }

      const artifactVersion = foundCurrentArtifact ? version : version + 1;
      const artifactKey = `${artifact.identifier}-v${artifactVersion}`;

      // Only auto-select if we haven't already selected this specific version
      if (alreadyAutoSelectedArtifact !== artifactKey) {
        setSelectedArtifact({
          ...artifact,
          version: artifactVersion,
        });
        setAlreadyAutoSelectedArtifact(artifactKey);
      }
    }
  }, [artifact, messages]);

  //   if (thinking) {
  //     elements.push(
  //       <ThinkingDropdown key={`thinking-${index}`}>
  //         <MarkdownViewer content={thinking} />
  //       </ThinkingDropdown>
  //     );
  //   }

  const renderWithArtifact = () => {
    let processedText = text.replace(
      /<antThinking>[\s\S]*?(?:<\/antThinking>|$)/g,
      ""
    );
    const artifactPosition = processedText.indexOf("<antArtifact");
    processedText = processedText.replace(
      /<antArtifact[\s\S]*?>[\s\S]*?(?:<\/antArtifact>|$)/g,
      "{{ARTIFACT}}"
    );

    const parts = processedText.split("{{ARTIFACT}}");

    if (artifactPosition > 0) {
      if (parts[0].trim()) {
        elements.push(
          <MarkdownViewer key={`before-${index}`} content={parts[0].trim()} />
        );
      }
      elements.push(
        <ArtifactPreview
          key={`artifact-${index}`}
          artifact={artifact!}
          messages={messages}
        />
      );
      if (parts[1]?.trim()) {
        elements.push(
          <MarkdownViewer key={`after-${index}`} content={parts[1].trim()} />
        );
      }
    } else {
      elements.push(
        <ArtifactPreview
          key={`artifact-${index}`}
          artifact={artifact!}
          messages={messages}
        />
      );
      if (cleanContent) {
        elements.push(
          <MarkdownViewer key={`text-${index}`} content={cleanContent} />
        );
      }
    }
  };

  if (artifact) {
    renderWithArtifact();
  } else if (cleanContent) {
    elements.push(
      <MarkdownViewer key={`text-${index}`} content={cleanContent} />
    );
  }

  return <>{elements}</>;
};

// Component to render message content
const MessageContent: React.FC<{
  message: Message;
  messages: Message[];
}> = React.memo(({ message, messages }) => {
  if (message.parts?.length) {
    return (
      <>
        {message.parts.flatMap((part, index) =>
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
      </>
    );
  }

  const content =
    typeof message.content === "string" ? (
      <TextContent text={message.content} messages={messages} index={0} />
    ) : (
      <MarkdownViewer content={message.content} />
    );

  return <>{content}</>;
});

// Main component
const AssistantMessage: React.FC<{
  message: Message;
  showEye: boolean;
  messages: Message[];
}> = ({ message, showEye, messages }) => {
  return (
    <div className="my-2 flex flex-col justify-start">
      <div className="flex">
        <div className="mr-1 w-[32px] h-[32px]">
          {showEye && <Syyclops3dEye size={32} animate={false} />}
        </div>
        <div className="max-w-full md:max-w-[750px] overflow-hidden bg-background break-words mt-[1px] flex flex-col gap-2">
          <MessageContent message={message} messages={messages} />
        </div>
      </div>
    </div>
  );
};

export default AssistantMessage;
