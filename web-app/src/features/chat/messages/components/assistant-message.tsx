import React from "react";
import { Message } from "ai/react";
import MarkdownViewer from "./viewers/markdown-viewer";
import ThinkingDropdown from "./thinking-dropdown";
import ToolCallMessageContent from "./tool-call-result";
import logo from "@/assets/logo192.png";

const TextContent: React.FC<{
  text: string;
  messages: Message[];
  index: number;
  hasArtifactTool?: boolean;
}> = ({ text, index }) => {
  return text ? <MarkdownViewer key={`text-${index}`} content={text} /> : null;
};

const MessageContent: React.FC<{ message: Message; messages: Message[] }> =
  React.memo(({ message, messages }) => {
    const shouldAutoCloseThinking = React.useMemo(() => {
      return message.parts?.some(
        (part) =>
          part.type === "tool-invocation" ||
          (part.type === "text" && part.text?.trim().length > 0)
      );
    }, [message.parts]);

    const hasArtifactTool = React.useMemo(() => {
      const hasInParts = message.parts?.some(
        (part) =>
          part.type === "tool-invocation" &&
          part.toolInvocation?.toolName === "create_artifact"
      );
      const hasInToolInvocations = message.toolInvocations?.some(
        (tool) => tool.toolName === "create_artifact"
      );
      return hasInParts || hasInToolInvocations;
    }, [message.parts, message.toolInvocations]);

    if (message.parts?.length) {
      return (
        <div className="flex flex-col gap-2">
          {message.parts.map((part, index) => {
            if (part.type === "reasoning") {
              return (
                <ThinkingDropdown
                  key={`reasoning-${index}`}
                  autoClose={shouldAutoCloseThinking}
                >
                  <MarkdownViewer content={part.reasoning} />
                </ThinkingDropdown>
              );
            }
            if (part.type === "tool-invocation") {
              return (
                <ToolCallMessageContent
                  key={`tool-${index}`}
                  tool={part.toolInvocation}
                />
              );
            }
            if (part.type === "text") {
              return (
                <TextContent
                  key={`text-${index}`}
                  text={part.text}
                  messages={messages}
                  index={index}
                  hasArtifactTool={hasArtifactTool}
                />
              );
            }
            return null;
          })}
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
      <div className="max-w-full md:max-w-[750px]  bg-background break-words mt-[1px] flex flex-col gap-2">
        <MessageContent message={message} messages={messages} />
      </div>
    </div>
  </div>
);
AssistantMessage.displayName = "AssistantMessage";

export default AssistantMessage;
