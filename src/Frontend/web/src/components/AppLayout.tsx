import { useEffect, useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  Avatar,
  useMediaQuery,
  useTheme,
  alpha
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import ConstructionIcon from "@mui/icons-material/Construction";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthContext";
import { usePackages, type PackageCode } from "../auth/PackagesContext";
import { usePremium } from "../auth/PremiumContext";
import { PremiumCrown } from "./PremiumCrown";
import { useWorkspace } from "../auth/WorkspaceContext";
import { api } from "../api/client";
import { useImpersonation } from "../impersonation/ImpersonationContext";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { SessionCountdown } from "./SessionCountdown";
import { KalypsisLogo } from "./KalypsisLogo";
import { KalypsisOnboarding } from "./KalypsisOnboarding";
import { PageTourMount } from "./PageTour";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  /** Show a "Coming soon" chip and route to ComingSoonPage. */
  comingSoon?: boolean;
  /**
   * Premium feature code. When set and the tenant hasn't unlocked it,
   * the item gets a gold crown badge and clicking opens the upgrade dialog
   * instead of navigating. Server-side endpoints enforce the same gate.
   */
  premium?: import("../auth/PremiumContext").PremiumFeatureCode;
  /**
   * Phase 5: license gating — this nav item only appears if the tenant has
   * this package enabled in their subscription. Omit for items every tenant
   * always has.
   */
  package?: import("../auth/PackagesContext").PackageCode;
  /**
   * Phase 8.7: explicit list of workspaces this item appears in. Empty/undefined
   * means "always visible regardless of workspace" (Profile, Notifications).
   * When a workspace is selected, the sidebar shows ONLY items whose
   * <c>workspaces</c> list contains it.
   */
  workspaces?: import("../auth/PackagesContext").PackageCode[];
  /** @deprecated since 8.7 — use `workspaces` instead. Kept for back-compat. */
  foundational?: boolean;
  /**
   * Phase 14: group items into a collapsible dropdown in the sidebar.
   * Ungrouped items render at the top (everyday work — Dashboard, Customers, Policies).
   * Grouped items go under a folder header that toggles open/closed; defaults closed.
   * Group open state persists in localStorage so each user's preference sticks.
   */
  group?: string;
  /** Optional icon next to the group header in the sidebar. */
  groupIcon?: ReactNode;
}

interface AppLayoutProps {
  navItems: NavItem[];
  children: ReactNode;
}

const DRAWER_WIDTH = 408;
const DRAWER_RAIL_WIDTH = 64;
const MOBILE_DRAWER_WIDTH = "min(88vw, 360px)";

