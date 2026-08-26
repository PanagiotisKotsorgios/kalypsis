import { useMemo } from "react";
import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AgencySettingsHubPage } from "./AgencySettingsHubPage";
import { ProfilePage } from "./ProfilePage";
import { DocumentationPage } from "./DocumentationPage";

/**
 * Merged agency-settings + personal-profile surface for AgencyAdmin.
 * Replaces the pair of sidebar entries («Ρυθμίσεις Γραφείου» +
 * «Προφίλ») with a single tabbed page — same pattern as the finance
 * merge. Both original routes still work: they redirect here with
 * the matching tab pre-selected, so old bookmarks + emails don't
 * break.
 *
 * Non-AgencyAdmin roles (AgencyUser, Producer, Standalone, etc.) can
 * still see just /profile in their own sidebars — this merge only
 * affects the surface that had BOTH.
 */
export function AgencyAndProfilePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const active = useMemo(() => {
    const p = params.get("tab");
    if (p === "profile") return "profile";
    if (p === "documentation") return "documentation";
    return "agency";
  }, [params]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <SettingsIcon color="primary" sx={{ fontSize: 34 }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {t("agencyProfile.title", "Γραφείο & Προφίλ")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("agencyProfile.subtitle",
              "Ρυθμίσεις του γραφείου + προσωπικές ρυθμίσεις χρήστη σε ένα σημείο.")}
          </Typography>
        </Box>
      </Stack>
      <Tabs value={active} onChange={(_, v) => setParams(prev => {
        const n = new URLSearchParams(prev);
        n.set("tab", v);
        return n;
      })} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tab value="agency" icon={<SettingsIcon fontSize="small" />} iconPosition="start"
          label={t("agencyProfile.tabs.agency", "Γραφείο")} />
        <Tab value="profile" icon={<AccountCircleIcon fontSize="small" />} iconPosition="start"
          label={t("agencyProfile.tabs.profile", "Προσωπικό προφίλ")} />
        <Tab value="documentation" icon={<MenuBookIcon fontSize="small" />} iconPosition="start"
          label={t("agencyProfile.tabs.documentation", "Οδηγίες χρήσης")} />
      </Tabs>
      {active === "agency" && <AgencySettingsHubPage />}
      {active === "profile" && <ProfilePage />}
      {active === "documentation" && <DocumentationPage />}
    </Box>
  );
}
