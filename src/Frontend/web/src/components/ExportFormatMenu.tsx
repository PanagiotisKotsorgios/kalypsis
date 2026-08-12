import { useState } from "react";
import { Button, ButtonProps, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

export type ExportFormat = "csv" | "xlsx" | "pdf";

/**
 * One button, three formats: consolidates the CSV / Excel / PDF trio into
 * a single «Εξαγωγή ▾» dropdown so filter bars stop devouring row width.
 * Operators pick a format from the menu; the parent handles the actual
 * download in onExport. `formats` optionally trims the menu (default: all
 * three).
 */
export function ExportFormatMenu(props: {
  onExport: (fmt: ExportFormat) => void | Promise<void>;
  formats?: ExportFormat[];
  label?: string;
  disabled?: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  color?: ButtonProps["color"];
  sx?: ButtonProps["sx"];
}) {
  const {
    onExport,
    formats = ["csv", "xlsx", "pdf"],
    label = "Εξαγωγή",
    disabled,
    size = "small",
    variant = "outlined",
    color,
    sx,
  } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const pick = async (fmt: ExportFormat) => { setAnchor(null); await onExport(fmt); };
  const meta: Record<ExportFormat, { label: string; icon: JSX.Element }> = {
    csv:  { label: "CSV",       icon: <TableChartIcon fontSize="small" /> },
    xlsx: { label: "Excel (XLSX)", icon: <GridOnIcon fontSize="small" /> },
    pdf:  { label: "PDF",       icon: <PictureAsPdfIcon fontSize="small" /> },
  };
  return (
    <>
      <Button
        size={size}
        variant={variant}
        color={color}
        startIcon={<DownloadIcon />}
        endIcon={<ArrowDropDownIcon />}
        onClick={e => setAnchor(e.currentTarget)}
        disabled={disabled}
        sx={sx}
      >
        {label}
      </Button>
      <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}>
        {formats.map(f => (
          <MenuItem key={f} onClick={() => pick(f)}>
            <ListItemIcon>{meta[f].icon}</ListItemIcon>
            <ListItemText>{meta[f].label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
