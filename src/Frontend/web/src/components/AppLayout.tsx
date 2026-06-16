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

import { useAuth } from "../auth/AuthContext";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { KalypsisLogo } from "./KalypsisLogo";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  /** Show a "Coming soon" chip and route to ComingSoonPage. */
  comingSoon?: boolean;
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
      <Toolbar sx={{ px: 2, justifyContent: "space-between" }}>
        <KalypsisLogo size={32} />
        {isMobile && (
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, py: 1, overflowY: "auto" }}>
        {navItems.map((item) => {
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
          <Typography
            variant="subtitle1"
            sx={{ flex: 1, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {user?.tenantName ?? t("app.subtitle")}
          </Typography>
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
        {children}
      </Box>
    </Box>
  );
}
