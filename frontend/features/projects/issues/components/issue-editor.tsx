"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
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
  Loader2,
  Paperclip,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

interface MenuBarProps {
  editor: Editor | null;
}

const MenuBar = ({ editor }: MenuBarProps) => {
  if (!editor) return null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = ""; // Reset file input

    if (!files.length || !editor) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        // 1. Generate a unique file key
        const file_id = crypto.randomUUID();
        const file_key = `user-attachments/${file_id}`;

        // 2. Get presigned URL from backend
        const presignResponse = await api.uploads.getPresignedUrl(
          file.name,
          file.type,
          file.size,
          file_key
        );

        const { url: uploadUrl } = presignResponse;
        const viewUrl = `${api.baseUrl}/user-attachments/${file_id}`;

        // 3. Upload file to S3 using the presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(
            `Failed to upload file: ${uploadResponse.statusText}`
          );
        }

        // 4. Insert file representation into editor
        let contentToInsert = "";
        if (file.type.startsWith("image/")) {
          contentToInsert = `<img src="${viewUrl}" alt="${file.name}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`;
        } else {
          contentToInsert = `<p><a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="attachment-link">${file.name}</a></p>`;
        }

        editor.chain().focus().insertContent(contentToInsert).run();
      }
    } catch (error) {
      console.error("File upload failed:", error);
      // TODO: Show user-friendly error message
    } finally {
      setIsUploading(false);
    }
  };

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
    {
      action: () => fileInputRef.current?.click(),
      isActive: false,
      icon: isUploading ? Loader2 : Paperclip,
      label: "Attach File",
      disabled: !editor.isEditable || isUploading,
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
          className={cn(
            "h-8 w-8",
            item.isActive ? "bg-muted" : "",
            item.label === "Attach File" && isUploading ? "animate-spin" : ""
          )}
          aria-label={item.label}
          disabled={!editor.isEditable || item.disabled}
        >
          <item.icon className="h-4 w-4" />
        </Button>
      ))}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        disabled={isUploading}
      />
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
  showControls?: boolean;
  minHeight?: string;
}

export function IssueEditor({
  initialContent,
  onSave,
  onCancel,
  onChange,
  placeholder = "Type here...",
  isLoading = false,
  editable = true,
  showControls = true,
  minHeight = "400px",
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
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          style:
            "max-width: 100%; height: auto; display: block; margin: 10px 0;",
          alt: "User uploaded image",
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
          // class: null, // To remove default classes if any
        },
        validate: (href: string) => /^https?:\/\//.test(href), // Basic validation for http/https <-- Add type string
      }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          "w-full px-3 py-2 text-sm outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        ),
        style: `min-height: ${minHeight};`,
      },
    },
    content: initialContent,
    editable: editable && !isLoading,
    onUpdate: ({ editor }) => {
      if (onChange) {
        const htmlContent = editor.getHTML();
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

  const resetContent = () => {
    editor?.commands.clearContent(true); // Clear content and trigger update
  };

  return (
    <div className={cn(isLoading && "opacity-70 cursor-not-allowed")}>
      {/* Apply border and focus styles to this inner div */}
      <div
        className={cn(
          "rounded-md border border-input bg-card",
          "ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1",
          "overflow-hidden" // Ensure border radius applies correctly to children
        )}
      >
        <MenuBar editor={editor} />
        <div className="flex-grow overflow-auto p-3">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Button container is now outside the bordered div */}
      {editable &&
        showControls && ( // Only show Save/Cancel controls now
          // Added margin-top for spacing
          <div className="flex justify-end gap-2 mt-3">
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
              }
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      {/* Removed submit button logic previously here */}
    </div>
  );
}
