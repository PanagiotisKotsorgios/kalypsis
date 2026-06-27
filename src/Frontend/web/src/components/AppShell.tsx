import { type ReactNode } from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AppLayout, type NavItem } from "./AppLayout";
import { BackOfficeActionHelp } from "./BackOfficeActionHelp";
import { EmployeeActivityTracker } from "./EmployeeActivityTracker";
import { LanguageToggle } from "./LanguageToggle";
import { SessionCountdown } from "./SessionCountdown";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../auth/WorkspaceContext";
import type { Role } from "../auth/AuthContext";

/**
 * Phase 8 — Routing shell that decides between the fullscreen Workspace Hub
 * and the regular sidebar-bearing <AppLayout>:
 *
 *   - Agency-side roles AT /app WITH no workspace selected → render the hub
 *     fullscreen with a minimal top bar (no sidebar, no nav rail).
 *   - Everything else → render the standard <AppLayout> with the role's nav
 *     (filtered to the current workspace's package + foundational items).
 */
export function AppShell({
  navItems, role, children
}: {
  navItems: NavItem[];
  role: Role | undefined;
  children: ReactNode;
}) {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isAgencyRole = role === "AgencyAdmin" || role === "AgencyUser";
  const shouldTrackEmployeeActivity = isAgencyRole || role === "PlatformAdmin" || role === "PlatformEmployee";
  // Treat both `/app` and `/app/` as the hub URL — anything deeper is a real workspace page.
  const onHubUrl = location.pathname === "/app" || location.pathname === "/app/";
  const showHubFullscreen = isAgencyRole && !workspace && onHubUrl;

  if (showHubFullscreen) {
    return (
      <Box data-app-shell sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", overflowX: "hidden", bgcolor: "background.default" }}>
        {shouldTrackEmployeeActivity && <EmployeeActivityTracker />}
        {/* Minimal top bar — same look as the dashboard chrome, no sidebar */}
        <Box sx={{
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          px: { xs: 1.5, md: 4 },
          pt: "max(12px, env(safe-area-inset-top))",
          pb: 1.5
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{
              fontFamily: "Georgia, serif",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "text.primary"
            }}>
              Kalypsis
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SessionCountdown />
              <LanguageToggle />
              <IconButton
                onClick={() => { signOut(); navigate("/", { replace: true }); }}
                title={t("auth.logout")}
                size="small"
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        {/* Hub body — fills the rest of the viewport */}
        <Box sx={{
          flex: 1,
          px: { xs: 1.5, md: 6 },
          py: { xs: 3, md: 7 },
          pb: { xs: "calc(24px + env(safe-area-inset-bottom))", md: 7 },
          maxWidth: 1200,
          width: "100%",
          mx: "auto"
        }} data-backoffice-help-root>
          {children}
          <BackOfficeActionHelp />
        </Box>

        {/* User identity footer */}
        {user && (
          <Box sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            px: { xs: 2, md: 4 },
            py: 1.5
          }}>
            <Typography variant="caption" color="text.secondary">
              {user.email} · {user.tenantName ?? "—"}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <AppLayout navItems={navItems}>
      {shouldTrackEmployeeActivity && <EmployeeActivityTracker />}
      {isAgencyRole ? (
        <Box data-backoffice-help-root>
          {children}
          <BackOfficeActionHelp />
        </Box>
      ) : children}
    </AppLayout>
  );
}
