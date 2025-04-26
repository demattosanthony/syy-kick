"use client";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

const KeyboardShortcutsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  useKeyboardShortcuts();
  return <>{children}</>;
};

export default KeyboardShortcutsProvider;
