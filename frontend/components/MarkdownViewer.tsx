import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism, SyntaxHighlighterProps } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyP,
  TypographyBlockquote,
  TypographyTable,
  TypographyTh,
  TypographyTd,
  TypographyTr,
  TypographyList,
  TypographyLi,
  TypographyInlineCode,
} from "./Typography";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui/button";

const SyntaxHighlighter =
  Prism as typeof React.Component<SyntaxHighlighterProps>;

// CodeBlock component for rendering code with copy functionality
const CodeBlock = ({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).trim();
  const [buttonText, setButtonText] = useState("Copy");

  const handleCopy = () => {
    navigator.clipboard
      .writeText(codeString)
      .then(() => {
        console.log("Code copied to clipboard");
        setButtonText("Copied!");
        setTimeout(() => setButtonText("Copy"), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy code: ", err);
      });
  };

  return match ? (
    <div className="relative w-full overflow-x-auto">
      <Button
        size={"icon"}
        variant={"ghost"}
        className="absolute right-0 top-2.5 text-white hover:bg-transparent hover:text-white hover:opacity-90"
        onClick={handleCopy}
      >
        {buttonText === "Copy" ? (
          <Copy size={16} />
        ) : (
          <Check size={16} className="text-green-500" />
        )}
      </Button>
      <div className="max-w-full break-words">
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          showLineNumbers
          //   wrapLongLines={true}
          customStyle={{
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    </div>
  ) : (
    <TypographyInlineCode>{children}</TypographyInlineCode>
  );
};

// MarkdownViewer component for rendering markdown content
const MarkdownViewer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="markdown-viewer">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <TypographyH1>{children}</TypographyH1>,
          h2: ({ children }) => <TypographyH2>{children}</TypographyH2>,
          h3: ({ children }) => <TypographyH3>{children}</TypographyH3>,
          h4: ({ children }) => <TypographyH4>{children}</TypographyH4>,
          p: ({ children }) => <TypographyP>{children}</TypographyP>,
          blockquote: ({ children }) => (
            <TypographyBlockquote>{children}</TypographyBlockquote>
          ),
          table: ({ children }) => (
            <TypographyTable>{children}</TypographyTable>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <TypographyTr>{children}</TypographyTr>,
          th: ({ children }) => <TypographyTh>{children}</TypographyTh>,
          td: ({ children }) => <TypographyTd>{children}</TypographyTd>,
          ul: ({ children }) => <TypographyList>{children}</TypographyList>,
          ol: ({ children }) => <TypographyList>{children}</TypographyList>,
          li: ({ children }) => <TypographyLi>{children}</TypographyLi>,
          code: ({ className, children }) => (
            <CodeBlock className={className}>{children}</CodeBlock>
          ),
          em: ({ children }) => <em>{children}</em>,
          strong: ({ children }) => <strong>{children}</strong>,
          a: ({ children, ...props }) => (
            <a
              className="text-blue-500 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          img: ({ ...props }) => (
            <img className="max-w-full h-auto" {...props} />
          ),
        }}
        remarkPlugins={[remarkGfm]}
        className="flex flex-col gap-1"
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
