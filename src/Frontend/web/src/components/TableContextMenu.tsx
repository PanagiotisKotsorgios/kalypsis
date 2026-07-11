import { useCallback, useState } from "react";
import {
  Divider, ListItemIcon, ListItemText, Menu, MenuItem
} from "@mui/material";
import SortByAlphaIcon from "@mui/icons-material/SortByAlpha";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import PushPinIcon from "@mui/icons-material/PushPin";
import EventIcon from "@mui/icons-material/Event";

/* =============================================================================
   Right-click context menus for exportable / printable tables.

   Two hooks + one Menu component:
     * useHeaderContextMenu  — right-click on a <TableCell> header to sort or
                               hide the column. Detects the semantic type
                               (string / number / date) so the sort labels
                               read naturally ("A→Z" vs "Παλιότερα → Νεότερα"
                               vs "Χαμηλότερα → Υψηλότερα").
     * useRowContextMenu     — right-click on a <TableRow> to trigger the
                               common per-row actions (edit / duplicate /
                               delete) via the callbacks the page passes in.

   Both hooks return `{ open, close, menu }`. The consumer wires up
   `onContextMenu={(e) => open(e, {key})}` on the target and drops `{menu}`
   inside its render tree.
   ========================================================================= */

export type ColumnType = "string" | "number" | "date";

interface ColumnMenuContext {
  key: string;
  label: string;
  type: ColumnType;
  canHide: boolean;
}

interface HeaderMenuOptions {
  /** Called with (key, direction) when the user picks a sort option. */
  onSort?: (key: string, direction: "asc" | "desc") => void;
  /** Called when the user picks "Hide column". */
  onHide?: (key: string) => void;
  /** Optional extra items rendered above the sort/hide block. */
  extraItems?: React.ReactNode;
}

interface HeaderMenuState {
  anchor: { x: number; y: number } | null;
  ctx: ColumnMenuContext | null;
}

export function useHeaderContextMenu(options: HeaderMenuOptions) {
  const [state, setState] = useState<HeaderMenuState>({ anchor: null, ctx: null });

  const open = useCallback((e: React.MouseEvent, ctx: ColumnMenuContext) => {
    e.preventDefault();
    setState({ anchor: { x: e.clientX, y: e.clientY }, ctx });
  }, []);
  const close = useCallback(() => setState({ anchor: null, ctx: null }), []);

  const menu = state.anchor && state.ctx ? (
    <Menu
      open
      anchorReference="anchorPosition"
      anchorPosition={{ top: state.anchor.y, left: state.anchor.x }}
      onClose={close}
      slotProps={{ paper: { sx: { minWidth: 240 } } }}
    >
      {options.extraItems}
      {options.onSort && (
        <MenuItem onClick={() => { options.onSort!(state.ctx!.key, "asc"); close(); }}>
          <ListItemIcon>{sortIconFor(state.ctx.type, "asc")}</ListItemIcon>
          <ListItemText primary={sortLabelFor(state.ctx.type, "asc")} secondary={state.ctx.label} />
        </MenuItem>
      )}
      {options.onSort && (
        <MenuItem onClick={() => { options.onSort!(state.ctx!.key, "desc"); close(); }}>
          <ListItemIcon>{sortIconFor(state.ctx.type, "desc")}</ListItemIcon>
          <ListItemText primary={sortLabelFor(state.ctx.type, "desc")} secondary={state.ctx.label} />
        </MenuItem>
      )}
      {options.onSort && options.onHide && <Divider />}
      {options.onHide && state.ctx.canHide && (
        <MenuItem onClick={() => { options.onHide!(state.ctx!.key); close(); }}>
          <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Απόκρυψη στήλης" secondary={state.ctx.label} />
        </MenuItem>
      )}
    </Menu>
  ) : null;

  return { open, close, menu };
}

