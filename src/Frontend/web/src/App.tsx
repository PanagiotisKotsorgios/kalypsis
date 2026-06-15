import { Navigate, Route, Routes } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import NotificationsIcon from "@mui/icons-material/Notifications";
import GroupIcon from "@mui/icons-material/Group";
import BusinessIcon from "@mui/icons-material/Business";
import AssignmentIcon from "@mui/icons-material/Assignment";
import HandshakeIcon from "@mui/icons-material/Handshake";
import ReportIcon from "@mui/icons-material/Report";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

import { useAuth, type Role } from "./auth/AuthContext";
import { AppLayout, type NavItem } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const navByRole: Record<Role, NavItem[]> = {
  Customer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/notifications", labelKey: "nav.notifications", icon: <NotificationsIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  AgencyAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon /> },
    { to: "/producers", labelKey: "nav.producers", icon: <HandshakeIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> },
    { to: "/users", labelKey: "nav.users", icon: <GroupIcon /> },
    { to: "/reports", labelKey: "nav.reports", icon: <DashboardIcon /> }
  ],
  AgencyUser: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/documents", labelKey: "nav.documents", icon: <FolderIcon /> },
    { to: "/tasks", labelKey: "nav.tasks", icon: <AssignmentIcon /> },
    { to: "/claims", labelKey: "nav.claims", icon: <ReportIcon /> }
  ],
  Producer: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/policies", labelKey: "nav.policies", icon: <DescriptionIcon /> },
    { to: "/customers", labelKey: "nav.customers", icon: <PeopleIcon /> },
    { to: "/profile", labelKey: "nav.profile", icon: <AccountCircleIcon /> }
  ],
  PlatformAdmin: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/users", labelKey: "nav.users", icon: <GroupIcon /> },
    { to: "/reports", labelKey: "nav.reports", icon: <DashboardIcon /> }
  ],
  PlatformEmployee: [
    { to: "/", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
    { to: "/tenants", labelKey: "nav.tenants", icon: <BusinessIcon /> },
    { to: "/reports", labelKey: "nav.reports", icon: <DashboardIcon /> }
  ]
};

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout navItems={user ? navByRole[user.role] : []}>
              <Routes>
                <Route index element={<DashboardPage />} />
                <Route path="customers" element={<PlaceholderPage titleKey="nav.customers" />} />
                <Route path="policies" element={<PlaceholderPage titleKey="nav.policies" />} />
                <Route path="documents" element={<PlaceholderPage titleKey="nav.documents" />} />
                <Route path="notifications" element={<PlaceholderPage titleKey="nav.notifications" />} />
                <Route path="users" element={<PlaceholderPage titleKey="nav.users" />} />
                <Route path="tenants" element={<PlaceholderPage titleKey="nav.tenants" />} />
                <Route path="tasks" element={<PlaceholderPage titleKey="nav.tasks" />} />
                <Route path="producers" element={<PlaceholderPage titleKey="nav.producers" />} />
                <Route path="claims" element={<PlaceholderPage titleKey="nav.claims" />} />
                <Route path="reports" element={<PlaceholderPage titleKey="nav.reports" />} />
                <Route path="profile" element={<PlaceholderPage titleKey="nav.profile" />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
