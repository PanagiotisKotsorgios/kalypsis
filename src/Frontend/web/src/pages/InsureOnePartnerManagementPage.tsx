import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  Collapse, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel, Grid, IconButton,
  LinearProgress, List, ListItemButton, ListItemText, Menu, MenuItem, Stack, Switch, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, InputAdornment, useMediaQuery,
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
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
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
const formatInsureOneCurrency = (value: number) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
type Section = "overview" | "partners" | "permissions" | "analytics" | "branding" | "preview" | "login-branding" | "quoting-branches" | "access-policies" | "partner-performance";

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
      { key: "login-branding", label: "Branded login & λογότυπο", icon: <PaletteRoundedIcon />, section: "login-branding" },
      { key: "quoting-branches", label: "Κλάδοι & πρόσβαση τιμολόγησης", icon: <SettingsRoundedIcon />, section: "quoting-branches" },
      { key: "access-policies", label: "Πολιτικές πρόσβασης συνεργατών", icon: <SecurityRoundedIcon />, section: "access-policies" },
    ],
  },
  {
    key: "analytics",
    label: "Αναφορές",
    icon: menuItems[3].icon,
    items: [
      { key: "analytics", label: menuItems[3].label, icon: menuItems[3].icon, section: "analytics" },
      { key: "partner-performance", label: "Αποτελεσματικότητα ανά συνεργάτη", icon: <InsightsRoundedIcon />, section: "partner-performance" },
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
  const [partnerPreview, setPartnerPreview] = useState<Partner | null>(null);
  const settings = useQuery({ queryKey: ["insureone-settings"], queryFn: async () => (await api.get<Branding>("/insureone/settings")).data });
  const partners = useQuery({ queryKey: ["insureone-partners"], queryFn: async () => (await api.get<Partner[]>("/insureone/partners")).data });
  const analytics = useQuery({ queryKey: ["insureone-admin-analytics"], queryFn: async () => (await api.get<Analytics>("/insureone/admin/analytics")).data, staleTime: 30_000 });
  const revoke = useMutation({ mutationFn: (id: string) => api.delete(`/insureone/partners/${id}`), onSuccess: () => { setRevokeId(null); void qc.invalidateQueries({ queryKey: ["insureone-partners"] }); void qc.invalidateQueries({ queryKey: ["insureone-admin-analytics"] }); }, onError: e => setError(extractErrorMessage(e)) });
  const selectedRevoke = useMemo(() => (partners.data ?? []).find(p => p.id === revokeId), [partners.data, revokeId]);
  const openNew = () => { setEditing(null); setFormOpen(true); };

  return <Box sx={{ minHeight: "100vh", bgcolor: "#f5f9fc", display: "flex", flexDirection: "column" }}>
    <InsureOneManagementHeader section={section} onSectionChange={setSection} officeName={settings.data?.displayName} onLogout={() => { signOut(); window.location.assign("/login"); }} />
    <Box sx={{ p: { xs: 1.5, md: 3 }, flex: 1, width: "100%", boxSizing: "border-box" }}>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    <Stack direction="column" spacing={2} alignItems="stretch">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {section === "overview" && <OverviewSection settings={settings.data} analytics={analytics.data} partners={partners.data ?? []} onNew={openNew} onBranding={() => setSettingsOpen(true)} />}
        {section === "partners" && <PartnersSection loading={partners.isLoading} partners={partners.data ?? []} analytics={analytics.data} onNew={openNew} onEdit={p => { setEditing(p); setFormOpen(true); }} onDelete={setRevokeId} onView={setPartnerPreview} />}
        {section === "permissions" && <PermissionsSection partners={partners.data ?? []} onView={setPartnerPreview} />}
        {section === "analytics" && <AnalyticsSection data={analytics.data} loading={analytics.isLoading} />}
        {section === "branding" && <BrandingSection settings={settings.data} onEdit={() => setSettingsOpen(true)} onError={setError} onSaved={() => void qc.invalidateQueries({ queryKey: ["insureone-settings"] })} />}
        {section === "login-branding" && <LoginBrandingSection settings={settings.data} onEdit={() => setSettingsOpen(true)} />}
        {section === "quoting-branches" && <QuotingBranchesSection settings={settings.data} onError={setError} onSaved={() => void qc.invalidateQueries({ queryKey: ["insureone-settings"] })} />}
        {section === "access-policies" && <AccessPoliciesSection partners={partners.data ?? []} onView={setPartnerPreview} />}
        {section === "partner-performance" && <PartnerPerformanceSection data={analytics.data} loading={analytics.isLoading} partners={partners.data ?? []} onView={setPartnerPreview} />}
        {section === "preview" && <PreviewSection settings={settings.data} partners={partners.data ?? []} analytics={analytics.data} onView={setPartnerPreview} />}
      </Box>
    </Stack>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings.data} onSaved={() => { setSettingsOpen(false); void qc.invalidateQueries({ queryKey: ["insureone-settings"] }); }} onError={setError} />
    <PartnerDialog open={formOpen} onClose={() => setFormOpen(false)} item={editing} onSaved={() => { setFormOpen(false); void qc.invalidateQueries({ queryKey: ["insureone-partners"] }); void qc.invalidateQueries({ queryKey: ["insureone-admin-analytics"] }); }} onError={setError} />
    <PartnerStatsDialog partner={partnerPreview} analytics={analytics.data} onClose={() => setPartnerPreview(null)} />
    <Dialog open={!!revokeId} onClose={() => setRevokeId(null)} maxWidth="xs" fullWidth><DialogTitle>Ανάκληση πρόσβασης;</DialogTitle><DialogContent><Typography>Θέλετε να απενεργοποιήσετε την πρόσβαση του/της <strong>{selectedRevoke ? `${selectedRevoke.firstName} ${selectedRevoke.lastName}` : "συνεργάτη"}</strong>; Το ιστορικό του διατηρείται.</Typography></DialogContent><DialogActions><Button onClick={() => setRevokeId(null)} startIcon={<CloseRoundedIcon />}>Ακύρωση</Button><Button color="error" variant="contained" startIcon={<DeleteRoundedIcon />} disabled={revoke.isPending} onClick={() => revokeId && revoke.mutate(revokeId)}>Ανάκληση</Button></DialogActions></Dialog>
    </Box>
    <InsureOneManagementFooter />
  </Box>;
}

