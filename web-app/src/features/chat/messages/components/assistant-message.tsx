import React, { useState } from "react";
import { Message as AIMessage } from "ai/react";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
} from "@/components/ui/message";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import MarkdownViewer from "./viewers/markdown-viewer";
import ThinkingDropdown from "./thinking-dropdown";
import ToolCallMessageContent from "./tool-call-result";
import logo from "@/assets/logo192.png";

const TextContent: React.FC<{
  text: string;
  messages: AIMessage[];
  index: number;
  hasArtifactTool?: boolean;
}> = ({ text, index }) => {
  return text ? <MarkdownViewer key={`text-${index}`} content={text} /> : null;
};

const MessageContentComponent: React.FC<{
  message: AIMessage;
  messages: AIMessage[];
}> = React.memo(({ message, messages }) => {
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
MessageContentComponent.displayName = "MessageContentComponent";

const AssistantMessage: React.FC<{
  message: AIMessage;
  showEye: boolean;
  messages: AIMessage[];
}> = ({ message, showEye, messages }) => {
  const [copied, setCopied] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const getMessageText = () => {
    if (message.parts?.length) {
      return message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
    }
    return typeof message.content === "string" ? message.content : "";
  };

  const handleCopy = () => {
    const text = getMessageText();
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Message
      className="justify-start group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {showEye && <MessageAvatar src={logo} alt="AI" fallback="AI" />}
      <div className="flex w-full flex-col gap-2">
        <div className="bg-transparent p-0">
          <MessageContentComponent message={message} messages={messages} />
        </div>

        <MessageActions
          className={`self-start transition-opacity duration-200 ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}
        >
          <MessageAction tooltip={copied ? "Copied!" : "Copy to clipboard"}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </MessageAction>
        </MessageActions>
      </div>
    </Message>
  );
};
AssistantMessage.displayName = "AssistantMessage";

export default AssistantMessage;
