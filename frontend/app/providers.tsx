"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Provider as JotaiProvider } from "jotai";
import { WorkspaceProvider } from "@/components/sidebar/workspace-context";
import { Toaster } from "@/components/ui/sonner";

function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useKeyboardShortcuts();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <JotaiProvider>
          <WorkspaceProvider>
            <KeyboardShortcutsProvider>
              <Toaster />
              {children}
            </KeyboardShortcutsProvider>
          </WorkspaceProvider>
        </JotaiProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