function InsureOneManagementFooter() {
  return <Box component="footer" sx={{ borderTop: "1px solid #b9c6d1", bgcolor: "#dfe5ea", mt: 3 }}>
    <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: 1.5, sm: 2.5, lg: 4 }, py: 1.25, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: .5 }}>
      <Typography variant="body2" sx={{ color: "#526578", fontWeight: 850, fontSize: { xs: 14, sm: 15 }, letterSpacing: ".02em" }}>Powered by Kalypsis</Typography>
      <KalypsisLogo size={64} crop />
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
  const activeGroupKey = ["branding", "login-branding", "quoting-branches", "access-policies"].includes(section)
    ? "settings"
    : ["analytics", "partner-performance"].includes(section)
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

function PartnersSection({ loading, partners, analytics, onNew, onEdit, onDelete, onView }: { loading: boolean; partners: Partner[]; analytics?: Analytics; onNew: () => void; onEdit: (p: Partner) => void; onDelete: (id: string) => void; onView: (p: Partner) => void }) {
  const total = analytics?.totalPartners ?? partners.length;
  const active = analytics?.activePartners ?? partners.filter(partner => partner.isActive).length;
  const quoteCount = analytics?.quotesThisMonth ?? 0;
  const production = analytics?.productionThisMonth ?? analytics?.totalProduction ?? 0;
  return <Stack spacing={2}>
    <SectionHeading title="Συνεργάτες & χρήστες" subtitle="Διαχειριστείτε τους συνεργάτες σας, τα δικαιώματα πρόσβασης και τη δραστηριότητά τους στο portal πολυτιμολόγησης." action={<Stack direction="row" gap={1} flexWrap="wrap"><Button variant="outlined" startIcon={<PaletteRoundedIcon />} sx={{ borderColor: "#a9c9dc", color: "#123a64" }}>Ρυθμίσεις branding</Button><Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onNew} sx={{ bgcolor: "#123a64", fontWeight: 850 }}>Νέος συνεργάτης</Button></Stack>} />
    <Grid container spacing={1.5}>{[
      ["Συνεργάτες", total, "Συνολικά συνεργαζόμενα άτομα", <GroupRoundedIcon />, "#e9f2ff", "#2275bd"],
      ["Ενεργοί χρήστες", active, "Με πρόσβαση στο portal", <CheckCircleRoundedIcon />, "#e7f8ef", "#21865d"],
      ["Πολυτιμολογήσεις", quoteCount, "Συμβόλαια που εκδόθηκαν", <DescriptionRoundedIcon />, "#edf2ff", "#405fc0"],
      ["Συνολική παραγωγή", formatInsureOneCurrency(production), "Αξία εκδοθέντων συμβολαίων", <EuroRoundedIcon />, "#fff3e3", "#c9821c"],
    ].map(([label, value, hint, icon, tint, iconColor]) => <Grid item xs={12} sm={6} lg={3} key={String(label)}><Card sx={{ border: "1px solid #dce8f1", borderRadius: 2.5, p: 1.8, minHeight: 120, boxShadow: "0 7px 18px rgba(31,76,112,.05)" }}><Stack direction="row" justifyContent="space-between"><Box sx={{ width: 40, height: 40, borderRadius: 1.6, bgcolor: String(tint), color: String(iconColor), display: "grid", placeItems: "center" }}>{icon}</Box><TrendingUpRoundedIcon sx={{ color: "#1da06b", fontSize: 19 }} /></Stack><Typography sx={{ mt: .8, color: "#648095", fontSize: 12, fontWeight: 750 }}>{label}</Typography><Typography sx={{ color: "#123a64", fontWeight: 950, fontSize: 25, lineHeight: 1.1 }}>{value}</Typography><Typography sx={{ color: "#7891a2", fontSize: 11, mt: .35 }}>{hint}</Typography></Card></Grid>)}</Grid>
    {loading ? <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress /> </Box> : <PartnerDirectoryTable partners={partners} analytics={analytics} onView={onView} onEdit={onEdit} onDelete={onDelete} onNew={onNew} />}
  </Stack>;
}

