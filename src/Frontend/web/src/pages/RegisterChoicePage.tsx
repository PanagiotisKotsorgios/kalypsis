import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import { PublicShell } from "../components/PublicShell";
import { BrandImage } from "../components/BrandImage";

export function RegisterChoicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <PublicShell>
      <Box
        sx={{
          position: "relative",
          py: { xs: 10, md: 14 },
          color: "common.white",
          overflow: "hidden"
        }}
      >
        <BrandImage seed="kalypsis-register-greek-mosaic" width={1800} height={900} overlay="navy-strong" />
        <Container maxWidth="md" sx={{ position: "relative", textAlign: "center" }}>
          <Stack spacing={2.5} alignItems="center">
            <Chip
              label={t("register.eyebrow")}
              sx={{ bgcolor: "rgba(255,255,255,0.14)", color: "common.white", fontWeight: 600 }}
            />
            <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: -1 }}>
              {t("register.headline")}
            </Typography>
            <Typography sx={{ opacity: 0.92, fontSize: 18, maxWidth: 640 }}>
              {t("register.lead")}
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 14 }, mt: { xs: -6, md: -8 }, position: "relative", zIndex: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }
          }}
        >
          <ChoiceCard
            icon={<BusinessIcon sx={{ fontSize: 32 }} />}
            titleKey="register.choice.agency.title"
            subtitleKey="register.choice.agency.subtitle"
            bodyKey="register.choice.agency.body"
            points={[
              "register.choice.agency.p1",
              "register.choice.agency.p2",
              "register.choice.agency.p3",
              "register.choice.agency.p4"
            ]}
            ctaKey="register.choice.agency.cta"
            onClick={() => navigate("/register/agency")}
            accent="primary"
          />
          <ChoiceCard
            icon={<PersonIcon sx={{ fontSize: 32 }} />}
            titleKey="register.choice.agent.title"
            subtitleKey="register.choice.agent.subtitle"
            bodyKey="register.choice.agent.body"
            points={[
              "register.choice.agent.p1",
              "register.choice.agent.p2",
              "register.choice.agent.p3",
              "register.choice.agent.p4"
            ]}
            ctaKey="register.choice.agent.cta"
            onClick={() => navigate("/register/agent")}
            accent="secondary"
          />
        </Box>

        <Box sx={{ textAlign: "center", mt: 6 }}>
          <Typography color="text.secondary">
            {t("register.alreadyHave")}{" "}
            <Button component={RouterLink} to="/login" variant="text" sx={{ fontWeight: 700 }}>
              {t("auth.signIn")}
            </Button>
          </Typography>
        </Box>
      </Container>
    </PublicShell>
  );
}

interface ChoiceCardProps {
  icon: React.ReactNode;
  titleKey: string;
  subtitleKey: string;
  bodyKey: string;
  points: string[];
  ctaKey: string;
  onClick: () => void;
  accent: "primary" | "secondary";
}

function ChoiceCard({
  icon,
  titleKey,
  subtitleKey,
  bodyKey,
  points,
  ctaKey,
  onClick,
  accent
}: ChoiceCardProps) {
  const { t } = useTranslation();
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 4,
        boxShadow: "0 16px 48px rgba(11,37,69,0.12)",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider"
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent sx={{ p: { xs: 3, md: 4.5 } }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  bgcolor: `${accent}.main`,
                  color: "common.white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {icon}
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5 }}>
                  {t(subtitleKey)}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                  {t(titleKey)}
                </Typography>
              </Box>
            </Stack>

            <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {t(bodyKey)}
            </Typography>

            <Stack spacing={1}>
              {points.map((p) => (
                <Stack key={p} direction="row" spacing={1.2} alignItems="flex-start">
                  <CheckIcon sx={{ color: `${accent}.main`, fontSize: 20, mt: 0.3 }} />
                  <Typography>{t(p)}</Typography>
                </Stack>
              ))}
            </Stack>

            <Button
              variant="contained"
              color={accent}
              endIcon={<ArrowForwardIcon />}
              size="large"
              sx={{ alignSelf: "flex-start", fontWeight: 700, px: 3 }}
            >
              {t(ctaKey)}
            </Button>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
