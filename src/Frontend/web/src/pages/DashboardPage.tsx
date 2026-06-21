import { useAuth } from "../auth/AuthContext";
import { ProducerDashboardPage } from "./ProducerDashboardPage";
import { CustomerDashboardPage } from "./CustomerDashboardPage";
import { AgencyAdminDashboard } from "./dashboards/AgencyAdminDashboard";
import { AgencyUserDashboard } from "./dashboards/AgencyUserDashboard";
import { PlatformDashboard } from "./dashboards/PlatformDashboard";

/**
 * Role-aware entry point. Each role gets a dedicated dashboard so the surface
 * matches what they're allowed to act on.
 */
export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "Producer") return <ProducerDashboardPage />;
  if (user?.role === "Customer") return <CustomerDashboardPage />;
  if (user?.role === "AgencyAdmin") return <AgencyAdminDashboard />;
  if (user?.role === "AgencyUser") return <AgencyUserDashboard />;
  if (user?.role === "PlatformAdmin" || user?.role === "PlatformEmployee") {
    return <PlatformDashboard />;
  }
  return null;
}