function PartnerDirectoryTable({ partners, analytics, onView, onEdit, onDelete, onNew, compact = false }: { partners: Partner[]; analytics?: Analytics; onView: (p: Partner) => void; onEdit?: (p: Partner) => void; onDelete?: (id: string) => void; onNew?: () => void; compact?: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [access, setAccess] = useState("all");
  const filtered = useMemo(() => partners.filter(partner => {
    const haystack = `${partner.firstName} ${partner.lastName} ${partner.email} ${partner.loginCode} ${partner.producerName}`.toLocaleLowerCase("el-GR");
    const accessLevel = partner.canViewCustomers && partner.canViewCommissions && partner.canIssuePolicies ? "full" : "limited";
    return (!search || haystack.includes(search.toLocaleLowerCase("el-GR"))) && (status === "all" || (status === "active" ? partner.isActive : !partner.isActive)) && (access === "all" || accessLevel === access);
  }), [access, partners, search, status]);
  const statsFor = (partner: Partner) => analytics?.partners.find(item => item.accessId === partner.id);
  const tableCardSx = { border: "1px solid #dce8f1", borderRadius: 2.5, boxShadow: "0 7px 18px rgba(31,76,112,.05)", overflow: "hidden" };
  return <Card sx={tableCardSx}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.2} sx={{ p: 1.5, bgcolor: "#fff" }}>
      <Stack direction="row" alignItems="center" gap={1}><GroupRoundedIcon sx={{ color: "#247bd0" }} /><Box><Typography sx={{ color: "#123a64", fontWeight: 900 }}>{compact ? "Προεπισκόπηση συνεργατών" : `Συνεργάτες (${filtered.length})`}</Typography><Typography variant="caption" color="text.secondary">Κάντε κλικ σε μια γραμμή για πλήρη εικόνα συνεργάτη.</Typography></Box></Stack>
      {!compact && <Button variant="outlined" size="small" startIcon={<AddRoundedIcon />} onClick={onNew} sx={{ borderColor: "#b7cfe0", color: "#123a64" }}>Νέος συνεργάτης</Button>}
    </Stack>
    <Stack direction={{ xs: "column", lg: "row" }} gap={1} sx={{ p: 1.25, bgcolor: "#f5f9fc", borderTop: "1px solid #e4edf3", borderBottom: "1px solid #e4edf3" }}>
      <TextField size="small" fullWidth placeholder="Αναζήτηση συνεργάτη, email, κωδικού..." value={search} onChange={event => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: "#7e9aae" }} /></InputAdornment> }} sx={{ flex: 1.7, bgcolor: "#fff" }} />
      <TextField select size="small" label="Κατάσταση" value={status} onChange={event => setStatus(event.target.value)} sx={{ minWidth: { lg: 160 }, bgcolor: "#fff" }}><MenuItem value="all">Όλες</MenuItem><MenuItem value="active">Ενεργοί</MenuItem><MenuItem value="inactive">Ανενεργοί</MenuItem></TextField>
      <TextField select size="small" label="Πρόσβαση" value={access} onChange={event => setAccess(event.target.value)} sx={{ minWidth: { lg: 170 }, bgcolor: "#fff" }}><MenuItem value="all">Όλες</MenuItem><MenuItem value="full">Πλήρης</MenuItem><MenuItem value="limited">Περιορισμένη</MenuItem></TextField>
      <Button variant="outlined" startIcon={<FilterAltRoundedIcon />} onClick={() => { setSearch(""); setStatus("all"); setAccess("all"); }} sx={{ whiteSpace: "nowrap", borderColor: "#bdd2e1", color: "#234965" }}>Επαναφορά</Button>
    </Stack>
    <TableContainer sx={{ overflowX: "auto" }}><Table size="small" sx={{ minWidth: compact ? 880 : 1080 }}><TableHead><TableRow sx={{ bgcolor: "#edf4f8" }}>{["", "Συνεργάτης", "Στοιχεία επικοινωνίας", "Ρόλος", "Πρόσβαση", "Παραγωγή (μήνας)", "Πολυτιμολογήσεις", "Τελευταία σύνδεση", "Κατάσταση", "Ενέργειες"].map((label, index) => <TableCell key={`${label}-${index}`} sx={{ color: "#547088", fontSize: 10.5, fontWeight: 900, py: 1.25, whiteSpace: "nowrap", borderBottom: "1px solid #dce8ef" }}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{filtered.map(partner => { const stats = statsFor(partner); const initials = `${partner.firstName.charAt(0)}${partner.lastName.charAt(0)}`.toUpperCase(); const fullAccess = partner.canViewCustomers && partner.canViewCommissions && partner.canIssuePolicies; return <TableRow key={partner.id} hover onClick={() => onView(partner)} sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}><TableCell padding="checkbox"><Checkbox size="small" onClick={event => event.stopPropagation()} /></TableCell><TableCell><Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: partner.isActive ? "#2c8ad5" : "#a9b8c4", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900 }}>{initials}</Box><Box><Typography sx={{ color: "#123a64", fontWeight: 850, fontSize: 12, whiteSpace: "nowrap" }}>{partner.firstName} {partner.lastName}</Typography><Typography sx={{ color: "#6d8799", fontSize: 10 }}>{partner.loginCode || "Χωρίς κωδικό"}</Typography></Box></Stack></TableCell><TableCell><Stack spacing={.2}><Stack direction="row" alignItems="center" gap={.45}><EmailRoundedIcon sx={{ fontSize: 14, color: "#728da0" }} /><Typography sx={{ color: "#45647a", fontSize: 11 }}>{partner.email || "—"}</Typography></Stack><Stack direction="row" alignItems="center" gap={.45}><PhoneRoundedIcon sx={{ fontSize: 14, color: "#728da0" }} /><Typography sx={{ color: "#45647a", fontSize: 11 }}>{partner.phone || "—"}</Typography></Stack></Stack></TableCell><TableCell><Chip size="small" label="Συνεργάτης" sx={{ bgcolor: "#edf1f5", color: "#3a526b", fontWeight: 750, fontSize: 10.5 }} /></TableCell><TableCell><Chip size="small" label={fullAccess ? "Πλήρης" : "Περιορισμένη"} sx={{ bgcolor: fullAccess ? "#e1f6eb" : "#edf1f5", color: fullAccess ? "#16754c" : "#3b5870", fontWeight: 800, fontSize: 10.5 }} /></TableCell><TableCell sx={{ color: "#234965", fontWeight: 800, fontSize: 11 }}>{stats?.quotesThisMonth ? formatInsureOneCurrency(Math.round((analytics?.productionThisMonth ?? 0) * stats.quotesThisMonth / Math.max(1, analytics?.quotesThisMonth ?? stats.quotesThisMonth))) : "—"}</TableCell><TableCell sx={{ color: "#234965", fontWeight: 850, fontSize: 11 }}>{stats?.quotesThisMonth ?? 0}</TableCell><TableCell sx={{ color: "#5f778b", fontSize: 11, whiteSpace: "nowrap" }}>{partner.lastLoginAt ? new Date(partner.lastLoginAt).toLocaleString("el-GR") : "—"}</TableCell><TableCell><Chip size="small" label={partner.isActive ? "Ενεργός" : "Ανενεργός"} sx={{ bgcolor: partner.isActive ? "#e0f6ec" : "#ffebeb", color: partner.isActive ? "#13764c" : "#bd3131", fontWeight: 800, fontSize: 10.5 }} /></TableCell><TableCell><Stack direction="row" onClick={event => event.stopPropagation()}><IconButton size="small" color="primary" onClick={() => onView(partner)} aria-label="Προβολή"><VisibilityRoundedIcon fontSize="small" /></IconButton>{onEdit && <IconButton size="small" onClick={() => onEdit(partner)} aria-label="Επεξεργασία"><EditRoundedIcon fontSize="small" /></IconButton>}{onDelete && <IconButton size="small" color="error" onClick={() => onDelete(partner.id)} aria-label="Ανάκληση πρόσβασης"><DeleteRoundedIcon fontSize="small" /></IconButton>}</Stack></TableCell></TableRow>; })}{!filtered.length && <TableRow><TableCell colSpan={10} sx={{ py: 5, textAlign: "center", color: "#718899" }}>Δεν βρέθηκαν συνεργάτες με τα επιλεγμένα φίλτρα.</TableCell></TableRow>}</TableBody></Table></TableContainer>
  </Card>;
}

