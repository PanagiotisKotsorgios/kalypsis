import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Editorial-pace IntersectionObserver reveal — slower (800ms) and uses the
 * same `cubic-bezier(0.16, 1, 0.3, 1)` curve as the rest of the editorial
 * stylesheet so motion reads as one orchestrated load.
 */
export function EdReveal({
  children,
  delay = 0,
  as: As = "div",
  className = "",
  threshold = 0.18
}: {
  children: ReactNode;
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [delay, threshold]);

  const Component = As as React.ElementType;
  return (
    <Component
      ref={ref as React.RefObject<HTMLElement>}
      className={`ed-reveal ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </Component>
  );
}
