import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { Link as RouterLink } from "react-router-dom";

/**
 * «Γέφυρες Εταιρειών» hub — one sidebar entry replaces four. Presents the
 * four bridge screens as big cards so the sidebar stays lean and the user
 * still gets a one-click path to each specific tool.
 */
export function CarrierBridgesHubPage() {
  const tiles = [
    {
      to: "/app/carrier-bridges",
      title: "Παραγωγή / Γέφυρες εταιρειών",
      body: "Ανέβασμα αρχείων παραγωγής (πωλήσεις / εκδόσεις) από κάθε ασφαλιστική. Παρακολουθήστε τι έχει εισαχθεί και ξανατρέξτε ένα batch.",
      icon: <CloudUploadIcon />,
      color: "#0b2545",
    },
    {
      to: "/app/over-commission-bridges",
      title: "Γέφυρες υπερπρομηθειών",
      body: "Εισαγωγή μηνιαίων πινακίων υπερπρομηθειών από κάθε ασφαλιστική. Το σύστημα τα αντιστοιχίζει σε συνεργάτες και ενημερώνει τα οικονομικά.",
      icon: <StackedLineChartIcon />,
      color: "#1ea7e1",
    },
    {
      to: "/app/collection-files-bridges",
      title: "Γέφυρες οικονομικών (Αρχεία είσπραξης)",
      body: "Ανέβασμα αρχείων είσπραξης από τις ασφαλιστικές για αυτόματη ενημέρωση πληρωμών ασφαλίστρων και συμφωνία με τα ημερολόγια.",
      icon: <ReceiptLongIcon />,
      color: "#2ea44f",
    },
    {
      to: "/app/bridge-code-mappings",
      title: "Αντιστοιχίσεις κωδικών",
      body: "Χαρτογραφήστε τους κωδικούς ασφαλιστικών (κλάδοι, καλύψεις, καταστάσεις) με τους δικούς μας — μια φορά και για πάντα.",
      icon: <SyncAltIcon />,
      color: "#d97706",
    },
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
        <CloudUploadIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Γέφυρες Εταιρειών</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 900 }}>
        Όλες οι γέφυρες (bridges) εισαγωγής αρχείων από τις ασφαλιστικές σε μία σελίδα.
        Επιλέξτε τι θέλετε να διαχειριστείτε.
      </Typography>

      <Box sx={{
        display: "grid",
        gap: 2.5,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" }
      }}>
        {tiles.map((t) => (
          <Card key={t.to} variant="outlined" sx={{
            borderRadius: 2.5,
            // Permanent navy-tinted frame at rest so the tile reads as a
            // labeled container without depending on hover; hover deepens
            // it into the tile's accent colour.
            borderWidth: 1.5,
            borderColor: (theme) => theme.palette.mode === "dark"
              ? "rgba(148,191,230,0.32)"
              : "rgba(11,37,69,0.32)",
            transition: "border-color 220ms, box-shadow 220ms, transform 220ms",
            "&:hover": {
              borderColor: t.color, transform: "translateY(-2px)",
              boxShadow: `0 16px 34px -18px ${t.color}88`,
            }
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
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {t.body}
                  </Typography>
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

export default CarrierBridgesHubPage;
