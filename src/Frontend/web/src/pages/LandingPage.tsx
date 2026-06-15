import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Stack,
  Typography,
  useTheme
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import ShieldIcon from "@mui/icons-material/Shield";
import GroupsIcon from "@mui/icons-material/Groups";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LockIcon from "@mui/icons-material/Lock";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";

interface RoleCardProps {
  titleKey: string;
  subtitleKey: string;
  descKey: string;
  loginHint: string;
}

function RoleCard({ titleKey, subtitleKey, descKey, loginHint }: RoleCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Card
      sx={{
        height: "100%",
        transition: "transform 200ms, box-shadow 200ms",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 16px 40px rgba(11, 37, 69, 0.12)"
        }
      }}
    >
      <CardActionArea
        sx={{ height: "100%", p: 1 }}
        onClick={() => navigate(`/login?hint=${encodeURIComponent(loginHint)}`)}
      >
        <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.5, py: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <ShieldIcon color="primary" sx={{ fontSize: 36 }} />
            <ArrowForwardIcon color="action" />
          </Stack>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5 }}>
            {t(subtitleKey)}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            {t(titleKey)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: "auto" }}>
            {t(descKey)}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Top bar */}
      <Box
        sx={{
          py: 2,
          px: { xs: 3, md: 6 },
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <KalypsisLogo size={48} />
        <Stack direction="row" spacing={2} alignItems="center">
          <LanguageToggle />
          <Button component={RouterLink} to="/login" variant="contained" size="large">
            {t("landing.loginCta")}
          </Button>
        </Stack>
      </Box>

      {/* Hero */}
      <Box
        sx={{
          py: { xs: 8, md: 14 },
          px: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, ${theme.palette.secondary.main} 130%)`,
          color: "common.white"
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Typography variant="overline" sx={{ letterSpacing: 3, opacity: 0.8 }}>
              {t("app.subtitle")}
            </Typography>
            <Typography variant="h2" sx={{ maxWidth: 880, fontWeight: 800 }}>
              {t("landing.headline")}
            </Typography>
            <Typography variant="h6" sx={{ maxWidth: 700, fontWeight: 400, opacity: 0.92 }}>
              {t("landing.lead")}
            </Typography>
            <Box
              sx={{
                mt: 2,
                px: 2,
                py: 0.75,
                bgcolor: "rgba(255,255,255,0.12)",
                borderRadius: 999,
                fontSize: 14,
                letterSpacing: 1.2
              }}
            >
              {t("app.tagline")}
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Roles */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={1} alignItems="center" textAlign="center" mb={5}>
          <Typography variant="h3">{t("landing.whoAreYou")}</Typography>
          <Typography variant="body1" color="text.secondary">
            {t("landing.rolesIntro")}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(5, 1fr)"
            }
          }}
        >
          <RoleCard
            titleKey="landing.roles.customer.title"
            subtitleKey="landing.roles.customer.subtitle"
            descKey="landing.roles.customer.description"
            loginHint="customer"
          />
          <RoleCard
            titleKey="landing.roles.agencyAdmin.title"
            subtitleKey="landing.roles.agencyAdmin.subtitle"
            descKey="landing.roles.agencyAdmin.description"
            loginHint="agencyAdmin"
          />
          <RoleCard
            titleKey="landing.roles.agencyUser.title"
            subtitleKey="landing.roles.agencyUser.subtitle"
            descKey="landing.roles.agencyUser.description"
            loginHint="agencyUser"
          />
          <RoleCard
            titleKey="landing.roles.producer.title"
            subtitleKey="landing.roles.producer.subtitle"
            descKey="landing.roles.producer.description"
            loginHint="producer"
          />
          <RoleCard
            titleKey="landing.roles.platform.title"
            subtitleKey="landing.roles.platform.subtitle"
            descKey="landing.roles.platform.description"
            loginHint="platform"
          />
        </Box>
      </Container>

      {/* Features */}
      <Box sx={{ bgcolor: "common.white", py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Stack spacing={1} alignItems="center" textAlign="center" mb={5}>
            <Typography variant="h3">{t("landing.features.title")}</Typography>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 4,
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }
            }}
          >
            <Stack spacing={1.5} alignItems="flex-start">
              <GroupsIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h6">{t("landing.features.multi.title")}</Typography>
              <Typography color="text.secondary">{t("landing.features.multi.body")}</Typography>
            </Stack>
            <Stack spacing={1.5} alignItems="flex-start">
              <AutoAwesomeIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h6">{t("landing.features.easy.title")}</Typography>
              <Typography color="text.secondary">{t("landing.features.easy.body")}</Typography>
            </Stack>
            <Stack spacing={1.5} alignItems="flex-start">
              <LockIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h6">{t("landing.features.secure.title")}</Typography>
              <Typography color="text.secondary">{t("landing.features.secure.body")}</Typography>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Box
        sx={{
          py: 4,
          textAlign: "center",
          color: "text.secondary",
          fontSize: 14
        }}
      >
        {t("landing.footer")}
      </Box>
    </Box>
  );
}
