import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";
import { PageEnter } from "../components/PageEnter";
import { PublicFooter } from "../components/PublicFooter";
import { ReleaseMarkdown } from "../components/ReleaseMarkdown";
import type { DesktopRelease, DesktopReleaseAsset } from "../models/DesktopRelease";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";
const RULE = "#e5e9ef";
const HERO_BG = "/images/kalypsis-hero-bg.png";

const copy = {
  el: {
    eyebrow: "Kalypsis Desktop · Αρχείο εκδόσεων",
    title: "Όλες οι εκδόσεις, σε ένα σημείο.",
    lead: "Δείτε κάθε διαθέσιμη έκδοση και κατεβάστε απευθείας τον εγκαταστάτη, την portable εφαρμογή ή τα εργαλεία εγκατάστασης που χρειάζεστε.",
    back: "Επιστροφή στη λήψη",
    signIn: "Σύνδεση",
    catalog: "Κατάλογος εκδόσεων",
    catalogBody: "Τα αρχεία ενημερώνονται αυτόματα μόλις δημοσιευτεί νέα έκδοση από τη διαχείριση της πλατφόρμας.",
    latest: "Τελευταία έκδοση",
    prerelease: "Δοκιμαστική",
    published: "Δημοσιεύτηκε",
    files: "αρχεία",
    availableDownloads: "διαθέσιμες λήψεις",
    guides: "οδηγοί",
    file: "Αρχείο",
    kind: "Τύπος",
    size: "Μέγεθος",
    uploaded: "Ανέβηκε",
    downloads: "Λήψεις",
    action: "Λήψη",
    noFiles: "Δεν υπάρχουν αρχεία σε αυτή την έκδοση.",
    noDownloads: "Δεν υπάρχουν ακόμη αρχεία εγκατάστασης σε αυτή την έκδοση.",
    guideTitle: "Οδηγοί εγκατάστασης",
    guideBody: "Διαβάστε τις πλήρεις οδηγίες μέσα στο Kalypsis, χωρίς λήψη αρχείου.",
    viewGuide: "Προβολή οδηγού",
    empty: "Δεν υπάρχουν ακόμη δημοσιευμένες desktop εκδόσεις.",
    error: "Δεν ήταν δυνατή η φόρτωση των εκδόσεων αυτή τη στιγμή.",
    retry: "Δοκιμή ξανά",
    installer: "Εγκαταστάτης Windows",
    portable: "Portable εφαρμογή",
    server: "Εγκατάσταση server",
    client: "Εγκατάσταση client",
    update: "Πακέτο ενημέρωσης",
    guide: "Οδηγός",
    checksum: "Έλεγχος ακεραιότητας",
    other: "Αρχείο έκδοσης"
  },
  en: {
    eyebrow: "Kalypsis Desktop · Release archive",
    title: "Every release, in one place.",
    lead: "Browse every available version and directly download the installer, portable app, or deployment tools you need.",
    back: "Back to download",
    signIn: "Sign in",
    catalog: "Release catalog",
    catalogBody: "Files update automatically as soon as a new version is published by the platform administrators.",
    latest: "Latest release",
    prerelease: "Prerelease",
    published: "Published",
    files: "files",
    availableDownloads: "available downloads",
    guides: "guides",
    file: "File",
    kind: "Type",
    size: "Size",
    uploaded: "Uploaded",
    downloads: "Downloads",
    action: "Download",
    noFiles: "There are no files in this release.",
    noDownloads: "There are no installation files in this release yet.",
    guideTitle: "Installation guides",
    guideBody: "Read the complete instructions inside Kalypsis without downloading a file.",
    viewGuide: "View guide",
    empty: "There are no published desktop releases yet.",
    error: "The releases could not be loaded right now.",
    retry: "Try again",
    installer: "Windows installer",
    portable: "Portable application",
    server: "Server setup",
    client: "Client setup",
    update: "Update package",
    guide: "Guide",
    checksum: "Integrity check",
    other: "Release file"
  }
} as const;

