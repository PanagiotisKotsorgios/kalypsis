import { Box, Card, CardContent, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

interface Tile {
  labelKey: string;
  value: string | number;
}

const tilesByRole: Record<string, Tile[]> = {
  Customer: [
    { labelKey: "dashboard.activePolicies", value: 3 },
    { labelKey: "dashboard.expiringSoon", value: 1 },
    { labelKey: "dashboard.unreadNotifications", value: 2 }
  ],
  AgencyAdmin: [
    { labelKey: "dashboard.customersCount", value: 128 },
    { labelKey: "dashboard.policiesCount", value: 342 },
    { labelKey: "dashboard.expiringSoon", value: 14 },
    { labelKey: "dashboard.documentsUploaded", value: 921 }
  ],
  AgencyUser: [
    { labelKey: "dashboard.customersCount", value: 128 },
    { labelKey: "dashboard.policiesCount", value: 342 },
    { labelKey: "dashboard.expiringSoon", value: 14 }
  ],
  Producer: [
    { labelKey: "dashboard.policiesCount", value: 87 },
    { labelKey: "dashboard.expiringSoon", value: 4 }
  ],
  PlatformAdmin: [
    { labelKey: "nav.tenants", value: 7 },
    { labelKey: "nav.users", value: 54 }
  ],
  PlatformEmployee: [
    { labelKey: "nav.tenants", value: 7 },
    { labelKey: "nav.users", value: 54 }
  ]
};

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tiles = user ? tilesByRole[user.role] ?? [] : [];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t("common.welcome")}, {user?.firstName ?? user?.email}
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
