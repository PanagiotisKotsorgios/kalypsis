// Same neutral-gray palette and compact density as the customer/production lists.
export const policyCoverageContainerSx = {
  minWidth: 0, maxHeight: 380, overflow: "auto", border: "1px solid #D5E0EC", borderRadius: 1.25,
  bgcolor: "#F0F2F5", scrollbarGutter: "stable",
};
export const policyCoverageTableSx = {
  minWidth: 720,
  "& th, & td": { borderColor: "#DFE5ED", verticalAlign: "middle" },
  "& th": { bgcolor: "#E9EEF4", color: "#102C55", fontWeight: 800, fontSize: 12, py: .65, px: 1, lineHeight: 1.3, whiteSpace: "nowrap" },
  "& td": { color: "#102C55", fontSize: 12.5, py: .4, px: 1, lineHeight: 1.3 },
  "& td.MuiTableCell-alignRight": { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  "& .MuiIconButton-root": { width: 28, height: 28, p: .5, borderRadius: .75 },
  "& tfoot td": { bgcolor: "#E9EEF4", fontWeight: 800, borderTop: "2px solid #D5E0EC" },
};
export function policyCoverageRowSx(index: number) {
  return { bgcolor: index % 2 ? "#F0F2F5" : "#F8FAFC", "&:hover": { bgcolor: "#E5EDF7" },
    "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "#DCEBFA" } };
}
