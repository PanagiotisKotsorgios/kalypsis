import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import StorageIcon from "@mui/icons-material/Storage";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DESKTOP_CLIENT_SETUP_URL,
  DESKTOP_DEPLOYMENT_GUIDE_URL,
  DESKTOP_SERVER_SETUP_URL,
  DesktopDownloadButton
} from "../components/DesktopDownloadButton";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { PageEnter } from "../components/PageEnter";
import { PublicFooter } from "../components/PublicFooter";

// Same visual system as LandingPage/#features.
const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";
const RULE = "#e5e9ef";
const SURFACE = "#fafbfc";
const HERO_BG = "/images/kalypsis-hero-bg.png";

const FEATURE_KEYS = [
  { icon: ComputerIcon, title: "allInOneTitle", body: "allInOneBody" },
  { icon: StorageIcon, title: "localTitle", body: "localBody" },
  { icon: SystemUpdateAltIcon, title: "updatesTitle", body: "updatesBody" },
  { icon: VerifiedUserOutlinedIcon, title: "requirementsTitle", body: "requirementsBody" }
] as const;

export function DownloadPage() {
  const { t } = useTranslation();

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#ffffff",
      color: NAVY,
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      display: "flex",
      flexDirection: "column",
      overflowX: "hidden"
    }}>
      <Box sx={{ height: 3, background: "linear-gradient(90deg, #0b2545 0%, #1ea7e1 50%, #0b2545 100%)" }} />

      <Box sx={{
        position: "relative",
        overflow: "hidden",
        backgroundImage: `url("${HERO_BG}")`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        bgcolor: "#f8fbff",
        pb: { xs: 6, md: 9 }
      }}>
        <DownloadNav />

        <Container maxWidth={false} sx={{
          maxWidth: { xs: "100%", md: "82%", xl: "1600px" },
          px: { xs: 3, md: 6 },
          pt: { xs: 7, md: 10 },
          position: "relative",
          zIndex: 1
        }}>
          <PageEnter stagger={500}>
            <Stack spacing={2.25} sx={{ maxWidth: 820 }}>
              <Typography sx={{ color: ACCENT, fontSize: 12, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" }}>
                {t("landing.v2.desktop.downloadPage.eyebrow")}
              </Typography>
              <Typography component="h1" sx={{ color: NAVY, fontSize: { xs: 38, md: 60 }, fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.035em" }}>
                {t("landing.v2.desktop.downloadPage.title")}
              </Typography>
              <Typography sx={{ color: NAVY_SOFT, maxWidth: 720, fontSize: { xs: 16, md: 18 }, lineHeight: 1.7 }}>
                {t("landing.v2.desktop.downloadPage.lead")}
              </Typography>
              <Box sx={{ pt: 2 }}>
                <DesktopDownloadButton />
              </Box>
            </Stack>
          </PageEnter>
        </Container>
      </Box>

      <Container maxWidth={false} sx={{
        maxWidth: { xs: "100%", md: "82%", xl: "1600px" },
        px: { xs: 3, md: 6 },
        py: { xs: 7, md: 10 },
        flex: 1
      }}>
        <SectionHeading
          eyebrow={t("landing.v2.featuresEyebrow")}
          title={t("landing.v2.desktop.downloadPage.whyTitle")}
          body={t("landing.v2.desktop.downloadPage.whyBody")}
        />

        <Box sx={{
          display: "grid",
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(6, 1fr)" },
          gridTemplateAreas: {
            xs: '"a" "b" "c" "d"',
            sm: '"a a" "b c" "d d"',
            md: '"a a a b b b" "a a a c c c" "d d d d d d"'
          }
        }}>
          {FEATURE_KEYS.map(({ icon, title, body }, index) => (
            <FeatureCard
              key={title}
              icon={icon}
              title={t(`landing.v2.desktop.downloadPage.${title}`)}
              body={t(`landing.v2.desktop.downloadPage.${body}`)}
              area={String.fromCharCode(97 + index)}
              featured={index === 0}
            />
          ))}
        </Box>

        <Box component="section" sx={{ pt: { xs: 8, md: 11 } }}>
          <SectionHeading
            eyebrow="Setup.exe"
            title={t("landing.v2.desktop.downloadPage.installTitle")}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            {[1, 2, 3].map((step) => (
              <StepCard
                key={step}
                number={step}
                title={t(`landing.v2.desktop.downloadPage.step${step}Title`)}
                body={t(`landing.v2.desktop.downloadPage.step${step}Body`)}
              />
            ))}
          </Box>
        </Box>

        <Box component="section" sx={{ pt: { xs: 8, md: 11 } }}>
          <SectionHeading
            eyebrow="LAN deployment"
            title={t("landing.v2.desktop.downloadPage.officeTitle")}
            body={t("landing.v2.desktop.downloadPage.officeLead")}
          />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
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
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mt: 3 }}>
            <Button
              component="a"
              href={DESKTOP_DEPLOYMENT_GUIDE_URL}
              download="DEPLOYMENT.md"
              variant="outlined"
              startIcon={<DescriptionOutlinedIcon />}
              sx={{ borderColor: ACCENT, color: NAVY, textTransform: "none", fontWeight: 800, borderRadius: 1.5, px: 2.5 }}
            >
              {t("landing.v2.desktop.downloadPage.guideButton")}
            </Button>
          </Stack>
        </Box>

        <Box sx={{ mt: { xs: 7, md: 9 }, p: { xs: 2.5, md: 3 }, bgcolor: "#edf7fc", border: "1px solid rgba(31,123,179,0.22)", borderRadius: 2.5 }}>
          <Typography sx={{ color: NAVY_SOFT, fontSize: 13.5, lineHeight: 1.65 }}>
            {t("landing.v2.desktop.downloadPage.signatureNote")}
          </Typography>
        </Box>
      </Container>

      <PublicFooter />
    </Box>
  );
}

