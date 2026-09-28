import { Button, Chip, Stack, Tooltip, Typography } from "@mui/material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";

export interface QuickFilterOption {
  key: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  count?: number;
  color?: "default" | "primary" | "success" | "warning" | "error" | "info";
}

/**
 * Small, consistent quick-filter strip used above the detailed filters on
 * list pages. It keeps the common actions one click away without adding
 * another permanent row of controls to the page.
 */
export function QuickFilterBar({
  options,
  onClear,
  activeCount = 0,
  label = "Γρήγορα φίλτρα",
}: {
  options: QuickFilterOption[];
  onClear?: () => void;
  activeCount?: number;
  label?: string;
}) {
  if (options.length === 0 && !onClear) return null;
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} useFlexGap
      flexWrap={{ xs: "nowrap", sm: "wrap" }}
      sx={{ mb: 1, minWidth: 0, overflowX: { xs: "auto", sm: "visible" }, pb: { xs: 0.25, sm: 0 } }}>
      <FilterAltIcon fontSize="small" color="action" />
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>
        {label}
      </Typography>
      {options.map(option => (
        <Chip
          key={option.key}
          size="small"
          clickable
          variant={option.active ? "filled" : "outlined"}
          color={option.active ? (option.color ?? "primary") : "default"}
          label={option.count === undefined ? option.label : `${option.label} (${option.count})`}
          onClick={option.onClick}
        />
      ))}
      {onClear && (
        <Tooltip title="Καθαρισμός όλων των φίλτρων">
          <Button
            size="small"
            color={activeCount > 0 ? "error" : "inherit"}
            variant={activeCount > 0 ? "outlined" : "text"}
            startIcon={<FilterAltOffIcon fontSize="small" />}
            onClick={onClear}
            sx={{ minWidth: 0, whiteSpace: "nowrap" }}
          >
            Καθαρισμός
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
}