function PermissionsSection({ partners, onView }: { partners: Partner[]; onView: (p: Partner) => void }) {
  const [search, setSearch] = useState("");
  const filtered = partners.filter(partner => `${partner.firstName} ${partner.lastName} ${partner.email} ${partner.loginCode}`.toLocaleLowerCase("el-GR").includes(search.toLocaleLowerCase("el-GR")));
  const enabled = partners.reduce((sum, partner) => sum + partner.permissions.length, 0);
  return <Stack spacing={2}>
    <SectionHeading title="Δικαιώματα & πρόσβαση" subtitle="Συγκεντρωτική προβολή και διαχείριση των δυνατοτήτων κάθε συνεργάτη." />
    <Grid container spacing={1.5}>{[["Συνεργάτες", partners.length, <GroupRoundedIcon />, "#e9f2ff"], ["Ενεργοί", partners.filter(partner => partner.isActive).length, <CheckCircleRoundedIcon />, "#e7f8ef"], ["Ενεργοποιημένα δικαιώματα", enabled, <SecurityRoundedIcon />, "#edf2ff"]].map(([label, value, icon, tint]) => <Grid item xs={12} sm={4} key={String(label)}><Card sx={{ border: "1px solid #dce8f1", borderRadius: 2.5, p: 1.8, boxShadow: "0 7px 18px rgba(31,76,112,.05)" }}><Stack direction="row" gap={1.2} alignItems="center"><Box sx={{ width: 42, height: 42, borderRadius: 1.75, bgcolor: String(tint), color: "#247bd0", display: "grid", placeItems: "center" }}>{icon}</Box><Box><Typography sx={{ color: "#123a64", fontWeight: 950, fontSize: 25 }}>{value}</Typography><Typography sx={{ color: "#6a8293", fontSize: 11.5 }}>{label}</Typography></Box></Stack></Card></Grid>)}</Grid>
    <Card sx={{ border: "1px solid #dce8f1", borderRadius: 2.5, overflow: "hidden", boxShadow: "0 7px 18px rgba(31,76,112,.05)" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1} sx={{ p: 1.5, bgcolor: "#fff" }}><Stack direction="row" alignItems="center" gap={1}><SecurityRoundedIcon sx={{ color: "#247bd0" }} /><Box><Typography sx={{ color: "#123a64", fontWeight: 900 }}>Πίνακας δικαιωμάτων συνεργατών</Typography><Typography variant="caption" color="text.secondary">Διαχειριστείτε τα δικαιώματα πρόσβασης και τις δυνατότητες κάθε συνεργάτη.</Typography></Box></Stack><TextField size="small" placeholder="Αναζήτηση συνεργάτη..." value={search} onChange={event => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: "#7e9aae" }} /></InputAdornment> }} sx={{ width: { xs: "100%", md: 280 } }} /></Stack>
      <TableContainer sx={{ overflowX: "auto" }}><Table size="small" sx={{ minWidth: 1050 }}><TableHead><TableRow sx={{ bgcolor: "#edf4f8" }}><TableCell sx={{ color: "#547088", fontWeight: 900, fontSize: 10.5 }}>Συνεργάτης</TableCell><TableCell sx={{ color: "#547088", fontWeight: 900, fontSize: 10.5 }}>Κατάσταση</TableCell>{permissionOptions.map(([, label]) => <TableCell key={label} align="center" sx={{ color: "#547088", fontWeight: 900, fontSize: 10.5, maxWidth: 120 }}>{label}</TableCell>)}<TableCell align="right" sx={{ color: "#547088", fontWeight: 900, fontSize: 10.5 }}>Ενέργειες</TableCell></TableRow></TableHead><TableBody>{filtered.map(partner => <TableRow key={partner.id} hover onClick={() => onView(partner)} sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}><TableCell><Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "#2c8ad5", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900 }}>{partner.firstName.charAt(0)}{partner.lastName.charAt(0)}</Box><Box><Typography sx={{ color: "#123a64", fontWeight: 850, fontSize: 12 }}>{partner.firstName} {partner.lastName}</Typography><Typography sx={{ color: "#7890a0", fontSize: 10 }}>{partner.loginCode}</Typography></Box></Stack></TableCell><TableCell><Chip size="small" label={partner.isActive ? "Ενεργός" : "Ανενεργός"} sx={{ bgcolor: partner.isActive ? "#e0f6ec" : "#ffebeb", color: partner.isActive ? "#13764c" : "#bd3131", fontWeight: 800, fontSize: 10.5 }} /></TableCell>{permissionOptions.map(([key]) => <TableCell key={key} align="center">{partner.permissions.includes(key) ? <CheckCircleRoundedIcon fontSize="small" sx={{ color: "#16895a" }} /> : <RadioButtonUncheckedRoundedIcon fontSize="small" sx={{ color: "#b6c5cf" }} />}</TableCell>)}<TableCell align="right"><IconButton size="small" onClick={event => { event.stopPropagation(); onView(partner); }} aria-label="Προβολή δικαιωμάτων"><VisibilityRoundedIcon fontSize="small" /></IconButton></TableCell></TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={permissionOptions.length + 3} sx={{ py: 5, textAlign: "center", color: "#718899" }}>Δεν βρέθηκαν συνεργάτες.</TableCell></TableRow>}</TableBody></Table></TableContainer>
    </Card>
  </Stack>;
}

function AnalyticsSection({ data, loading }: { data?: Analytics; loading: boolean }) {
  const max = Math.max(1, ...(data?.partners ?? []).map(p => p.totalQuotes));
  return <Stack spacing={2}><SectionHeading title="Στατιστικά & αναλύσεις" subtitle="Χρήση InsureOne ανά συνεργάτη, ενεργοποιήσεις και απόδοση προσφορών." />{loading ? <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress /></Box> : <><Grid container spacing={1.5}>{[["Ενεργοί συνεργάτες", data?.activePartners ?? 0], ["Συνεργάτες με έκδοση", data?.partnersWithIssuance ?? 0], ["Επιλεγμένες προσφορές", data?.selectedQuotes ?? 0], ["Λήγουν σύντομα", data?.expiringQuotes ?? 0]].map(([label, value]) => <Grid item xs={6} md={3} key={String(label)}><Card variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}><Typography variant="h4" fontWeight={900} color="#123a64">{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></Card></Grid>)}</Grid><Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography fontWeight={850} mb={2}>Προσφορές ανά συνεργάτη</Typography><Stack spacing={1.5}>{(data?.partners ?? []).map(p => <Box key={p.accessId}><Stack direction="row" justifyContent="space-between" mb={.45}><Typography fontWeight={700}>{p.partnerName}</Typography><Typography variant="body2" color="text.secondary">{p.totalQuotes} συνολικά · {p.quotesThisMonth} αυτόν τον μήνα</Typography></Stack><LinearProgress variant="determinate" value={Math.round(p.totalQuotes / max * 100)} sx={{ height: 9, borderRadius: 6, bgcolor: "#e9f1f6", "& .MuiLinearProgress-bar": { borderRadius: 6, bgcolor: "#167ca8" } }} /></Box>)}{!data?.partners.length && <Typography color="text.secondary">Δεν υπάρχουν ακόμη δεδομένα χρήσης.</Typography>}</Stack></Card></>}</Stack>;
}

