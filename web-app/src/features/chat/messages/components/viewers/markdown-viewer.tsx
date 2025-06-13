import { useMemo, memo, useId } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Typography components
import {
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyP,
  TypographyBlockquote,
  TypographyTable,
  TypographyTr,
  TypographyTh,
  TypographyTd,
  TypographyList,
  TypographyOrderedList,
  TypographyLi,
} from "@/components/Typography";

// Utilities
import { marked } from "marked";
import { cn } from "@/lib/utils";

// Code block components
import {
  CodeBlock,
  CodeBlockCode,
} from "@/features/chat/messages/components/viewers/code-block";

function extractLanguage(className?: string): string {
  if (!className) return "plaintext";
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : "plaintext";
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

export type MarkdownViewerProps = {
  content: string;
  id?: string;
  className?: string;
  components?: Partial<Components>;
};

const INITIAL_COMPONENTS: Partial<Components> = {
  h1: ({ children }) => <TypographyH1>{children}</TypographyH1>,
  h2: ({ children }) => <TypographyH2>{children}</TypographyH2>,
  h3: ({ children }) => <TypographyH3>{children}</TypographyH3>,
  h4: ({ children }) => <TypographyH4>{children}</TypographyH4>,
  p: ({ children }) => <TypographyP>{children}</TypographyP>,
  blockquote: ({ children }) => (
    <TypographyBlockquote>{children}</TypographyBlockquote>
  ),
  table: ({ children }) => <TypographyTable>{children}</TypographyTable>,
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <TypographyTr>{children}</TypographyTr>,
  th: ({ children }) => <TypographyTh>{children}</TypographyTh>,
  td: ({ children }) => <TypographyTd>{children}</TypographyTd>,
  ul: ({ children }) => <TypographyList>{children}</TypographyList>,
  ol: ({ children }) => (
    <TypographyOrderedList>{children}</TypographyOrderedList>
  ),
  li: ({ children }) => <TypographyLi>{children}</TypographyLi>,
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground dark:bg-muted rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      );
    }

    const language = extractLanguage(className);

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    );
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>;
  },
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
  img: ({ ...props }) => <img className="max-w-full h-auto" {...props} />,
  hr: ({ ...props }) => <hr className="my-4" {...props} />,
};

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string;
    components?: Partial<Components>;
  }) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    );
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content;
  }
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function MarkdownViewerComponent({
  content,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownViewerProps) {
  const generatedId = useId();
  const blockId = id ?? generatedId;
  const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

  return (
    <div className={cn("markdown-viewer flex flex-col gap-2", className)}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  );
}

const MarkdownViewer = memo(MarkdownViewerComponent);
MarkdownViewer.displayName = "MarkdownViewer";

export default MarkdownViewer;
