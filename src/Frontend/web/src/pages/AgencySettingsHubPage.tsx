import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import GavelIcon from "@mui/icons-material/Gavel";
import BackupIcon from "@mui/icons-material/Backup";
import BugReportIcon from "@mui/icons-material/BugReport";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { Link as RouterLink } from "react-router-dom";

/**
 * Consolidated «Ρυθμίσεις γραφείου» hub — one sidebar entry now covers
 * agency settings, legal docs and backups. Individual routes still work
 * for bookmarks.
 */
export function AgencySettingsHubPage() {
  const tiles = [
    {
      to: "/app/agency-settings",
      title: "Ρυθμίσεις γραφείου",
      body: "Στοιχεία γραφείου, χρήστες, ρόλοι, e-mail branding, προεπιλογές συμβολαίων, feature flags.",
      icon: <SettingsIcon />, color: "#0b2545",
    },
    {
      to: "/app/legal",
      title: "Νομικά έγγραφα",
      body: "Πρότυπα συμβάσεων, GDPR, έντυπα διαμεσολάβησης — προσαρμοσμένα στο γραφείο σας.",
      icon: <GavelIcon />, color: "#1f7bb3",
    },
    {
      to: "/app/backups",
      title: "Αντίγραφα ασφαλείας",
      body: "Χειροκίνητα και προγραμματισμένα backups + λήψη πλήρους αντιγράφου της βάσης.",
      icon: <BackupIcon />, color: "#16a34a",
    },
    {
      to: "/app/instructions",
      title: "Οδηγίες γραφείου",
      body: "Εσωτερικός οδηγός για το προσωπικό του γραφείου — διαδικασίες, standards, quick-reference.",
      icon: <MenuBookIcon />, color: "#7c3aed",
    },
    {
      to: "/app/support-request",
      title: "Αιτήματα υποστήριξης",
      body: "Στείλτε αίτημα προς την ομάδα Kalypsis με αυτόματα προσαρτημένα diagnostics από τον browser.",
      icon: <BugReportIcon />, color: "#dc2626",
    },
  ];
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
        <SettingsIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Ρυθμίσεις &amp; διαχείριση</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 900 }}>
        Όλες οι ρυθμίσεις γραφείου, τα νομικά έγγραφα και τα αντίγραφα ασφαλείας σε μία σελίδα.
      </Typography>
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" } }}>
        {tiles.map((t) => (
          <Card key={t.to} variant="outlined" sx={{
            borderRadius: 2.5, transition: "border-color 220ms, box-shadow 220ms, transform 220ms",
            "&:hover": { borderColor: t.color, transform: "translateY(-2px)",
              boxShadow: `0 16px 34px -18px ${t.color}55` }
          }}>
            <CardActionArea component={RouterLink} to={t.to} sx={{ p: 3, height: "100%" }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{
                  width: 56, height: 56, borderRadius: 1.5, flexShrink: 0,
                  bgcolor: `${t.color}12`, color: t.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Box sx={{ "& svg": { fontSize: 30 } }}>{t.icon}</Box>
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>{t.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{t.body}</Typography>
                  <Chip size="small" label="Άνοιγμα" sx={{ mt: 1.5, fontWeight: 700 }} />
                </Box>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
export default AgencySettingsHubPage;
