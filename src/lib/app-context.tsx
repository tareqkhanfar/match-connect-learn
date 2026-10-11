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
import { allowsPath, schoolRoleLabels, type Access } from "./roles";

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

  /**
   * The child a parent is currently looking at.
   *
   * A guardian with several children would otherwise see whichever one each
   * screen happened to pick. Choosing once, here, makes every screen agree.
   * Null for every other persona, and for a parent with a single child it is
   * simply that child.
   */
  activeChild: string | null;
  setActiveChild: (student: string | null) => void;
  /** The children this guardian may switch between. */
  children_: Array<{ id: string; name: string }>;

  /** A staff role's narrowing of `role`: the vice principal, a supervisor, the nurse. */
  access: Access;
  /** Whether this person's role reaches the screen at `path`. */
  allows: (path: string) => boolean;
  /** The role as the person is called — «نائب المدير» rather than «مدير المدرسة». */
  roleLabel: string;
}

const AppContext = createContext<AppState | null>(null);

const THEME_KEY = "match-edu-theme";

const ACTIVE_CHILD_KEY = "match-edu-active-child";

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [activeChild, setActiveChildState] = useState<string | null>(null);

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

  const kids = useMemo(() => sessionQuery.data?.scope?.children ?? [], [sessionQuery.data]);

  // Restore the last choice, but only if that child is still attached to this
  // guardian — a stale id would silently scope every screen to nothing.
  useEffect(() => {
    if (!kids.length) {
      setActiveChildState(null);
      return;
    }
    const stored = window.localStorage.getItem(ACTIVE_CHILD_KEY);
    const valid = stored && kids.some((k) => k.id === stored) ? stored : kids[0]!.id;
    setActiveChildState(valid);
  }, [kids]);

  const setActiveChild = useCallback((student: string | null) => {
    setActiveChildState(student);
    if (student) window.localStorage.setItem(ACTIVE_CHILD_KEY, student);
    else window.localStorage.removeItem(ACTIVE_CHILD_KEY);
  }, []);

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
    // The next sign-in starts in its default workspace again
    // (lib/active-workspace.ts — inlined here to keep that module out of
    // this one's imports).
    try {
      window.sessionStorage.removeItem("ms-landed");
    } catch {
      // Nothing to forget.
    }
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
  const access = useMemo<Access>(
    () => ({
      staffRole: session?.staffRole ?? null,
      hidesFinance: !!session?.hidesFinance,
      readOnly: !!session?.readOnly,
    }),
    [session],
  );
  const allows = useCallback((path: string) => allowsPath(access, path), [access]);

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
      activeChild,
      setActiveChild,
      children_: kids,
      access,
      allows,
      roleLabel:
        session?.roleLabel ||
        (session?.staffRole
          ? schoolRoleLabels[session.staffRole]
          : schoolRoleLabels[session?.role ?? "admin"]),
    }),
    [
      access,
      allows,
      session,
      signIn,
      signOut,
      loginMutation.isPending,
      signInError,
      theme,
      toggleTheme,
      sessionQuery.isLoading,
      activeChild,
      setActiveChild,
      kids,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
