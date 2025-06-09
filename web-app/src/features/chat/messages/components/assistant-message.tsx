import React, { useState } from "react";
import { Message as AIMessage } from "ai/react";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
} from "@/components/ui/message";
import { Button } from "@/components/ui/button";
import { Copy, Check, AlertCircle, RotateCcw } from "lucide-react";
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

const ErrorMessage: React.FC<{
  error: string;
  hasPartialContent: boolean;
}> = ({ error, hasPartialContent }) => {
  return (
    <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 mt-2 w-fit">
      <div className="flex items-start gap-2">
        <AlertCircle className="size-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {hasPartialContent
              ? "Message generation failed"
              : "Failed to generate response"}
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          {hasPartialContent && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Partial content shown above may be incomplete.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const MessageContentComponent: React.FC<{
  message: AIMessage & { status?: string; error?: string };
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

  const isFailedMessage = message.status === "failed";
  const hasPartialContent = Boolean(
    isFailedMessage &&
      (message.content ||
        message.parts?.some((part) => part.type === "text" && part.text))
  );

  const renderContent = () => {
    if (message.parts?.length) {
      return (
        <div className="flex flex-col gap-2">
          {message.parts.map((part, index) => {
            if (part.type === "reasoning") {
              return (
                <ThinkingDropdown
                  key={`reasoning-${index}`}
                  autoClose={shouldAutoCloseThinking}
                  reasoningDurationSeconds={
                    (message as any).reasoningDurationSeconds
                  }
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
  };

  return (
    <div className="flex flex-col">
      {renderContent()}
      {isFailedMessage && message.error && (
        <ErrorMessage
          error={message.error}
          hasPartialContent={hasPartialContent}
        />
      )}
    </div>
  );
});
MessageContentComponent.displayName = "MessageContentComponent";

const AssistantMessage: React.FC<{
  message: AIMessage & { status?: string; error?: string };
  showEye: boolean;
  showActions: boolean;
  messages: AIMessage[];
  onRetry?: (messageId: string) => void;
}> = ({ message, showEye, showActions, messages, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

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

  const handleRetry = async () => {
    if (!onRetry || !message.id || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry(message.id);
    } catch (error) {
      console.error("Error retrying message:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  //   const isFailedMessage = message.status === "failed";

  return (
    <Message
      className="justify-start group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {showEye ? (
        <MessageAvatar src={logo} alt="AI" fallback="AI" className="" />
      ) : (
        <div className="size-8" />
      )}
      <div className="flex w-full flex-col gap-2">
        <div className="bg-transparent p-0">
          <MessageContentComponent message={message} messages={messages} />
        </div>

        {showActions && (
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
                disabled={message.status === "failed" && !getMessageText()}
              >
                {copied ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </MessageAction>

            {onRetry && (
              <MessageAction
                tooltip={isRetrying ? "Retrying..." : "Retry message"}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  <RotateCcw
                    className={`size-4 ${isRetrying ? "animate-spin" : ""}`}
                  />
                </Button>
              </MessageAction>
            )}
          </MessageActions>
        )}
      </div>
    </Message>
  );
};
AssistantMessage.displayName = "AssistantMessage";

export default AssistantMessage;
