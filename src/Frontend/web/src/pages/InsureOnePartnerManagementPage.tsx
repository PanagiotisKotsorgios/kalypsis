import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  Collapse, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel, Grid, IconButton,
  LinearProgress, List, ListItemButton, ListItemText, Menu, MenuItem, Stack, Switch, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AnalyticsRoundedIcon from "@mui/icons-material/AnalyticsRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EuroRoundedIcon from "@mui/icons-material/EuroRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";

interface Branding {
  agencyOfficeId: string; slug: string; isEnabled: boolean; displayName: string;
  welcomeMessage?: string | null; primaryColor: string; secondaryColor: string;
  supportEmail?: string | null; supportPhone?: string | null; logoUrl?: string | null;
  allowedBranches: string[];
}
interface Partner {
  id: string; userId?: string | null; producerId: string; producerName: string; email: string;
  firstName: string; lastName: string; phone?: string | null; loginCode: string;
  isActive: boolean; canIssuePolicies: boolean; canViewCommissions: boolean;
  canViewCustomers: boolean; lastLoginAt?: string | null; notes?: string | null; permissions: string[];
}
interface PartnerAnalytics {
  accessId: string; partnerName: string; email: string; isActive: boolean;
  lastLoginAt?: string | null; totalQuotes: number; quotesThisMonth: number;
  selectedQuotes: number; canIssuePolicies: boolean; permissions: string[];
}
interface Analytics {
  agencyOfficeId: string; officeName: string; totalPartners: number; activePartners: number;
  partnersWithIssuance: number; totalQuotes: number; quotesThisMonth: number;
  selectedQuotes: number; expiringQuotes: number; partners: PartnerAnalytics[];
  totalProduction?: number; productionThisMonth?: number;
}

const branches = ["Οχημάτων", "Σύγκριση Οχημάτων", "Περιουσίας", "Υγείας", "Σκαφών", "Προσωπικού Ατυχήματος", "Νομικής Προστασίας", "Πράσινης Κάρτας", "Ποδηλάτων"];
const permissionOptions = [
  ["quoting.read", "Προβολή τιμολόγησης"], ["quoting.create", "Δημιουργία προσφορών"],
  ["quotes.save", "Αποθήκευση / επιλογή προσφοράς"], ["quotes.history", "Ιστορικό προσφορών"],
  ["quotes.export", "Εξαγωγή ιστορικού"], ["customers.read", "Αναζήτηση πελατών"],
] as const;
type PermissionKey = typeof permissionOptions[number][0];
const defaultPartnerPermissions: PermissionKey[] = permissionOptions.map(([key]) => key);
type Section = "overview" | "partners" | "permissions" | "analytics" | "branding" | "preview";

const menuItems: { key: Section; label: string; icon: JSX.Element }[] = [
  { key: "overview", label: "Επισκόπηση", icon: <InsightsRoundedIcon /> },
  { key: "partners", label: "Συνεργάτες & χρήστες", icon: <GroupRoundedIcon /> },
  { key: "permissions", label: "Δικαιώματα & πρόσβαση", icon: <SecurityRoundedIcon /> },
  { key: "analytics", label: "Στατιστικά & αναλύσεις", icon: <AnalyticsRoundedIcon /> },
  { key: "branding", label: "Branding & ρυθμίσεις", icon: <SettingsRoundedIcon /> },
  { key: "preview", label: "Προεπισκόπηση συνεργάτη", icon: <PreviewRoundedIcon /> },
];

type InsureOneMenuGroup = {
  key: string;
  label: string;
  icon: JSX.Element;
  items: { key: string; label: string; icon: JSX.Element; section: Section }[];
};

const menuGroups: InsureOneMenuGroup[] = [
  {
    key: "overview",
    label: menuItems[0].label,
    icon: menuItems[0].icon,
    items: [{ key: "overview", label: menuItems[0].label, icon: menuItems[0].icon, section: "overview" }],
  },
  {
    key: "partners",
    label: "Συνεργάτες",
    icon: menuItems[1].icon,
    items: [
      { key: "partners-list", label: menuItems[1].label, icon: menuItems[1].icon, section: "partners" },
      { key: "partners-permissions", label: menuItems[2].label, icon: menuItems[2].icon, section: "permissions" },
      { key: "partners-preview", label: menuItems[5].label, icon: menuItems[5].icon, section: "preview" },
    ],
  },
  {
    key: "settings",
    label: "Ρυθμίσεις",
    icon: menuItems[4].icon,
    items: [
      { key: "branding", label: menuItems[4].label, icon: menuItems[4].icon, section: "branding" },
      { key: "login-branding", label: "Branded login & λογότυπο", icon: <PaletteRoundedIcon />, section: "branding" },
      { key: "quoting-branches", label: "Κλάδοι & πρόσβαση τιμολόγησης", icon: <SettingsRoundedIcon />, section: "branding" },
      { key: "access-policies", label: "Πολιτικές πρόσβασης συνεργατών", icon: <SecurityRoundedIcon />, section: "permissions" },
    ],
  },
  {
    key: "analytics",
    label: "Αναφορές",
    icon: menuItems[3].icon,
    items: [
      { key: "analytics", label: menuItems[3].label, icon: menuItems[3].icon, section: "analytics" },
      { key: "partner-performance", label: "Αποτελεσματικότητα ανά συνεργάτη", icon: <InsightsRoundedIcon />, section: "analytics" },
    ],
  },
];

