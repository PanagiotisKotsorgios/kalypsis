import type { ReactElement } from "react";
import { Tab, Tabs } from "@mui/material";

export function DetailProfileTabs({ value, onChange, items }: {
  value: number; onChange: (value: number) => void; items: readonly { label: string; icon: ReactElement }[];
}) {
  return <Tabs value={value} onChange={(_, next: number) => onChange(next)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{
    position: "sticky", top: 0, zIndex: 4, mb: .75, px: .25, py: .5, flexShrink: 0, minHeight: 44,
    border: "1px solid", borderColor: "divider", borderRadius: 1.25,
    bgcolor: "background.paper", boxShadow: "0 2px 8px rgba(15,23,42,.12)",
    overflow: "hidden", "& .MuiTabs-scroller": { overflowX: "auto !important", overflowY: "hidden", scrollbarWidth: "thin" },
    "& .MuiTabs-flexContainer": { gap: .35, flexWrap: "nowrap", alignItems: "center" },
    "& .MuiTabs-scrollButtons": { width: { xs: 24, sm: 28 }, color: "#0b5cad", "&.Mui-disabled": { opacity: .25 } },
    "& .MuiTabs-indicator": { display: "none" },
    "& .MuiTab-root": {
      minHeight: 36, height: 36, minWidth: { xs: 94, sm: 104, md: 116 }, px: { xs: .7, md: .85 }, py: .25,
      border: "1px solid #263238", borderRadius: .8,
      background: "linear-gradient(180deg, #e5e7eb 0%, #b8c0c8 100%) !important",
      color: "#111827 !important", borderColor: "#263238 !important", opacity: "1 !important", textTransform: "none", fontWeight: 750, fontSize: { xs: ".68rem", md: ".74rem" }, lineHeight: 1.05, whiteSpace: "nowrap", boxSizing: "border-box", overflow: "visible",
      "& .MuiTab-iconWrapper, & .MuiTab-icon": { fontSize: { xs: 16, md: 17 }, marginRight: .35, marginBottom: 0 },
      transition: "background .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease",
      "&:hover": { background: "linear-gradient(180deg, #d4d8de 0%, #9ca6b1 100%) !important", color: "#0b2545 !important", borderColor: "#111827 !important", transform: "none" },
      "&.Mui-selected": { background: "linear-gradient(135deg, #0b5cad 0%, #063b73 100%) !important", color: "#fff !important", borderColor: "#062f63 !important", boxShadow: "0 3px 8px rgba(6,47,99,.35)", "& .MuiSvgIcon-root": { color: "#fff !important" } },
      "&.Mui-selected:hover": { color: "#fff !important", background: "linear-gradient(135deg, #0b5cad 0%, #063b73 100%) !important" },
    },
  }}>{items.map(item => <Tab key={item.label} icon={item.icon} iconPosition="start" label={item.label} />)}</Tabs>;
}
