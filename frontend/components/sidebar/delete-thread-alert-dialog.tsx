"use client";

import { useDeleteThreadMutation } from "@/queries/queries";
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

interface DeleteThreadAlertDialogProps {
  threadId: string;
}

export function DeleteThreadAlertDialog({
  threadId,
}: DeleteThreadAlertDialogProps) {
  const deleteThread = useDeleteThreadMutation();

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
          <AlertDialogTitle>Delete Thread</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this thread and all its messages?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteThread.mutate(threadId)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
