import { useCallback, useSyncExternalStore } from "react";
import { useApp } from "./app-context";
import { useMyWorkspaces, type MyWorkspace } from "./api/workspaces";

/**
 * Which workspace this person is working in.
 *
 * Empty means their role's own menu — what everyone had before workspaces
 * existed, and still what anyone without one has. The choice is kept per user
 * in this browser, and reset to their default at each sign-in (see
 * `useLandOnDefault`), so the workspace the school gave them is where they
 * start and switching is theirs for the rest of the session.
 */
const KEY = (user: string) => `ms-active-workspace:${user}`;
const LANDED = "ms-landed";

const listeners = new Set<() => void>();

function read(user: string): string | null {
  try {
    return window.localStorage.getItem(KEY(user));
  } catch {
    return null;
  }
}

function write(user: string, id: string | null) {
  try {
    if (id === null) window.localStorage.removeItem(KEY(user));
    else window.localStorage.setItem(KEY(user), id);
  } catch {
    // A browser refusing storage still switches for this page's lifetime.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export interface ActiveWorkspace {
  loading: boolean;
  workspaces: MyWorkspace[];
  /** Null: the role's own menu. */
  active: MyWorkspace | null;
  defaultId: string;
  hideSystem: boolean;
  canBuild: boolean;
  setActive: (id: string) => void;
}

export function useActiveWorkspace(): ActiveWorkspace {
  const { session } = useApp();
  const user = session?.user ?? "";
  const mine = useMyWorkspaces(!!session);
  const stored = useSyncExternalStore(
    subscribe,
    () => (user ? read(user) : null),
    () => null,
  );
  const data = mine.data;
  const list = data?.workspaces ?? [];
  const hideSystem = !!data?.hideSystem;
  // A stored choice counts only while it is still one of theirs.
  const valid =
    stored !== null && (stored === "" ? !hideSystem : list.some((w) => w.id === stored));
  const wanted = valid ? stored : (data?.default ?? "");
  const active = list.find((w) => w.id === wanted) ?? (hideSystem && list.length ? list[0]! : null);
  const setActive = useCallback(
    (id: string) => {
      if (user) write(user, id);
    },
    [user],
  );
  return {
    // Pending rather than loading: true from the first render with a session,
    // before the request has even started, so nothing acts on an empty list.
    loading: !!session && mine.isPending,
    workspaces: list,
    active,
    defaultId: data?.default ?? "",
    hideSystem,
    canBuild: !!data?.canBuild,
    setActive,
  };
}

/** Where a workspace's home is. */
export function workspaceHome(id: string | null | undefined) {
  return id ? `/app/w/${id}` : "/app/workspace";
}

/**
 * Once per sign-in: start in the default workspace. Returns the route to go to
 * when the person arrived on the plain dashboard, or null.
 */
export function landOnDefault(user: string, defaultId: string, pathname: string): string | null {
  let landed: string | null = null;
  try {
    landed = window.sessionStorage.getItem(LANDED);
  } catch {
    return null;
  }
  if (landed === user) return null;
  try {
    window.sessionStorage.setItem(LANDED, user);
  } catch {
    // Without session storage this would land on every reload; better not at all.
    return null;
  }
  write(user, null);
  return defaultId && pathname === "/app" ? workspaceHome(defaultId) : null;
}

/** Signing out: the next sign-in lands again. */
export function forgetLanding() {
  try {
    window.sessionStorage.removeItem(LANDED);
  } catch {
    // Nothing to forget.
  }
}
