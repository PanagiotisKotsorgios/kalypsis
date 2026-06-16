import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function ComingSoonPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const labelKey = params.get("key");
  const featureName = labelKey ? t(labelKey) : t("comingSoon.feature");

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: { xs: "70vh", md: "60vh" },
        py: 4
      }}
    >
      <Card sx={{ maxWidth: 560, width: "100%", textAlign: "center", borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 4, md: 6 } }}>
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              bgcolor: "rgba(246,166,35,0.12)",
              color: "#f6a623",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 2
            }}
          >
            <ConstructionIcon sx={{ fontSize: 44 }} />
          </Box>
          <Stack direction="row" spacing={1} justifyContent="center" mb={2}>
            <Chip label={t("comingSoon.tag")} size="small" color="warning" sx={{ fontWeight: 700 }} />
          </Stack>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            {featureName}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500, mb: 2 }}>
            {t("comingSoon.title")}
          </Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.7, mb: 4 }}>
            {t("comingSoon.body")}
          </Typography>
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
