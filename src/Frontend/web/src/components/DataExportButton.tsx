import { useRef, useState } from "react";
import {
  Button,
  ButtonGroup,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import GridOnIcon from "@mui/icons-material/GridOn";
import TableChartIcon from "@mui/icons-material/TableChart";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import { useTranslation } from "react-i18next";
import { api, API_BASE_URL } from "../api/client";
import { printTable, type PrintColumn } from "../utils/printableTable";

type ExportFormat = "xlsx" | "csv" | "pdf";
type AnyAction = ExportFormat | "print";

interface DataExportButtonProps<T = unknown> {
  entity: string;
  search?: string;
  size?: "small" | "medium" | "large";
  label?: string;
  defaultFormat?: ExportFormat;
  /** Whitelist of column keys — when set and non-empty, sent as a `columns=`
   *  query param to the export endpoint so backends can trim their output. */
  visibleColumnKeys?: string[];
  /** Rows to feed the client-side Print handler. When omitted, the Print
   *  option falls back to `window.print()` on the caller's page. */
  printRows?: T[];
  /** Columns to render in the print output — falls back to a single "Data"
   *  column if only printRows was passed with no schema. */
  printColumns?: PrintColumn<T>[];
  /** Print header. Defaults to `entity`. */
  printTitle?: string;
  printSubtitle?: string;
}

const FORMAT_META: Record<ExportFormat, { label: string; icon: JSX.Element; mime: string; ext: string }> = {
  xlsx: { label: "Excel (.xlsx)", icon: <TableChartIcon fontSize="small" />, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  csv:  { label: "CSV (.csv)",   icon: <GridOnIcon fontSize="small" />,    mime: "text/csv",                                                              ext: "csv" },
  pdf:  { label: "PDF (.pdf)",   icon: <PictureAsPdfIcon fontSize="small" />, mime: "application/pdf",                                                  ext: "pdf" }
};

/**
 * Universal export trigger. Hits /api/data-exports/{entity} with the chosen
 * format and streams the file as a download. The dropdown lets the user pick
 * Excel / CSV / PDF; clicking the main button uses the default format.
 * An "Εκτύπωση" (Print) item at the bottom of the menu opens a client-side
 * printable window using printRows/printColumns if provided, or falls back
 * to the browser's page print dialog.
 *
 * Wired into any list page by passing the entity slug used by UniversalExportHandler:
 *   customers, policies, claims, producers, insurance-companies, commission-rules,
 *   branches, tariffs, tasks, receipts, payments, appointments, cover-notes,
 *   email-templates, notifications.
 */
export function DataExportButton<T = unknown>({
  entity,
  search,
  size = "small",
  label = "Εξαγωγή",
  defaultFormat = "xlsx",
  visibleColumnKeys,
  printRows,
  printColumns,
  printTitle,
  printSubtitle,
}: DataExportButtonProps<T>) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<AnyAction | null>(null);

  const download = async (format: ExportFormat) => {
    setBusy(format);
    try {
      const params: Record<string, string> = { format };
      if (search && search.trim()) params.search = search.trim();
      if (visibleColumnKeys && visibleColumnKeys.length > 0) {
        params.columns = visibleColumnKeys.join(",");
      }
      const res = await api.get(`/data-exports/${entity}`, { params, responseType: "blob" });
      const cd = res.headers["content-disposition"] as string | undefined;
      const match = cd?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const fallback = `${entity}-${new Date().toISOString().slice(0,10)}.${FORMAT_META[format].ext}`;
      const fileName = match ? decodeURIComponent(match[1]) : fallback;
      const blob = new Blob([res.data], { type: FORMAT_META[format].mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const handlePrint = () => {
    setBusy("print");
    try {
      if (printRows && printColumns && printColumns.length > 0) {
        // Client-side print — respects the caller's visible column set.
        const cols = visibleColumnKeys && visibleColumnKeys.length > 0
          ? printColumns.filter(c => visibleColumnKeys.includes(c.key))
          : printColumns;
        printTable<T>({
          title: printTitle ?? entity,
          subtitle: printSubtitle,
          columns: cols,
          rows: printRows,
        });
      } else {
        // Fallback — just fire the browser's own print dialog against whatever
        // is on screen. Consumers get "something" even if they don't pass rows.
        window.print();
      }
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const formats: ExportFormat[] = ["xlsx", "csv", "pdf"];

  return (
    <>
      <ButtonGroup variant="outlined" size={size} ref={anchorRef}>
        <Tooltip title={`${label} ${FORMAT_META[defaultFormat].label}`}>
          <Button
            startIcon={busy === defaultFormat ? <CircularProgress size={14} /> : <DownloadIcon />}
            disabled={busy !== null}
            onClick={() => void download(defaultFormat)}
            sx={{ fontWeight: 700 }}
          >
            {label}
          </Button>
        </Tooltip>
        <Button
          size={size}
          disabled={busy !== null}
          onClick={() => setOpen(true)}
          aria-label="Επιλογή μορφής εξαγωγής"
          sx={{ minWidth: 0, px: 0.5 }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Menu
        anchorEl={anchorRef.current}
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        {formats.map((f) => (
          <MenuItem
            key={f}
            disabled={busy !== null}
            onClick={() => void download(f)}
          >
            <ListItemIcon>
              {busy === f ? <CircularProgress size={16} /> : FORMAT_META[f].icon}
            </ListItemIcon>
            <ListItemText primary={FORMAT_META[f].label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem disabled={busy !== null} onClick={handlePrint}>
          <ListItemIcon>
            {busy === "print" ? <CircularProgress size={16} /> : <PrintIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={t("common.print", "Εκτύπωση")}
            secondary={printRows ? undefined : t("common.printCurrentPage", "Τρέχουσα σελίδα")}
          />
        </MenuItem>
      </Menu>
    </>
  );
}

// Re-export base URL for callers that need to construct a direct link as a fallback.
export const DATA_EXPORTS_BASE = `${API_BASE_URL}/data-exports`;