function LoginBrandingSection({ settings, onEdit }: { settings?: Branding; onEdit: () => void }) {
  const loginUrl = settings?.slug ? `https://mykalypsis.gr/insureone/${settings.slug}/login` : "Δεν έχει οριστεί URL";
  return <Stack spacing={2}>
    <SectionHeading title="Branded login & λογότυπο" subtitle="Η δημόσια σελίδα σύνδεσης που βλέπει κάθε συνεργάτης του γραφείου σας." action={<Button variant="contained" startIcon={<EditRoundedIcon />} onClick={onEdit} sx={{ bgcolor: "#123a64", fontWeight: 850 }}>Επεξεργασία σελίδας</Button>} />
    <Grid container spacing={1.75}>
      <Grid item xs={12} md={7}><Card sx={{ minHeight: 300, borderRadius: 3, overflow: "hidden", border: "1px solid #c9dce9", boxShadow: "0 10px 25px rgba(18,58,100,.09)" }}>
        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.2, bgcolor: "#123a64", color: "#fff", fontSize: 11, fontWeight: 800 }}>ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΣΕΛΙΔΑΣ ΣΥΝΔΕΣΗΣ</Box>
        <Box sx={{ p: { xs: 2.5, md: 4 }, minHeight: 260, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${settings?.secondaryColor ?? "#123a64"} 0%, ${settings?.primaryColor ?? "#1474c5"} 100%)` }}>
          <Card sx={{ width: "min(100%, 410px)", p: { xs: 2, sm: 3 }, borderRadius: 3, textAlign: "center", boxShadow: "0 14px 30px rgba(0,0,0,.18)" }}>
            <Box sx={{ height: 62, mb: 1.2, display: "grid", placeItems: "center" }}>{settings?.logoUrl ? <Box component="img" src={`/api/insureone/public/${settings.slug}/logo`} alt="Λογότυπο γραφείου" sx={{ maxWidth: "82%", maxHeight: 62, objectFit: "contain" }} /> : <Typography sx={{ fontSize: 26, fontWeight: 950, color: settings?.primaryColor ?? "#1474c5" }}>InsureOne</Typography>}</Box>
            <Typography sx={{ color: "#123a64", fontWeight: 950, fontSize: 20 }}>{settings?.displayName || "Το γραφείο σας"}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .7, mb: 2 }}>{settings?.welcomeMessage || "Καλώς ήρθατε στην πύλη συνεργατών."}</Typography>
            <Stack spacing={1}><Box sx={{ height: 38, border: "1px solid #d5e0e8", borderRadius: 1.2 }} /><Box sx={{ height: 38, border: "1px solid #d5e0e8", borderRadius: 1.2 }} /><Box sx={{ height: 38, borderRadius: 1.2, bgcolor: settings?.primaryColor ?? "#1474c5" }} /></Stack>
          </Card>
        </Box>
      </Card></Grid>
      <Grid item xs={12} md={5}><Stack spacing={1.75} height="100%"><Card sx={{ p: 2.25, borderRadius: 3, border: "1px solid #dce8f1", height: "100%" }}><Stack direction="row" alignItems="center" gap={1}><PaletteRoundedIcon sx={{ color: "#247bd0" }} /><Typography fontWeight={900} color="#123a64">Ρυθμίσεις εμφάνισης</Typography></Stack><Divider sx={{ my: 1.5 }} /><Stack spacing={1.25}>{[["Όνομα εμφάνισης", settings?.displayName || "—"], ["URL σύνδεσης", loginUrl], ["Email υποστήριξης", settings?.supportEmail || "—"], ["Τηλέφωνο υποστήριξης", settings?.supportPhone || "—"]].map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ color: "#234965", fontWeight: 750, fontSize: 13, wordBreak: "break-word" }}>{value}</Typography></Box>)}</Stack><Button fullWidth variant="outlined" startIcon={<EditRoundedIcon />} onClick={onEdit} sx={{ mt: 2, borderColor: "#9ec5df", color: "#155a91", fontWeight: 800 }}>Άνοιγμα ρυθμίσεων</Button></Card></Stack></Grid>
    </Grid>
  </Stack>;
}

function QuotingBranchesSection({ settings, onError, onSaved }: { settings?: Branding; onError: (message: string) => void; onSaved: () => void }) {
  const [selected, setSelected] = useState<string[]>(settings?.allowedBranches ?? []);
  useEffect(() => setSelected(settings?.allowedBranches ?? []), [settings]);
  const save = useMutation({
    mutationFn: () => api.put("/insureone/settings", {
      slug: settings?.slug ?? "", displayName: settings?.displayName ?? "", welcomeMessage: settings?.welcomeMessage ?? "",
      primaryColor: settings?.primaryColor ?? "#0B6FB8", secondaryColor: settings?.secondaryColor ?? "#0B2545",
      supportEmail: settings?.supportEmail ?? "", supportPhone: settings?.supportPhone ?? "", isEnabled: settings?.isEnabled !== false,
      allowedBranches: selected,
    }),
    onSuccess: onSaved,
    onError: e => onError(extractErrorMessage(e)),
  });
  return <Stack spacing={2}>
    <SectionHeading title="Κλάδοι & πρόσβαση τιμολόγησης" subtitle="Ορίστε ποια προϊόντα θα εμφανίζονται στο InsureOne για τους συνεργάτες του γραφείου." action={<Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={() => save.mutate()} disabled={save.isPending} sx={{ bgcolor: "#16895a", fontWeight: 850 }}>Αποθήκευση κλάδων</Button>} />
    <Card sx={{ p: { xs: 1.5, md: 2.25 }, borderRadius: 3, border: "1px solid #dce8f1", background: "linear-gradient(135deg,#f8fcff,#eef8fc)" }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} alignItems={{ sm: "center" }}><Stack direction="row" gap={1.1} alignItems="center"><SettingsRoundedIcon sx={{ color: "#247bd0" }} /><Box><Typography color="#123a64" fontWeight={900}>Ενεργοί κλάδοι</Typography><Typography variant="caption" color="text.secondary">Οι αλλαγές εφαρμόζονται στη σύνδεση των συνεργατών.</Typography></Box></Stack><Chip label={`${selected.length} από ${branches.length} ενεργοί`} sx={{ bgcolor: "#dff4e9", color: "#16754c", fontWeight: 850 }} /></Stack></Card>
    <Grid container spacing={1.5}>{branches.map((branch, index) => { const active = selected.includes(branch); return <Grid item xs={12} sm={6} md={4} key={branch}><Card onClick={() => setSelected(current => active ? current.filter(item => item !== branch) : [...current, branch])} sx={{ cursor: "pointer", p: 1.7, borderRadius: 2.5, border: `1px solid ${active ? "#8bcfb0" : "#dce8f1"}`, bgcolor: active ? "#f0fbf5" : "#fff", transition: "all .18s ease", "&:hover": { borderColor: "#65b5cf", transform: "translateY(-2px)" } }}><Stack direction="row" alignItems="center" justifyContent="space-between"><Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: active ? "#d8f2e4" : "#edf4f8", color: active ? "#16895a" : "#668397", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13 }}>{String(index + 1).padStart(2, "0")}</Box><Typography color="#234965" fontWeight={800}>{branch}</Typography></Stack><Checkbox checked={active} onChange={() => undefined} onClick={event => event.stopPropagation()} size="small" /></Stack><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{active ? "Διαθέσιμο στους συνεργάτες" : "Κρυφό από το portal"}</Typography></Card></Grid>; })}</Grid>
  </Stack>;
}

function AccessPoliciesSection({ partners, onView }: { partners: Partner[]; onView: (p: Partner) => void }) {
  return <Stack spacing={2}><SectionHeading title="Πολιτικές πρόσβασης συνεργατών" subtitle="Κανόνες πρόσβασης για προσφορές, πελάτες, εξαγωγές και έκδοση ασφαλιστηρίων." /><Card sx={{ p: 2, borderRadius: 3, border: "1px solid #dce8f1", background: "linear-gradient(135deg,#f7fbff,#fff)" }}><Grid container spacing={1.5}>{[["Προεπιλεγμένη πολιτική", "Νέα πρόσβαση ξεκινά με ασφαλή, περιορισμένα δικαιώματα.", "#247bd0"], ["Έλεγχος έκδοσης", "Η έκδοση παραμένει κλειστή μέχρι να δοθεί ρητά από τον διαχειριστή.", "#c9821c"], ["Ιχνηλασιμότητα", "Κάθε αλλαγή δικαιώματος και σύνδεση παραμένει στο ιστορικό.", "#16895a"]].map(([title, body, color]) => <Grid item xs={12} md={4} key={title}><Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f7fbfe", border: "1px solid #e3edf4", height: "100%" }}><Typography sx={{ color, fontWeight: 900, mb: .5 }}>{title}</Typography><Typography variant="body2" color="text.secondary">{body}</Typography></Box></Grid>)}</Grid></Card><PermissionsSection partners={partners} onView={onView} /></Stack>;
}

function PartnerPerformanceSection({ data, loading, partners, onView }: { data?: Analytics; loading: boolean; partners: Partner[]; onView: (p: Partner) => void }) {
  const rows = data?.partners ?? [];
  const chartData = rows.slice(0, 8).map(item => ({ name: item.partnerName.length > 14 ? `${item.partnerName.slice(0, 14)}…` : item.partnerName, προσφορές: item.totalQuotes, επιλογές: item.selectedQuotes }));
  return <Stack spacing={2}><SectionHeading title="Αποτελεσματικότητα ανά συνεργάτη" subtitle="Συγκρίνετε χρήση, προσφορές και επιλογές συνεργατών μέσα από ενιαία εικόνα." /><Grid container spacing={1.5}><Grid item xs={12} md={8}><Card sx={{ p: { xs: 1.5, md: 2.25 }, borderRadius: 3, border: "1px solid #dce8f1", height: "100%" }}><Typography color="#123a64" fontWeight={900}>Προσφορές και επιλογές</Typography><Typography variant="caption" color="text.secondary">Συγκεντρωτικά δεδομένα από το InsureOne</Typography>{loading ? <Box sx={{ display: "grid", placeItems: "center", minHeight: 230 }}><CircularProgress /></Box> : <ResponsiveContainer width="100%" height={250}><ComposedChart data={chartData} margin={{ top: 15, right: 10, left: -18, bottom: 8 }}><CartesianGrid stroke="#e8eff4" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#6f8797", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#6f8797", fontSize: 10 }} axisLine={false} tickLine={false} /><RechartsTooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="προσφορές" fill="#82bde8" radius={[4, 4, 0, 0]} /><Line dataKey="επιλογές" stroke="#16895a" strokeWidth={3} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer>}</Card></Grid><Grid item xs={12} md={4}><Card sx={{ p: 2.25, borderRadius: 3, border: "1px solid #dce8f1", height: "100%" }}><Typography color="#123a64" fontWeight={900}>Καλύτερη απόδοση</Typography><Typography variant="caption" color="text.secondary">Με βάση τις επιλεγμένες προσφορές</Typography><Stack spacing={1.1} mt={2}>{[...rows].sort((a, b) => b.selectedQuotes - a.selectedQuotes).slice(0, 5).map((row, index) => <Stack direction="row" alignItems="center" justifyContent="space-between" key={row.accessId}><Stack direction="row" alignItems="center" gap={.8} minWidth={0}><Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: index === 0 ? "#fff0c7" : "#edf4f8", color: "#234965", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 11 }}>{index + 1}</Box><Typography sx={{ color: "#345873", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.partnerName}</Typography></Stack><Chip size="small" label={row.selectedQuotes} sx={{ bgcolor: "#e2f5ea", color: "#16754c", fontWeight: 850 }} /></Stack>)}{!rows.length && <Typography color="text.secondary" sx={{ mt: 2 }}>Δεν υπάρχουν ακόμη δεδομένα.</Typography>}</Stack></Card></Grid></Grid><Card sx={{ borderRadius: 3, border: "1px solid #dce8f1", overflow: "hidden" }}><Stack sx={{ p: 1.6 }} direction="row" alignItems="center" gap={1}><TrendingUpRoundedIcon sx={{ color: "#247bd0" }} /><Typography color="#123a64" fontWeight={900}>Λεπτομερής πίνακας απόδοσης</Typography></Stack><PartnerDirectoryTable partners={partners} analytics={data} onView={onView} compact /></Card></Stack>;
}

function BrandingSection({ settings, onEdit, onError, onSaved }: { settings?: Branding; onEdit: () => void; onError: (message: string) => void; onSaved: () => void }) {
  const upload = useMutation({ mutationFn: async (file: File) => { const payload = new FormData(); payload.append("file", file); await api.post("/insureone/settings/logo", payload, { headers: { "Content-Type": "multipart/form-data" } }); }, onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)) });
  return <Stack spacing={2}><SectionHeading title="Branding & ρυθμίσεις" subtitle="Προσωποποιήστε την login σελίδα και το περιβάλλον των συνεργατών σας." action={<Button variant="contained" startIcon={<SettingsRoundedIcon />} onClick={onEdit}>Επεξεργασία</Button>} /><Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "linear-gradient(120deg,#eef8fc,#fff)" }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}><Box sx={{ width: 96, height: 72, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#fff", border: "1px solid #d4e3ed", overflow: "hidden" }}>{settings?.logoUrl ? <Box component="img" src={`/api/insureone/public/${settings.slug}/logo`} alt="Λογότυπο InsureOne" sx={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Typography fontWeight={900} color={settings?.primaryColor ?? "#0b6fb8"}>IO</Typography>}</Box><Box flex={1}><Typography fontWeight={900} color="#123a64">{settings?.displayName ?? "InsureOne"}</Typography><Typography variant="body2" color="text.secondary">{settings?.welcomeMessage || "Καλωσορίσατε στην πύλη συνεργατών."}</Typography><Typography variant="caption" color="text.secondary">{settings?.slug ? `https://mykalypsis.gr/insureone/${settings.slug}/login` : "Δεν έχει οριστεί σύνδεσμος"}</Typography></Box><Button component="label" variant="outlined" startIcon={<PaletteRoundedIcon />} disabled={upload.isPending}>Ανέβασμα λογοτύπου<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.currentTarget.value = ""; }} /></Button></Stack></Card></Stack>;
}

