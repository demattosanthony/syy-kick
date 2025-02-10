"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { Trash } from "lucide-react";

interface DeleteAlertDialogProps {
  id: string;
  type: "thread" | "project";
  onDelete: (id: string) => void;
  title?: string;
  description?: string;
}

export function DeleteAlertDialog({
  id,
  type,
  onDelete,
  title,
  description,
}: DeleteAlertDialogProps) {
  const defaultTitles = {
    thread: "Delete Thread",
    project: "Delete Project",
  };

  const defaultDescriptions = {
    thread:
      "Are you sure you want to delete this thread and all its messages? This action cannot be undone.",
    project:
      "Are you sure you want to delete this project and all its contents? This action cannot be undone.",
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          className="text-destructive"
          onSelect={(e) => e.preventDefault()}
        >
          <Trash className="h-2 w-2" />
          Delete
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || defaultTitles[type]}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescriptions[type]}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
