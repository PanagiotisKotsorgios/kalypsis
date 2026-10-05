import { GlobalStyles } from "@mui/material";

/**
 * Every MuiTableHead inside the authenticated app becomes sticky. Rather
 * than sprinkling `<Table stickyHeader>` across the 60+ table callsites,
 * a single CSS rule turns them all on at once. Works for any table nested
 * inside a scrollable container (MuiTableContainer or a plain Box with
 * overflow).
 *
 * The header sits at `top: 0` with the light-theme background pinned so
 * scroll traffic doesn't bleed through, and picks up a subtle bottom
 * border so the boundary reads cleanly.
 */
export function GlobalStickyHeaders() {
  return (
    <GlobalStyles styles={{
      // /app-only — pre-login pages have their own tighter styles.
      "body:not([data-prelogin]) .MuiTableHead-root": {
        position: "sticky",
        top: 0,
        zIndex: 3,
        backgroundColor: "#e3e7eb !important",
      },
      "body:not([data-prelogin]) .MuiTableHead-root .MuiTableCell-root": {
        backgroundColor: "#e3e7eb !important",
        color: "#263238",
        borderBottom: "2px solid #c1c9d0",
        fontWeight: 700,
      },
    }} />
  );
}