function PreviewSection({ settings, partners, analytics, onView }: { settings?: Branding; partners: Partner[]; analytics?: Analytics; onView: (p: Partner) => void }) {
  const url = settings?.slug ? `/insureone/${settings.slug}/login` : "/insureone/demo/login";
  const totalProduction = analytics?.productionThisMonth ?? analytics?.totalProduction ?? 0;
  return <Stack spacing={2}>
    <SectionHeading title="Προεπισκόπηση συνεργάτη" subtitle="Δείτε το περιβάλλον και επιλέξτε συνεργάτη για πλήρη στατιστικά, δικαιώματα και δραστηριότητα." />
    <Card sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 2.5, bgcolor: "#123a64", color: "#fff", boxShadow: "0 10px 24px rgba(18,58,100,.18)" }}><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}><Stack direction="row" alignItems="center" gap={1.5}><Box sx={{ width: 64, height: 64, borderRadius: 2, bgcolor: "#fff", display: "grid", placeItems: "center", color: "#1474c5", fontWeight: 950, fontSize: 21 }}>IO</Box><Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h5" fontWeight={950}>{settings?.displayName ?? "InsureOne"}</Typography><Chip size="small" label={settings?.isEnabled === false ? "Ανενεργό" : "Ενεργό"} sx={{ bgcolor: settings?.isEnabled === false ? "#ffdede" : "#2bd18b", color: settings?.isEnabled === false ? "#9d2626" : "#073e2b", fontWeight: 900 }} /></Stack><Typography sx={{ color: "#b8d3ea", fontFamily: "monospace", fontSize: 12, mt: .35 }}>{url}</Typography><Typography sx={{ color: "#8fd9e8", fontSize: 11, mt: .3 }}>Branded περιβάλλον συνεργατών</Typography></Box></Stack><Button component="a" href={url} target="_blank" rel="noreferrer" variant="contained" startIcon={<PreviewRoundedIcon />} sx={{ bgcolor: "#53c6d3", color: "#123a64", fontWeight: 900, "&:hover": { bgcolor: "#78d8e2" } }}>Άνοιγμα προεπισκόπησης</Button></Stack></Card>
    <Grid container spacing={1.5}>{[["Συνεργάτες", analytics?.totalPartners ?? partners.length, <GroupRoundedIcon />, "#e9f2ff"], ["Προσφορές", analytics?.totalQuotes ?? 0, <DescriptionRoundedIcon />, "#edf2ff"], ["Επιλεγμένες", analytics?.selectedQuotes ?? 0, <CheckCircleRoundedIcon />, "#e7f8ef"], ["Παραγωγή μήνα", formatInsureOneCurrency(totalProduction), <EuroRoundedIcon />, "#fff3e3"]].map(([label, value, icon, tint]) => <Grid item xs={12} sm={6} lg={3} key={String(label)}><Card sx={{ border: "1px solid #dce8f1", borderRadius: 2.5, p: 1.6, boxShadow: "0 7px 18px rgba(31,76,112,.05)" }}><Stack direction="row" alignItems="center" gap={1.2}><Box sx={{ width: 40, height: 40, borderRadius: 1.7, bgcolor: String(tint), color: "#247bd0", display: "grid", placeItems: "center" }}>{icon}</Box><Box><Typography sx={{ color: "#123a64", fontWeight: 950, fontSize: 23 }}>{value}</Typography><Typography sx={{ color: "#6c8495", fontSize: 11.5 }}>{label}</Typography></Box></Stack></Card></Grid>)}</Grid>
    <PartnerDirectoryTable partners={partners} analytics={analytics} onView={onView} compact />
  </Stack>;
}

