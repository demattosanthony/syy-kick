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
import { Markdown } from "tiptap-markdown";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

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
        heading: {
          levels: [1, 2, 3, 4],
        },
        bulletList: {},
        orderedList: {},
        code: {},
        codeBlock: {},
        blockquote: {},
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Table,
      TableRow,
      TableCell,
      TableHeader,
      // Add Markdown extension to handle conversion
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
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
              // Save content without closing the editor
              if (editor) {
                setIsSaving(true);
                const markdown = editor.storage.markdown.getMarkdown();
                onUpdate(markdown);

                setTimeout(() => {
                  setIsSaving(false);
                }, 300);
              }
              return true;
            },
          };
        },
      }),
    ],
    editable: isEditing,
    onBlur: () => {
      if (editor) {
        setIsSaving(true);
        // Get the markdown content from the editor
        const markdown = editor.storage.markdown.getMarkdown();
        onUpdate(markdown);

        // Just show saving indicator without closing the editor
        setTimeout(() => {
          setIsSaving(false);
        }, 300);
      }
    },
  });
  // Parse markdown and set content when entering edit mode
  useEffect(() => {
    if (editor && isEditing) {
      // This will convert markdown to the editor's internal format
      editor.commands.setContent(block.markdown);
    }
  }, [isEditing, editor, block.markdown]);

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
            <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
              <span>
                <span className="mr-1">✏️</span> Editing
              </span>
              <div className="flex space-x-2">
                {/* Enhanced formatting toolbar */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    editor.chain().focus().toggleBold().run();
                  }}
                  data-active={editor.isActive("bold")}
                >
                  <strong>B</strong>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  data-active={editor.isActive("italic")}
                >
                  <em>I</em>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  data-active={editor.isActive("code")}
                >
                  <code>{"<>"}</code>
                </Button>
                <span className="border-r h-4 mx-1"></span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                  data-active={editor.isActive("heading", { level: 1 })}
                >
                  H1
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  data-active={editor.isActive("heading", { level: 2 })}
                >
                  H2
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                  }
                  data-active={editor.isActive("heading", { level: 3 })}
                >
                  H3
                </Button>
                <span className="border-r h-4 mx-1"></span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  data-active={editor.isActive("bulletList")}
                >
                  •
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                  data-active={editor.isActive("orderedList")}
                >
                  1.
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() =>
                    editor.chain().focus().toggleBlockquote().run()
                  }
                  data-active={editor.isActive("blockquote")}
                >
                  "
                </Button>
              </div>
            </div>
            <EditorContent
              editor={editor}
              className="prose dark:prose-invert max-w-none"
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
                  onClick={() => {
                    if (editor) {
                      setIsSaving(true);
                      const markdown = editor.storage.markdown.getMarkdown();
                      onUpdate(markdown);

                      setTimeout(() => {
                        setIsSaving(false);
                        setIsEditing(false); // Exit edit mode after saving
                      }, 300);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
            <style jsx global>{`
              .ProseMirror {
                outline: none !important;
                min-height: 100px;
                padding: 0.5rem;
              }
              .ProseMirror p {
                margin: 0.5em 0;
              }
              .ProseMirror h1,
              .ProseMirror h2,
              .ProseMirror h3,
              .ProseMirror h4 {
                margin: 1em 0 0.5em;
                font-weight: bold;
              }
              .ProseMirror h1 {
                font-size: 1.75em;
              }
              .ProseMirror h2 {
                font-size: 1.5em;
              }
              .ProseMirror h3 {
                font-size: 1.25em;
              }
              .ProseMirror h4 {
                font-size: 1.1em;
              }
              .ProseMirror ul,
              .ProseMirror ol {
                padding-left: 1.5em;
                margin: 0.5em 0;
              }
              .ProseMirror blockquote {
                border-left: 3px solid #ddd;
                padding-left: 1em;
                margin-left: 0;
                margin-right: 0;
                font-style: italic;
              }
              .ProseMirror code {
                background-color: rgba(97, 97, 97, 0.1);
                border-radius: 3px;
                padding: 0.2em 0.4em;
                font-family: monospace;
              }
              [data-active="true"] {
                background-color: rgba(59, 130, 246, 0.1);
                color: rgb(59, 130, 246);
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
