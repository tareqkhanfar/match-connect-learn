import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLogin, useLogout, useSession } from "./api/hooks";
import type { Role, Session } from "./api/types";

interface AppState {
  /** Persona resolved from the backend session (never chosen by the client). */
  role: Role;
  session: Session | null;
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  signingIn: boolean;
  signInError: string | null;
  theme: "light" | "dark";
  toggleTheme: () => void;
  /** False until the session lookup has settled. */
  ready: boolean;
}

const AppContext = createContext<AppState | null>(null);

const THEME_KEY = "match-edu-theme";

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [signInError, setSignInError] = useState<string | null>(null);

  const sessionQuery = useSession();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
    if (storedTheme) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setSignInError(null);
      try {
        await loginMutation.mutateAsync({ email, password });
      } catch (error) {
        // Prefer the Arabic message the backend sends for this UI.
        const message =
          (error as { messageAr?: string; message?: string }).messageAr ||
          (error as Error).message ||
          "تعذّر تسجيل الدخول";
        setSignInError(message);
        throw error;
      }
    },
    [loginMutation],
  );

  const signOut = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const session = sessionQuery.data ?? null;

  const value = useMemo<AppState>(
    () => ({
      role: session?.role ?? "admin",
      session,
      signedIn: Boolean(session),
      signIn,
      signOut,
      signingIn: loginMutation.isPending,
      signInError,
      theme,
      toggleTheme,
      ready: !sessionQuery.isLoading,
    }),
    [
      session,
      signIn,
      signOut,
      loginMutation.isPending,
      signInError,
      theme,
      toggleTheme,
      sessionQuery.isLoading,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
