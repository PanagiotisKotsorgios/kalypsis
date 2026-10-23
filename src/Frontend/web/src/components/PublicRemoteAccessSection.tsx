import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import { useTranslation } from "react-i18next";

export const REMOTE_ACCESS_TOOLS = [
  {
    name: "RustDesk", logo: "rustdesk.svg", wordmark: false, logoWidth: 26, logoHeight: 26,
    website: "https://rustdesk.com/", download: "https://rustdesk.com/download",
    el: {
      description: "Απομακρυσμένη πρόσβαση στον υπολογιστή σας και τεχνική υποστήριξη, με δυνατότητα χρήσης δικών σας αυτοδιαχειριζόμενων διακομιστών.",
      features: ["Δικοί σας διακομιστές", "Ανοιχτός κώδικας", "Windows · macOS · Linux"],
    },
    en: {
      description: "Remote access to your computer and technical support, with the option to run your own self-hosted servers.",
      features: ["Self-hosted servers", "Open source", "Windows · macOS · Linux"],
    },
  },
  {
    name: "AnyViewer", logo: "anyviewer.png", wordmark: true, logoWidth: 336, logoHeight: 120,
    website: "https://www.anyviewer.com/", download: "https://www.anyviewer.com/download.html",
    el: {
      description: "Αποκτήστε πρόσβαση και ελέγξτε τον υπολογιστή σας από άλλη συσκευή, με εύχρηστα εργαλεία για απομακρυσμένη εργασία, μεταφορά αρχείων και τεχνική βοήθεια.",
      features: ["Υπολογιστές & κινητά", "Μεταφορά αρχείων", "Απομακρυσμένη υποστήριξη"],
    },
    en: {
      description: "Access and control your computer from another device, with easy-to-use tools for remote work, file transfers and technical assistance.",
      features: ["Computers & mobile devices", "File transfer", "Remote support"],
    },
  },
  {
    name: "AnyDesk", logo: "anydesk.png", wordmark: true, logoWidth: 2029, logoHeight: 479,
    website: "https://anydesk.com/en", download: "https://anydesk.com/en/downloads/windows",
    el: {
      description: "Απομακρυσμένος έλεγχος και κοινή χρήση οθόνης για εργασία και τεχνική υποστήριξη, με σύνδεση μεταξύ διαφορετικών λειτουργικών συστημάτων.",
      features: ["Απομακρυσμένος έλεγχος", "Κοινή χρήση οθόνης", "Πολλαπλές πλατφόρμες"],
    },
    en: {
      description: "Remote control and screen sharing for work and technical support, with connections across different operating systems.",
      features: ["Remote control", "Screen sharing", "Multiple platforms"],
    },
  },
  {
    name: "TeamViewer", logo: "teamviewer.svg", wordmark: true, logoWidth: 831, logoHeight: 111,
    website: "https://www.teamviewer.com/", download: "https://www.teamviewer.com/en/download/windows/",
    el: {
      description: "Συνδεθείτε σε υπολογιστές και κινητές συσκευές για απομακρυσμένη υποστήριξη, έλεγχο και κοινή χρήση οθόνης.",
      features: ["Τεχνική υποστήριξη", "Υπολογιστές & κινητά", "Κοινή χρήση οθόνης"],
    },
    en: {
      description: "Connect to computers and mobile devices for remote support, control and screen sharing.",
      features: ["Technical support", "Computers & mobile devices", "Screen sharing"],
    },
  },
];

