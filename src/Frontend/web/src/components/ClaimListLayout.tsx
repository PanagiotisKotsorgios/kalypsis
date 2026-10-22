import { useEffect, useState, type ReactNode } from "react";
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TableContainer, useMediaQuery, useTheme } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import { CUSTOMER_TABLE_COLORS, customerTableSx } from "../pages/customerTableAppearance";

/** Saved reports remain mounted outside the closed modal, so toolbar save requests still work. */
export function ClaimListFilters({ title, children, savedFilters, desktopColumns, extraFilters }: {
  title: string; children: ReactNode; savedFilters: ReactNode; desktopColumns: number; extraFilters?: ReactNode;
}) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const compact = useMediaQuery(theme.breakpoints.down("xl"));
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!compact) setOpen(false); }, [compact]);
  const fields = <Box data-claim-filter-fields sx={{ display: "grid", gap: 1, alignItems: "center", minWidth: 0,
    gridTemplateColumns: compact ? { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" } : `minmax(220px,2fr) repeat(${desktopColumns - 1}, minmax(135px,1fr))`,
    "& > .MuiFormControl-root, & > .MuiAutocomplete-root": { minWidth: "0 !important", width: "100%" },
    "& .MuiInputBase-root": { minWidth: 0 }, "& > .MuiButton-root": { whiteSpace: "nowrap", minHeight: 40 },
  }}>{children}</Box>;
  return <Box sx={{ mb: 1, minWidth: 0, display: "grid", gridTemplateColumns: compact ? "minmax(0,1fr)" : "minmax(0,1fr) auto", columnGap: .75, alignItems: "center" }}>
    <Stack direction="row" gap={.75} alignItems="center" useFlexGap flexWrap="wrap" sx={{ minWidth: 0, maxWidth: compact ? "100%" : 220, gridColumn: compact ? 1 : 2, gridRow: 1,
      "& > .MuiButton-root": { maxWidth: "100%" } }}>
      {compact && <Button variant="contained" startIcon={<FilterListIcon />} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
        sx={{ bgcolor: "#159B59", color: "#fff", whiteSpace: "nowrap", "&:hover": { bgcolor: "#107B46", color: "#fff" } }}>Φίλτρα</Button>}
      {savedFilters}
    </Stack>
    {!compact && <Card variant="outlined" sx={{ gridColumn: 1, gridRow: 1, minWidth: 0, p: 1, bgcolor: dark ? "#15263A" : "#EDF2F7", borderColor: dark ? "#344E6B" : "#D5E0EC", overflow: "visible" }}>{fields}</Card>}
    <Dialog open={compact && open} onClose={() => setOpen(false)} fullWidth maxWidth="md"
      PaperProps={{ sx: { m: 1, width: "calc(100% - 16px)", maxHeight: "calc(100dvh - 16px)", bgcolor: dark ? "#15263A" : "#EDF2F7" } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: { xs: 18, sm: 22 }, overflowWrap: "anywhere" }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ minWidth: 0 }}>
        {fields}
        {extraFilters && <Box sx={{ mt: 1.25 }}>{extraFilters}</Box>}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: .5 }}><Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={() => setOpen(false)}>Κλείσιμο</Button>
        <Button variant="contained" color="success" sx={{ color: "#fff" }} onClick={() => setOpen(false)}>Προβολή αποτελεσμάτων</Button></DialogActions>
    </Dialog>
  </Box>;
}

/** The exact customer-list density/palette, with pagination outside native table scrolling. */
export function ClaimListTableFrame({ children, pagination, label, minWidth = 860 }: {
  children: ReactNode; pagination?: ReactNode; label: string; minWidth?: number;
}) {
  const dark = useTheme().palette.mode === "dark";
  return <Card variant="outlined" data-claim-list-table={label} sx={{ minWidth: 0, overflow: "hidden", bgcolor: dark ? "#15263A" : "#F0F2F5", borderColor: dark ? "#344E6B" : CUSTOMER_TABLE_COLORS.border }}>
    <TableContainer role="region" tabIndex={0} aria-label={label} sx={{ ...customerTableSx(dark), minWidth: 0, maxHeight: "min(660px,65dvh)", overflow: "auto", scrollbarGutter: "stable",
      "& .MuiTable-root": { minWidth },
      "& .MuiTableBody-root > .MuiTableRow-root": { bgcolor: dark ? "#15263A" : CUSTOMER_TABLE_COLORS.odd },
      "& .MuiTableBody-root > .MuiTableRow-root:nth-of-type(even)": { bgcolor: dark ? "#1B3046" : CUSTOMER_TABLE_COLORS.even },
      "& .MuiTableBody-root > .MuiTableRow-root:hover": { bgcolor: dark ? "#243F5C" : CUSTOMER_TABLE_COLORS.hover },
      "& .MuiTableBody-root > .MuiTableRow-root.Mui-selected, & .MuiTableBody-root > .MuiTableRow-root.Mui-selected:hover": { bgcolor: dark ? "#264A72" : CUSTOMER_TABLE_COLORS.selected },
      "& .MuiTableCell-alignRight": { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
    }}>{children}</TableContainer>
    {pagination && <Box data-claim-list-pagination sx={{ borderTop: "1px solid", borderColor: dark ? "#344E6B" : CUSTOMER_TABLE_COLORS.border, bgcolor: dark ? "#203750" : "#EDF2F7", p: .25,
      "& .MuiTablePagination-toolbar": { flexWrap: "wrap", minHeight: 44, px: 1, gap: .5 },
      "& .MuiTablePagination-spacer": { flex: "1 1 0" },
      "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { my: .5 },
      "& .MuiStack-root": { flexWrap: "wrap" },
    }}>{pagination}</Box>}
  </Card>;
}
