// Page-scoped compact table styling; no global theme or other lists are changed.
export const CUSTOMER_TABLE_COLORS = {
  header: "#E9EEF4", odd: "#F8FAFC", even: "#F0F2F5", hover: "#E5EDF7",
  selected: "#DCEBFA", border: "#DFE5ED", navy: "#102C55", prospect: "#FFF0DC",
};

export function customerTableSx(dark = false) {
  return {
    minWidth: 760,
    "& .MuiTableCell-root": { borderColor: dark ? "#344E6B" : CUSTOMER_TABLE_COLORS.border, verticalAlign: "middle" },
    "& .MuiTableCell-head": { bgcolor: dark ? "#203750" : CUSTOMER_TABLE_COLORS.header, color: dark ? "#E6EEF7" : CUSTOMER_TABLE_COLORS.navy,
      fontWeight: 800, fontSize: 13, lineHeight: 1.3, py: .7, px: 1 },
    "& .MuiTableCell-body": { fontSize: 13, lineHeight: 1.3, py: .45, px: 1 },
    "& .MuiTableCell-paddingCheckbox": { width: 36, px: .5 },
    "& .MuiCheckbox-root, & .MuiIconButton-root": { p: .5, width: 28, height: 28, flexShrink: 0 },
    "& .MuiCheckbox-root .MuiSvgIcon-root": { fontSize: 20 },
    "& .MuiChip-root": { height: 24, maxWidth: "100%" },
    "& .MuiChip-label": { px: .9 },
    "& .MuiTypography-body1, & .MuiTypography-body2": { fontSize: 13, lineHeight: 1.3 },
    "& .MuiTypography-caption": { fontSize: 11.5, lineHeight: 1.25 },
  };
}

export function customerTableRowSx(index: number, prospect: boolean, dark = false) {
  return {
    cursor: "pointer",
    bgcolor: prospect ? (dark ? "#49331C" : CUSTOMER_TABLE_COLORS.prospect)
      : dark ? (index % 2 ? "#1B3046" : "#15263A") : (index % 2 ? CUSTOMER_TABLE_COLORS.even : CUSTOMER_TABLE_COLORS.odd),
    "&:hover": { bgcolor: prospect ? (dark ? "#5B4022" : "#FFE2B5") : (dark ? "#243F5C" : CUSTOMER_TABLE_COLORS.hover) },
    "&.Mui-selected, &.Mui-selected:hover": { bgcolor: dark ? "#264A72" : CUSTOMER_TABLE_COLORS.selected },
  };
}
