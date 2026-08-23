import { type ReactNode } from "react";
import { Box } from "@mui/material";

import { AppLayout, type NavItem } from "./AppLayout";
import { BackOfficeActionHelp } from "./BackOfficeActionHelp";
import { EmployeeActivityTracker } from "./EmployeeActivityTracker";
import type { Role } from "../auth/AuthContext";

/**
 * Routing shell — always renders the standard <AppLayout> with the role's
 * sidebar. Historically this had a fullscreen «workspace hub» branch for
 * agency users on /app with no workspace selected, which stripped the
 * sidebar entirely. That branch became a trap: the workspace-switcher
 * pill row is disabled elsewhere (`false && useWorkspaceUi`) so operators
 * had no way to enter a workspace, and every fresh tenant login started
 * with workspace=null. Result: agency admins landed on /app with no
 * sidebar and no navigation of any kind. Removed the branch entirely —
 * the WorkspaceHub page still renders inside AppLayout as its /app
 * content, but the sidebar is always available.
 */
export function AppShell({
  navItems, role, children
}: {
  navItems: NavItem[];
  role: Role | undefined;
  children: ReactNode;
}) {
  const isAgencyRole = role === "AgencyAdmin" || role === "AgencyUser";
  const shouldTrackEmployeeActivity = isAgencyRole
    || role === "PlatformAdmin"
    || role === "PlatformEmployee";

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