export function DesktopReleasesPage() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("el") ? "el" : "en";
  const c = copy[language];
  const locale = language === "el" ? "el-GR" : "en-GB";
  const releasesQuery = useQuery({
    queryKey: ["public-desktop-releases"],
    queryFn: async () => (await api.get<DesktopRelease[]>("/public/desktop-releases")).data,
    staleTime: 5 * 60 * 1000
  });
  const releases = releasesQuery.data ?? [];
  const latestId = releases.find((release) => !release.prerelease)?.id;

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
        backgroundImage: `url("${HERO_BG}")`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        bgcolor: "#f8fbff",
        pb: { xs: 6, md: 8 }
      }}>
        <ReleasesNav backLabel={c.back} signInLabel={c.signIn} />
        <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "82%", xl: "1600px" }, px: { xs: 3, md: 6 }, pt: { xs: 6, md: 9 } }}>
          <PageEnter stagger={450}>
            <Stack spacing={2.2} sx={{ maxWidth: 830 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <SystemUpdateAltIcon sx={{ color: ACCENT, fontSize: 20 }} />
                <Typography sx={{ color: ACCENT, fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  {c.eyebrow}
                </Typography>
              </Stack>
              <Typography component="h1" sx={{ fontSize: { xs: 38, md: 58 }, fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.035em" }}>
                {c.title}
              </Typography>
              <Typography sx={{ color: NAVY_SOFT, maxWidth: 760, fontSize: { xs: 16, md: 18 }, lineHeight: 1.7 }}>
                {c.lead}
              </Typography>
            </Stack>
          </PageEnter>
        </Container>
      </Box>

      <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "86%", xl: "1680px" }, px: { xs: 2, md: 6 }, py: { xs: 6, md: 9 }, flex: 1 }}>
        <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
          <Typography sx={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: NAVY_SOFT, fontWeight: 650, mb: 1.5 }}>
            {c.catalog}
          </Typography>
          <Typography component="h2" sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 850, letterSpacing: "-0.015em", mb: 1.5 }}>
            {c.catalog}
          </Typography>
          <Typography sx={{ color: NAVY_SOFT, maxWidth: 760, mx: "auto", lineHeight: 1.65 }}>
            {c.catalogBody}
          </Typography>
        </Box>

        {releasesQuery.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>
        ) : releasesQuery.isError ? (
          <Alert severity="error" action={<Button color="inherit" onClick={() => void releasesQuery.refetch()}>{c.retry}</Button>}>
            {c.error}
          </Alert>
        ) : releases.length === 0 ? (
          <Alert severity="info">{c.empty}</Alert>
        ) : (
          <Stack spacing={3}>
            {releases.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                isLatest={release.id === latestId}
                locale={locale}
                labels={c}
              />
            ))}
          </Stack>
        )}
      </Container>

      <PublicFooter />
    </Box>
  );
}

function ReleasesNav({ backLabel, signInLabel }: { backLabel: string; signInLabel: string }) {
  return (
    <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "96%", lg: "88%", xl: "1600px" }, px: { xs: 2, md: 3 }, pt: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{
        borderRadius: { xs: 3, md: "22px" }, px: { xs: 1.5, md: 3.5 }, py: { xs: 1, md: 1.5 },
        background: "rgba(255,255,255,0.84)", backdropFilter: "blur(16px)",
        boxShadow: "0 18px 44px rgba(15,42,80,0.12)", border: "1px solid rgba(148,191,230,0.35)"
      }}>
        <Box component={RouterLink} to="/" sx={{ display: "flex", alignItems: "center" }}><KalypsisLogo size={58} crop /></Box>
        <Box sx={{ flex: 1 }} />
        <Button component={RouterLink} to="/download" startIcon={<ArrowBackIcon />} sx={{ ...navButtonSx, display: { xs: "none", sm: "inline-flex" } }}>
          {backLabel}
        </Button>
        <Button component={RouterLink} to="/login" startIcon={<LoginOutlinedIcon />} sx={{ ...navButtonSx, bgcolor: NAVY, color: "#fff", display: { xs: "none", md: "inline-flex" }, "&:hover": { bgcolor: "#1d4e89" } }}>
          {signInLabel}
        </Button>
        <LanguageToggle />
        <Button component={RouterLink} to="/download" aria-label={backLabel} sx={{ ...navButtonSx, minWidth: 42, px: 1, display: { xs: "inline-flex", sm: "none" } }}>
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

