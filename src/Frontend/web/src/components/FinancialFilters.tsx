import { useEffect, useState, type ReactNode } from "react";
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Stack, useMediaQuery, useTheme } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";

/** Financial-page filter forms share one early breakpoint and an accessible modal.
 * Saved-report controls stay mounted outside the modal for toolbar save requests. */
export function FinancialFilters({ title, children, savedFilters, quickFilters, activeCount = 0 }: {
  title: string; children: ReactNode; savedFilters?: ReactNode; quickFilters?: ReactNode; activeCount?: number;
}) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("xl"));
  const dark = theme.palette.mode === "dark";
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!compact) setOpen(false); }, [compact]);
  const content = <Box data-financial-filter-fields sx={{ minWidth: 0, pt: .75,
    "& > .MuiStack-root, & > .MuiBox-root": {
      display: "grid", gridTemplateColumns: compact ? { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" } : "repeat(auto-fit,minmax(180px,1fr))",
      gap: 1.25, alignItems: "center", minWidth: 0,
      "& > *": { minWidth: "0 !important", width: "100%", margin: "0 !important", gridColumn: "auto !important" },
    },
    "& .MuiFormControl-root, & .MuiAutocomplete-root": { minWidth: "0 !important", width: "100%" },
    "& .MuiButton-root": { minHeight: 40, whiteSpace: "normal" },
    "& .MuiFormControlLabel-root": { overflowWrap: "anywhere" },
  }}>{children}</Box>;
  return <Box data-financial-filters={title} sx={{ minWidth: 0, mb: 1.5 }}>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: (savedFilters || quickFilters) && !compact ? 1 : 0 }}>
      {(compact || quickFilters) && <Button variant={compact ? "contained" : "outlined"} startIcon={<FilterListIcon />} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
        sx={{ ...(compact ? { bgcolor: "#159B59", color: "#fff", "&:hover": { bgcolor: "#107B46", color: "#fff" } } : {}), maxWidth: "100%", whiteSpace: "normal" }}>
        {compact ? "Φίλτρα" : "Γρήγορα φίλτρα"}{activeCount > 0 ? ` (${activeCount})` : ""}
      </Button>}
      {savedFilters}
    </Stack>
    {!compact && <Card variant="outlined" sx={{ px: 1.5, py: 1.25, minWidth: 0, overflow: "visible", bgcolor: dark ? "#15263A" : "#EDF2F7" }}>{content}</Card>}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"
      PaperProps={{ sx: { m: 1, width: "calc(100% - 16px)", maxHeight: "calc(100dvh - 16px)", bgcolor: dark ? "#15263A" : "#EDF2F7" } }}>
      <DialogTitle sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>{title}</DialogTitle>
      <DialogContent dividers>
        {quickFilters && <Box sx={{ mb: 1.5, minWidth: 0 }}>{quickFilters}</Box>}
        {content}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: .5 }}>
        <Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setOpen(false)}>Κλείσιμο</Button>
        <Button color="success" variant="contained" sx={{ color: "#fff" }} onClick={() => setOpen(false)}>Προβολή αποτελεσμάτων</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
