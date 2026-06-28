import { useRef, useState } from "react";
import {
  Button,
  ButtonGroup,
  CircularProgress,
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
import { api, API_BASE_URL } from "../api/client";

type ExportFormat = "xlsx" | "csv" | "pdf";

interface DataExportButtonProps {
  entity: string;
  search?: string;
  size?: "small" | "medium" | "large";
  label?: string;
  defaultFormat?: ExportFormat;
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
 *
 * Wired into any list page by passing the entity slug used by UniversalExportHandler:
 *   customers, policies, claims, producers, insurance-companies, commission-rules,
 *   branches, tariffs, tasks, receipts, payments, appointments, cover-notes,
 *   email-templates, notifications.
 */
export function DataExportButton({
  entity,
  search,
  size = "small",
  label = "Εξαγωγή",
  defaultFormat = "xlsx"
}: DataExportButtonProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);

  const download = async (format: ExportFormat) => {
    setDownloading(format);
    try {
      const params: Record<string, string> = { format };
      if (search && search.trim()) params.search = search.trim();
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
      setDownloading(null);
      setOpen(false);
    }
  };

  const formats: ExportFormat[] = ["xlsx", "csv", "pdf"];

  return (
    <>
      <ButtonGroup variant="outlined" size={size} ref={anchorRef}>
        <Tooltip title={`${label} ${FORMAT_META[defaultFormat].label}`}>
          <Button
            startIcon={downloading === defaultFormat ? <CircularProgress size={14} /> : <DownloadIcon />}
            disabled={downloading !== null}
            onClick={() => void download(defaultFormat)}
            sx={{ fontWeight: 700 }}
          >
            {label}
          </Button>
        </Tooltip>
        <Button
          size={size}
          disabled={downloading !== null}
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
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        {formats.map((f) => (
          <MenuItem
            key={f}
            disabled={downloading !== null}
            onClick={() => void download(f)}
          >
            <ListItemIcon>
              {downloading === f ? <CircularProgress size={16} /> : FORMAT_META[f].icon}
            </ListItemIcon>
            <ListItemText primary={FORMAT_META[f].label} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// Re-export base URL for callers that need to construct a direct link as a fallback.
export const DATA_EXPORTS_BASE = `${API_BASE_URL}/data-exports`;