export function InsureOnePartnerManagementPage() {
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partner | null>(null);
  const settings = useQuery({ queryKey: ["insureone-settings"], queryFn: async () => (await api.get<Branding>("/insureone/settings")).data });
  const partners = useQuery({ queryKey: ["insureone-partners"], queryFn: async () => (await api.get<Partner[]>("/insureone/partners")).data });
  const analytics = useQuery({ queryKey: ["insureone-admin-analytics"], queryFn: async () => (await api.get<Analytics>("/insureone/admin/analytics")).data, staleTime: 30_000 });
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/insureone/partners/${id}`), onSuccess: () => { setRevokeId(null); void qc.invalidateQueries({ queryKey: ["insureone-partners"] }); void qc.invalidateQueries({ queryKey: ["insureone-admin-analytics"] }); }, onError: e => setError(extractErrorMessage(e)) });
  const selectedRevoke = useMemo(() => (partners.data ?? []).find(p => p.id === revokeId), [partners.data, revokeId]);
  const openNew = () => { setEditing(null); setFormOpen(true); };

  return <Box sx={{ minHeight: "100vh", bgcolor: "#f5f9fc" }}>
    <InsureOneManagementHeader section={section} onSectionChange={setSection} officeName={settings.data?.displayName} onLogout={() => { signOut(); window.location.assign("/login"); }} />
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    <Stack direction="column" spacing={2} alignItems="stretch">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {section === "overview" && <OverviewSection settings={settings.data} analytics={analytics.data} partners={partners.data ?? []} onNew={openNew} onBranding={() => setSettingsOpen(true)} />}
        {section === "partners" && <PartnersSection loading={partners.isLoading} partners={partners.data ?? []} onNew={openNew} onEdit={p => { setEditing(p); setFormOpen(true); }} onDelete={setRevokeId} />}
        {section === "permissions" && <PermissionsSection partners={partners.data ?? []} />}
        {section === "analytics" && <AnalyticsSection data={analytics.data} loading={analytics.isLoading} />}
        {section === "branding" && <BrandingSection settings={settings.data} onEdit={() => setSettingsOpen(true)} onError={setError} onSaved={() => void qc.invalidateQueries({ queryKey: ["insureone-settings"] })} />}
        {section === "preview" && <PreviewSection settings={settings.data} />}
      </Box>
    </Stack>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings.data} onSaved={() => { setSettingsOpen(false); void qc.invalidateQueries({ queryKey: ["insureone-settings"] }); }} onError={setError} />
    <PartnerDialog open={formOpen} onClose={() => setFormOpen(false)} item={editing} onSaved={() => { setFormOpen(false); void qc.invalidateQueries({ queryKey: ["insureone-partners"] }); void qc.invalidateQueries({ queryKey: ["insureone-admin-analytics"] }); }} onError={setError} />
    <Dialog open={!!revokeId} onClose={() => setRevokeId(null)} maxWidth="xs" fullWidth><DialogTitle>Ανάκληση πρόσβασης;</DialogTitle><DialogContent><Typography>Θέλετε να απενεργοποιήσετε την πρόσβαση του/της <strong>{selectedRevoke ? `${selectedRevoke.firstName} ${selectedRevoke.lastName}` : "συνεργάτη"}</strong>; Το ιστορικό του διατηρείται.</Typography></DialogContent><DialogActions><Button onClick={() => setRevokeId(null)} startIcon={<CloseRoundedIcon />}>Ακύρωση</Button><Button color="error" variant="contained" startIcon={<DeleteRoundedIcon />} disabled={revoke.isPending} onClick={() => revokeId && revoke.mutate(revokeId)}>Ανάκληση</Button></DialogActions></Dialog>
    </Box>
  </Box>;
}

function InsureOneManagementHeader({ section, onSectionChange, officeName, onLogout }: { section: Section; onSectionChange: (section: Section) => void; officeName?: string | null; onLogout: () => void }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState<{ key: string; anchor: HTMLElement } | null>(null);
  const [mobileExpandedGroup, setMobileExpandedGroup] = useState<string | null>(null);
  const compactNav = useMediaQuery("(max-width:1120px)");
  const selectSection = (nextSection: Section) => {
    onSectionChange(nextSection);
    setMobileNavOpen(false);
    setMobileExpandedGroup(null);
    setDesktopMenu(null);
  };
  const activeGroupKey = section === "branding"
    ? "settings"
    : section === "analytics"
      ? "analytics"
      : section === "partners" || section === "permissions" || section === "preview"
        ? "partners"
        : "overview";

  return <>
    <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #ccd8e3", boxShadow: "0 3px 16px rgba(18,58,100,.08)" }}>
      <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: 1.25, sm: 2.5, lg: 4 }, py: { xs: .75, sm: 1, md: 1.25 }, display: "flex", alignItems: "center", justifyContent: "space-between", gap: { xs: .75, sm: 1.5, md: 2 } }}>
        <Stack direction="row" spacing={{ xs: .75, sm: 1.5 }} alignItems="center" minWidth={0} sx={{ flex: 1 }}>
          <Box component="img" src="/assets/insureone-plugin-logo.png" alt="InsureOne Kalypsis" sx={{ width: { xs: 180, sm: 290, md: 390 }, maxWidth: "100%", height: { xs: 64, sm: 92, md: 124 }, objectFit: "contain", objectPosition: "left center", flexShrink: 1 }} />
          <Box sx={{ display: { xs: "none", md: "block" }, pl: 1.5, borderLeft: "1px solid #d9e3ec" }}>
            <Typography sx={{ color: "#123a64", fontWeight: 900, fontSize: 14 }}>ΔΙΑΧΕΙΡΙΣΗ INSUREONE</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>Χρήστες, δικαιώματα και απόδοση συνεργατών</Typography>
          </Box>
        </Stack>
        <Typography noWrap sx={{ color: "#123a64", fontWeight: 800, fontSize: { xs: 10, sm: 13 }, maxWidth: { xs: 92, sm: 180, md: 240 }, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {officeName || "Το γραφείο σας"}
        </Typography>
      </Box>
    </Box>
    <Box sx={{ bgcolor: "#123a64", borderTop: "1px solid rgba(255,255,255,.12)" }}>
      <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: .5, sm: 2.5, lg: 4 }, display: "flex", alignItems: "center", gap: { xs: .5, sm: .75 } }}>
        {!compactNav && <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {menuGroups.map(group => {
            const active = activeGroupKey === group.key;
            if (group.items.length === 1) {
              const item = group.items[0];
              return <Button key={group.key} onClick={() => onSectionChange(item.section)} sx={{ minHeight: 58, minWidth: "max-content", px: { sm: 1.5, md: 2.1 }, borderRadius: 0, color: "#fff", fontWeight: 850, fontSize: { sm: 13, md: 14 }, textTransform: "none", whiteSpace: "nowrap", borderBottom: "3px solid transparent", bgcolor: active ? "#2e75b6" : "transparent", borderBottomColor: active ? "#53c6d3" : "transparent", transition: "background-color .16s ease, color .16s ease, border-color .16s ease", "&:hover": { bgcolor: "rgba(83,198,211,.2)", color: "#fff", borderBottomColor: "#53c6d3" } }}>{group.label}</Button>;
            }
            return <Fragment key={group.key}>
              <Button onClick={event => setDesktopMenu({ key: group.key, anchor: event.currentTarget })} endIcon={<KeyboardArrowDownRoundedIcon fontSize="small" />} sx={{ minHeight: 58, minWidth: "max-content", px: { sm: 1.5, md: 2.1 }, borderRadius: 0, color: "#fff", fontWeight: 850, fontSize: { sm: 13, md: 14 }, textTransform: "none", whiteSpace: "nowrap", borderBottom: "3px solid transparent", bgcolor: active ? "#2e75b6" : "transparent", borderBottomColor: active ? "#53c6d3" : "transparent", transition: "background-color .16s ease, color .16s ease, border-color .16s ease", "&:hover": { bgcolor: "rgba(83,198,211,.2)", color: "#fff", borderBottomColor: "#53c6d3" }, "& .MuiButton-endIcon": { ml: .35, transition: "transform .16s ease", transform: desktopMenu?.key === group.key ? "rotate(180deg)" : "none" } }}>{group.label}</Button>
              <Menu anchorEl={desktopMenu?.key === group.key ? desktopMenu.anchor : null} open={desktopMenu?.key === group.key} onClose={() => setDesktopMenu(null)} PaperProps={{ sx: { mt: .75, minWidth: 250, border: "1px solid #cbd9e6", boxShadow: "0 10px 28px rgba(18,58,100,.2)", borderRadius: 1.5 } }} MenuListProps={{ dense: true, sx: { py: .5, "& .MuiMenuItem-root": { px: 1.5, py: 1, fontSize: 13, fontWeight: 750, color: "#173b5d", borderRadius: .75, mx: .5, gap: 1, "&:hover": { bgcolor: "#e6f4f7", color: "#0b6d84" } } } }}>
                {group.items.map(item => <MenuItem key={item.key} selected={section === item.section} onClick={() => selectSection(item.section)}>{item.icon}<span>{item.label}</span></MenuItem>)}
              </Menu>
            </Fragment>;
          })}
        </Box>}
        {!compactNav && <Box sx={{ display: "none", flex: 1, minWidth: 0, alignItems: "center", overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {menuItems.map(item => <Button key={item.key} onClick={() => onSectionChange(item.key)} startIcon={item.icon} sx={{ minHeight: 58, minWidth: "max-content", px: { xs: 1.25, sm: 1.75, md: 2.25 }, borderRadius: 0, color: "#fff", fontWeight: 850, fontSize: { xs: 12, sm: 13, md: 14 }, textTransform: "none", whiteSpace: "nowrap", borderBottom: "3px solid transparent", bgcolor: section === item.key ? "#2e75b6" : "transparent", borderBottomColor: section === item.key ? "#53c6d3" : "transparent", transition: "background-color .16s ease, color .16s ease, border-color .16s ease", "&:hover": { bgcolor: "rgba(83,198,211,.2)", color: "#fff", borderBottomColor: "#53c6d3" }, "& .MuiButton-startIcon": { color: "inherit", mr: .55 } }}>{item.label}</Button>)}
        </Box>}
        {compactNav && <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <IconButton aria-label="Άνοιγμα μενού InsureOne" onClick={() => setMobileNavOpen(true)} sx={{ color: "#fff", width: 48, height: 48, borderRadius: 1.25, bgcolor: "rgba(83,198,211,.18)", "&:hover": { bgcolor: "rgba(83,198,211,.35)" } }}>
            <MenuRoundedIcon />
          </IconButton>
          <Typography noWrap sx={{ color: "#fff", fontWeight: 850, fontSize: { xs: 14, sm: 16 } }}>Μενού InsureOne</Typography>
        </Stack>}
        <Button aria-label="Αποσύνδεση" variant="contained" color="error" size="small" onClick={onLogout} startIcon={<LogoutRoundedIcon />} sx={{ flexShrink: 0, minWidth: { xs: 38, sm: 40 }, px: { xs: 1, sm: 1.25 }, color: "#fff", fontWeight: 850, borderRadius: 1.25, bgcolor: "#c62828", "&:hover": { bgcolor: "#9f1f1f" }, "& .MuiButton-startIcon": { mr: { xs: 0, sm: .65 } } }}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Αποσύνδεση</Box>
        </Button>
        <Drawer anchor="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} ModalProps={{ keepMounted: true }}>
          <Box role="presentation" sx={{ width: { xs: "min(88vw, 360px)", sm: 380 }, height: "100%", bgcolor: "#f7fbfd" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.75, bgcolor: "#123a64", color: "#fff" }}>
              <Box><Typography sx={{ fontWeight: 900, fontSize: 17 }}>Μενού InsureOne</Typography><Typography variant="caption" sx={{ color: "rgba(255,255,255,.78)" }}>{officeName || "Το γραφείο σας"}</Typography></Box>
              <IconButton aria-label="Κλείσιμο μενού" onClick={() => setMobileNavOpen(false)} sx={{ color: "#fff" }}><CloseRoundedIcon /></IconButton>
            </Stack>
            <List sx={{ px: 1, py: 1 }}>
              {menuGroups.map(group => {
                const expanded = mobileExpandedGroup === group.key;
                const active = activeGroupKey === group.key;
                if (group.items.length === 1) {
                  const item = group.items[0];
                  return <ListItemButton key={`mobile-${group.key}`} selected={section === item.section} onClick={() => selectSection(item.section)} sx={{ borderRadius: 1, mb: .5, "&.Mui-selected": { bgcolor: "#dceff5", color: "#123a64" }, "&.Mui-selected:hover": { bgcolor: "#c8e7ef" } }}><ListItemText primary={group.label} primaryTypographyProps={{ fontWeight: 800 }} /></ListItemButton>;
                }
                return <Fragment key={`mobile-${group.key}`}>
                  <ListItemButton selected={active} onClick={() => setMobileExpandedGroup(current => current === group.key ? null : group.key)} sx={{ borderRadius: 1, mb: .5, "&.Mui-selected": { bgcolor: "#dceff5", color: "#123a64" }, "&.Mui-selected:hover": { bgcolor: "#c8e7ef" } }}>
                    <ListItemText primary={group.label} primaryTypographyProps={{ fontWeight: 800 }} />
                    <KeyboardArrowDownRoundedIcon sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .16s ease" }} />
                  </ListItemButton>
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <List disablePadding sx={{ pl: 1 }}>
                      {group.items.map(item => <ListItemButton key={`mobile-${item.key}`} selected={section === item.section} onClick={() => selectSection(item.section)} sx={{ borderRadius: 1, mb: .25, pl: 2.5, color: "#31516b", "&.Mui-selected": { bgcolor: "#e6f4f7", color: "#0b6d84" } }}><ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 700 }} />{item.icon}</ListItemButton>)}
                    </List>
                  </Collapse>
                </Fragment>;
              })}
            </List>
            <List sx={{ display: "none", px: 1, py: 1 }}>
              {menuItems.map(item => <ListItemButton key={`mobile-${item.key}`} selected={section === item.key} onClick={() => selectSection(item.key)} sx={{ borderRadius: 1, mb: .5, "&.Mui-selected": { bgcolor: "#dceff5", color: "#123a64" }, "&.Mui-selected:hover": { bgcolor: "#c8e7ef" } }}>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 800 }} />
                {item.icon}
              </ListItemButton>)}
            </List>
          </Box>
        </Drawer>
      </Box>
    </Box>
  </>;
}

function OverviewSection({ analytics, partners, onNew, onBranding }: { settings?: Branding; analytics?: Analytics; partners: Partner[]; onNew: () => void; onBranding: () => void }) {
  const [range, setRange] = useState("01/10/2026 - 10/10/2026");
  const [rangeAnchor, setRangeAnchor] = useState<HTMLElement | null>(null);
  const totalPartners = analytics?.totalPartners ?? partners.length;
  const activePartners = analytics?.activePartners ?? partners.filter(partner => partner.isActive).length;
  const totalQuotes = analytics?.totalQuotes ?? 0;
  const monthlyQuotes = analytics?.quotesThisMonth ?? 0;
  const totalProduction = analytics?.totalProduction ?? 0;
  const monthlyProduction = analytics?.productionThisMonth ?? totalProduction;
  const formatCurrency = (value: number) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
  const chartSeed = Math.max(monthlyQuotes, 0);
  const productionSeed = Math.max(monthlyProduction, 0);
  const dailyData = useMemo(() => {
    const weights = [.08, .13, .18, .17, .2, .12, .12];
    return ["04/10", "05/10", "06/10", "07/10", "08/10", "09/10", "10/10"].map((date, index) => ({
      date,
      quotes: Math.round(chartSeed * weights[index]),
      production: Math.round(productionSeed * weights[index]),
    }));
  }, [chartSeed, productionSeed]);
  const distribution = [
    { name: "Αυτοκίνητο", value: 52, amount: Math.round(totalProduction * .52), color: "#1a78e6" },
    { name: "Μηχανή", value: 18, amount: Math.round(totalProduction * .18), color: "#22a879" },
    { name: "Κατοικία", value: 14, amount: Math.round(totalProduction * .14), color: "#f4b63f" },
    { name: "Υγεία", value: 10, amount: Math.round(totalProduction * .10), color: "#ee776d" },
    { name: "Λοιπά", value: 6, amount: Math.round(totalProduction * .06), color: "#a9b7c5" },
  ];
  const statusTotal = Math.max(totalPartners, 0);
  const statusChart = statusTotal > 0
    ? [{ name: "Ενεργοί", value: activePartners, color: "#21a46f" }, { name: "Ανενεργοί", value: Math.max(statusTotal - activePartners, 0), color: "#e4a83c" }, { name: "Σε αναμονή", value: 0, color: "#b8c5d0" }]
    : [{ name: "Δεν υπάρχουν δεδομένα", value: 1, color: "#dce7ee" }];
  const activityRows = (analytics?.partners ?? []).slice(0, 6).map((partner, index) => ({
    id: partner.accessId,
    date: partner.lastLoginAt ? new Date(partner.lastLoginAt).toLocaleDateString("el-GR") : "—",
    partner: partner.partnerName,
    action: partner.quotesThisMonth > 0 ? "Δημιουργία προσφοράς" : "Σύνδεση στο InsureOne",
    details: partner.quotesThisMonth > 0 ? `${partner.quotesThisMonth} προσφορές τον μήνα` : "Πρόσβαση στο portal",
    value: partner.totalQuotes > 0 && totalProduction > 0 ? formatCurrency(Math.round(totalProduction / Math.max(1, totalQuotes || partner.totalQuotes))) : "—",
    status: partner.isActive ? "Ολοκληρώθηκε" : "Ανενεργός",
    index,
  }));
  const metricCards = [
    { label: "Συνεργάτες", value: totalPartners.toLocaleString("el-GR"), hint: "Σύνολο συνεργατών", icon: <GroupRoundedIcon />, tint: "#e8f3fc", iconColor: "#2275bd" },
    { label: "Ενεργοί χρήστες", value: activePartners.toLocaleString("el-GR"), hint: "Με πρόσβαση στο portal", icon: <CheckCircleRoundedIcon />, tint: "#e8f7ef", iconColor: "#21865d" },
    { label: "Συνολική παραγωγή", value: formatCurrency(totalProduction), hint: "Πολυτιμολογήσεις (μήνας)", icon: <EuroRoundedIcon />, tint: "#edf2ff", iconColor: "#405fc0" },
    { label: "Πολυτιμολογήσεις", value: monthlyQuotes.toLocaleString("el-GR"), hint: "Συμβόλαια (μήνας)", icon: <DescriptionRoundedIcon />, tint: "#fff4e3", iconColor: "#c9821c" },
  ];
  const chartCardSx = { border: "1px solid #dce8f1", borderRadius: 2.5, boxShadow: "0 7px 18px rgba(31, 76, 112, .06)", bgcolor: "#fff" };
  return <Stack spacing={2.25}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5}>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button variant="outlined" startIcon={<PaletteRoundedIcon />} onClick={onBranding} sx={{ borderColor: "#a9c9dc", color: "#123a64", bgcolor: "#fff", fontWeight: 800 }}>Ρυθμίσεις branding</Button>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onNew} sx={{ bgcolor: "#123a64", fontWeight: 850, boxShadow: "none", "&:hover": { bgcolor: "#0c2c4b", boxShadow: "none" } }}>Νέος συνεργάτης</Button>
      </Stack>
      <Button variant="outlined" startIcon={<CalendarMonthRoundedIcon />} endIcon={<KeyboardArrowDownRoundedIcon />} onClick={event => setRangeAnchor(event.currentTarget)} sx={{ alignSelf: { xs: "stretch", md: "auto" }, justifyContent: "space-between", borderColor: "#bdd2e1", color: "#244866", bgcolor: "#fff", minWidth: { md: 220 }, fontWeight: 750 }}>{range}</Button>
      <Menu anchorEl={rangeAnchor} open={Boolean(rangeAnchor)} onClose={() => setRangeAnchor(null)}>
        {["01/10/2026 - 10/10/2026", "01/09/2026 - 30/09/2026", "01/01/2026 - 10/10/2026"].map(value => <MenuItem key={value} selected={range === value} onClick={() => { setRange(value); setRangeAnchor(null); }}>{value}</MenuItem>)}
      </Menu>
    </Stack>
    <Box sx={{ borderLeft: "4px solid #25a9cf", pl: 1.5 }}><Typography variant="h5" sx={{ color: "#123a64", fontWeight: 950, letterSpacing: -.2 }}>Επισκόπηση InsureOne</Typography><Typography variant="body2" sx={{ color: "#60798d", mt: .35 }}>Συνοπτική εικόνα της δραστηριότητας των συνεργατών και της παραγωγής του γραφείου σας.</Typography></Box>
    <Grid container spacing={1.75}>{metricCards.map(metric => <Grid item xs={12} sm={6} lg={3} key={metric.label}><Card sx={{ ...chartCardSx, p: 2.1, minHeight: 142, height: "100%" }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box sx={{ width: 42, height: 42, borderRadius: 1.75, bgcolor: metric.tint, color: metric.iconColor, display: "grid", placeItems: "center" }}>{metric.icon}</Box><TrendingUpRoundedIcon sx={{ color: "#1da06b", fontSize: 20 }} /></Stack><Typography sx={{ mt: 1.25, color: "#668095", fontSize: 12.5, fontWeight: 750 }}>{metric.label}</Typography><Typography sx={{ mt: .1, color: "#123a64", fontSize: 27, lineHeight: 1.1, fontWeight: 950 }}>{metric.value}</Typography><Typography sx={{ mt: .5, color: "#7690a2", fontSize: 11.5 }}>{metric.hint}</Typography></Card></Grid>)}</Grid>
    <Grid container spacing={1.75}>
      <Grid item xs={12} lg={6}><Card sx={{ ...chartCardSx, p: { xs: 1.5, md: 2.25 }, height: "100%" }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}><Box><Typography sx={{ color: "#123a64", fontWeight: 900 }}>Παραγωγή ανά ημέρα</Typography><Typography variant="caption" color="text.secondary">Προσφορές και αξία παραγωγής στο επιλεγμένο διάστημα</Typography></Box><Chip size="small" label="Τελευταίες 7 ημέρες" sx={{ bgcolor: "#edf6fb", color: "#28709b", fontWeight: 750 }} /></Stack><ResponsiveContainer width="100%" height={220}><ComposedChart data={dailyData} margin={{ top: 6, right: 4, left: -16, bottom: 0 }}><CartesianGrid stroke="#e8eff4" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#7a91a0", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="left" tick={{ fill: "#7a91a0", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis yAxisId="right" orientation="right" tick={{ fill: "#7a91a0", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={value => `${value}€`} /><RechartsTooltip formatter={(value, name) => [name === "production" ? formatCurrency(Number(value ?? 0)) : value, name === "production" ? "Παραγωγή" : "Πολυτιμολογήσεις"]} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /><Bar yAxisId="left" dataKey="quotes" name="Πολυτιμολογήσεις" fill="#8fc3ec" radius={[4, 4, 0, 0]} barSize={23} /><Line yAxisId="right" type="monotone" dataKey="production" name="Παραγωγή (€)" stroke="#1a78e6" strokeWidth={3} dot={{ r: 3, fill: "#1a78e6" }} activeDot={{ r: 5 }} /></ComposedChart></ResponsiveContainer></Card></Grid>
      <Grid item xs={12} md={6} lg={3}><Card sx={{ ...chartCardSx, p: { xs: 1.5, md: 2.25 }, height: "100%" }}><Typography sx={{ color: "#123a64", fontWeight: 900 }}>Κατανομή παραγωγής</Typography><Typography variant="caption" color="text.secondary">Ανά κλάδο ασφάλισης</Typography><Stack direction="row" alignItems="center" gap={1} mt={1}><Box sx={{ width: { xs: "46%", sm: 142 }, minWidth: 118, height: 150 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={43} outerRadius={67} paddingAngle={2} stroke="none">{distribution.map(item => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer></Box><Stack spacing={.65} flex={1}>{distribution.map(item => <Stack key={item.name} direction="row" alignItems="center" justifyContent="space-between" gap={.5}><Stack direction="row" alignItems="center" gap={.55} minWidth={0}><Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: item.color, flexShrink: 0 }} /><Typography sx={{ color: "#5f778b", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</Typography></Stack><Typography sx={{ color: "#234965", fontSize: 10.5, fontWeight: 850 }}>{item.value}%</Typography></Stack>)}</Stack></Stack><Typography sx={{ color: "#123a64", fontWeight: 900, textAlign: "center", mt: -1 }}>{formatCurrency(totalProduction)} <Box component="span" sx={{ color: "#8398a8", fontSize: 11, fontWeight: 500 }}>/ Σύνολο</Box></Typography></Card></Grid>
      <Grid item xs={12} md={6} lg={3}><Card sx={{ ...chartCardSx, p: { xs: 1.5, md: 2.25 }, height: "100%" }}><Typography sx={{ color: "#123a64", fontWeight: 900 }}>Κατάσταση συνεργατών</Typography><Typography variant="caption" color="text.secondary">Δραστηριότητα πρόσβασης στο portal</Typography><Stack direction="row" alignItems="center" gap={1} mt={1}><Box sx={{ width: { xs: "46%", sm: 142 }, minWidth: 118, height: 150, position: "relative" }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={43} outerRadius={67} paddingAngle={statusTotal ? 2 : 0} stroke="none">{statusChart.map(item => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}><Box sx={{ textAlign: "center" }}><Typography sx={{ color: "#123a64", fontWeight: 950, fontSize: 18 }}>{totalPartners}</Typography><Typography sx={{ color: "#8297a7", fontSize: 10 }}>Συνεργάτες</Typography></Box></Box></Box><Stack spacing={.7} flex={1}>{[{ name: "Ενεργοί", value: activePartners, color: "#21a46f" }, { name: "Ανενεργοί", value: Math.max(totalPartners - activePartners, 0), color: "#e4a83c" }, { name: "Σε αναμονή", value: 0, color: "#b8c5d0" }].map(item => <Stack key={item.name} direction="row" alignItems="center" justifyContent="space-between"><Stack direction="row" alignItems="center" gap={.55}><Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: item.color }} /><Typography sx={{ color: "#5f778b", fontSize: 10.5 }}>{item.name}</Typography></Stack><Typography sx={{ color: "#234965", fontSize: 10.5, fontWeight: 850 }}>{item.value}</Typography></Stack>)}</Stack></Stack><Typography sx={{ color: "#879aa8", fontSize: 11, textAlign: "center", mt: -1 }}>{totalPartners ? `${Math.round(activePartners / totalPartners * 100)}% ενεργοί` : "Δεν υπάρχουν δεδομένα"}</Typography></Card></Grid>
    </Grid>
    <Card sx={{ ...chartCardSx, overflow: "hidden" }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: { xs: 1.5, md: 2.25 }, pb: 1.2 }}><Box><Typography sx={{ color: "#123a64", fontWeight: 900 }}>Πρόσφατη δραστηριότητα</Typography><Typography variant="caption" color="text.secondary">Τελευταίες ενέργειες των συνεργατών σας</Typography></Box><Button size="small" sx={{ color: "#2479b8", fontWeight: 800 }}>Προβολή όλων</Button></Stack><TableContainer sx={{ overflowX: "auto" }}><Table size="small" sx={{ minWidth: 780 }}><TableHead><TableRow sx={{ bgcolor: "#f4f8fb" }}>{["#", "Ημερομηνία", "Συνεργάτης", "Ενέργεια", "Στοιχεία", "Αξία", "Κατάσταση", ""].map(label => <TableCell key={label} sx={{ color: "#6c8495", fontSize: 11, fontWeight: 850, borderBottom: "1px solid #e1ebf1", py: 1.2 }}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{activityRows.length ? activityRows.map(row => <TableRow key={row.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}><TableCell sx={{ color: "#7890a0", fontSize: 11 }}>{String(row.index + 1).padStart(2, "0")}</TableCell><TableCell sx={{ color: "#5f778b", fontSize: 11 }}>{row.date}</TableCell><TableCell sx={{ color: "#123a64", fontWeight: 800, fontSize: 12 }}>{row.partner}</TableCell><TableCell sx={{ color: "#45647a", fontSize: 11.5 }}>{row.action}</TableCell><TableCell sx={{ color: "#6f8797", fontSize: 11 }}>{row.details}</TableCell><TableCell sx={{ color: "#123a64", fontWeight: 850, fontSize: 11.5 }}>{row.value}</TableCell><TableCell><Chip size="small" label={row.status} sx={{ bgcolor: row.status === "Ολοκληρώθηκε" ? "#e4f6ec" : "#fff1d8", color: row.status === "Ολοκληρώθηκε" ? "#177247" : "#9b6819", fontSize: 10.5, fontWeight: 800, height: 24 }} /></TableCell><TableCell align="right"><IconButton size="small" aria-label="Περισσότερες ενέργειες"><MoreVertRoundedIcon fontSize="small" /></IconButton></TableCell></TableRow>) : <TableRow><TableCell colSpan={8} sx={{ py: 4, textAlign: "center", color: "#718899", fontSize: 13 }}>Δεν υπάρχει πρόσφατη δραστηριότητα.</TableCell></TableRow>}</TableBody></Table></TableContainer></Card>
  </Stack>;
}

function PartnersSection({ loading, partners, onNew, onEdit, onDelete }: { loading: boolean; partners: Partner[]; onNew: () => void; onEdit: (p: Partner) => void; onDelete: (id: string) => void }) {
  return <Stack spacing={2}><SectionHeading title="Συνεργάτες & χρήστες" subtitle="Δημιουργία υποκωδικών, πρόσβαση στο InsureOne και έλεγχος ανά συνεργάτη." action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onNew}>Νέος συνεργάτης</Button>} />{loading ? <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress /></Box> : <Grid container spacing={2}>{partners.map(p => <Grid item xs={12} md={6} lg={4} key={p.id}><Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}><Stack sx={{ p: 2.5 }} spacing={1.25}><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography fontWeight={850}>{p.firstName} {p.lastName}</Typography><Typography variant="body2" color="text.secondary">{p.email}</Typography></Box><Chip size="small" color={p.isActive ? "success" : "default"} label={p.isActive ? "Ενεργός" : "Ανενεργός"} /></Stack><Typography variant="body2"><strong>Κωδικός:</strong> {p.loginCode}</Typography><Typography variant="body2" color="text.secondary">Συνεργάτης: {p.producerName}</Typography><Stack direction="row" gap={.5} flexWrap="wrap"><Chip size="small" label="Τιμολόγηση" color="primary" variant="outlined" />{p.canViewCustomers && <Chip size="small" label="Πελάτες" variant="outlined" />}{p.canViewCommissions && <Chip size="small" label="Προμήθειες" variant="outlined" />}{p.canIssuePolicies && <Chip size="small" label="Έκδοση" variant="outlined" />}</Stack><Divider sx={{ my: .5 }} /><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="caption" color="text.secondary">{p.lastLoginAt ? `Τελευταία είσοδος: ${new Date(p.lastLoginAt).toLocaleString("el-GR")}` : "Δεν έχει συνδεθεί ακόμη"}</Typography><Stack direction="row"><IconButton size="small" onClick={() => onEdit(p)} aria-label="Επεξεργασία"><EditRoundedIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => onDelete(p.id)} aria-label="Ανάκληση πρόσβασης"><DeleteRoundedIcon fontSize="small" /></IconButton></Stack></Stack></Stack></Card></Grid>)}</Grid>}{!loading && !partners.length && <Card variant="outlined" sx={{ p: 5, textAlign: "center" }}><Typography color="text.secondary">Δεν έχουν δημιουργηθεί ακόμη συνεργάτες InsureOne.</Typography></Card>}</Stack>;
}

function PermissionsSection({ partners }: { partners: Partner[] }) {
  return <Stack spacing={2}><SectionHeading title="Δικαιώματα & πρόσβαση" subtitle="Συγκεντρωτική προβολή των δυνατοτήτων κάθε συνεργάτη." /><Card variant="outlined" sx={{ borderRadius: 3, overflow: "auto" }}><Box sx={{ minWidth: 720 }}><Stack direction="row" sx={{ p: 1.5, bgcolor: "#eef5f9", borderBottom: "1px solid #d6e4ed" }}><Typography sx={{ width: 230, fontWeight: 850 }}>Συνεργάτης</Typography>{permissionOptions.map(([, label]) => <Typography key={label} sx={{ flex: 1, px: .75, fontSize: 12, fontWeight: 800, color: "#31516b" }}>{label}</Typography>)}</Stack>{partners.map(partner => <Stack direction="row" key={partner.id} sx={{ p: 1.5, alignItems: "center", borderBottom: "1px solid #edf2f6" }}><Typography sx={{ width: 230, fontWeight: 750 }}>{partner.firstName} {partner.lastName}</Typography>{permissionOptions.map(([key]) => <Box key={key} sx={{ flex: 1, px: .75 }}>{partner.permissions.includes(key) ? <CheckCircleRoundedIcon fontSize="small" sx={{ color: "#1b7f55" }} /> : <Typography color="text.disabled">—</Typography>}</Box>)}</Stack>)}</Box></Card></Stack>;
}

function AnalyticsSection({ data, loading }: { data?: Analytics; loading: boolean }) {
  const max = Math.max(1, ...(data?.partners ?? []).map(p => p.totalQuotes));
  return <Stack spacing={2}><SectionHeading title="Στατιστικά & αναλύσεις" subtitle="Χρήση InsureOne ανά συνεργάτη, ενεργοποιήσεις και απόδοση προσφορών." />{loading ? <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress /></Box> : <><Grid container spacing={1.5}>{[["Ενεργοί συνεργάτες", data?.activePartners ?? 0], ["Συνεργάτες με έκδοση", data?.partnersWithIssuance ?? 0], ["Επιλεγμένες προσφορές", data?.selectedQuotes ?? 0], ["Λήγουν σύντομα", data?.expiringQuotes ?? 0]].map(([label, value]) => <Grid item xs={6} md={3} key={String(label)}><Card variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}><Typography variant="h4" fontWeight={900} color="#123a64">{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Card></Grid>)}</Grid><Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography fontWeight={850} mb={2}>Προσφορές ανά συνεργάτη</Typography><Stack spacing={1.5}>{(data?.partners ?? []).map(p => <Box key={p.accessId}><Stack direction="row" justifyContent="space-between" mb={.45}><Typography fontWeight={700}>{p.partnerName}</Typography><Typography variant="body2" color="text.secondary">{p.totalQuotes} συνολικά · {p.quotesThisMonth} αυτόν τον μήνα</Typography></Stack><LinearProgress variant="determinate" value={Math.round(p.totalQuotes / max * 100)} sx={{ height: 9, borderRadius: 6, bgcolor: "#e9f1f6", "& .MuiLinearProgress-bar": { borderRadius: 6, bgcolor: "#167ca8" } }} /></Box>)}{!data?.partners.length && <Typography color="text.secondary">Δεν υπάρχουν ακόμη δεδομένα χρήσης.</Typography>}</Stack></Card></>}</Stack>;
}

function BrandingSection({ settings, onEdit, onError, onSaved }: { settings?: Branding; onEdit: () => void; onError: (message: string) => void; onSaved: () => void }) {
  const upload = useMutation({ mutationFn: async (file: File) => { const payload = new FormData(); payload.append("file", file); await api.post("/insureone/settings/logo", payload, { headers: { "Content-Type": "multipart/form-data" } }); }, onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)) });
  return <Stack spacing={2}><SectionHeading title="Branding & ρυθμίσεις" subtitle="Προσωποποιήστε την login σελίδα και το περιβάλλον των συνεργατών σας." action={<Button variant="contained" startIcon={<SettingsRoundedIcon />} onClick={onEdit}>Επεξεργασία</Button>} /><Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "linear-gradient(120deg,#eef8fc,#fff)" }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}><Box sx={{ width: 96, height: 72, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#fff", border: "1px solid #d4e3ed", overflow: "hidden" }}>{settings?.logoUrl ? <Box component="img" src={`/api/insureone/public/${settings.slug}/logo`} alt="Λογότυπο InsureOne" sx={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Typography fontWeight={900} color={settings?.primaryColor ?? "#0b6fb8"}>IO</Typography>}</Box><Box flex={1}><Typography fontWeight={900} color="#123a64">{settings?.displayName ?? "InsureOne"}</Typography><Typography variant="body2" color="text.secondary">{settings?.welcomeMessage || "Καλωσορίσατε στην πύλη συνεργατών."}</Typography><Typography variant="caption" color="text.secondary">{settings?.slug ? `https://mykalypsis.gr/insureone/${settings.slug}/login` : "Δεν έχει οριστεί σύνδεσμος"}</Typography></Box><Button component="label" variant="outlined" startIcon={<PaletteRoundedIcon />} disabled={upload.isPending}>Ανέβασμα λογοτύπου<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.currentTarget.value = ""; }} /></Button></Stack></Card></Stack>;
}

