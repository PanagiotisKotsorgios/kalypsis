import { Box, Card, CardContent, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { ProducerDashboardPage } from "./ProducerDashboardPage";
import { CustomerDashboardPage } from "./CustomerDashboardPage";

interface Tile {
  labelKey: string;
  value: string | number;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Producers get a dedicated dashboard backed by /api/reports/producer.
  if (user?.role === "Producer") return <ProducerDashboardPage />;
  // Customers get the simple portal dashboard.
  if (user?.role === "Customer") return <CustomerDashboardPage />;

  const isPlatform = user?.role === "PlatformAdmin" || user?.role === "PlatformEmployee";
  const isAgency = user?.role === "AgencyAdmin" || user?.role === "AgencyUser";

  const tenantsQuery = useQuery({
    queryKey: ["dashboard", "tenants"],
    queryFn: async () => (await api.get<{ id: string; userCount: number; customerCount: number }[]>("/tenants")).data,
    enabled: isPlatform
  });

  const customersQuery = useQuery({
    queryKey: ["dashboard", "customers"],
    queryFn: async () => (await api.get<unknown[]>("/customers")).data,
    enabled: isAgency
  });

  const usersQuery = useQuery({
    queryKey: ["dashboard", "users"],
    queryFn: async () => (await api.get<unknown[]>("/users")).data,
    enabled: user?.role === "AgencyAdmin"
  });

  let tiles: Tile[] = [];
  if (isPlatform) {
    const total = tenantsQuery.data ?? [];
    tiles = [
      { labelKey: "dashboard.agenciesCount", value: total.length },
      {
        labelKey: "dashboard.usersCount",
        value: total.reduce((acc, t) => acc + t.userCount, 0)
      },
      {
        labelKey: "dashboard.customersCount",
        value: total.reduce((acc, t) => acc + t.customerCount, 0)
      }
    ];
  } else if (user?.role === "AgencyAdmin") {
    tiles = [
      { labelKey: "dashboard.customersCount", value: (customersQuery.data ?? []).length },
      { labelKey: "dashboard.usersCount", value: (usersQuery.data ?? []).length }
    ];
  } else if (user?.role === "AgencyUser") {
    tiles = [
      { labelKey: "dashboard.customersCount", value: (customersQuery.data ?? []).length }
    ];
  } else if ((user?.role as string) === "Customer") {
    tiles = [
      { labelKey: "dashboard.activePolicies", value: 0 },
      { labelKey: "dashboard.expiringSoon", value: 0 },
      { labelKey: "dashboard.unreadNotifications", value: 0 }
    ];
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t("common.welcome")}, {user?.firstName ?? user?.email}
      </Typography>
      <Typography color="text.secondary" mb={4}>
        {user?.tenantName}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)"
          }
        }}
      >
        {tiles.map((tile) => (
          <Card key={tile.labelKey}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                {t(tile.labelKey)}
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {tile.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </>
  );
}
