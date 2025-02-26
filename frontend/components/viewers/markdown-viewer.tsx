import React, { useState, useEffect, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism, SyntaxHighlighterProps } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  TypographyInlineCode,
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
} from "../Typography";
import { Button } from "../ui/button";

const SyntaxHighlighter =
  Prism as typeof React.Component<SyntaxHighlighterProps>;

// CodeBlock component (unchanged)
const CodeBlock = ({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).trim();
  const [buttonText, setButtonText] = useState("Copy");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString).then(() => {
      setButtonText("Copied!");
      setTimeout(() => setButtonText("Copy"), 2000);
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
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        showLineNumbers
        customStyle={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  ) : (
    <TypographyInlineCode>{children}</TypographyInlineCode>
  );
};

// EditableBlock component for viewing and editing a single block
const EditableBlock = ({
  block,
  onUpdate,
  editable = true,
}: {
  block: { markdown: string };
  onUpdate: (newMarkdown: string) => void;
  editable?: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize editor with the block's markdown content
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Add any specific configurations here
      }),
      // Add a custom keymap extension
      Extension.create({
        name: "customKeymap",
        addKeyboardShortcuts() {
          return {
            Escape: () => {
              setIsEditing(false);
              return true;
            },
            "Mod-Enter": () => {
              editor?.commands.blur();
              return true;
            },
          };
        },
      }),
    ],
    content: block.markdown,
    editable: isEditing,
    onBlur: () => {
      if (editor) {
        setIsSaving(true);
        // Get the HTML content instead of plain text to preserve formatting
        const content = editor.getHTML();
        // Convert HTML to markdown before saving
        const markdown = convertHtmlToMarkdown(content);
        onUpdate(markdown);

        // Add a small delay to show saving indicator
        setTimeout(() => {
          setIsEditing(false);
          setIsSaving(false);
        }, 300);
      }
    },
  });

  // Helper function to convert HTML to markdown (placeholder)
  const convertHtmlToMarkdown = (html: string) => {
    // In a real implementation, you would use a library like turndown
    // This is just a placeholder
    return html.replace(/<[^>]*>/g, "");
  };

  // Update editor content when block changes
  useEffect(() => {
    if (editor && editor.getText() !== block.markdown) {
      editor.commands.setContent(block.markdown);
    }
  }, [block.markdown, editor]);

  // Set editor to editable and focus when isEditing changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
      if (isEditing) {
        editor.commands.focus("end");
      }
    }
  }, [isEditing, editor]);

  const handleDoubleClick = () => {
    if (editable) {
      setIsEditing(true);
    }
  };

  // Add single click edit button for better discoverability
  const handleEditClick = () => {
    if (editable) {
      setIsEditing(true);
    }
  };

  return (
    <div className="relative group mb-2">
      {editable && !isEditing && (
        <Button
          size="sm"
          variant="ghost"
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleEditClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </Button>
      )}

      <div
        onDoubleClick={handleDoubleClick}
        className={`p-2 rounded-md transition-all duration-200 ${
          editable && !isEditing
            ? "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-text"
            : ""
        } ${isEditing ? "bg-white dark:bg-gray-900 shadow-sm" : ""}`}
      >
        {isEditing && editor ? (
          <div className="border rounded-md p-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <div className="text-xs text-gray-500 mb-1 flex items-center">
              <span className="mr-1">✏️</span> Editing
            </div>
            <EditorContent
              editor={editor}
              className="ProseMirror-focused-override"
            />
            <div className="flex justify-between mt-2 text-sm">
              <div className="text-gray-500">
                {isSaving
                  ? "Saving..."
                  : "Press Esc to cancel, Ctrl+Enter to save"}
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => editor.commands.blur()}
                >
                  Save
                </Button>
              </div>
            </div>
            <style jsx global>{`
              .ProseMirror-focused-override .ProseMirror {
                outline: none !important;
                box-shadow: none !important;
                border: none !important;
                min-height: 100px;
              }
              .ProseMirror {
                outline: none !important;
                box-shadow: none !important;
                border: none !important;
                padding: 0.5rem;
              }
            `}</style>
          </div>
        ) : (
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
              tr: ({ children }) => <TypographyTr>{children}</TypographyTr>,
              th: ({ children }) => <TypographyTh>{children}</TypographyTh>,
              td: ({ children }) => <TypographyTd>{children}</TypographyTd>,
              ul: ({ children }) => <TypographyList>{children}</TypographyList>,
              ol: ({ children }) => (
                <TypographyOrderedList>{children}</TypographyOrderedList>
              ),
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
          >
            {block.markdown}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

// MarkdownEditorViewer component
const MarkdownEditorViewer = ({
  initialContent,
  editable = false,
}: {
  initialContent: string;
  editable?: boolean;
}) => {
  const [blocks, setBlocks] = useState<{ markdown: string }[]>([]);

  // Parse markdown into blocks on mount
  useEffect(() => {
    // Split the content by double newlines as a simple approach
    const blockList = initialContent
      .split(/\n\n+/)
      .filter((block) => block.trim());
    setBlocks(blockList.map((markdown) => ({ markdown })));
  }, [initialContent]);

  const updateBlock = (index: number, newMarkdown: string) => {
    setBlocks((prevBlocks) =>
      prevBlocks.map((block, i) =>
        i === index ? { ...block, markdown: newMarkdown } : block
      )
    );
  };

  return (
    <div className="markdown-editor-viewer">
      {blocks.map((block, index) => (
        <EditableBlock
          key={index}
          block={block}
          editable={editable}
          onUpdate={(newMarkdown) => updateBlock(index, newMarkdown)}
        />
      ))}
    </div>
  );
};

export default MarkdownEditorViewer;
