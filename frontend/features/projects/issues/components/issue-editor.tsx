"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  List,
  Strikethrough,
  Quote,
  Heading,
  ListOrdered,
  CheckSquare,
} from "lucide-react";
import { useEffect } from "react";

interface MenuBarProps {
  editor: Editor | null;
}

const MenuBar = ({ editor }: MenuBarProps) => {
  if (!editor) return null;

  const menuItems = [
    {
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive("heading", { level: 3 }),
      icon: Heading,
      label: "Heading (H3)",
    },
    {
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive("bold"),
      icon: Bold,
      label: "Bold",
    },
    {
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive("italic"),
      icon: Italic,
      label: "Italic",
    },
    {
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive("bulletList"),
      icon: List,
      label: "Bullet List",
    },
    {
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive("orderedList"),
      icon: ListOrdered,
      label: "Numbered List",
    },
    {
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive("taskList"),
      icon: CheckSquare,
      label: "Task List",
    },
    {
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive("strike"),
      icon: Strikethrough,
      label: "Strikethrough",
    },
    {
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive("blockquote"),
      icon: Quote,
      label: "Blockquote",
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-input bg-transparent">
      {menuItems.map((item) => (
        <Button
          key={item.label}
          type="button"
          size="icon"
          variant="ghost"
          onClick={item.action}
          className={cn("h-8 w-8", item.isActive ? "bg-muted" : "")}
          aria-label={item.label}
          disabled={!editor.isEditable}
        >
          <item.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
};

interface IssueEditorProps {
  initialContent: string;
  onSave?: (htmlContent: string) => void;
  onCancel: () => void;
  onChange?: (htmlContent: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  editable?: boolean;
  showControls?: boolean; // New prop to control visibility of Save/Cancel
}

export function IssueEditor({
  initialContent,
  onSave,
  onCancel,
  onChange,
  placeholder = "Type here...",
  isLoading = false,
  editable = true,
  showControls = true, // Default to true
}: IssueEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3],
          HTMLAttributes: {
            class: "scroll-m-20 text-xl font-semibold tracking-tight",
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: "bg-muted rounded-md p-2 font-mono text-sm",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "mt-6 border-l-2 pl-6 italic text-base",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "mb-2 ml-6 list-disc text-base",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "mb-2 ml-6 list-decimal text-base",
          },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "flex items-center gap-2 data-[checked=true]:line-through",
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[400px] w-full px-3 py-2 text-sm outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        ),
      },
    },
    content: initialContent,
    editable: editable && !isLoading, // Editor is editable only if not loading and editable prop is true
    onUpdate: ({ editor }) => {
      if (onChange) {
        const htmlContent = editor.getHTML();
        // Treat empty paragraph as empty string for consistency
        onChange(htmlContent === "<p></p>" ? "" : htmlContent);
      }
    },
  });

  // Update content if initialContent changes externally (e.g., after save)
  // But only if the editor is not currently focused to avoid losing user input
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor]);

  // Effect to update editable status when isLoading changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable && !isLoading);
    }
  }, [isLoading, editable, editor]);

  const handleInternalSave = () => {
    if (!editor) return;
    const htmlContent = editor.getHTML();
    // Treat empty paragraph as empty string for consistency
    if (onSave) onSave(htmlContent === "<p></p>" ? "" : htmlContent);
  };

  return (
    <div
      className={cn(
        "flex flex-col",
        "rounded-md border border-input bg-card", // Use bg-card for consistency
        "ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
        isLoading && "opacity-70 cursor-not-allowed" // Style when loading
      )}
    >
      <MenuBar editor={editor} />
      <div className="flex-grow overflow-auto p-2">
        {" "}
        {/* Added padding */}
        <EditorContent editor={editor} />
      </div>
      {showControls &&
        editable && ( // Only show controls if editable and showControls is true
          <div className="flex justify-end gap-2 p-2 border-t border-input">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInternalSave}
              disabled={
                isLoading ||
                !editor?.isEditable ||
                editor?.getHTML() === initialContent
              } // Disable if loading, not editable, or no changes
            >
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
    </div>
  );
}
