import { Box, Button, Container, Stack } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EmailIcon from "@mui/icons-material/Email";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PackageCode } from "../auth/PackagesContext";

const PACKAGE_KEYS: Record<PackageCode, string> = {
  BackOffice:   "packageLocked.names.BackOffice",
  FrontOffice:  "packageLocked.names.FrontOffice",
  Crm:          "packageLocked.names.Crm",
  Intelligence: "packageLocked.names.Intelligence",
  Integrations: "packageLocked.names.Integrations"
};

/**
 * Polite screen the user sees when they try to reach a feature whose package
 * isn't licensed for their tenant. Renders the package's friendly name and
 * offers two actions: contact the platform admin, or go back to the dashboard.
 */
export function PackageLockedPage({ requiredPackage }: { requiredPackage: PackageCode }) {
  const { t } = useTranslation();

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack alignItems="center" spacing={3} sx={{ textAlign: "center" }}>
        <Box sx={{
          width: 96, height: 96,
          borderRadius: "50%",
          bgcolor: "rgba(176,138,62,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <LockOutlinedIcon sx={{ fontSize: 48, color: "var(--gold, #b08a3e)" }} />
        </Box>

        <Box>
          <Box sx={{
            fontFamily: "var(--display, serif)",
            fontSize: { xs: 28, md: 36 },
            fontWeight: 700,
            color: "var(--ink, #0b2545)",
            lineHeight: 1.15
          }}>
            {t("packageLocked.title")}
          </Box>
          <Box sx={{ mt: 2, color: "text.secondary", fontSize: 16, lineHeight: 1.65 }}>
            {t("packageLocked.lead", { package: t(PACKAGE_KEYS[requiredPackage]) })}
          </Box>
        </Box>

        <Box sx={{
          mt: 1,
          p: 2.5,
          border: "1px solid",
          borderColor: "divider",
          width: "100%",
          textAlign: "left",
          bgcolor: "#fbfaf6"
        }}>
          <Box sx={{ fontFamily: "monospace", fontSize: 13, color: "var(--gold, #b08a3e)", letterSpacing: "0.06em", mb: 0.5 }}>
            {t("packageLocked.requiredPackageLabel")}
          </Box>
          <Box sx={{ fontWeight: 700, fontSize: 18 }}>
            {t(PACKAGE_KEYS[requiredPackage])}
          </Box>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1 }}>
          <Button
            component="a"
            href="mailto:info@mykalypsis.gr?subject=Package%20upgrade%20request"
            variant="contained"
            startIcon={<EmailIcon />}
          >
            {t("packageLocked.contact")}
          </Button>
          <Button component={RouterLink} to="/app" variant="outlined">
            {t("packageLocked.backToDashboard")}
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}

/**
 * Route wrapper. If the tenant lacks the required package, renders the locked
 * screen; otherwise renders the children.
 */
import { usePackages } from "../auth/PackagesContext";
import { PageLoader } from "../components/PageLoader";

export function PackageGate({ package: pkg, children }: { package: PackageCode; children: React.ReactNode }) {
  const { has, loading } = usePackages();
  if (loading) return <PageLoader minHeight="60vh" />;
  if (!has(pkg)) return <PackageLockedPage requiredPackage={pkg} />;
  return <>{children}</>;
}
