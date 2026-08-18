import { useEffect, useRef, useState } from "react";
import { Box, Button, Fade, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CloseIcon from "@mui/icons-material/Close";
import { Link as RouterLink } from "react-router-dom";

/**
 * Floating «Λήψη Kalypsis Desktop» pill for public pages. Fixed to the
 * viewport, draggable by the operator to any corner or edge, snaps to the
 * nearest edge on release. Position persists in localStorage per browser
 * so a preferred spot sticks across sessions. Dismissable — the operator
 * can hide it for the current browser (until they clear storage).
 *
 * Rendered by <PublicShell /> once, so every prelogin page inherits it
 * without repeating the wiring.
 */

interface Anchor { corner: "tl" | "tr" | "bl" | "br"; x: number; y: number; }
const STORAGE_KEY = "kalypsis.publicDownloadButton.v1";
const DISMISS_KEY = "kalypsis.publicDownloadButton.dismissed";

function loadAnchor(): Anchor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Anchor;
    if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number"
        && ["tl", "tr", "bl", "br"].includes(parsed.corner)) return parsed;
  } catch { /* ignore */ }
  return null;
}

export function FloatingDownloadButton() {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISS_KEY) !== "1";
  });
  const [anchor, setAnchor] = useState<Anchor>(() =>
    loadAnchor() ?? { corner: "br", x: 24, y: 24 });
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; startAnchor: Anchor; moved: boolean } | null>(null);

  // Snap to nearest edge on release. Pins the button to the closer horizontal
  // AND vertical edge so it always hugs a corner or an edge — mirrors how a
  // Windows floating panel behaves. Distances are computed from the button's
  // current top-left in viewport coordinates.
  const snapToEdge = (topLeft: { x: number; y: number }) => {
    if (typeof window === "undefined") return;
    const node = nodeRef.current;
    const w = node?.offsetWidth ?? 220;
    const h = node?.offsetHeight ?? 56;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const distLeft = topLeft.x;
    const distRight = vw - (topLeft.x + w);
    const distTop = topLeft.y;
    const distBottom = vh - (topLeft.y + h);
    const horiz: "l" | "r" = distLeft <= distRight ? "l" : "r";
    const vert:  "t" | "b" = distTop <= distBottom ? "t" : "b";
    const corner: Anchor["corner"] = `${vert}${horiz}` as Anchor["corner"];
    const margin = 16;
    // Preserve some of the operator's off-edge distance so a mid-drag stop
    // doesn't slam back to (16,16) — just clamped to a sensible band.
    const anchorX = Math.max(margin, horiz === "l" ? Math.min(topLeft.x, 40) : Math.min(vw - (topLeft.x + w), 40));
    const anchorY = Math.max(margin, vert === "t" ? Math.min(topLeft.y, 40) : Math.min(vh - (topLeft.y + h), 40));
    const next: Anchor = { corner, x: Math.round(anchorX), y: Math.round(anchorY) };
    setAnchor(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = draggingRef.current;
      if (!d || !nodeRef.current) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      // Convert current anchor+delta to viewport top-left, then apply as
      // inline styles directly so the drag feels 1:1.
      const w = nodeRef.current.offsetWidth;
      const h = nodeRef.current.offsetHeight;
      const startTopLeft = anchorToTopLeft(d.startAnchor, w, h);
      const nx = Math.max(0, Math.min(window.innerWidth  - w, startTopLeft.x + dx));
      const ny = Math.max(0, Math.min(window.innerHeight - h, startTopLeft.y + dy));
      nodeRef.current.style.left = `${nx}px`;
      nodeRef.current.style.top  = `${ny}px`;
      nodeRef.current.style.right = "auto";
      nodeRef.current.style.bottom = "auto";
    };
    const onUp = (e: PointerEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      const w = nodeRef.current?.offsetWidth ?? 220;
      const h = nodeRef.current?.offsetHeight ?? 56;
      const startTopLeft = anchorToTopLeft(d.startAnchor, w, h);
      const nx = Math.max(0, Math.min(window.innerWidth  - w, startTopLeft.x + (e.clientX - d.startX)));
      const ny = Math.max(0, Math.min(window.innerHeight - h, startTopLeft.y + (e.clientY - d.startY)));
      draggingRef.current = null;
      snapToEdge({ x: nx, y: ny });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const style = anchorToStyle(anchor);

  return (
    <Fade in>
      <Box
        ref={nodeRef}
        role="complementary"
        aria-label="Λήψη Kalypsis Desktop — σύρετε για να μετακινήσετε"
        sx={{
          position: "fixed",
          zIndex: 1400,
          ...style,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 999,
          boxShadow: "0 12px 30px -12px rgba(11,37,69,0.35)",
          pl: 0.5, pr: 1.5, py: 0.5,
          display: "flex", alignItems: "center", gap: 1,
          transition: draggingRef.current ? "none" : "left 200ms ease, top 200ms ease, right 200ms ease, bottom 200ms ease",
          userSelect: "none",
        }}
      >
        <Tooltip title="Σύρετε το κουμπί σε άλλη γωνία">
          <IconButton
            size="small"
            onPointerDown={(e) => {
              draggingRef.current = { startX: e.clientX, startY: e.clientY, startAnchor: anchor, moved: false };
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            sx={{ cursor: "grab", "&:active": { cursor: "grabbing" }, color: "text.secondary" }}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          component={RouterLink} to="/download"
          startIcon={<DownloadIcon />}
          variant="contained" size="small"
          sx={{ fontWeight: 800, whiteSpace: "nowrap", letterSpacing: "0.02em", borderRadius: 999 }}
          onClick={(e) => {
            // Swallow clicks that happened as the tail-end of a drag.
            if (draggingRef.current?.moved) { e.preventDefault(); }
          }}
        >
          <Stack sx={{ textAlign: "left", ml: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, lineHeight: 1, fontSize: 11 }}>
              Kalypsis Desktop
            </Typography>
            <Typography variant="caption" sx={{ lineHeight: 1, fontSize: 10, opacity: 0.85 }}>
              Λήψη για Windows
            </Typography>
          </Stack>
        </Button>
        <Tooltip title="Απόκρυψη">
          <IconButton
            size="small"
            onClick={() => {
              setVisible(false);
              try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* quota */ }
            }}
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Fade>
  );
}

function anchorToStyle(a: Anchor): Record<string, string | number> {
  switch (a.corner) {
    case "tl": return { top: a.y, left: a.x, right: "auto", bottom: "auto" };
    case "tr": return { top: a.y, right: a.x, left: "auto", bottom: "auto" };
    case "bl": return { bottom: a.y, left: a.x, right: "auto", top: "auto" };
    case "br": return { bottom: a.y, right: a.x, left: "auto", top: "auto" };
  }
}

function anchorToTopLeft(a: Anchor, w: number, h: number): { x: number; y: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const left = a.corner === "tl" || a.corner === "bl" ? a.x : vw - w - a.x;
  const top  = a.corner === "tl" || a.corner === "tr" ? a.y : vh - h - a.y;
  return { x: left, y: top };
}