function PreviewSection({ settings }: { settings?: Branding }) {
  const url = settings?.slug ? `/insureone/${settings.slug}/login` : "/insureone/demo/login";
  return <Stack spacing={2}><SectionHeading title="Προεπισκόπηση συνεργάτη" subtitle="Ελέγξτε το branded περιβάλλον πριν μοιραστείτε τον σύνδεσμο." /><Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: "#123a64", color: "#fff" }}><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}><Box><Typography variant="h5" fontWeight={900}>{settings?.displayName ?? "InsureOne"}</Typography><Typography sx={{ opacity: .8 }}>Σελίδα σύνδεσης συνεργατών</Typography><Typography sx={{ mt: 1, fontFamily: "monospace", fontSize: 13, color: "#a9e5ef" }}>{url}</Typography></Box><Button component="a" href={url} target="_blank" rel="noreferrer" variant="contained" sx={{ bgcolor: "#53c6d3", color: "#123a64", fontWeight: 900 }} startIcon={<PreviewRoundedIcon />}>Άνοιγμα προεπισκόπησης</Button></Stack></Card></Stack>;
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: JSX.Element }) { return <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1}><Box><Typography variant="h5" fontWeight={900} color="#123a64">{title}</Typography><Typography variant="body2" color="text.secondary">{subtitle}</Typography></Box>{action}</Stack>; }

