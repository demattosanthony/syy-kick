import { Provider as JotaiProvider } from "jotai";
import { WorkspaceProvider } from "@/components/sidebar/workspace-context";
import { Toaster } from "@/components/ui/sonner";
import { getActiveWorkspaceCookie } from "./workspace-actions";
import TanstackQueryClientProvider from "./providers/tanstack-query-client-provider";
import KeyboardShortcutsProvider from "./providers/keyboard-shortcuts-provider";
import ThemeProvider from "./providers/theme-provider";

export async function Providers({ children }: { children: React.ReactNode }) {
  const initialWorkspace = await getActiveWorkspaceCookie();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TanstackQueryClientProvider>
        <JotaiProvider>
          <WorkspaceProvider initialWorkspace={initialWorkspace}>
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
