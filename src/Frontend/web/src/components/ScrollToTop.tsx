import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets the scroll position to the top of the page on every navigation.
 *
 * - Skips the scroll if the URL contains a hash (e.g. `/#features`) so anchor
 *   links keep working.
 * - Uses `instant` behaviour (no animation) — the fade-in animations on the
 *   destination page already do the visual smoothing.
 *
 * Mount once at the root, inside <BrowserRouter>.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return; // let the browser handle anchor scrolling
    // Some browsers restore the previous scroll on history.pop — kill it.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}
