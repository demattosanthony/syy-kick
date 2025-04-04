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
  ListOrdered,
  CheckSquare,
} from "lucide-react";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

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
        placeholder: "Type your description here...",
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
          editor?.commands.clearContent();
          setTitle("");
        },
        onError: (error) => {
          toast.error(`Failed to create issue: ${error.message}`);
        },
      }
    );
  };
  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-xl font-bold mb-4">Create new issue</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base">
              Add a title <span className="text-red-500">*</span>
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
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base">
              Add a description
            </Label>
            <div
              className={cn(
                "flex flex-col min-h-[400px]",
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
