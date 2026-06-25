import { type ReactNode } from "react";
import { Box } from "@mui/material";

interface PageEnterProps {
  children: ReactNode;
  /** Total stagger budget (ms) — children get evenly distributed delays. */
  stagger?: number;
  /** Override the default fade-up distance. */
  yOffset?: number;
  /** Per-child animation duration (ms). Longer = smoother but more "noticeable". */
  duration?: number;
}

/**
 * Wraps a pre-login page in a top-level fade-up animation triggered on
 * mount. Direct children cascade in sequence with a long, eased curve.
 *
 * The defaults are tuned for "premium SaaS" smoothness: 1100 ms per-element
 * duration, a 12 px vertical lift (small enough to feel gentle), and a
 * `cubic-bezier(0.22, 1, 0.36, 1)` ease-out-quart that decelerates softly.
 * `will-change` + `transform: translate3d` keep the animation on the GPU.
 *
 * Animation is suppressed when the user has either:
 *   • toggled "Παύση κινήσεων" in the accessibility widget, or
 *   • the OS-level `prefers-reduced-motion: reduce` media query.
 */
export function PageEnter({
  children, stagger = 900, yOffset = 12, duration = 1100
}: PageEnterProps) {
  return (
    <Box className="kalypsis-page-enter"
      sx={{
        // First-level descendants reveal one-by-one.
        "& > *": {
          opacity: 0,
          willChange: "opacity, transform",
          animation: `kalypsisPageEnter ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
          // backface-visibility nudge keeps Chromium on the GPU compositor.
          backfaceVisibility: "hidden"
        },
        "& > *:nth-of-type(1)": { animationDelay: "60ms" },
        "& > *:nth-of-type(2)": { animationDelay: `${60 + Math.round(stagger * 0.18)}ms` },
        "& > *:nth-of-type(3)": { animationDelay: `${60 + Math.round(stagger * 0.36)}ms` },
        "& > *:nth-of-type(4)": { animationDelay: `${60 + Math.round(stagger * 0.54)}ms` },
        "& > *:nth-of-type(5)": { animationDelay: `${60 + Math.round(stagger * 0.72)}ms` },
        "& > *:nth-of-type(6)": { animationDelay: `${60 + Math.round(stagger * 0.90)}ms` },
        "& > *:nth-of-type(n+7)": { animationDelay: `${60 + stagger}ms` },
        "@keyframes kalypsisPageEnter": {
          "0%":   { opacity: 0, transform: `translate3d(0, ${yOffset}px, 0)` },
          "100%": { opacity: 1, transform: "translate3d(0, 0, 0)" }
        },
        // Respect the user's stated preference for less motion.
        "@media (prefers-reduced-motion: reduce)": {
          "& > *": { opacity: 1, animation: "none", willChange: "auto" }
        },
        'html[data-a11y-reduce-motion="1"] & > *': {
          opacity: 1, animation: "none", willChange: "auto"
        }
      }}>
      {children}
    </Box>
  );
}
