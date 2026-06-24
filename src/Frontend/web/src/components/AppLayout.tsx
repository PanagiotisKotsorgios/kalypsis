import { useEffect, useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  Avatar,
  useMediaQuery,
  useTheme
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthContext";
import { usePackages, type PackageCode } from "../auth/PackagesContext";
import { useWorkspace } from "../auth/WorkspaceContext";
import { api } from "../api/client";
import { useImpersonation } from "../impersonation/ImpersonationContext";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { KalypsisLogo } from "./KalypsisLogo";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  /** Show a "Coming soon" chip and route to ComingSoonPage. */
  comingSoon?: boolean;
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
}

interface AppLayoutProps {
  navItems: NavItem[];
  children: ReactNode;
}

const DRAWER_WIDTH = 260;

export function AppLayout({ navItems, children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(!isMobile);

  const { tenantId: impersonatedTenantId } = useImpersonation();
  const { has: hasPackage } = usePackages();
  const { workspace, enter: enterWorkspace, exitToHub } = useWorkspace();
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

  // Snap drawer state when crossing breakpoint and auto-close on mobile navigation.
  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);
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
      <Toolbar sx={{ px: 2, justifyContent: "space-between", gap: 1 }}>
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
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, py: 1, overflowY: "auto" }}>
        {navItems.filter(item => {
          // 1. License gating: drop items whose package isn't enabled for the tenant.
          if (item.package && !hasPackage(item.package)) return false;

          // 2. Workspace scoping: only applies to agency-side UI inside a workspace.
          if (useWorkspaceUi && workspace) {
            // Items with an explicit workspaces list: show only when the current
            // workspace is in it.
            if (item.workspaces && item.workspaces.length > 0)
              return item.workspaces.includes(workspace);

            // Items tagged to a specific package: show in that workspace.
            if (item.package) return item.package === workspace;

            // Items with no workspace metadata are global (Profile, Notifications) — always show.
            return true;
          }

          return true;
        }).map((item) => {
          const route = `/app${item.to === "/" ? "" : item.to}`;
          const selected =
            item.to === "/"
              ? location.pathname === "/app"
              : location.pathname.startsWith(route);
          const target = item.comingSoon ? "/app/coming-soon?key=" + encodeURIComponent(item.labelKey) : route;

          return (
            <ListItemButton
              key={item.to + item.labelKey}
              component={RouterLink}
              to={target}
              selected={selected}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 1.5,
                opacity: item.comingSoon ? 0.7 : 1
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={t(item.labelKey)}
                primaryTypographyProps={{ fontWeight: 500, noWrap: true }}
              />
              {item.comingSoon && (
                <Chip
                  label={t("nav.comingSoonChip")}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    bgcolor: "rgba(11,37,69,0.08)",
                    color: "text.secondary",
                    ml: 0.5
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
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
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "background.paper",
          color: "text.primary"
        }}
        elevation={0}
      >
        <Toolbar sx={{ borderBottom: "1px solid", borderColor: "divider", gap: 1 }}>
          <IconButton edge="start" onClick={() => setOpen((v) => !v)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
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
          {useWorkspaceUi && (
            <Box sx={{
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

          <Stack direction="row" spacing={{ xs: 0.5, md: 1.5 }} alignItems="center">
            <NotificationBell />
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <LanguageToggle />
            </Box>
            <IconButton onClick={handleSignOut} title={t("auth.logout")}>
              <LogoutIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? "temporary" : "persistent"}
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: !isMobile && open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          mt: 8,
          minWidth: 0,      // keep wide content from forcing horizontal scroll
          maxWidth: "100%"
        }}
      >
        <ImpersonationBanner />
        {children}
      </Box>
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
