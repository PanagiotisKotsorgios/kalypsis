import { Box, Button, Container, Divider, Stack, Typography } from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import StorageIcon from "@mui/icons-material/Storage";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { useTranslation } from "react-i18next";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import {
  DESKTOP_CLIENT_SETUP_URL,
  DESKTOP_DEPLOYMENT_GUIDE_URL,
  DESKTOP_SERVER_SETUP_URL,
  DesktopDownloadButton
} from "../components/DesktopDownloadButton";
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

            <Divider sx={{ borderColor: RULE, my: { xs: 6, md: 8 } }} />

            <Typography component="h2" sx={{ color: NAVY, fontSize: { xs: 25, md: 32 }, fontWeight: 850, mb: 1.5 }}>
              {t("landing.v2.desktop.downloadPage.officeTitle")}
            </Typography>
            <Typography sx={{ color: NAVY_SOFT, fontSize: 14.5, lineHeight: 1.7, mb: 3 }}>
              {t("landing.v2.desktop.downloadPage.officeLead")}
            </Typography>

            <Stack spacing={2.5}>
              <OfficeRoleCard
                number={1}
                title={t("landing.v2.desktop.downloadPage.serverTitle")}
                body={t("landing.v2.desktop.downloadPage.serverBody")}
                button={t("landing.v2.desktop.downloadPage.serverButton")}
                href={DESKTOP_SERVER_SETUP_URL}
                fileName="Setup-KalypsisServer.ps1"
                command={'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\Setup-KalypsisServer.ps1 -SetupExe .\\kalypsis-desktop-win-Setup.exe -AppUserPassword "<strong-password>" -RootPassword "<strong-root-password>"'}
              />
              <OfficeRoleCard
                number={2}
                title={t("landing.v2.desktop.downloadPage.clientTitle")}
                body={t("landing.v2.desktop.downloadPage.clientBody")}
                button={t("landing.v2.desktop.downloadPage.clientButton")}
                href={DESKTOP_CLIENT_SETUP_URL}
                fileName="Setup-KalypsisClient.ps1"
                command={'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\Setup-KalypsisClient.ps1 -SetupExe .\\kalypsis-desktop-win-Setup.exe -ServerHost "<server-ip>" -AppUserPassword "<same-password>"'}
              />
            </Stack>

            <Button
              component="a"
              href={DESKTOP_DEPLOYMENT_GUIDE_URL}
              download="DEPLOYMENT.md"
              startIcon={<DescriptionOutlinedIcon />}
              sx={{ mt: 2.5, textTransform: "none", fontWeight: 700 }}
            >
              {t("landing.v2.desktop.downloadPage.guideButton")}
            </Button>

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

function OfficeRoleCard({
  number, title, body, button, href, fileName, command
}: {
  number: number;
  title: string;
  body: string;
  button: string;
  href: string;
  fileName: string;
  command: string;
}) {
  return (
    <Box sx={{ border: `1px solid ${RULE}`, borderRadius: 2, p: { xs: 2.5, md: 3 }, bgcolor: SURFACE }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: ACCENT, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
          {number}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: 16 }}>{title}</Typography>
          <Typography sx={{ color: NAVY_SOFT, fontSize: 14, lineHeight: 1.65, mt: 0.5 }}>{body}</Typography>
          <Button
            component="a"
            href={href}
            download={fileName}
            size="small"
            startIcon={<DownloadIcon />}
            sx={{ mt: 1.5, textTransform: "none", fontWeight: 750 }}
          >
            {button}
          </Button>
          <Box component="pre" sx={{ mt: 1.5, mb: 0, p: 1.5, borderRadius: 1, bgcolor: "#0b1522", color: "#e6eef7", fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {command}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

export default DownloadPage;