function ReleaseCard({
  release,
  isLatest,
  locale,
  labels
}: {
  release: DesktopRelease;
  isLatest: boolean;
  locale: string;
  labels: typeof copy.el | typeof copy.en;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const downloadableAssets = release.assets.filter(isPublicDownloadAsset);
  const markdownAssets = release.assets.filter(isMarkdownAsset);
  return (
    <Box component="article" sx={{ border: `1px solid ${isLatest ? "rgba(31,123,179,0.45)" : RULE}`, borderRadius: 2.5, overflow: "hidden", boxShadow: isLatest ? "0 18px 42px -28px rgba(11,37,69,0.45)" : "none" }}>
      <Box sx={{ p: { xs: 2.5, md: 3.5 }, bgcolor: isLatest ? "#f4faff" : "#fafbfc", borderBottom: `1px solid ${RULE}` }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
          <Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 0.75 }}>
              <Typography component="h3" sx={{ fontSize: { xs: 21, md: 25 }, fontWeight: 850 }}>{release.name}</Typography>
              <Chip label={release.tagName} size="small" sx={{ fontFamily: "monospace", fontWeight: 800 }} />
              {isLatest && <Chip label={labels.latest} size="small" color="primary" />}
              {release.prerelease && <Chip label={labels.prerelease} size="small" color="warning" />}
            </Stack>
            <Typography sx={{ color: NAVY_SOFT, fontSize: 13.5 }}>
              {labels.published}: {date.format(new Date(release.publishedAt ?? release.createdAt))} · {downloadableAssets.length} {labels.availableDownloads}
              {markdownAssets.length > 0 ? ` · ${markdownAssets.length} ${labels.guides}` : ""}
            </Typography>
            {release.body && (
              <ReleaseMarkdown compact sx={{ mt: 1.75, maxWidth: 940 }}>{release.body}</ReleaseMarkdown>
            )}
          </Box>
          <HistoryIcon sx={{ color: ACCENT, fontSize: 34, opacity: 0.75 }} />
        </Stack>
      </Box>

      {downloadableAssets.length === 0 ? (
        <Typography sx={{ p: 3, color: NAVY_SOFT }}>{release.assets.length === 0 ? labels.noFiles : labels.noDownloads}</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 850 }}>
            <TableHead>
              <TableRow>
                <TableCell>{labels.file}</TableCell>
                <TableCell>{labels.kind}</TableCell>
                <TableCell>{labels.size}</TableCell>
                <TableCell>{labels.uploaded}</TableCell>
                <TableCell align="right">{labels.downloads}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {downloadableAssets.map((asset) => (
                <TableRow key={asset.id} hover>
                  <TableCell sx={{ fontWeight: 750, color: NAVY }}>{asset.name}</TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={assetType(asset, labels)} /></TableCell>
                  <TableCell>{formatBytes(asset.size)}</TableCell>
                  <TableCell>{date.format(new Date(asset.createdAt))}</TableCell>
                  <TableCell align="right">{asset.downloadCount.toLocaleString(locale)}</TableCell>
                  <TableCell align="right">
                    <Button
                      component="a"
                      href={asset.browserDownloadUrl}
                      download={asset.name}
                      variant={isPrimaryInstaller(asset) ? "contained" : "outlined"}
                      size="small"
                      startIcon={<DownloadIcon />}
                      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 1.5, whiteSpace: "nowrap" }}
                    >
                      {labels.action}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {markdownAssets.length > 0 && (
        <Box sx={{ p: { xs: 2.5, md: 3 }, borderTop: `1px solid ${RULE}`, bgcolor: "#fbfcfd" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
            <Box>
              <Typography sx={{ color: NAVY, fontWeight: 850, fontSize: 17 }}>{labels.guideTitle}</Typography>
              <Typography sx={{ color: NAVY_SOFT, fontSize: 13.5, mt: 0.35 }}>{labels.guideBody}</Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
              {markdownAssets.map((asset) => (
                <Button
                  key={asset.id}
                  component={RouterLink}
                  to={`/download/releases/guide/${asset.id}`}
                  state={{ releaseName: release.name, fileName: asset.name }}
                  variant="outlined"
                  startIcon={<DescriptionOutlinedIcon />}
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 1.5 }}
                >
                  {labels.viewGuide}: {asset.name}
                </Button>
              ))}
            </Stack>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function isPublicDownloadAsset(asset: DesktopReleaseAsset) {
  return /\.(exe|msi|msix|appx|zip|ps1|bat|cmd|dmg|pkg|deb|rpm|appimage)$/i.test(asset.name);
}

function isMarkdownAsset(asset: DesktopReleaseAsset) {
  return /\.(md|markdown)$/i.test(asset.name);
}

function assetType(asset: DesktopReleaseAsset, labels: typeof copy.el | typeof copy.en) {
  const name = asset.name.toLowerCase();
  if (name.endsWith("setup.exe")) return labels.installer;
  if (name.includes("portable")) return labels.portable;
  if (name.includes("server")) return labels.server;
  if (name.includes("client")) return labels.client;
  if (name.endsWith(".nupkg") || name === "releases.win.json") return labels.update;
  if (name.endsWith(".md") || name.endsWith(".pdf")) return labels.guide;
  if (name.includes("sha") || name.includes("checksum")) return labels.checksum;
  return labels.other;
}

function isPrimaryInstaller(asset: DesktopReleaseAsset) {
  return asset.name.toLowerCase().endsWith("setup.exe");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export default DesktopReleasesPage;