function SettingsDialog({ open, onClose, settings, onSaved, onError }: { open: boolean; onClose: () => void; settings?: Branding; onSaved: () => void; onError: (s: string) => void }) {
  const [form, setForm] = useState({ slug: "", displayName: "", welcomeMessage: "", primaryColor: "#0B6FB8", secondaryColor: "#0B2545", supportEmail: "", supportPhone: "", isEnabled: true, allowedBranches: [] as string[] });
  useEffect(() => { if (settings) setForm({ slug: settings.slug, displayName: settings.displayName, welcomeMessage: settings.welcomeMessage ?? "", primaryColor: settings.primaryColor, secondaryColor: settings.secondaryColor, supportEmail: settings.supportEmail ?? "", supportPhone: settings.supportPhone ?? "", isEnabled: settings.isEnabled, allowedBranches: settings.allowedBranches ?? [] }); }, [settings, open]);
  const save = useMutation({ mutationFn: () => api.put("/insureone/settings", form), onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)) });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>Branding και ρυθμίσεις InsureOne</DialogTitle><DialogContent><Grid container spacing={2} sx={{ mt: .2 }}><Grid item xs={12} sm={6}><TextField fullWidth label="Slug URL" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} helperText="π.χ. neo-poseidonas" /></Grid><Grid item xs={12} sm={6}><TextField fullWidth label="Όνομα εμφάνισης" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} /></Grid><Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Μήνυμα καλωσορίσματος" value={form.welcomeMessage} onChange={e => setForm({ ...form, welcomeMessage: e.target.value })} /></Grid><Grid item xs={6}><TextField fullWidth label="Κύριο χρώμα" value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} /></Grid><Grid item xs={6}><TextField fullWidth label="Δευτερεύον χρώμα" value={form.secondaryColor} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} /></Grid><Grid item xs={12} sm={6}><TextField fullWidth label="Email υποστήριξης" value={form.supportEmail} onChange={e => setForm({ ...form, supportEmail: e.target.value })} /></Grid><Grid item xs={12} sm={6}><TextField fullWidth label="Τηλέφωνο υποστήριξης" value={form.supportPhone} onChange={e => setForm({ ...form, supportPhone: e.target.value })} /></Grid><Grid item xs={12}><FormControlLabel control={<Switch checked={form.isEnabled} onChange={e => setForm({ ...form, isEnabled: e.target.checked })} />} label="Ενεργή branded σύνδεση" /></Grid><Grid item xs={12}><Typography fontWeight={750} mb={1}>Επιτρεπόμενοι κλάδοι</Typography><Stack direction="row" gap={.4} flexWrap="wrap">{branches.map(branch => <FormControlLabel key={branch} control={<Checkbox size="small" checked={form.allowedBranches.includes(branch)} onChange={e => setForm({ ...form, allowedBranches: e.target.checked ? [...form.allowedBranches, branch] : form.allowedBranches.filter(x => x !== branch) })} />} label={branch} />)}</Stack></Grid></Grid></DialogContent><DialogActions><Button onClick={onClose}>Ακύρωση</Button><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button></DialogActions></Dialog>;
}