function sortIconFor(type: ColumnType, dir: "asc" | "desc"): React.ReactNode {
  if (type === "string") return <SortByAlphaIcon fontSize="small" />;
  if (type === "date")   return <EventIcon fontSize="small" />;
  return dir === "asc"
    ? <ArrowUpwardIcon fontSize="small" />
    : <ArrowDownwardIcon fontSize="small" />;
}
function sortLabelFor(type: ColumnType, dir: "asc" | "desc"): string {
  if (type === "string") return dir === "asc" ? "Ταξινόμηση Α → Ω" : "Ταξινόμηση Ω → Α";
  if (type === "date")   return dir === "asc" ? "Παλιότερα → Νεότερα" : "Νεότερα → Παλιότερα";
  return dir === "asc" ? "Χαμηλότερα → Υψηλότερα" : "Υψηλότερα → Χαμηλότερα";
}

// -----------------------------------------------------------------------------
// Row context menu.
// -----------------------------------------------------------------------------

interface RowMenuOptions<T> {
  onEdit?: (row: T) => void;
  onDuplicate?: (row: T) => void;
  onDelete?: (row: T) => void;
  onPin?: (row: T) => void;
  /** Optional label prefix, e.g. "Πελάτης" → "Επεξεργασία Πελάτη". */
  entityLabel?: string;
  /** Extra items rendered at the top. */
  extraItems?: (row: T, close: () => void) => React.ReactNode;
}

interface RowMenuState<T> {
  anchor: { x: number; y: number } | null;
  row: T | null;
}

export function useRowContextMenu<T>(options: RowMenuOptions<T>) {
  const [state, setState] = useState<RowMenuState<T>>({ anchor: null, row: null });
  const open = useCallback((e: React.MouseEvent, row: T) => {
    e.preventDefault();
    setState({ anchor: { x: e.clientX, y: e.clientY }, row });
  }, []);
  const close = useCallback(() => setState({ anchor: null, row: null }), []);

  const suffix = options.entityLabel ? ` ${options.entityLabel.toLowerCase()}` : "";

  const menu = state.anchor && state.row !== null ? (
    <Menu
      open
      anchorReference="anchorPosition"
      anchorPosition={{ top: state.anchor.y, left: state.anchor.x }}
      onClose={close}
      slotProps={{ paper: { sx: { minWidth: 220 } } }}
    >
      {options.extraItems?.(state.row, close)}
      {options.onEdit && (
        <MenuItem onClick={() => { options.onEdit!(state.row as T); close(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={`Επεξεργασία${suffix}`} />
        </MenuItem>
      )}
      {options.onDuplicate && (
        <MenuItem onClick={() => { options.onDuplicate!(state.row as T); close(); }}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={`Αντιγραφή${suffix}`} />
        </MenuItem>
      )}
      {options.onPin && (
        <MenuItem onClick={() => { options.onPin!(state.row as T); close(); }}>
          <ListItemIcon><PushPinIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Καρφίτσωμα" />
        </MenuItem>
      )}
      {(options.onEdit || options.onDuplicate || options.onPin) && options.onDelete && <Divider />}
      {options.onDelete && (
        <MenuItem onClick={() => { options.onDelete!(state.row as T); close(); }} sx={{ color: "error.main" }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary={`Διαγραφή${suffix}`} />
        </MenuItem>
      )}
    </Menu>
  ) : null;

  return { open, close, menu };
}

// -----------------------------------------------------------------------------
// Convenience: a single hook that returns both menus wired for a filter
// "clear" action. Callers pass `hasFilters` + `onClearFilters` when they
// want a "Καθαρισμός φίλτρων" item to appear regardless of column.
// -----------------------------------------------------------------------------

export function useClearFiltersMenuItem(hasFilters: boolean, onClear: () => void, close: () => void): React.ReactNode {
  if (!hasFilters) return null;
  return (
    <>
      <MenuItem onClick={() => { onClear(); close(); }}>
        <ListItemIcon><FilterAltOffIcon fontSize="small" /></ListItemIcon>
        <ListItemText primary="Καθαρισμός φίλτρων" />
      </MenuItem>
      <Divider />
    </>
  );
}
