import { Box, Button, Card, CardContent, Chip, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function ComingSoonPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const labelKey = params.get("key");
  const featureName = labelKey ? t(labelKey) : t("comingSoon.feature");

  // Resolve a feature slug (e.g. "dias", "claims") and look up rich copy.
  const slug = labelKey?.startsWith("nav.") ? labelKey.slice(4) : null;
  const featureKey = slug ? `comingSoon.features.${slug}` : null;
  const has = (k: string) => featureKey ? i18n.exists(`${featureKey}.${k}`) : false;
  const bullets: string[] = featureKey && has("bullets")
    ? (t(`${featureKey}.bullets`, { returnObjects: true }) as string[])
    : [];
  const intro = featureKey && has("intro") ? t(`${featureKey}.intro`) : null;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
      <Card sx={{ maxWidth: 720, width: "100%", borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack direction="row" spacing={2} alignItems="center" mb={2}>
            <Box
              sx={{
                width: 64, height: 64, borderRadius: "50%",
                bgcolor: "rgba(246,166,35,0.12)", color: "#f6a623",
                display: "inline-flex", alignItems: "center", justifyContent: "center"
              }}
            >
              <ConstructionIcon sx={{ fontSize: 32 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Chip label={t("comingSoon.tag")} size="small" color="warning" sx={{ fontWeight: 700, mb: 0.5 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {featureName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t("comingSoon.title")}
              </Typography>
            </Box>
          </Stack>

          <Typography color="text.secondary" sx={{ lineHeight: 1.75, mb: bullets.length ? 2 : 4 }}>
            {intro ?? t("comingSoon.body")}
          </Typography>

          {bullets.length > 0 && (
            <List dense sx={{ mb: 3 }}>
              {bullets.map((b, i) => (
                <ListItem key={i} sx={{ alignItems: "flex-start", py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.6 }}>
                    <CheckCircleIcon sx={{ color: "primary.main", fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText primary={b} primaryTypographyProps={{ sx: { lineHeight: 1.55 } }} />
                </ListItem>
              ))}
            </List>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/app")}
            sx={{ fontWeight: 700 }}
          >
            {t("comingSoon.back")}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
