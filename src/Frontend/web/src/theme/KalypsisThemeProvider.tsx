import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, useMediaQuery } from "@mui/material";
import { buildKalypsisTheme } from "../theme";
import type { ReactNode } from "react";

/**
 * User-preferences state persisted per-browser under this key. The shape
 * mirrors the ProfilePage «Προτιμήσεις πλατφόρμας» card so any toggle
 * change there is picked up here immediately via the storage event.
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
export const DEFAULT_PREFS: UserPreferences = {
  themeMode: "auto",
  density: "comfortable",
  digestFrequency: "daily",
  playSounds: true,
  emailAlerts: true,
  landingPage: "dashboard",
  autoLockMinutes: 0,
  showQuickActions: true,
  showKpisOnTop: true,
};
export const PREFS_KEY = "kalypsis:userPreferences:v1";

function readPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return DEFAULT_PREFS; }
}

/**
 * Global hook: returns the current preferences object and re-renders when
 * any tab (including this one) mutates them. Uses a storage event that
 * ProfilePage broadcasts on save.
 */
export function useUserPreferences(): UserPreferences {
  const [prefs, setPrefs] = useState<UserPreferences>(() => readPrefs());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFS_KEY) setPrefs(readPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return prefs;
}

/**
 * Wraps the app in a MUI ThemeProvider that rebuilds the theme whenever
 * the user's preferences change. Handles the `auto` theme by watching
 * `prefers-color-scheme` so the app tracks the OS-level dark-mode flip.
 * Also exposes the current density on `data-density` so pure CSS (like
 * the sidebar / editorial styles) can react.
 */
export function KalypsisThemeProvider({ children }: { children: ReactNode }) {
  const prefs = useUserPreferences();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
  const effectiveMode: "light" | "dark" =
    prefs.themeMode === "auto" ? (systemDark ? "dark" : "light") : prefs.themeMode;

  // Rebuild the theme only when the two inputs that actually affect it change.
  const theme = useMemo(
    () => buildKalypsisTheme(effectiveMode, prefs.density),
    [effectiveMode, prefs.density]
  );

  // Expose current density + theme mode to CSS via data-attributes.
  useEffect(() => {
    document.documentElement.dataset.density = prefs.density;
    document.documentElement.dataset.theme = effectiveMode;
    // Update the theme-color meta so mobile browsers repaint the chrome.
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
