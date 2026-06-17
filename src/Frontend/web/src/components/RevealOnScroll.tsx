import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

/**
 * Wrap any block of content to fade + translate into view the first time it
 * enters the viewport. Cheap one-shot IntersectionObserver per instance so
 * a long page never accumulates listeners. Respects prefers-reduced-motion.
 */
interface Props {
  children: ReactNode;
  /** "up" lifts from below (default), "down" drops from above, "left"/"right" slides in. */
  direction?: "up" | "down" | "left" | "right";
  /** Delay before this element starts animating, in ms (for staggering siblings). */
  delay?: number;
  /** How aggressively to translate the element while hidden, in px. */
  distance?: number;
  /** Animation duration in ms. */
  duration?: number;
  threshold?: number;
  sx?: SxProps<Theme>;
}

export function RevealOnScroll({
  children,
  direction = "up",
  delay = 0,
  distance = 28,
  duration = 700,
  threshold = 0.12,
  sx
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect users who prefer no motion — render visible immediately.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);

  const initialTransform =
    direction === "up" ? `translateY(${distance}px)`
    : direction === "down" ? `translateY(-${distance}px)`
    : direction === "left" ? `translateX(${distance}px)`
    : `translateX(-${distance}px)`;

  return (
    <Box
      ref={ref}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0, 0)" : initialTransform,
        transition: `opacity ${duration}ms ease, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        transitionDelay: `${delay}ms`,
        willChange: "opacity, transform",
        ...sx
      }}
    >
      {children}
    </Box>
  );
}
