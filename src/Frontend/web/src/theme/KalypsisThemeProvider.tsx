import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, useMediaQuery } from "@mui/material";
import { buildKalypsisTheme } from "../theme";
import { useAuth } from "../auth/AuthContext";
import type { ReactNode } from "react";

/**
 * User-preferences state persisted per-user under a keyed localStorage
 * entry:
 *
 *   kalypsis:userPreferences:v1:{userId}
 *
 * ...so switching accounts on the same browser (e.g. platform admin
 * impersonating an agency user) instantly loads the target user's own
 * theme, density and landing choices — not the previous session's.
 * Anonymous / logged-out state falls back to the ":anon" bucket, which
 * always defaults to the neutral light theme.
 */
export interface UserPreferences {
  themeMode: "light" | "dark" | "auto";
  density: "comfortable" | "compact";
  digestFrequency: "daily" | "weekly" | "never";
  playSounds: boolean;
  emailAlerts: boolean;
  landingPage: "dashboard" | "policies" | "customers" | "renewals" | "financials" | "tasks";
  autoLockMinutes: number;
  showQuickActions: boolean;
  showKpisOnTop: boolean;
}

/**
 * Defaults. `themeMode: "light"` is deliberate — a first-time user (or
 * anyone who never opened Προτιμήσεις) should always see the neutral
 * white surface, not the OS's dark mode preference. Once they explicitly
 * pick auto/dark from their profile it sticks per user.
 */
export const DEFAULT_PREFS: UserPreferences = {
  themeMode: "light",
  density: "comfortable",
  digestFrequency: "daily",
  playSounds: true,
  emailAlerts: true,
  landingPage: "dashboard",
  autoLockMinutes: 0,
  showQuickActions: true,
  showKpisOnTop: true,
};

/** Storage-key prefix. The user id (or "anon") is appended per bucket. */
export const PREFS_KEY_PREFIX = "kalypsis:userPreferences:v1";

/** Compose the full storage key for a given user id (may be null / undefined). */
export function prefsKeyFor(userId?: string | null): string {
  return `${PREFS_KEY_PREFIX}:${userId ?? "anon"}`;
}

/**
 * Legacy machine-wide key from an earlier version. Kept only so we can
 * migrate it into the anonymous bucket on first read — after that it
 * plays no further role.
 */
const LEGACY_KEY = "kalypsis:userPreferences:v1";

/** Read prefs for a specific user id. Never throws — corrupt JSON falls
 * back to defaults so the app keeps rendering. */
export function readPrefsFor(userId?: string | null): UserPreferences {
  try {
    // Legacy migration: if a rogue machine-wide entry exists AND we're
    // reading the anon bucket AND that bucket is empty, hoist the legacy
    // value up so we don't lose the user's earlier choices.
    if (!userId && !localStorage.getItem(prefsKeyFor(null))) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          localStorage.setItem(prefsKeyFor(null), JSON.stringify({ ...DEFAULT_PREFS, ...parsed }));
        } catch { /* corrupt — ignore */ }
      }
    }
    const raw = localStorage.getItem(prefsKeyFor(userId));
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return DEFAULT_PREFS; }
}

/** Persist prefs for the given user, then broadcast a storage event so
 * other tabs AND this-tab consumers (like the theme provider) pick it up. */
export function writePrefsFor(userId: string | null | undefined, prefs: UserPreferences): void {
  try {
    const key = prefsKeyFor(userId);
    const serialised = JSON.stringify(prefs);
    localStorage.setItem(key, serialised);
    // In-tab consumers listen for `storage` — StorageEvent's `key` is what
    // they filter on.
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: serialised }));
  } catch { /* quota / private mode — ignore */ }
}

/**
 * Hook: returns the preferences for the currently-logged-in user (or the
 * anon defaults) and re-renders whenever they change — either in this tab
 * (ProfilePage updates broadcast via writePrefsFor) or another one
 * (localStorage storage event).
 */
export function useUserPreferences(): UserPreferences {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const [prefs, setPrefs] = useState<UserPreferences>(() => readPrefsFor(userId));

  // Re-read whenever the logged-in user changes (login, logout, impersonate,
  // exit-impersonation).
  useEffect(() => {
    setPrefs(readPrefsFor(userId));
  }, [userId]);

  // Re-read whenever the current user's bucket is written by any tab.
  useEffect(() => {
    const key = prefsKeyFor(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setPrefs(readPrefsFor(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  return prefs;
}

/**
 * Wraps the app in a MUI ThemeProvider that rebuilds the theme whenever
 * the currently-logged-in user's preferences change. Handles the `auto`
 * theme by watching `prefers-color-scheme` so the app tracks the OS-level
 * dark-mode flip. Also exposes the current density on `data-density` so
 * pure CSS (like the sidebar / editorial styles) can react.
 */
export function KalypsisThemeProvider({ children }: { children: ReactNode }) {
  const prefs = useUserPreferences();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
  const effectiveMode: "light" | "dark" =
    prefs.themeMode === "auto" ? (systemDark ? "dark" : "light") : prefs.themeMode;

  const theme = useMemo(
    () => buildKalypsisTheme(effectiveMode, prefs.density),
    [effectiveMode, prefs.density]
  );

  useEffect(() => {
    document.documentElement.dataset.density = prefs.density;
    document.documentElement.dataset.theme = effectiveMode;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = effectiveMode === "dark" ? "#0b1522" : "#0b2545";
  }, [prefs.density, effectiveMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
