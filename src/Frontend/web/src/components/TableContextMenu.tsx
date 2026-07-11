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
     * useHeaderContextMenu  — right-click a header cell to sort or hide the
                               column. Sort labels adapt to the column's
                               semantic type (string / number / date).
     * useRowContextMenu     — right-click a body row to fire common per-row
                               actions (edit / duplicate / delete / pin).

   Both hooks return `{ open, close, menu }`. The consumer wires up
   `onContextMenu={(e) => open(e, {key, …})}` on the target and drops
   `{menu}` inside its render tree.

   Positioning uses anchorPosition based on the ORIGINAL event's clientX/Y
   (not currentTarget) so the menu opens exactly at the mouse cursor even
   when the user right-clicks inside a nested span rather than the cell.
   A ~2/6 px offset — the same one MUI uses in their docs — keeps the
   menu from covering the pointer.
   ========================================================================= */

export type ColumnType = "string" | "number" | "date";

interface ColumnMenuContext {
  key: string;
  label: string;
  type: ColumnType;
  canHide: boolean;
}

interface HeaderMenuOptions {
  onSort?: (key: string, direction: "asc" | "desc") => void;
  onHide?: (key: string) => void;
  extraItems?: React.ReactNode;
}

interface HeaderMenuState {
  position: { x: number; y: number } | null;
  ctx: ColumnMenuContext | null;
}

export function useHeaderContextMenu(options: HeaderMenuOptions) {
  const [state, setState] = useState<HeaderMenuState>({ position: null, ctx: null });

  const open = useCallback((e: React.MouseEvent, ctx: ColumnMenuContext) => {
    e.preventDefault();
    e.stopPropagation();
    setState({
      // MUI docs pattern — the small offset stops the menu from covering
      // the cursor so the user can see what they're aiming at.
      position: { x: e.clientX + 2, y: e.clientY - 6 },
      ctx,
    });
  }, []);
  const close = useCallback(() => setState({ position: null, ctx: null }), []);

  const isOpen = state.position !== null && state.ctx !== null;

  const menu = (
    <Menu
      open={isOpen}
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={state.position ? { top: state.position.y, left: state.position.x } : undefined}
      MenuListProps={{ dense: true, sx: { minWidth: 240 } }}
    >
      {options.extraItems}
      {options.onSort && state.ctx && (
        <MenuItem onClick={() => { options.onSort!(state.ctx!.key, "asc"); close(); }}>
          <ListItemIcon>{sortIconFor(state.ctx.type, "asc")}</ListItemIcon>
          <ListItemText primary={sortLabelFor(state.ctx.type, "asc")} secondary={state.ctx.label} />
        </MenuItem>
      )}
      {options.onSort && state.ctx && (
        <MenuItem onClick={() => { options.onSort!(state.ctx!.key, "desc"); close(); }}>
          <ListItemIcon>{sortIconFor(state.ctx.type, "desc")}</ListItemIcon>
          <ListItemText primary={sortLabelFor(state.ctx.type, "desc")} secondary={state.ctx.label} />
        </MenuItem>
      )}
      {options.onSort && options.onHide && <Divider />}
      {options.onHide && state.ctx?.canHide && (
        <MenuItem onClick={() => { options.onHide!(state.ctx!.key); close(); }}>
          <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Απόκρυψη στήλης" secondary={state.ctx.label} />
        </MenuItem>
      )}
    </Menu>
  );

  return { open, close, menu, isOpen };
}

function sortIconFor(type: ColumnType, dir: "asc" | "desc"): React.ReactNode {
  if (type === "string")
    return dir === "asc"
      ? <SortByAlphaIcon fontSize="small" />
      : <SortByAlphaIcon fontSize="small" sx={{ transform: "scaleX(-1)" }} />;
  if (type === "date") return <EventIcon fontSize="small" />;
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
// Row context menu — same pattern.
// -----------------------------------------------------------------------------

interface RowMenuOptions<T> {
  onEdit?: (row: T) => void;
  onDuplicate?: (row: T) => void;
  onDelete?: (row: T) => void;
  onPin?: (row: T) => void;
  entityLabel?: string;
  extraItems?: (row: T, close: () => void) => React.ReactNode;
}

interface RowMenuState<T> {
  position: { x: number; y: number } | null;
  row: T | null;
}

export function useRowContextMenu<T>(options: RowMenuOptions<T>) {
  const [state, setState] = useState<RowMenuState<T>>({ position: null, row: null });

  const open = useCallback((e: React.MouseEvent, row: T) => {
    e.preventDefault();
    e.stopPropagation();
    setState({
      position: { x: e.clientX + 2, y: e.clientY - 6 },
      row,
    });
  }, []);
  const close = useCallback(() => setState({ position: null, row: null }), []);

  const suffix = options.entityLabel ? ` ${options.entityLabel.toLowerCase()}` : "";
  const isOpen = state.position !== null && state.row !== null;

  const menu = (
    <Menu
      open={isOpen}
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={state.position ? { top: state.position.y, left: state.position.x } : undefined}
      MenuListProps={{ dense: true, sx: { minWidth: 220 } }}
    >
      {state.row !== null && options.extraItems?.(state.row, close)}
      {state.row !== null && options.onEdit && (
        <MenuItem onClick={() => { options.onEdit!(state.row as T); close(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={`Επεξεργασία${suffix}`} />
        </MenuItem>
      )}
      {state.row !== null && options.onDuplicate && (
        <MenuItem onClick={() => { options.onDuplicate!(state.row as T); close(); }}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={`Αντιγραφή${suffix}`} />
        </MenuItem>
      )}
      {state.row !== null && options.onPin && (
        <MenuItem onClick={() => { options.onPin!(state.row as T); close(); }}>
          <ListItemIcon><PushPinIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Καρφίτσωμα" />
        </MenuItem>
      )}
      {(options.onEdit || options.onDuplicate || options.onPin) && options.onDelete && <Divider />}
      {state.row !== null && options.onDelete && (
        <MenuItem onClick={() => { options.onDelete!(state.row as T); close(); }} sx={{ color: "error.main" }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary={`Διαγραφή${suffix}`} />
        </MenuItem>
      )}
    </Menu>
  );

  return { open, close, menu, isOpen };
}

// -----------------------------------------------------------------------------
// Helper: a “Καθαρισμός φίλτρων” item to plug into extraItems.
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
