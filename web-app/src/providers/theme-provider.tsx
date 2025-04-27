import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove previous theme class
    root.classList.remove("light", "dark");

    // Determine the theme to apply (system or explicit)
    let themeToApply = theme;
    if (theme === "system") {
      themeToApply = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    // Add the new theme class
    root.classList.add(themeToApply);

    // Optional: Add listener for system theme changes if needed
    // This part depends on whether you want the theme to react
    // automatically if the OS theme changes while the app is open.
    // const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    // const handleChange = () => {
    //   if (theme === 'system') { // Only update if current theme is 'system'
    //      const newSystemTheme = mediaQuery.matches ? 'dark' : 'light';
    //      root.classList.remove('light', 'dark');
    //      root.classList.add(newSystemTheme);
    //      // Optionally update state if needed, though the class is the main goal
    //      // setTheme('system'); // Re-trigger effect? Or maybe just update class?
    //   }
    // };
    // mediaQuery.addEventListener('change', handleChange);
    // return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]); // Depend only on theme state changes

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