function PartnerDialog({ open, onClose, item, onSaved, onError }: { open: boolean; onClose: () => void; item: Partner | null; onSaved: () => void; onError: (s: string) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", loginCode: "", phone: "", isActive: true, canIssuePolicies: false, canViewCommissions: true, canViewCustomers: true, permissions: [...defaultPartnerPermissions], notes: "" });
  useEffect(() => { if (item) setForm({ firstName: item.firstName, lastName: item.lastName, email: item.email, password: "", loginCode: item.loginCode, phone: item.phone ?? "", isActive: item.isActive, canIssuePolicies: item.canIssuePolicies, canViewCommissions: item.canViewCommissions, canViewCustomers: item.canViewCustomers, permissions: (item.permissions?.length ? item.permissions : [...defaultPartnerPermissions]) as PermissionKey[], notes: item.notes ?? "" }); else if (open) setForm({ firstName: "", lastName: "", email: "", password: "", loginCode: "", phone: "", isActive: true, canIssuePolicies: false, canViewCommissions: true, canViewCustomers: true, permissions: [...defaultPartnerPermissions], notes: "" }); }, [item, open]);
  const save = useMutation({ mutationFn: () => item ? api.put(`/insureone/partners/${item.id}`, { isActive: form.isActive, canIssuePolicies: form.canIssuePolicies, canViewCommissions: form.canViewCommissions, canViewCustomers: form.canViewCustomers, permissions: form.permissions, loginCode: form.loginCode, newPassword: form.password || null, notes: form.notes || null, phone: form.phone || null }) : api.post("/insureone/partners", { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, loginCode: form.loginCode || null, phone: form.phone || null, canIssuePolicies: form.canIssuePolicies, canViewCommissions: form.canViewCommissions, canViewCustomers: form.canViewCustomers, permissions: form.permissions, notes: form.notes || null }), onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)) });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{item ? "Επεξεργασία συνεργάτη InsureOne" : "Νέος συνεργάτης InsureOne"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{!item && <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth required label="Όνομα" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /><TextField fullWidth required label="Επώνυμο" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></Stack>}<TextField fullWidth required={!item} label="Email" type="email" disabled={!!item} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><TextField fullWidth label="Κωδικός σύνδεσης" value={form.loginCode} onChange={e => setForm({ ...form, loginCode: e.target.value })} helperText="Ο συνεργάτης μπορεί να συνδεθεί με αυτόν αντί για email." />{!item && <TextField fullWidth required label="Προσωρινός κωδικός" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} helperText="Τουλάχιστον 8 χαρακτήρες." />}{item && <TextField fullWidth label="Νέος κωδικός (προαιρετικά)" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}<TextField fullWidth label="Τηλέφωνο" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><Stack>{[{ key: "isActive", label: "Ενεργή πρόσβαση" }, { key: "canViewCustomers", label: "Προβολή πελατών" }, { key: "canViewCommissions", label: "Προβολή προμηθειών" }, { key: "canIssuePolicies", label: "Υποβολή προς έκδοση" }].map(x => <FormControlLabel key={x.key} control={<Switch checked={(form as Record<string, unknown>)[x.key] as boolean} onChange={e => setForm({ ...form, [x.key]: e.target.checked })} />} label={x.label} />)}</Stack><Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f5f9fd", border: "1px solid #dce9f2" }}><Typography fontWeight={750} mb={.5}>Δικαιώματα InsureOne</Typography><Typography variant="caption" color="text.secondary" display="block" mb={1}>Επιλέξτε με ακρίβεια τις λειτουργίες που θα είναι διαθέσιμες στον συνεργάτη.</Typography><Stack>{permissionOptions.map(([key, label]) => <FormControlLabel key={key} control={<Checkbox size="small" checked={form.permissions.includes(key)} onChange={e => setForm({ ...form, permissions: e.target.checked ? [...form.permissions, key] : form.permissions.filter(x => x !== key) })} />} label={label} />)}</Stack></Box><TextField fullWidth multiline minRows={2} label="Σημειώσεις" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Ακύρωση</Button><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || (!item && (!form.firstName || !form.lastName || !form.email || form.password.length < 8))}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button></DialogActions></Dialog>;
}
