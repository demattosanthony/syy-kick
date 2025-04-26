import { Provider as JotaiProvider } from "jotai";
import { WorkspaceProvider } from "@/workspace-context";
import { Toaster } from "@/components/ui/sonner";
import TanstackQueryClientProvider from "./providers/tanstack-query-client-provider";
import KeyboardShortcutsProvider from "./providers/keyboard-shortcuts-provider";
import { ThemeProvider } from "./providers/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TanstackQueryClientProvider>
        <JotaiProvider>
          <WorkspaceProvider>
            <KeyboardShortcutsProvider>
              <Toaster />
              {children}
            </KeyboardShortcutsProvider>
          </WorkspaceProvider>
        </JotaiProvider>
      </TanstackQueryClientProvider>
    </ThemeProvider>
  );
}
