import { Message } from "ai/react";
import { ThinkingDropdown } from "./ThinkingDropdown";
import { ToolCallMessageContent } from "./ToolCallResult";
import ArtifactPreview from "./artifact-preview";
import MarkdownViewer from "../viewers/markdown-viewer";
import Syyclops3dEye from "../syy-eye";
import React from "react";

const AssistantMessage = ({
  message,
  showEye,
}: {
  message: Message;
  showEye: boolean;
}) => {
  // Parse antThinking and antArtifact content
  const parseSpecialContent = (content: string) => {
    // Check for partial or complete tags
    const hasThinkingStart = content.includes("<antThinking>");
    const hasThinkingEnd = content.includes("</antThinking>");
    const hasArtifactStart = content.includes("<antArtifact");
    const hasArtifactEnd = content.includes("</antArtifact>");

    const thinkingRegex = /<antThinking>([\s\S]*?)(?:<\/antThinking>|$)/;
    const artifactRegex =
      /<antArtifact[\s\S]*?>([\s\S]*?)(?:<\/antArtifact>|$)/;
    const artifactMetaRegex =
      /<antArtifact\s+identifier="([\s\S]*?)"\s+type="([\s\S]*?)"\s+title="([\s\S]*?)">/;

    const thinkingMatch = content.match(thinkingRegex);
    const artifactMatch = content.match(artifactRegex);
    const artifactMetaMatch = content.match(artifactMetaRegex);

    const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;

    let artifact = null;
    if (artifactMatch && artifactMetaMatch) {
      artifact = {
        identifier: artifactMetaMatch[1],
        type: artifactMetaMatch[2],
        title: artifactMetaMatch[3],
        content: artifactMatch[1].trim(),
        isComplete: hasArtifactEnd,
      };
    }

    // Remove special tags from content only if they're complete
    let cleanContent = content;
    if (hasThinkingStart && hasThinkingEnd) {
      cleanContent = cleanContent.replace(
        /<antThinking>[\s\S]*?<\/antThinking>/,
        ""
      );
    }
    if (hasArtifactStart && hasArtifactEnd) {
      cleanContent = cleanContent.replace(
        /<antArtifact[\s\S]*?<\/antArtifact>/,
        ""
      );
    }

    // If tags are incomplete, hide them from the main content
    if (hasThinkingStart && !hasThinkingEnd) {
      cleanContent = cleanContent.replace(/<antThinking>[\s\S]*?$/, "");
    }
    if (hasArtifactStart && !hasArtifactEnd) {
      cleanContent = cleanContent.replace(/<antArtifact[\s\S]*?$/, "");
    }

    return {
      thinking,
      artifact,
      cleanContent: cleanContent.trim(),
      hasPartialThinking: hasThinkingStart && !hasThinkingEnd,
      hasPartialArtifact: hasArtifactStart && !hasArtifactEnd,
    };
  };
  // Process message content if it's a string
  const processedContent = React.useMemo(() => {
    if (typeof message.content === "string") {
      return parseSpecialContent(message.content);
    }
    return { thinking: null, artifact: null, cleanContent: message.content };
  }, [message.content]);

  console.log("processedContent", processedContent);

  return (
    <div className="my-2 flex flex-col justify-start">
      <div className="flex">
        <div className="mr-1 pt-2 w-[32px] h-[32px]">
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
          {message.parts?.map((part, index) => {
            switch (part.type) {
              //   case "text":
              //     return (
              //       <MarkdownViewer initialContent={part.text} key={index} />
              //     );
              //   case "reasoning":
              //     return (
              //       <ThinkingDropdown key={index}>
              //         <MarkdownViewer initialContent={part.reasoning || ""} />
              //       </ThinkingDropdown>
              //     );
              case "tool-invocation":
                return (
                  <ToolCallMessageContent
                    tool={part.toolInvocation}
                    key={index}
                  />
                );
              default:
                return null;
            }
          })}

          {/* Display regular content if no parts */}
          {!message.parts && processedContent.cleanContent && (
            <MarkdownViewer initialContent={processedContent.cleanContent} />
          )}

          {/* Display thinking content if present */}
          {processedContent.thinking && (
            <ThinkingDropdown>
              <MarkdownViewer initialContent={processedContent.thinking} />
            </ThinkingDropdown>
          )}

          {/* Display artifact if present */}
          {processedContent.artifact && (
            <ArtifactPreview artifact={processedContent.artifact} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AssistantMessage;
