import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { PublicFooter } from "../components/PublicFooter";
import { ReleaseMarkdown } from "../components/ReleaseMarkdown";
import type { DesktopRelease } from "../models/DesktopRelease";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";
const HERO_BG = "/images/kalypsis-hero-bg.png";

const copy = {
  el: {
    eyebrow: "Kalypsis Desktop · Οδηγός",
    fallbackTitle: "Οδηγός εγκατάστασης",
    lead: "Πλήρεις οδηγίες για ασφαλή εγκατάσταση και λειτουργία του Kalypsis Desktop.",
    back: "Όλες οι εκδόσεις",
    signIn: "Σύνδεση",
    loading: "Φόρτωση οδηγού…",
    error: "Ο οδηγός δεν είναι διαθέσιμος αυτή τη στιγμή.",
    retry: "Δοκιμή ξανά"
  },
  en: {
    eyebrow: "Kalypsis Desktop · Guide",
    fallbackTitle: "Installation guide",
    lead: "Complete instructions for installing and running Kalypsis Desktop safely.",
    back: "All releases",
    signIn: "Sign in",
    loading: "Loading guide…",
    error: "The guide is not available right now.",
    retry: "Try again"
  }
} as const;

export function DesktopReleaseGuidePage() {
  const { assetId: assetIdParam } = useParams();
  const assetId = Number(assetIdParam);
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("el") ? "el" : "en";
  const c = copy[language];

  const releasesQuery = useQuery({
    queryKey: ["public-desktop-releases"],
    queryFn: async () => (await api.get<DesktopRelease[]>("/public/desktop-releases")).data,
    staleTime: 5 * 60 * 1000
  });
  const guideQuery = useQuery({
    queryKey: ["public-desktop-release-guide", assetId],
    queryFn: async () => (await api.get<string>(`/public/desktop-releases/assets/${assetId}/markdown`, { responseType: "text" })).data,
    enabled: Number.isSafeInteger(assetId) && assetId > 0,
    staleTime: 5 * 60 * 1000
  });

  const release = releasesQuery.data?.find((candidate) => candidate.assets.some((asset) => asset.id === assetId));
  const asset = release?.assets.find((candidate) => candidate.id === assetId);
  const title = asset?.name ?? c.fallbackTitle;

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
      <Box sx={{ backgroundImage: `url("${HERO_BG}")`, backgroundSize: "cover", backgroundPosition: "center bottom", bgcolor: "#f8fbff", pb: { xs: 5, md: 7 } }}>
        <GuideNav backLabel={c.back} signInLabel={c.signIn} />
        <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 7 }, px: { xs: 3, md: 5 } }}>
          <Stack spacing={1.75} sx={{ maxWidth: 850 }}>
            <Stack direction="row" spacing={1.1} alignItems="center">
              <DescriptionOutlinedIcon sx={{ color: ACCENT, fontSize: 20 }} />
              <Typography sx={{ color: ACCENT, fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>{c.eyebrow}</Typography>
            </Stack>
            <Typography component="h1" sx={{ fontSize: { xs: 34, md: 50 }, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em" }}>{title}</Typography>
            <Typography sx={{ color: NAVY_SOFT, fontSize: { xs: 15.5, md: 17.5 }, lineHeight: 1.7 }}>{c.lead}</Typography>
            {release && <Typography sx={{ color: NAVY_SOFT, fontSize: 13.5, fontWeight: 700 }}>{release.name} · {release.tagName}</Typography>}
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 5 }, py: { xs: 5, md: 8 }, flex: 1 }}>
        {guideQuery.isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 10 }}><CircularProgress /><Typography color="text.secondary">{c.loading}</Typography></Stack>
        ) : guideQuery.isError || !guideQuery.data ? (
          <Alert severity="error" action={<Button color="inherit" onClick={() => void guideQuery.refetch()}>{c.retry}</Button>}>{c.error}</Alert>
        ) : (
          <Box component="article" sx={{ p: { xs: 2.5, sm: 4, md: 6 }, border: "1px solid #e5e9ef", borderRadius: 3, bgcolor: "#fff", boxShadow: "0 24px 60px -42px rgba(11,37,69,0.45)" }}>
            <ReleaseMarkdown>{guideQuery.data}</ReleaseMarkdown>
          </Box>
        )}

        <Button component={RouterLink} to="/download/releases" startIcon={<ArrowBackIcon />} sx={{ mt: 3, textTransform: "none", fontWeight: 800 }}>
          {c.back}
        </Button>
      </Container>
      <PublicFooter />
    </Box>
  );
}

function GuideNav({ backLabel, signInLabel }: { backLabel: string; signInLabel: string }) {
  return (
    <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "96%", lg: "88%", xl: "1600px" }, px: { xs: 2, md: 3 }, pt: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{
        borderRadius: { xs: 3, md: "22px" }, px: { xs: 1.5, md: 3.5 }, py: { xs: 1, md: 1.5 },
        background: "rgba(255,255,255,0.84)", backdropFilter: "blur(16px)",
        boxShadow: "0 18px 44px rgba(15,42,80,0.12)", border: "1px solid rgba(148,191,230,0.35)"
      }}>
        <Box component={RouterLink} to="/" sx={{ display: "flex", alignItems: "center" }}><KalypsisLogo size={58} crop /></Box>
        <Box sx={{ flex: 1 }} />
        <Button component={RouterLink} to="/download/releases" startIcon={<ArrowBackIcon />} sx={{ ...navButtonSx, display: { xs: "none", sm: "inline-flex" } }}>{backLabel}</Button>
        <Button component={RouterLink} to="/login" startIcon={<LoginOutlinedIcon />} sx={{ ...navButtonSx, bgcolor: NAVY, color: "#fff", display: { xs: "none", md: "inline-flex" }, "&:hover": { bgcolor: "#1d4e89" } }}>{signInLabel}</Button>
        <LanguageToggle />
        <Button component={RouterLink} to="/download/releases" aria-label={backLabel} sx={{ ...navButtonSx, minWidth: 42, px: 1, display: { xs: "inline-flex", sm: "none" } }}><ArrowBackIcon /></Button>
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

export default DesktopReleaseGuidePage;
