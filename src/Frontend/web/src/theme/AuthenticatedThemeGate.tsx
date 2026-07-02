import { useEffect, useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, useMediaQuery } from "@mui/material";
import { buildKalypsisTheme } from "../theme";
import { useOptionalAuthUser } from "../auth/AuthContext";
import { useUserPreferences } from "./KalypsisThemeProvider";
import type { ReactNode } from "react";

/**
 * Theme wrapper that only kicks in AFTER a user is authenticated.
 *
 * The outer static-light ThemeProvider in main.tsx handles pre-login
 * surfaces (landing, login, contact, terms, maintenance) — those pages
 * never see the user's dark-mode preference. Once AuthProvider hydrates a
 * real user, this gate mounts its own MUI ThemeProvider with the theme
 * built from that user's per-user preferences bucket. Nested
 * ThemeProviders in MUI cleanly override the outer one for their
 * subtree, so pre-login pages stay light and post-login pages honour
 * the profile choice.
 *
 * Design goals:
 *   1. Pre-login surfaces are ALWAYS light. No user preferences can
 *      leak into them.
 *   2. Impersonation is honoured: when a platform admin impersonates an
 *      agency user, the impersonation flow rewrites AuthContext's user
 *      object → useUserPreferences re-reads → this gate rebuilds the
 *      theme for that user, not the admin's.
 *   3. If somehow the user is still null when this gate is mounted, we
 *      simply pass through without wrapping — the outer static light
 *      theme stays in effect.
 */
export function AuthenticatedThemeGate({ children }: { children: ReactNode }) {
  const user = useOptionalAuthUser();
  const prefs = useUserPreferences();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });

  // Effective mode: if not logged in yet, force light — pre-login pages
  // must never render dark. Otherwise honour the user's own preference.
  const effectiveMode: "light" | "dark" = !user
    ? "light"
    : prefs.themeMode === "auto"
      ? (systemDark ? "dark" : "light")
      : prefs.themeMode;

  const theme = useMemo(
    () => buildKalypsisTheme(effectiveMode, prefs.density),
    [effectiveMode, prefs.density]
  );

  // Expose current effective mode + density on <html> so pure-CSS
  // (sidebar, editorial styles) and the mobile browser chrome can react.
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

  // Not authenticated → don't wrap. Outer static light theme stays.
  if (!user) return <>{children}</>;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
