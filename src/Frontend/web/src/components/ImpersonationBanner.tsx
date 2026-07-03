import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useImpersonation } from "../impersonation/ImpersonationContext";

/**
 * Sticky banner shown to PlatformAdmin / PlatformEmployee while they're
 * "viewing as" a tenant. All API calls scope to that tenant via the
 * X-Impersonate-Tenant header and the sidebar reflects the agency view.
 */
export function ImpersonationBanner() {
  const { t } = useTranslation();
  const { tenantId, tenantName, exit } = useImpersonation();
  const navigate = useNavigate();

  if (!tenantId) return null;

  return (
    <Box
      sx={{
        position: "sticky",
        top: 64,
        zIndex: (theme) => theme.zIndex.appBar - 1,
        mx: { xs: -2, md: -4 },
        mt: -4,
        mb: 3
      }}
    >
      <Alert
        severity="warning"
        icon={<VisibilityIcon />}
        sx={{
          borderRadius: 0,
          alignItems: "center",
          "& .MuiAlert-message": { width: "100%" }
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t("impersonation.viewingAs", { name: tenantName ?? tenantId })}
            </Typography>
            {/* Explicit reminder that any mutation from here writes to the
                impersonated tenant's data — protects against the
                Platform-admin footgun of forgetting they're not in their own
                sandbox. */}
            <Typography variant="caption" sx={{ display: "block", fontWeight: 600, opacity: 0.9 }}>
              Οι αλλαγές που κάνετε ΓΡΑΦΟΝΤΑΙ στα δεδομένα του γραφείου «{tenantName ?? tenantId}».
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<ExitToAppIcon />}
            onClick={() => { exit(); navigate("/app/tenants", { replace: true }); }}
          >
            {t("impersonation.exit")}
          </Button>
        </Stack>
      </Alert>
    </Box>
  );
}