function DownloadNav() {
  const { t } = useTranslation();
  return (
    <Container maxWidth={false} sx={{
      maxWidth: { xs: "100%", md: "96%", lg: "88%", xl: "1600px" },
      px: { xs: 2, md: 3 },
      pt: { xs: 1.5, md: 2 },
      position: "relative",
      zIndex: 2
    }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{
        borderRadius: { xs: 3, md: "22px" },
        px: { xs: 1.5, md: 3.5 },
        py: { xs: 1, md: 1.5 },
        background: "rgba(255,255,255,0.84)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 18px 44px rgba(15,42,80,0.12)",
        border: "1px solid rgba(148,191,230,0.35)"
      }}>
        <Box component={RouterLink} to="/" sx={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <KalypsisLogo size={58} crop />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
          <Button component="a" href="/#features" startIcon={<ArrowBackIcon />} sx={navButtonSx}>
            {t("publicNav.platform")}
          </Button>
          <Button component={RouterLink} to="/contact" startIcon={<ChatBubbleOutlineIcon />} sx={navButtonSx}>
            {t("publicNav.contact")}
          </Button>
          <Button component={RouterLink} to="/login" startIcon={<LoginOutlinedIcon />} sx={{ ...navButtonSx, bgcolor: NAVY, color: "#ffffff", "&:hover": { bgcolor: "#1d4e89" } }}>
            {t("publicNav.signIn")}
          </Button>
        </Stack>
        <LanguageToggle />
        <Button component={RouterLink} to="/" aria-label={t("publicNav.home") as string} sx={{ ...navButtonSx, minWidth: 42, px: 1, display: { xs: "inline-flex", md: "none" } }}>
          <ArrowBackIcon />
        </Button>
      </Stack>
    </Container>
  );
}

const navButtonSx = {
  borderRadius: 999,
  px: 2,
  py: 0.85,
  color: NAVY,
  fontWeight: 750,
  textTransform: "none",
  whiteSpace: "nowrap",
  "&:hover": { bgcolor: "rgba(30,167,225,0.1)" }
} as const;

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
      <Typography sx={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: NAVY_SOFT, fontWeight: 600, mb: 1.5 }}>
        {eyebrow}
      </Typography>
      <Typography component="h2" sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, color: NAVY, letterSpacing: "-0.015em", mb: body ? 1.5 : 0 }}>
        {title}
      </Typography>
      {body && (
        <Typography sx={{ fontSize: { xs: 14.5, md: 15.5 }, lineHeight: 1.65, color: NAVY_SOFT, maxWidth: 760, mx: "auto" }}>
          {body}
        </Typography>
      )}
    </Box>
  );
}

