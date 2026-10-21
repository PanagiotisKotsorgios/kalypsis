import { useState } from "react";
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import TuneIcon from "@mui/icons-material/Tune";

export type UnifiedExportAction = "csv" | "xlsx" | "pdf" | "print" | "columns";

export function UnifiedActionsMenu({
  createLabel = "Νέα εγγραφή", onCreate, importLabel = "Μαζική εισαγωγή", onImport,
  onSaveFilter, onExport, onColumns, onFilters, disabledExports = false,
  exportFormats = ["csv", "xlsx", "pdf", "print"],
}: {
  createLabel?: string; onCreate?: () => void;
  importLabel?: string; onImport?: () => void;
  onSaveFilter?: () => void;
  onExport?: (action: Exclude<UnifiedExportAction, "columns">) => void;
  onColumns?: () => void;
  onFilters?: () => void;
  disabledExports?: boolean;
  exportFormats?: Array<Exclude<UnifiedExportAction, "columns">>;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const run = (action?: () => void) => { setAnchor(null); action?.(); };
  const item = (color: string, hover: string) => ({ color, "&:hover": { bgcolor: hover } });
  return <>
    <Button variant="contained" size="large" startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />}
      onClick={event => setAnchor(event.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(anchor)}>
      Ενέργειες
    </Button>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { minWidth: 280, maxWidth: "calc(100vw - 24px)" } } }}>
      {onCreate && <MenuItem onClick={() => run(onCreate)} sx={item("#0877c9", "#e7f2fd")}><ListItemIcon sx={{ color: "#0877c9" }}><AddIcon fontSize="small" /></ListItemIcon><ListItemText primary={createLabel} /></MenuItem>}
      {onImport && <MenuItem onClick={() => run(onImport)} sx={item("#167c45", "#e7f5ec")}><ListItemIcon sx={{ color: "#167c45" }}><UploadFileIcon fontSize="small" /></ListItemIcon><ListItemText primary={importLabel} /></MenuItem>}
      {onSaveFilter && <MenuItem onClick={() => run(onSaveFilter)} sx={item("#0b5cad", "#e7f1fc")}><ListItemIcon sx={{ color: "#0b5cad" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Αποθήκευση νέου φίλτρου" /></MenuItem>}
      {(onCreate || onImport || onSaveFilter) && onExport && <Divider />}
      {onExport && exportFormats.includes("csv") && <MenuItem disabled={disabledExports} onClick={() => run(() => onExport("csv"))} sx={item("#087f73", "#e5f6f3")}><ListItemIcon sx={{ color: "#087f73" }}><TableChartIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή CSV" /></MenuItem>}
      {onExport && exportFormats.includes("xlsx") && <MenuItem disabled={disabledExports} onClick={() => run(() => onExport("xlsx"))} sx={item("#167c45", "#e7f5ec")}><ListItemIcon sx={{ color: "#167c45" }}><GridOnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή Excel" /></MenuItem>}
      {onExport && exportFormats.includes("pdf") && <MenuItem disabled={disabledExports} onClick={() => run(() => onExport("pdf"))} sx={item("#c73545", "#fdecef")}><ListItemIcon sx={{ color: "#c73545" }}><PictureAsPdfIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή PDF" /></MenuItem>}
      {onExport && exportFormats.includes("print") && <MenuItem disabled={disabledExports} onClick={() => run(() => onExport("print"))} sx={item("#456b91", "#edf2f7")}><ListItemIcon sx={{ color: "#456b91" }}><PrintIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εκτύπωση" /></MenuItem>}
      {(onColumns || onFilters) && <Divider />}
      {onColumns && <MenuItem onClick={() => run(onColumns)} sx={item("#5b55a5", "#efedfb")}><ListItemIcon sx={{ color: "#5b55a5" }}><ViewColumnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στήλες πίνακα" /></MenuItem>}
      {onFilters && <MenuItem onClick={() => run(onFilters)} sx={item("#a45b00", "#fff3df")}><ListItemIcon sx={{ color: "#a45b00" }}><TuneIcon fontSize="small" /></ListItemIcon><ListItemText primary="Σύνθετα φίλτρα" /></MenuItem>}
    </Menu>
  </>;
}
