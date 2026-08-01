import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "./mock-data";

interface AppState {
  role: Role;
  setRole: (r: Role) => void;
  signedIn: boolean;
  signIn: (r: Role) => void;
  signOut: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  ready: boolean;
}

const AppContext = createContext<AppState | null>(null);

const ROLE_KEY = "match-edu-role";
const THEME_KEY = "match-edu-theme";

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("admin");
  const [signedIn, setSignedIn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedRole = window.localStorage.getItem(ROLE_KEY) as Role | null;
    const storedTheme = window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
    if (storedRole) {
      setRoleState(storedRole);
      setSignedIn(true);
    }
    if (storedTheme) setTheme(storedTheme);
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const signIn = useCallback((r: Role) => {
    window.localStorage.setItem(ROLE_KEY, r);
    setRoleState(r);
    setSignedIn(true);
  }, []);

  const setRole = useCallback((r: Role) => {
    window.localStorage.setItem(ROLE_KEY, r);
    setRoleState(r);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(ROLE_KEY);
    setSignedIn(false);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ role, setRole, signedIn, signIn, signOut, theme, toggleTheme, ready }),
    [role, setRole, signedIn, signIn, signOut, theme, toggleTheme, ready],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
