import { Box, Container, Divider, Stack, Typography } from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import StorageIcon from "@mui/icons-material/Storage";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { useTranslation } from "react-i18next";
import { DesktopDownloadButton } from "../components/DesktopDownloadButton";
import { PageEnter } from "../components/PageEnter";
import { PublicShell } from "../components/PublicShell";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";
const RULE = "#e5e9ef";
const SURFACE = "#fafbfc";

const FEATURE_KEYS = [
  { icon: ComputerIcon, title: "allInOneTitle", body: "allInOneBody" },
  { icon: StorageIcon, title: "localTitle", body: "localBody" },
  { icon: SystemUpdateAltIcon, title: "updatesTitle", body: "updatesBody" },
  { icon: VerifiedUserOutlinedIcon, title: "requirementsTitle", body: "requirementsBody" }
] as const;

export function DownloadPage() {
  const { t } = useTranslation();

  return (
    <PublicShell mainSx={{ bgcolor: "#ffffff" }}>
      <PageEnter>
        <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: { xs: 7, md: 11 } }}>
          <Stack spacing={2} sx={{ maxWidth: 800 }}>
            <Typography sx={{ color: ACCENT, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
              {t("landing.v2.desktop.downloadPage.eyebrow")}
            </Typography>
            <Typography component="h1" sx={{ color: NAVY, fontSize: { xs: 34, md: 54 }, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.025em" }}>
              {t("landing.v2.desktop.downloadPage.title")}
            </Typography>
            <Typography sx={{ color: NAVY_SOFT, maxWidth: 720, fontSize: { xs: 16, md: 18 }, lineHeight: 1.7 }}>
              {t("landing.v2.desktop.downloadPage.lead")}
            </Typography>
            <Box sx={{ pt: 2 }}>
              <DesktopDownloadButton />
            </Box>
          </Stack>

          <Divider sx={{ borderColor: RULE, my: { xs: 6, md: 8 } }} />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
            {FEATURE_KEYS.map(({ icon: Icon, title, body }) => (
              <Box key={title} sx={{ border: `1px solid ${RULE}`, borderRadius: 2, p: 3, bgcolor: SURFACE }}>
                <Stack direction="row" spacing={2}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: "#e8f2fa", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon />
                  </Box>
                  <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>
                      {t(`landing.v2.desktop.downloadPage.${title}`)}
                    </Typography>
                    <Typography sx={{ color: NAVY_SOFT, fontSize: 13.5, lineHeight: 1.6 }}>
                      {t(`landing.v2.desktop.downloadPage.${body}`)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>

          <Divider sx={{ borderColor: RULE, my: { xs: 6, md: 8 } }} />

          <Box sx={{ maxWidth: 820 }}>
            <Typography component="h2" sx={{ color: NAVY, fontSize: { xs: 25, md: 32 }, fontWeight: 850, mb: 3 }}>
              {t("landing.v2.desktop.downloadPage.installTitle")}
            </Typography>
            <Stack spacing={3}>
              {[1, 2, 3].map((step) => (
                <Stack key={step} direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: NAVY, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
                    {step}
                  </Box>
                  <Box>
                    <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: 15.5 }}>
                      {t(`landing.v2.desktop.downloadPage.step${step}Title`)}
                    </Typography>
                    <Typography sx={{ color: NAVY_SOFT, fontSize: 14, lineHeight: 1.65, mt: 0.5 }}>
                      {t(`landing.v2.desktop.downloadPage.step${step}Body`)}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Box sx={{ mt: 5, p: 2.5, bgcolor: "#fff8e8", border: "1px solid #eed9a3", borderRadius: 2 }}>
              <Typography sx={{ color: NAVY, fontSize: 13.5, lineHeight: 1.6 }}>
                {t("landing.v2.desktop.downloadPage.signatureNote")}
              </Typography>
            </Box>
          </Box>
        </Container>
      </PageEnter>
    </PublicShell>
  );
}

export default DownloadPage;