function FeatureCard({ icon: Icon, title, body, area, featured }: {
  icon: typeof ComputerIcon;
  title: string;
  body: string;
  area: string;
  featured?: boolean;
}) {
  return (
    <Box sx={{
      gridArea: area,
      p: { xs: 3, md: featured ? 4.5 : 3.5 },
      borderRadius: 2.5,
      bgcolor: featured ? SURFACE : "#ffffff",
      border: `1px solid ${RULE}`,
      display: "flex",
      flexDirection: "column",
      transition: "box-shadow 220ms ease, border-color 220ms ease, transform 220ms ease",
      "&:hover": { borderColor: NAVY, boxShadow: "0 14px 30px -16px rgba(11,37,69,0.18)", transform: "translateY(-2px)" }
    }}>
      <Box sx={{ color: ACCENT, mb: featured ? 3 : 2, display: "inline-flex", alignItems: "center", justifyContent: "center", width: featured ? 56 : 44, height: featured ? 56 : 44, borderRadius: 1.5, bgcolor: "rgba(31,123,179,0.08)" }}>
        <Icon sx={{ fontSize: featured ? 30 : 24 }} />
      </Box>
      <Typography sx={{ fontSize: featured ? { xs: 22, md: 28 } : { xs: 18, md: 20 }, fontWeight: 800, color: NAVY, mb: 1, letterSpacing: "-0.015em", lineHeight: 1.2 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: featured ? { xs: 15.5, md: 17 } : { xs: 14.5, md: 15.5 }, lineHeight: 1.65, color: NAVY_SOFT }}>
        {body}
      </Typography>
    </Box>
  );
}

function StepCard({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <Box sx={{ p: { xs: 3, md: 3.5 }, borderRadius: 2.5, bgcolor: "#ffffff", border: `1px solid ${RULE}`, transition: "border-color 220ms ease, box-shadow 220ms ease", "&:hover": { borderColor: ACCENT, boxShadow: "0 14px 30px -18px rgba(11,37,69,0.2)" } }}>
      <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: "rgba(31,123,179,0.09)", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, mb: 2 }}>
        {String(number).padStart(2, "0")}
      </Box>
      <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: 17, mb: 1 }}>{title}</Typography>
      <Typography sx={{ color: NAVY_SOFT, fontSize: 14.5, lineHeight: 1.65 }}>{body}</Typography>
    </Box>
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
    <Box sx={{ border: `1px solid ${RULE}`, borderRadius: 2.5, p: { xs: 3, md: 4 }, bgcolor: number === 1 ? SURFACE : "#ffffff", transition: "border-color 220ms ease, box-shadow 220ms ease", "&:hover": { borderColor: NAVY, boxShadow: "0 14px 30px -16px rgba(11,37,69,0.18)" } }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: "rgba(31,123,179,0.09)", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, flexShrink: 0 }}>
          {String(number).padStart(2, "0")}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ color: NAVY, fontWeight: 800, fontSize: { xs: 18, md: 20 } }}>{title}</Typography>
          <Typography sx={{ color: NAVY_SOFT, fontSize: 14.5, lineHeight: 1.65, mt: 0.75 }}>{body}</Typography>
          <Button
            component="a"
            href={href}
            download={fileName}
            variant="contained"
            size="small"
            startIcon={<DownloadIcon />}
            sx={{ mt: 2, bgcolor: NAVY, textTransform: "none", fontWeight: 800, borderRadius: 1.5, boxShadow: "none", "&:hover": { bgcolor: "#1d4e89", boxShadow: "none" } }}
          >
            {button}
          </Button>
          <Box component="pre" sx={{ mt: 2, mb: 0, p: 1.75, borderRadius: 1.5, bgcolor: "#152640", color: "#e6eef7", fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {command}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

export default DownloadPage;
