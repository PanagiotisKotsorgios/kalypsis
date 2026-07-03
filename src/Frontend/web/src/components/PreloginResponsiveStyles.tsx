import { useEffect } from "react";
import { GlobalStyles } from "@mui/material";
import { useLocation } from "react-router-dom";

const PRELOGIN_PATH_PREFIXES = [
  "/", "/login", "/forgot-password", "/reset-password",
  "/register", "/pricing", "/faq", "/contact", "/terms", "/privacy", "/cookies"
];

function isPreloginPath(pathname: string): boolean {
  // Anything under /app is authenticated, so short-circuit there first.
  if (pathname.startsWith("/app")) return false;
  // Root path is always prelogin; everything else must be an exact prefix
  // match on our whitelist so unrelated public routes (e.g. embed pages we
  // add later) don't opt-in accidentally.
  if (pathname === "/") return true;
  return PRELOGIN_PATH_PREFIXES.some(p => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
}

/**
 * Injects a single stylesheet of responsive rules that applies ONLY when
 * the user is on a pre-login page. The goal: no button label ever wraps to
 * two lines on laptop widths, font sizes track viewport width with a
 * clamp() so text stays readable at 320px without overflowing at 1600px,
 * and CTAs shrink their horizontal padding on narrow screens instead of
 * overflowing their container.
 *
 * Toggled via a `data-prelogin` attribute on <body> so we don't leak these
 * rules into the /app shell (which has its own spacing scale).
 */
export function PreloginResponsiveStyles() {
  const { pathname } = useLocation();
  const active = isPreloginPath(pathname);

  useEffect(() => {
    if (active) document.body.dataset.prelogin = "1";
    else delete document.body.dataset.prelogin;
    return () => { delete document.body.dataset.prelogin; };
  }, [active]);

  if (!active) return null;

  return (
    <GlobalStyles styles={{
      // Every Button on a pre-login page stays single-line and gets an
      // ellipsis if the text truly can't fit — so no two-line wraps.
      "body[data-prelogin] .MuiButton-root": {
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        // clamp(min, preferred, max) — 12.5px at ≤360px viewport, 15px at
        // ≥1400px viewport, linearly interpolated between. Avoids the
        // MUI-breakpoint step function which was leaving big gaps at 720px.
        fontSize: "clamp(12.5px, 0.65vw + 10px, 15px)",
        letterSpacing: "0.01em",
      },
      // Inline label spans inside buttons (icon + text combos) — same rule
      // applies so the label doesn't push past the icon slot.
      "body[data-prelogin] .MuiButton-root > *": {
        whiteSpace: "nowrap",
      },
      // Horizontal padding shrinks in lockstep with the font size so small
      // buttons don't feel disproportionately hollow.
      "body[data-prelogin] .MuiButton-sizeMedium, body[data-prelogin] .MuiButton-sizeLarge": {
        paddingLeft: "clamp(10px, 1.2vw + 4px, 22px)",
        paddingRight: "clamp(10px, 1.2vw + 4px, 22px)",
      },
      // Hero headlines scale down before they wrap awkwardly. Only touches
      // h1-h4 on prelogin so main-app typography stays as-is.
      "body[data-prelogin] .MuiTypography-h1": { fontSize: "clamp(2rem, 4vw + 0.5rem, 4.5rem)", lineHeight: 1.1 },
      "body[data-prelogin] .MuiTypography-h2": { fontSize: "clamp(1.75rem, 3vw + 0.5rem, 3.5rem)", lineHeight: 1.15 },
      "body[data-prelogin] .MuiTypography-h3": { fontSize: "clamp(1.5rem, 2.4vw + 0.5rem, 2.75rem)", lineHeight: 1.2 },
      "body[data-prelogin] .MuiTypography-h4": { fontSize: "clamp(1.25rem, 1.8vw + 0.5rem, 2.25rem)", lineHeight: 1.25 },
      // Iron out horizontal overflow — a common pre-login-page bug where a
      // long chip or button pushes the page wider than the viewport and
      // triggers a horizontal scrollbar.
      "body[data-prelogin]": { overflowX: "hidden" },
    }} />
  );
}
