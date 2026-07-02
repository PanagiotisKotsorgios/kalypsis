import { useEffect, useState } from "react";
import { useOptionalAuthUser } from "../auth/AuthContext";

/**
 * Kept as a module for backwards compatibility with earlier commits that
 * imported it from here. All of the theming work lives in
 * <AuthenticatedThemeGate> now; this file only exports the shared
 * per-user preferences shape + read/write helpers + the hook that other
 * components (ProfilePage, AuthenticatedThemeGate) subscribe to.
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

/** Storage-key prefix. User id (or "anon") is appended per bucket. */
export const PREFS_KEY_PREFIX = "kalypsis:userPreferences:v1";

/** Compose the full storage key for a given user id (may be null / undefined). */
export function prefsKeyFor(userId?: string | null): string {
  return `${PREFS_KEY_PREFIX}:${userId ?? "anon"}`;
}

/** Legacy machine-wide key from an earlier version. Migrated once into
 *  the anon bucket on first read. */
const LEGACY_KEY = "kalypsis:userPreferences:v1";

/** Read prefs for a specific user id. Never throws — corrupt JSON falls
 *  back to defaults so the app keeps rendering. */
export function readPrefsFor(userId?: string | null): UserPreferences {
  try {
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
 *  other tabs AND this-tab consumers pick it up. */
export function writePrefsFor(userId: string | null | undefined, prefs: UserPreferences): void {
  try {
    const key = prefsKeyFor(userId);
    const serialised = JSON.stringify(prefs);
    localStorage.setItem(key, serialised);
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
  const user = useOptionalAuthUser();
  const userId = user?.userId ?? null;
  const [prefs, setPrefs] = useState<UserPreferences>(() => readPrefsFor(userId));

  useEffect(() => { setPrefs(readPrefsFor(userId)); }, [userId]);

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
