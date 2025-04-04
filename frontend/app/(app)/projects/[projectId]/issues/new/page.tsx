"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateIssue } from "@/features/projects/issues/api/create-issue";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  List,
  Strikethrough,
  Quote,
  Heading,
} from "lucide-react";

const MenuBar = ({ editor }: { editor: Editor | null }) => {
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
    // Removed border-b
    <div className="flex flex-wrap gap-1 p-2 border-b border-input">
      {menuItems.map((item) => (
        <Button
          key={item.label}
          type="button"
          size="icon"
          variant="ghost"
          onClick={item.action}
          className={cn("h-8 w-8", item.isActive ? "bg-muted" : "")}
          aria-label={item.label}
        >
          <item.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
};

export default function NewIssuePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const createIssueMutation = useCreateIssue();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: "bg-muted rounded-md p-2 font-mono text-sm",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-muted-foreground pl-4 italic",
          },
        },
      }),
      Placeholder.configure({
        placeholder: "Type your description here...",
      }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          // Base styles (padding, min-height, text size, etc.)
          "min-h-[400px] w-full px-3 py-2 text-sm outline-none",
          // Prose styles for typography (headings, lists, etc.)
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl dark:prose-invert max-w-none",
          // Disabled styles
          "disabled:cursor-not-allowed disabled:opacity-50"
        ),
      },
    },
    content: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      toast.error("Title is required.");
      return;
    }

    // Ensure editor content is fetched correctly
    const htmlDescription = editor?.getHTML() || "";
    const isEmptyDescription = editor?.isEmpty || htmlDescription === "<p></p>";

    createIssueMutation.mutate(
      {
        projectId,
        data: {
          title,
          description: isEmptyDescription ? "" : htmlDescription,
        },
      },
      {
        onSuccess: (data) => {
          toast.success(data.message || "Issue created successfully!");
          router.push(`/projects/${projectId}/issues`);
          // Optional: Reset editor after successful submission
          // editor?.commands.clearContent();
          // setTitle("");
        },
        onError: (error) => {
          toast.error(`Failed to create issue: ${error.message}`);
        },
      }
    );
  };
  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-xl font-bold mb-6">Create new issue</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50"
              placeholder="Title"
              required
            />
          </div>
          <div
            className={cn(
              "flex flex-col min-h-[200px]",
              "rounded-md border border-input bg-background",
              "ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-1"
            )}
          >
            <MenuBar editor={editor} />
            <div className="flex-grow overflow-auto">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button
            type="submit"
            disabled={createIssueMutation.isPending || !title}
          >
            Create Issue
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/issues`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
