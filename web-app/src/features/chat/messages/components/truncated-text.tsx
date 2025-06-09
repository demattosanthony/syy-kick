import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TruncatedTextProps {
  content: string;
  maxLength?: number;
  renderContent?: (content: string) => React.ReactNode;
  className?: string;
}

const TruncatedText: React.FC<TruncatedTextProps> = ({
  content,
  maxLength = 1500,
  renderContent,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const shouldTruncate = content.length > maxLength;
  const displayContent =
    shouldTruncate && !isExpanded
      ? content.substring(0, maxLength) + "..."
      : content;

  if (!shouldTruncate) {
    return (
      <div className={className}>
        {renderContent ? (
          renderContent(content)
        ) : (
          <div className="whitespace-pre-wrap">{content}</div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {renderContent ? (
        renderContent(displayContent)
      ) : (
        <div className="whitespace-pre-wrap">{displayContent}</div>
      )}

      <div className="mt-2 flex justify-start">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-muted-foreground hover:border-none hover:bg-transparent"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-3 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="size-3 mr-1" />
              Show more ({Math.ceil((content.length - maxLength) / 100)} more
              lines)
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default TruncatedText;
