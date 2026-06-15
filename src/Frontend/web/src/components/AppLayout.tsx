import { useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Stack,
  Avatar
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";
import { LanguageToggle } from "./LanguageToggle";
import { KalypsisLogo } from "./KalypsisLogo";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
}

interface AppLayoutProps {
  navItems: NavItem[];
  children: ReactNode;
}

const DRAWER_WIDTH = 250;

export function AppLayout({ navItems, children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);

  const handleSignOut = () => {
    signOut();
    navigate("/", { replace: true });
  };

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "?";

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2 }}>
        <KalypsisLogo size={32} />
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, py: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={`/app${item.to === "/" ? "" : item.to}`}
            selected={
              item.to === "/"
                ? location.pathname === "/app"
                : location.pathname.startsWith(`/app${item.to}`)
            }
            sx={{ mx: 1, mb: 0.5, borderRadius: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ fontWeight: 500 }} />
          </ListItemButton>
        ))}
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
        <Toolbar sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
          <IconButton edge="start" onClick={() => setOpen((v) => !v)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            {user?.tenantName ?? t("app.subtitle")}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <LanguageToggle />
            <IconButton onClick={handleSignOut} title={t("auth.logout")}>
              <LogoutIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : 0,
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
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, mt: 8 }}>
        {children}
      </Box>
    </Box>
  );
}