export function PublicRemoteAccessSection() {
  const { i18n } = useTranslation();
  const english = (i18n.resolvedLanguage ?? i18n.language ?? "el").startsWith("en");
  return <Box component="section" id="remote-access" aria-labelledby="remote-access-title" sx={{
    py: { xs: 5, md: 8 }, bgcolor: "#F7FAFE", borderTop: "1px solid #D7E5F3",
  }}>
    <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} gap={2.5} alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mb: 4, maxWidth: 960 }}>
        <Box aria-hidden sx={{ display: "grid", placeItems: "center", width: 66, height: 66, flexShrink: 0, borderRadius: 2.5, bgcolor: "#E1EFFD", color: "#1265B8", border: "1px solid #C7DFF7" }}>
          <SupportAgentOutlinedIcon sx={{ fontSize: 34 }} />
        </Box>
        <Box>
          <Typography sx={{ color: "#1766B5", fontSize: 11.5, fontWeight: 800, letterSpacing: ".14em", mb: 1 }}>
            {english ? "TOOLS FOR REMOTE SUPPORT" : "ΕΡΓΑΛΕΙΑ ΑΠΟΜΑΚΡΥΣΜΕΝΗΣ ΥΠΟΣΤΗΡΙΞΗΣ"}
          </Typography>
          <Typography component="h2" id="remote-access-title" sx={{ color: "#0B2B54", fontSize: { xs: 27, sm: 32, md: 38 }, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-.025em", textWrap: "balance", mb: 1.5 }}>
            {english ? "Remote access software" : "Προγράμματα απομακρυσμένης πρόσβασης"}
          </Typography>
          <Typography sx={{ color: "#455F7B", fontSize: { xs: 15, md: 16 }, lineHeight: 1.75 }}>
            {english ? "Connect to your computer or get remote assistance with the tool that suits your needs." : "Συνδεθείτε στον υπολογιστή σας ή λάβετε απομακρυσμένη βοήθεια με το εργαλείο που σας εξυπηρετεί."}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
        {REMOTE_ACCESS_TOOLS.map(tool => {
          const copy = english ? tool.en : tool.el;
          return <Box component="article" key={tool.name} aria-labelledby={`remote-${tool.name.toLowerCase()}-title`} sx={{
            minWidth: 0, bgcolor: "#fff", border: "1px solid #D3E1EF", borderRadius: 3, overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 6px 20px rgba(11,43,84,.04)", transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
            "&:hover, &:focus-within": { transform: "translateY(-4px)", borderColor: "#85B5E5", boxShadow: "0 15px 32px rgba(11,43,84,.10)" },
            "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover, &:focus-within": { transform: "none" } },
          }}>
            <Box component="a" href={tool.website} target="_blank" rel="noopener noreferrer"
              aria-label={`${tool.name} — ${english ? "official website (new tab)" : "επίσημος ιστότοπος (νέα καρτέλα)"}`}
              sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, p: { xs: 2.5, sm: 3 }, minHeight: 128, bgcolor: "#F5F9FE", borderBottom: "1px solid #DFEAF5", textDecoration: "none", color: "#0B2B54", "&:focus-visible": { outline: "3px solid #087CEB", outlineOffset: -3 } }}>
              <Box component="h3" id={`remote-${tool.name.toLowerCase()}-title`} sx={{ m: 0, display: "flex", alignItems: "center", gap: 1.75, minWidth: 0, fontSize: { xs: 27, sm: 31 }, fontWeight: 800 }}>
                <Box component="img" src={`/images/remote-access/${tool.logo}`} alt={tool.name} loading="lazy" decoding="async"
                  width={tool.logoWidth} height={tool.logoHeight}
                  sx={{ display: "block", width: tool.wordmark ? { xs: 180, sm: 205 } : 52, height: tool.wordmark ? "auto" : 52, maxWidth: "100%", objectFit: "contain" }} />
                {!tool.wordmark && <Box component="span" aria-hidden>RustDesk</Box>}
              </Box>
              <OpenInNewIcon aria-hidden sx={{ color: "#597997", fontSize: 21, flexShrink: 0 }} />
            </Box>
            <Box sx={{ p: { xs: 2.5, sm: 3 }, flex: 1, display: "flex", flexDirection: "column" }}>
              <Typography sx={{ color: "#455F7B", fontSize: 15.5, lineHeight: 1.8, mb: 2.5 }}>{copy.description}</Typography>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
                {copy.features.map(feature => <Chip key={feature} label={feature} size="small" sx={{ bgcolor: "#EDF5FE", color: "#1B527F", border: "1px solid #D3E5F7", fontWeight: 650, height: "auto", "& .MuiChip-label": { py: .5, whiteSpace: "normal" } }} />)}
              </Stack>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1.5} sx={{ mt: "auto" }}>
                <Button component="a" href={tool.download} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<DownloadIcon />}
                  aria-label={`${english ? "Download" : "Λήψη"} ${tool.name} — ${english ? "official download page (new tab)" : "επίσημη σελίδα λήψης (νέα καρτέλα)"}`}
                  sx={{ bgcolor: "#0B2B54", color: "#fff", textTransform: "none", fontWeight: 800, borderRadius: 1.5, px: 2.5, py: 1.25, boxShadow: "none", "&:hover": { bgcolor: "#164D85", boxShadow: "none" } }}>
                  {english ? "Official download" : "Επίσημη λήψη"}
                </Button>
                <Button component="a" href={tool.website} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                  sx={{ color: "#14599F", fontWeight: 750, textTransform: "none" }}>
                  {english ? "Learn more" : "Περισσότερα"}
                </Button>
              </Stack>
            </Box>
          </Box>;
        })}
      </Box>
    </Container>
  </Box>;
}