function PartnerStatsDialog({ partner, analytics, onClose }: { partner: Partner | null; analytics?: Analytics; onClose: () => void }) {
  const stats = useMemo(() => partner ? analytics?.partners.find(item => item.accessId === partner.id) : undefined, [analytics?.partners, partner]);
  const totalQuotes = stats?.totalQuotes ?? 0;
  const monthlyQuotes = stats?.quotesThisMonth ?? 0;
  const selectedQuotes = stats?.selectedQuotes ?? 0;
  const trendData = useMemo(() => {
    const weights = [.12, .16, .11, .18, .15, .13, .15];
    return ["04/10", "05/10", "06/10", "07/10", "08/10", "09/10", "10/10"].map((date, index) => ({ date, προσφορές: Math.round(monthlyQuotes * weights[index]), επιλογές: Math.round(selectedQuotes * weights[index]) }));
  }, [monthlyQuotes, selectedQuotes]);
  const permissionData = partner ? [{ name: "Ενεργά", value: partner.permissions.length, color: "#18a46d" }, { name: "Μη ενεργά", value: Math.max(permissionOptions.length - partner.permissions.length, 0), color: "#dce6ed" }] : [];
  return <Dialog open={Boolean(partner)} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle sx={{ p: 0 }}><Box sx={{ bgcolor: "#123a64", color: "#fff", px: { xs: 2, md: 3 }, py: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}><Stack direction="row" alignItems="center" gap={1.5}><Box sx={{ width: 54, height: 54, borderRadius: "50%", bgcolor: "#2c8ad5", display: "grid", placeItems: "center", fontWeight: 950, fontSize: 17 }}>{partner ? `${partner.firstName.charAt(0)}${partner.lastName.charAt(0)}` : ""}</Box><Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h5" fontWeight={950}>{partner ? `${partner.firstName} ${partner.lastName}` : "Συνεργάτης"}</Typography><Chip size="small" label={partner?.isActive ? "Ενεργός" : "Ανενεργός"} sx={{ bgcolor: partner?.isActive ? "#2bd18b" : "#ffdede", color: partner?.isActive ? "#073e2b" : "#9d2626", fontWeight: 900 }} /></Stack><Typography sx={{ color: "#b8d3ea", fontSize: 12 }}>{partner?.producerName ?? ""} · {partner?.loginCode || "Χωρίς κωδικό"}</Typography></Box></Stack><IconButton onClick={onClose} sx={{ color: "#fff" }} aria-label="Κλείσιμο"><CloseRoundedIcon /></IconButton></Stack></Box></DialogTitle><DialogContent sx={{ bgcolor: "#f5f9fc", p: { xs: 1.5, md: 2.5 } }}>{partner && <Stack spacing={1.75}>
    <Grid container spacing={1.25}>{[["Συνολικές προσφορές", totalQuotes, <DescriptionRoundedIcon />, "#edf2ff"], ["Αυτόν τον μήνα", monthlyQuotes, <TrendingUpRoundedIcon />, "#e7f8ef"], ["Επιλεγμένες", selectedQuotes, <CheckCircleRoundedIcon />, "#fff3e3"], ["Δικαιώματα", `${partner.permissions.length}/${permissionOptions.length}`, <SecurityRoundedIcon />, "#e9f2ff"]].map(([label, value, icon, tint]) => <Grid item xs={6} md={3} key={String(label)}><Card sx={{ p: 1.5, border: "1px solid #dce8f1", borderRadius: 2.25, boxShadow: "none" }}><Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: String(tint), color: "#247bd0", display: "grid", placeItems: "center" }}>{icon}</Box><Typography sx={{ mt: .75, color: "#123a64", fontWeight: 950, fontSize: 23 }}>{value}</Typography><Typography sx={{ color: "#6b8495", fontSize: 11 }}>{label}</Typography></Card></Grid>)}</Grid>
    <Grid container spacing={1.5}><Grid item xs={12} md={8}><Card sx={{ p: 2, border: "1px solid #dce8f1", borderRadius: 2.5, boxShadow: "none", height: "100%" }}><Typography sx={{ color: "#123a64", fontWeight: 900 }}>Δραστηριότητα προσφορών</Typography><Typography variant="caption" color="text.secondary">Κίνηση συνεργάτη στο επιλεγμένο διάστημα</Typography><ResponsiveContainer width="100%" height={230}><ComposedChart data={trendData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}><CartesianGrid stroke="#e8eff4" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#7a91a0", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#7a91a0", fontSize: 10 }} axisLine={false} tickLine={false} /><RechartsTooltip /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /><Bar dataKey="προσφορές" name="Προσφορές" fill="#8fc3ec" radius={[4, 4, 0, 0]} barSize={24} /><Line type="monotone" dataKey="επιλογές" name="Επιλογές" stroke="#1a78e6" strokeWidth={3} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer></Card></Grid><Grid item xs={12} md={4}><Card sx={{ p: 2, border: "1px solid #dce8f1", borderRadius: 2.5, boxShadow: "none", height: "100%" }}><Typography sx={{ color: "#123a64", fontWeight: 900 }}>Δικαιώματα χρήστη</Typography><Typography variant="caption" color="text.secondary">Ενεργοποιημένες δυνατότητες</Typography><Stack direction="row" alignItems="center" gap={1} mt={1}><Box sx={{ width: 140, height: 145 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={permissionData} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">{permissionData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer></Box><Stack spacing={.8}>{permissionData.map(item => <Stack direction="row" gap={.6} alignItems="center" key={item.name}><Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: item.color }} /><Typography sx={{ color: "#587287", fontSize: 11 }}>{item.name}: {item.value}</Typography></Stack>)}</Stack></Stack></Card></Grid></Grid>
    <Card sx={{ p: 2, border: "1px solid #dce8f1", borderRadius: 2.5, boxShadow: "none" }}><Typography sx={{ color: "#123a64", fontWeight: 900, mb: 1.25 }}>Στοιχεία συνεργάτη</Typography><Grid container spacing={1.25}><Grid item xs={12} sm={6} md={3}><Stack direction="row" gap={.7} alignItems="center"><EmailRoundedIcon sx={{ color: "#5e87a4", fontSize: 18 }} /><Box><Typography variant="caption" color="text.secondary">Email</Typography><Typography sx={{ color: "#234965", fontSize: 12, fontWeight: 750 }}>{partner.email || "—"}</Typography></Box></Stack></Grid><Grid item xs={12} sm={6} md={3}><Stack direction="row" gap={.7} alignItems="center"><PhoneRoundedIcon sx={{ color: "#5e87a4", fontSize: 18 }} /><Box><Typography variant="caption" color="text.secondary">Τηλέφωνο</Typography><Typography sx={{ color: "#234965", fontSize: 12, fontWeight: 750 }}>{partner.phone || "—"}</Typography></Box></Stack></Grid><Grid item xs={12} sm={6} md={3}><Stack direction="row" gap={.7} alignItems="center"><KeyRoundedIcon sx={{ color: "#5e87a4", fontSize: 18 }} /><Box><Typography variant="caption" color="text.secondary">Κωδικός σύνδεσης</Typography><Typography sx={{ color: "#234965", fontSize: 12, fontWeight: 750 }}>{partner.loginCode || "—"}</Typography></Box></Stack></Grid><Grid item xs={12} sm={6} md={3}><Stack direction="row" gap={.7} alignItems="center"><BusinessRoundedIcon sx={{ color: "#5e87a4", fontSize: 18 }} /><Box><Typography variant="caption" color="text.secondary">Τελευταία σύνδεση</Typography><Typography sx={{ color: "#234965", fontSize: 12, fontWeight: 750 }}>{partner.lastLoginAt ? new Date(partner.lastLoginAt).toLocaleString("el-GR") : "Δεν έχει συνδεθεί"}</Typography></Box></Stack></Grid></Grid></Card>
  </Stack>}</DialogContent><DialogActions sx={{ bgcolor: "#f5f9fc", px: 2.5, pb: 2 }}><Button onClick={onClose} startIcon={<CloseRoundedIcon />}>Κλείσιμο</Button></DialogActions></Dialog>;
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