export function AppLayout({ navItems, children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // Desktop open/closed persists per user; mobile is always controlled by hamburger.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nav.sidebarOpen") !== "false";
  });
  useEffect(() => {
    if (typeof window === "undefined" || isMobile) return;
    localStorage.setItem("nav.sidebarOpen", String(open));
  }, [open, isMobile]);

  const { tenantId: impersonatedTenantId } = useImpersonation();
  const { has: hasPackage } = usePackages();
  const premium = usePremium();
  const { workspace, enter: enterWorkspace, exitToHub } = useWorkspace();

  // Per-user persisted open/closed state for sidebar groups (default closed).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("nav.openGroups") ?? "{}"); } catch { return {}; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("nav.openGroups", JSON.stringify(openGroups));
  }, [openGroups]);
  const toggleGroup = (g: string) => setOpenGroups(s => ({ ...s, [g]: !s[g] }));

  // Desktop-install + mobile-app teasers — pinned at the bottom of every
  // sidebar for every role. Both open a "Coming soon" dialog for now; the
  // desktop entry will link to a Windows/macOS installer post 2026-10-20,
  // the mobile entry to App Store / Play Store links once the RN app ships.
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Whether this user gets the workspace-switcher UI at all. Only agency-side roles see it;
  // platform staff (not impersonating) and customers/producers use the linear sidebar.
  const useWorkspaceUi = user?.role === "AgencyAdmin" || user?.role === "AgencyUser" || !!impersonatedTenantId;
  const logoQuery = useQuery({
    queryKey: ["tenant-logo", impersonatedTenantId ?? user?.tenantId ?? "none"],
    enabled: !!user?.tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await api.get("/agency-profile/logo", { responseType: "blob" });
      if (res.status === 204 || !res.data || (res.data as Blob).size === 0) return null;
      return URL.createObjectURL(res.data as Blob);
    }
  });
  useEffect(() => () => { if (logoQuery.data) URL.revokeObjectURL(logoQuery.data); }, [logoQuery.data]);
  const tenantLogoUrl = logoQuery.data ?? null;

  // On mobile, auto-close the temporary drawer after navigating. On desktop, keep
  // whatever the user chose (open or rail) — never force-close on route changes.
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [location.pathname, isMobile]);

  const handleSignOut = () => {
    signOut();
    navigate("/", { replace: true });
  };

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "?";

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2, minHeight: 64, justifyContent: "space-between", gap: 1 }}>
        {tenantLogoUrl ? (
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              component="img"
              src={tenantLogoUrl}
              alt={user?.tenantName ?? ""}
              sx={{ height: 36, maxWidth: 140, objectFit: "contain" }}
            />
          </Stack>
        ) : (
          <KalypsisLogo size={32} />
        )}
        {isMobile && (
          <IconButton size="medium" aria-label={t("common.close")} onClick={() => setOpen(false)} sx={{ minWidth: 44, minHeight: 44 }}>
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List id="app-sidebar-navigation" sx={{ flex: 1, py: 1, overflowY: "auto", overscrollBehavior: "contain", pb: "max(8px, env(safe-area-inset-bottom))" }} component="nav">
        {(() => {
          const visible = navItems.filter(item => {
            if (item.package && !hasPackage(item.package)) return false;
            if (useWorkspaceUi && workspace) {
              if (item.workspaces && item.workspaces.length > 0)
                return item.workspaces.includes(workspace);
              if (item.package) return item.package === workspace;
              return true;
            }
            return true;
          });

          // Split: the Dashboard ("/") link is pinned at the very top,
          // remaining top-level items render below it, grouped items after.
          const dashboardItem = visible.find(i => i.to === "/" && !i.group);
          const otherTopLevel = visible.filter(i => !i.group && i.to !== "/");
          const grouped: Record<string, { items: NavItem[]; icon?: ReactNode }> = {};
          const groupOrder: string[] = [];
          for (const item of visible) {
            if (!item.group) continue;
            if (!grouped[item.group]) { grouped[item.group] = { items: [], icon: item.groupIcon }; groupOrder.push(item.group); }
            if (item.groupIcon && !grouped[item.group].icon) grouped[item.group].icon = item.groupIcon;
            grouped[item.group].items.push(item);
          }

          const renderItem = (item: NavItem, indented = false) => {
            const route = `/app${item.to === "/" ? "" : item.to}`;
            const selected = item.to === "/" ? location.pathname === "/app" : location.pathname.startsWith(route);
            const target = item.comingSoon ? "/app/coming-soon?key=" + encodeURIComponent(item.labelKey) : route;
            // Tour anchor — derive from the route so KalypsisOnboarding selectors stay stable.
            const tourKey = item.to === "/" ? "dashboard"
              : item.to.replace(/^\//, "").replace(/\//g, "-");
            const collapsed = !isMobile && !open;
            const premiumLocked = !!item.premium && !premium.has(item.premium);
            const button = (
              <ListItemButton
                key={item.to + item.labelKey}
                {...(premiumLocked
                  ? { onClick: (e: React.MouseEvent) => { e.preventDefault(); premium.promptUpgrade(item.premium!); } }
                  : { component: RouterLink, to: target })}
                selected={selected && !premiumLocked}
                data-tour={`sidebar-${tourKey}`}
                sx={{
                  mx: collapsed ? 0.5 : 1,
                  mb: 0.4,
                  pl: collapsed ? 1.2 : (indented ? 3 : 2),
                  borderRadius: 1.5,
                  minHeight: isMobile ? 48 : undefined,
                  justifyContent: collapsed ? "center" : "flex-start",
                  opacity: item.comingSoon ? 0.7 : 1
                }}
              >
                <ListItemIcon sx={{ minWidth: collapsed ? 0 : 34, justifyContent: "center" }}>{item.icon}</ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={t(item.labelKey)}
                    primaryTypographyProps={{ fontWeight: 500, noWrap: true, fontSize: indented ? 15 : 15.5 }}
                  />
                )}
                {!collapsed && premiumLocked && <PremiumCrown />}
                {!collapsed && item.comingSoon && (
                  <Chip label={t("nav.comingSoonChip")} size="small"
                    sx={{ height: 18, fontSize: 10, fontWeight: 700,
                      bgcolor: "rgba(11,37,69,0.08)", color: "text.secondary", ml: 0.5 }} />
                )}
              </ListItemButton>
            );
            return collapsed
              ? <Tooltip key={item.to + item.labelKey} title={premiumLocked ? `${t(item.labelKey)} · Premium` : t(item.labelKey)} placement="right" arrow>{button}</Tooltip>
              : button;
          };

          return (
            <>
              {dashboardItem && (
                <>
                  {renderItem(dashboardItem)}
                  <Divider sx={{ my: 1, mx: 2 }} />
                </>
              )}
              {otherTopLevel.map(item => renderItem(item))}
              {groupOrder.length > 0 && otherTopLevel.length > 0 && <Divider sx={{ my: 1, mx: 2 }} />}
              {groupOrder.map(groupKey => {
                const grp = grouped[groupKey];
                const isOpen = !!openGroups[groupKey];
                const collapsed = !isMobile && !open;
                // Highlight group if any child is the active route — and auto-open it.
                const containsActive = grp.items.some(i => {
                  const r = `/app${i.to === "/" ? "" : i.to}`;
                  return location.pathname === r || location.pathname.startsWith(r + "/");
                });
                const effectiveOpen = isOpen || containsActive;

                // In rail (collapsed) mode, render each grouped item as a standalone icon
                // with tooltip — folder structure makes no sense when the sidebar is 64px wide.
                if (collapsed) {
                  return (
                    <Box key={groupKey}>
                      {grp.items.map(item => renderItem(item))}
                    </Box>
                  );
                }

                const header = (
                  <ListItemButton onClick={() => toggleGroup(groupKey)}
                    sx={{ mx: 1, mb: 0.4, borderRadius: 1.5,
                      bgcolor: containsActive ? "rgba(11,37,69,0.04)" : "transparent" }}>
                    <ListItemIcon sx={{ minWidth: 34, color: containsActive ? "primary.main" : "text.secondary" }}>
                      {grp.icon ?? <FolderIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={t(`nav.group.${groupKey}`, groupKey)}
                      primaryTypographyProps={{
                        fontWeight: 700,
                        fontSize: 13.5,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: containsActive ? "primary.main" : "text.secondary",
                        noWrap: true
                      }}
                    />
                    <Chip label={grp.items.length} size="small"
                      sx={{ height: 18, fontSize: 10, fontWeight: 700, mr: 0.5,
                        bgcolor: "rgba(11,37,69,0.06)", color: "text.secondary" }} />
                    {effectiveOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </ListItemButton>
                );
                return (
                  <Box key={groupKey}>
                    {header}
                    <Collapse in={effectiveOpen} timeout="auto" unmountOnExit>
                      <List disablePadding>
                        {grp.items.map(item => renderItem(item, true))}
                      </List>
                    </Collapse>
                  </Box>
                );
              })}
              {/* Desktop + mobile install teasers — sit INSIDE the scrollable
                  nav list at its very bottom so the operator has to scroll
                  down to reach them (they're not pinned to the drawer
                  chrome). Dark-green filled buttons make them clearly a
                  different kind of action from the rest of the nav. */}
              {(() => {
                const green = "#1b5e20";      // material «green 900»
                const greenHover = "#256b2a"; // slightly brighter for hover
                const greenGlow = "#4caf50";  // «green 500» for glow ring
                // Attention-grabbing style: bold green gradient, thick colored
                // shadow, subtle pulse animation so eyes catch it even when
                // scrolled into view. Combined with an "@keyframes install-pulse"
                // that ripples the box-shadow every 2.2s.
                return (
                  <Box sx={{ mt: 1.5, px: !isMobile && !open ? 0.5 : 1.5, pb: 1 }}>
                    <Divider sx={{ mb: 1.5, mx: 1 }} />
                    <Box sx={{
                      "@keyframes install-pulse": {
                        "0%":   { boxShadow: `0 0 0 0 ${alpha(greenGlow, 0.55)}, 0 4px 10px rgba(0,0,0,0.28)` },
                        "70%":  { boxShadow: `0 0 0 10px ${alpha(greenGlow, 0)}, 0 4px 10px rgba(0,0,0,0.28)` },
                        "100%": { boxShadow: `0 0 0 0 ${alpha(greenGlow, 0)}, 0 4px 10px rgba(0,0,0,0.28)` }
                      }
                    }}>
                      {[
                        { key: "desktop" as const, icon: <DownloadForOfflineIcon sx={{ fontSize: 22 }} />,
                          labelKey: "nav.installDesktop", tipFallback: "Εγκατάσταση σε υπολογιστή",
                          labelFallback: "ΕΓΚΑΤΑΣΤΑΣΗ ΣΕ ΥΠΟΛΟΓΙΣΤΗ",
                          onClick: () => setDesktopOpen(true) },
                        { key: "mobile" as const, icon: <PhoneIphoneIcon sx={{ fontSize: 22 }} />,
                          labelKey: "nav.installMobile", tipFallback: "Εφαρμογή κινητού",
                          labelFallback: "ΕΦΑΡΜΟΓΗ ΚΙΝΗΤΟΥ",
                          onClick: () => setMobileOpen(true) }
                      ].map((entry, idx) => !isMobile && !open ? (
                        <Tooltip key={entry.key} title={t(entry.labelKey, entry.tipFallback)} placement="right" arrow>
                          <ListItemButton
                            onClick={entry.onClick}
                            sx={{
                              mx: 0.5, mb: 0.8, borderRadius: 2, justifyContent: "center",
                              py: 1.2,
                              background: `linear-gradient(135deg, ${green} 0%, ${greenHover} 100%)`,
                              color: "#fff",
                              border: `2px solid ${alpha(greenGlow, 0.35)}`,
                              boxShadow: `0 4px 10px rgba(0,0,0,0.28)`,
                              animation: `install-pulse 2.4s ease-in-out ${idx * 1.1}s infinite`,
                              "&:hover": {
                                background: `linear-gradient(135deg, ${greenHover} 0%, ${greenGlow} 100%)`,
                                transform: "translateY(-1px)"
                              }
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 0, color: "#fff", justifyContent: "center" }}>
                              {entry.icon}
                            </ListItemIcon>
                          </ListItemButton>
                        </Tooltip>
                      ) : (
                        <ListItemButton
                          key={entry.key}
                          onClick={entry.onClick}
                          sx={{
                            mx: 1, mb: 0.8, borderRadius: 2, py: 1.3,
                            background: `linear-gradient(135deg, ${green} 0%, ${greenHover} 100%)`,
                            color: "#fff",
                            border: `2px solid ${alpha(greenGlow, 0.35)}`,
                            boxShadow: `0 4px 12px rgba(0,0,0,0.30)`,
                            animation: `install-pulse 2.4s ease-in-out ${idx * 1.1}s infinite`,
                            "&:hover": {
                              background: `linear-gradient(135deg, ${greenHover} 0%, ${greenGlow} 100%)`,
                              transform: "translateY(-1px)"
                            }
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36, color: "#fff" }}>
                            {entry.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={t(entry.labelKey, entry.labelFallback)}
                            primaryTypographyProps={{
                              fontWeight: 900, noWrap: true, fontSize: 13.5,
                              letterSpacing: "0.07em", textTransform: "uppercase",
                              color: "#fff",
                              sx: { textShadow: "0 1px 2px rgba(0,0,0,0.35)" }
                            }}
                          />
                          <Chip label={t("nav.soon", "σύντομα")} size="small"
                            sx={{ height: 20, fontSize: 10, fontWeight: 800,
                              bgcolor: alpha(greenGlow, 0.6), color: "#fff",
                              border: "1px solid rgba(255,255,255,0.35)", ml: 0.5 }} />
                        </ListItemButton>
                      ))}
                    </Box>
                  </Box>
                );
              })()}
            </>
          );
        })()}
      </List>
      <Divider />
      <Dialog open={desktopOpen} onClose={() => setDesktopOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <ConstructionIcon color="secondary" />
            <span>Εγκατάσταση σε υπολογιστή</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Η <b>desktop έκδοση του Kalypsis</b> βρίσκεται ακόμη υπό ανάπτυξη. Θα είναι διαθέσιμη για κατέβασμα και
            εγκατάσταση <b>μετά τις 20 Οκτωβρίου 2026</b> για τις παρακάτω πλατφόρμες:
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <PlatformCard icon={<WindowsLogo />} name="Windows" hint="Installer .exe (Win 10 / 11)" />
            <PlatformCard icon={<MacOSLogo />} name="macOS" hint=".dmg (Apple silicon + Intel)" />
            <PlatformCard icon={<LinuxLogo />} name="Linux" hint=".deb · .rpm · AppImage" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Μέχρι τότε, μπορείτε να χρησιμοποιείτε κανονικά το Kalypsis μέσω browser — όλες οι λειτουργίες θα είναι
            διαθέσιμες και στην desktop έκδοση.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setDesktopOpen(false)}>Κατάλαβα</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <PhoneIphoneIcon color="secondary" />
            <span>Εφαρμογή κινητού</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            Η <b>εφαρμογή Kalypsis για κινητά</b> (iOS + Android) είναι υπό ανάπτυξη. Θα διατεθεί στο <b>App Store</b>
            {" "}και στο <b>Google Play</b> <b>μετά τις 20 Οκτωβρίου 2026</b>.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Το site λειτουργεί ήδη σαν προοδευτική εφαρμογή (PWA): μπορείτε να το «προσθέσετε στην αρχική οθόνη»
            του κινητού σας και να έχετε εμπειρία εφαρμογής μέχρι να κυκλοφορήσουν τα native builds.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setMobileOpen(false)}>Κατάλαβα</Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ p: !isMobile && !open ? 1 : 2, pb: isMobile ? "max(16px, env(safe-area-inset-bottom))" : undefined }}>
        {!isMobile && !open ? (
          <Tooltip title={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`} placement="right" arrow>
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: 14, mx: "auto" }}>
              {initials}
            </Avatar>
          </Tooltip>
        ) : (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: 14 }}>
              {initials}
            </Avatar>
            <Box sx={{ overflow: "hidden", minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {user ? t(`roles.${user.role}`) : ""}
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );

  return (
    <Box data-app-shell sx={{ display: "flex", minHeight: "100dvh", minWidth: 0, overflowX: "hidden", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "background.paper",
          color: "text.primary"
        }}
        elevation={0}
      >
        <Toolbar sx={{ minHeight: 64, pt: "env(safe-area-inset-top)", px: { xs: 1, sm: 2 }, borderBottom: "1px solid", borderColor: "divider", gap: { xs: 0.25, sm: 1 } }}>
          <IconButton edge="start" aria-label={open && isMobile ? t("common.close") : t("nav.menu")} aria-controls="app-sidebar-navigation" aria-expanded={isMobile ? open : undefined} onClick={() => setOpen((v) => !v)} sx={{ mr: { xs: 0.25, sm: 1 }, minWidth: 44, minHeight: 44 }}>
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            {tenantLogoUrl && (
              <Box
                component="img"
                src={tenantLogoUrl}
                alt=""
                sx={{ height: 32, maxWidth: 110, objectFit: "contain", display: { xs: "none", sm: "block" } }}
              />
            )}
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {user?.tenantName ?? t("app.subtitle")}
            </Typography>
          </Stack>

          {/* Workspace switcher (agency-side roles only) */}
          {false && useWorkspaceUi && (
            <Box data-tour="topbar-workspace-pills" sx={{
              flex: 1,
              display: { xs: "none", md: "flex" },
              justifyContent: "center",
              gap: 0.5,
              overflow: "hidden"
            }}>
              <WorkspacePill
                code={null}
                active={!workspace}
                onClick={() => { exitToHub(); navigate("/app"); }}
                labelKey="ws.switcher.hub" t={t} />
              {(["BackOffice","FrontOffice","Crm","Intelligence","Integrations"] as PackageCode[]).map((p) => (
                hasPackage(p) ? (
                  <WorkspacePill
                    key={p}
                    code={p}
                    active={workspace === p}
                    onClick={() => { enterWorkspace(p); }}
                    labelKey={`ws.switcher.${p}`} t={t} />
                ) : null
              ))}
            </Box>
          )}
          {!useWorkspaceUi && <Box sx={{ flex: 1 }} />}

          <Stack direction="row" spacing={{ xs: 0.25, md: 1.5 }} alignItems="center" flexShrink={0}>
            <SessionCountdown />
            <Box data-tour="topbar-bell"><NotificationBell /></Box>
            <Box data-tour="topbar-language" sx={{ display: { xs: "none", sm: "block" } }}>
              <LanguageToggle />
            </Box>
            <IconButton data-tour="topbar-logout" aria-label={t("auth.logout")} onClick={handleSignOut} title={t("auth.logout")} sx={{ minWidth: 44, minHeight: 44 }}>
              <LogoutIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Desktop: persistent drawer that collapses to an icon rail. On mobile it
          is a focused navigation sheet with a backdrop, so page content cannot
          be accidentally tapped while the menu is open. */}
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? open : true}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isMobile ? 0 : (open ? DRAWER_WIDTH : DRAWER_RAIL_WIDTH),
          flexShrink: 0,
          transition: (theme) => theme.transitions.create("width", { duration: 200 }),
          "& .MuiDrawer-paper": {
            width: isMobile ? MOBILE_DRAWER_WIDTH : (open ? DRAWER_WIDTH : DRAWER_RAIL_WIDTH),
            maxWidth: isMobile ? "calc(100vw - 20px)" : undefined,
            overflowX: "hidden",
            transition: (theme) => theme.transitions.create("width", { duration: 200 }),
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
            borderRadius: isMobile ? "0 18px 18px 0" : 0,
            boxShadow: isMobile ? "0 18px 52px rgba(11,37,69,0.26)" : undefined
          },
          "& .MuiBackdrop-root": isMobile ? {
            backgroundColor: "rgba(7,29,54,0.48)",
            backdropFilter: "blur(3px)"
          } : undefined
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        data-app-main
        sx={{
          flexGrow: 1,
          width: "100%",
          p: { xs: 1.5, sm: 2, md: 4 },
          pb: { xs: "calc(24px + env(safe-area-inset-bottom))", md: 4 },
          mt: 8,
          minWidth: 0,      // keep wide content from forcing horizontal scroll
          maxWidth: "100%",
          overflowX: "clip"
        }}
      >
        <ImpersonationBanner />
        {children}
      </Box>
      <KalypsisOnboarding />
      <PageTourMount />
    </Box>
  );
}

/* Workspace switcher pill — used in the top app bar. */
function WorkspacePill({ code, active, onClick, labelKey, t }: {
  code: PackageCode | null;
  active: boolean;
  onClick: () => void;
  labelKey: string;
  t: (k: string) => string;
}) {
  const colors: Record<string, string> = {
    BackOffice: "#0b2545",
    FrontOffice: "#5b3220",
    Crm: "#3e6b3e",
    Intelligence: "#b08a3e",
    Integrations: "#7a3b62"
  };
  const accent = code ? colors[code] : "#6b6258";
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: "pointer",
        px: 1.6, py: 0.85,
        fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: active ? "#fff" : accent,
        bgcolor: active ? accent : "transparent",
        border: "1px solid", borderColor: accent,
        borderRadius: 0,
        whiteSpace: "nowrap",
        transition: "background 180ms ease, color 180ms ease",
        "&:hover": { bgcolor: active ? accent : `${accent}22` }
      }}
    >
      {t(labelKey)}
    </Box>
  );
}

// Small card used inside the desktop-install dialog to preview each supported
// platform. Icon + name + a monospace hint for the artefact format, plus a
// "σύντομα" chip so it's clear these are teasers, not download links yet.
function PlatformCard({ icon, name, hint }: { icon: ReactNode; name: string; hint: string }) {
  return (
    <Box sx={(th) => ({
      flex: 1,
      p: 1.5,
      textAlign: "center",
      borderRadius: 1.5,
      border: `1px dashed ${alpha(th.palette.secondary.main, 0.5)}`,
      bgcolor: alpha(th.palette.secondary.main, 0.05),
    })}>
      <Box sx={{ display: "grid", placeItems: "center", mb: 0.5, color: "secondary.main" }}>
        {icon}
      </Box>
      <Typography variant="subtitle2" fontWeight={800}>{name}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", display: "block", mb: 0.5 }}>
        {hint}
      </Typography>
      <Chip label="σύντομα" size="small"
        sx={(th) => ({ height: 18, fontSize: 10, fontWeight: 700,
          bgcolor: alpha(th.palette.secondary.main, 0.15),
          color: "secondary.main" })} />
    </Box>
  );
}

// Inline SVG platform logos so we don't pull in an extra icon pack. Both sized
// to 32px and coloured via `currentColor` so they pick up the theme's
// secondary tint from the parent Box.
function WindowsLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M0 3.449L9.75 2.1v9.451H0V3.449zM10.949 1.938L23.999 0v11.4H10.95V1.938zM0 12.6h9.75v9.451L0 20.699V12.6zM10.949 12.6H24V24l-13.052-1.9V12.6z" />
    </svg>
  );
}
function MacOSLogo() {
  // Apple mark — the standard silhouette used across macOS install flows.
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}
function LinuxLogo() {
  // Simplified Tux silhouette — recognisable at 32px without needing the full
  // penguin detail. Same currentColor trick as WindowsLogo above.
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.077 1.093-.3 1.958-1.06 3.052-.885 1.135-2.132 2.968-2.827 4.87-.325.895-.523 1.798-.398 2.612-.35.79-.83 1.61-1.36 2.395-.79 1.176-1.75 2.246-2.06 2.75-.06.1-.06.2-.03.29.06.19.19.35.34.5.4.4 1 .8 1.65 1.05.65.25 1.36.34 1.9-.05.29-.22.5-.55.6-.9.14.03.29.05.44.05h.02c.6-.03 1.28-.29 1.7-.71.36-.36.63-.86.79-1.34.16.09.32.16.5.2.3.5.66 1 .96 1.4.4.5.85.9 1.4 1 .32.05.66.05 1.02.03.15 0 .3-.02.44-.04.35-.05.7-.13 1.05-.24.32-.1.66-.24.94-.42.28-.18.51-.4.65-.68.13-.24.2-.5.24-.75.03-.16.03-.32.03-.48.35-.06.68-.16.98-.28.42-.17.8-.4 1.1-.66.16.44.4.85.72 1.17.44.44 1.02.72 1.66.75h.02c.32 0 .64-.05.94-.15.3-.1.58-.24.82-.42.25-.19.46-.42.6-.7.14-.3.19-.66.11-1.02-.08-.35-.28-.65-.55-.9-.53-.51-1.34-1.5-2.14-2.72-.53-.8-1.05-1.66-1.42-2.47.12-.79-.08-1.66-.4-2.53-.68-1.86-1.9-3.65-2.75-4.75-.76-1.05-.98-1.85-1.05-2.9 0-.15-.02-.32-.02-.5 0-1.14.16-2.32-.32-3.32-.48-1.02-1.5-1.68-2.95-1.68z" />
    </svg>
  );
}
