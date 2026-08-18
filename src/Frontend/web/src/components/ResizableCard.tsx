import { useEffect, useState, type ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * Card wrapper that lets the operator drag one edge (left OR right) to
 * resize the card's max-width. Width is persisted to localStorage per
 * `id`, so a drag on one browser sticks across sessions on that machine
 * — matches the sidebar's UX. Both mouse and touch (pointer events)
 * work.
 *
 * Wrap any Card, Paper, Box, etc. in this to make its horizontal size
 * user-adjustable without changing its inner content:
 *
 *   <ResizableCard id="dashboard.kpi-strip">
 *     <Card ...>...</Card>
 *   </ResizableCard>
 */
export function ResizableCard({
  id,
  children,
  edge = "left",
  minWidth = 320,
  maxWidth = 2000,
  defaultWidth,
}: {
  id: string;
  children: ReactNode;
  edge?: "left" | "right";
  minWidth?: number;
  maxWidth?: number;
  /** Falls back to 100% when omitted and no override exists. */
  defaultWidth?: number;
}) {
  const storageKey = `kalypsis:resizableCard:${id}`;
  const [width, setWidth] = useState<number | null>(() => {
    if (typeof window === "undefined") return defaultWidth ?? null;
    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored >= minWidth && stored <= maxWidth) return stored;
    return defaultWidth ?? null;
  });

  useEffect(() => {
    if (typeof window === "undefined" || width == null) return;
    localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  const [resizing, setResizing] = useState<false | { startX: number; startWidth: number; rectRight: number }>(false);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - resizing.startX;
      const raw = edge === "left"
        // Dragging the left handle to the RIGHT shrinks the card
        // (because the right edge is anchored). Dragging LEFT expands.
        ? resizing.startWidth - dx
        : resizing.startWidth + dx;
      const clamped = Math.min(maxWidth, Math.max(minWidth, raw));
      setWidth(Math.round(clamped));
    };
    const onUp = () => setResizing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing, minWidth, maxWidth, edge]);

  const handleStyle = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: "col-resize",
    zIndex: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Highlight strip becomes visible on hover / while dragging so operators
    // learn the handle exists even without instructions.
    "&::before": {
      content: '""',
      width: 3,
      height: "min(80px, 60%)",
      borderRadius: 2,
      bgcolor: resizing ? "primary.main" : "divider",
      transition: "background-color 120ms ease",
    },
    "&:hover::before": { bgcolor: "primary.main" },
    ...(edge === "left" ? { left: -3 } : { right: -3 }),
  };

  return (
    <Box sx={{
      position: "relative",
      display: "inline-block",
      // Align with the parent's expected content flow. Using inline-block
      // + edge margin keeps the resize handle glued to the actual card
      // rather than growing the flexbox row.
      width: width != null ? width : "100%",
      maxWidth: "100%",
      marginLeft: edge === "left" && width != null ? "auto" : undefined,
      transition: resizing ? "none" : "width 120ms ease",
    }}>
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label={edge === "left" ? "Αριστερή λαβή αλλαγής μεγέθους" : "Δεξιά λαβή αλλαγής μεγέθους"}
        onPointerDown={(e) => {
          const rect = (e.currentTarget.parentElement?.getBoundingClientRect().right) ?? 0;
          setResizing({ startX: e.clientX, startWidth: e.currentTarget.parentElement?.getBoundingClientRect().width ?? minWidth, rectRight: rect });
          e.preventDefault();
        }}
        sx={handleStyle}
      />
      {children}
    </Box>
  );
}
