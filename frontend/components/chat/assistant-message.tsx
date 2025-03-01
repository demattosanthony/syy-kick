import { Message } from "ai/react";
import { ThinkingDropdown } from "./ThinkingDropdown";
import { ToolCallMessageContent } from "./ToolCallResult";
import ArtifactPreview from "./artifact-preview";
import MarkdownViewer from "../viewers/markdown-viewer";
import Syyclops3dEye from "../syy-eye";
import React from "react";

// Helper function to extract special content
const extractSpecialContent = (content: string) => {
  // Extract thinking content
  //   const thinkingMatch = content.match(
  //     /<antThinking>([\s\S]*?)(?:<\/antThinking>|$)/
  //   );
  const hasThinking = content.includes("<antThinking>");
  //   const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
  const thinking = null;

  // Extract artifact content
  const artifactMetaMatch = content.match(
    /<antArtifact\s+identifier="([\s\S]*?)"\s+type="([\s\S]*?)"\s+title="([\s\S]*?)">/
  );
  const artifactMatch = content.match(
    /<antArtifact[\s\S]*?>([\s\S]*?)(?:<\/antArtifact>|$)/
  );
  const hasArtifact = content.includes("<antArtifact");

  let artifact = null;
  if (artifactMatch && artifactMetaMatch) {
    artifact = {
      identifier: artifactMetaMatch[1],
      type: artifactMetaMatch[2],
      title: artifactMetaMatch[3],
      content: artifactMatch[1].trim(),
      isComplete: content.includes("</antArtifact>"),
    };
  }

  // Clean content by removing all special tags and their content
  let cleanContent = content;

  // Remove thinking tags and their content
  if (hasThinking) {
    cleanContent = cleanContent.replace(
      /<antThinking>[\s\S]*?(?:<\/antThinking>|$)/g,
      ""
    );
  }

  // Remove artifact tags and their content
  if (hasArtifact) {
    cleanContent = cleanContent.replace(
      /<antArtifact[\s\S]*?>[\s\S]*?(?:<\/antArtifact>|$)/g,
      ""
    );
  }

  return { thinking, artifact, cleanContent: cleanContent.trim() };
};

// Process text content and render appropriate components
const renderTextContent = (
  text: string,
  messages: Message[],
  index: number
) => {
  const { thinking, artifact, cleanContent } = extractSpecialContent(text);
  const elements: React.ReactNode[] = [];

  // Add thinking at the beginning
  if (thinking) {
    elements.push(
      <ThinkingDropdown key={`thinking-${index}`}>
        <MarkdownViewer content={thinking} />
      </ThinkingDropdown>
    );
  }

  // First, remove all special tags from the original text for positioning purposes
  let processedText = text;

  // Remove thinking tags for positioning
  if (text.includes("<antThinking>")) {
    processedText = processedText.replace(
      /<antThinking>[\s\S]*?(?:<\/antThinking>|$)/g,
      ""
    );
  }

  // For artifact positioning, we'll keep track of where it was but remove the tags
  let artifactPosition = -1;
  if (artifact) {
    artifactPosition = processedText.indexOf("<antArtifact");
    // Replace the artifact tag with a placeholder for positioning
    processedText = processedText.replace(
      /<antArtifact[\s\S]*?>[\s\S]*?(?:<\/antArtifact>|$)/g,
      "{{ARTIFACT_PLACEHOLDER}}"
    );
  }

  // Now render content in the correct order
  if (artifact && artifactPosition > 0) {
    // Split the content at the artifact placeholder
    const parts = processedText.split("{{ARTIFACT_PLACEHOLDER}}");

    // Render content before artifact
    if (parts[0].trim()) {
      elements.push(
        <MarkdownViewer
          content={parts[0].trim()}
          key={`text-before-${index}`}
        />
      );
    }

    // Render artifact
    elements.push(
      <ArtifactPreview
        artifact={artifact}
        messages={messages}
        key={`artifact-${index}`}
      />
    );

    // Render content after artifact
    if (parts[1] && parts[1].trim()) {
      elements.push(
        <MarkdownViewer content={parts[1].trim()} key={`text-after-${index}`} />
      );
    }
  } else if (artifact) {
    // Artifact at the beginning
    elements.push(
      <ArtifactPreview
        artifact={artifact}
        messages={messages}
        key={`artifact-${index}`}
      />
    );

    if (cleanContent) {
      elements.push(
        <MarkdownViewer content={cleanContent} key={`text-${index}`} />
      );
    }
  } else if (cleanContent) {
    // No artifact, just render clean content
    elements.push(
      <MarkdownViewer content={cleanContent} key={`text-${index}`} />
    );
  }

  return elements;
};

const AssistantMessage = ({
  message,
  showEye,
  messages,
}: {
  message: Message;
  showEye: boolean;
  messages: Message[];
}) => {
  const renderMessageContent = React.useMemo(() => {
    // Handle message with parts
    if (message.parts && message.parts.length > 0) {
      return message.parts.flatMap((part, index) => {
        if (part.type === "tool-invocation") {
          return [
            <ToolCallMessageContent
              tool={part.toolInvocation}
              key={`tool-${index}`}
            />,
          ] as React.ReactElement[];
        } else if (part.type === "text") {
          return renderTextContent(
            part.text,
            messages,
            index
          ) as React.ReactElement[];
        }
        return [] as React.ReactElement[];
      });
    }

    // Fallback for string content
    if (typeof message.content === "string") {
      return renderTextContent(message.content, messages, 0);
    }

    // Handle non-string content
    return [<MarkdownViewer content={message.content} key="main-content" />];
  }, [message, messages]);

  return (
    <div className="my-2 flex flex-col justify-start">
      <div className="flex">
        <div className="mr-1 w-[32px] h-[32px]">
          {showEye ? <Syyclops3dEye size={32} animate={false} /> : null}
        </div>

        <div
          className="
            max-w-full
            md:max-w-[750px]
            overflow-hidden
            bg-background
            break-words
            mt-[1px]
            flex flex-col
            gap-2
          "
        >
          {renderMessageContent}
        </div>
      </div>
    </div>
  );
};

export default AssistantMessage;
