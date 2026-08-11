import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import VerifiedIcon from "@mui/icons-material/Verified";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BalanceIcon from "@mui/icons-material/Balance";
import { Link as RouterLink } from "react-router-dom";

/**
 * «Ταυτοποίηση & καταμερισμοί» hub — one sidebar entry now covers the three
 * financial-reconciliation tools:
 *   – Ταυτοποίηση Οικονομικών     (monthly billing vs collections vs paid)
 *   – Ταυτοποίηση Συνεργατών      (per-producer declared vs computed)
 *   – Καταμερισμός Προμηθειών     (who took what, ledger view across sources)
 * Individual routes still work for bookmarks.
 */
export function ReconciliationHubPage() {
  const tiles = [
    {
      to: "/app/reconciliation-dashboard",
      title: "Ταυτοποίηση Οικονομικών",
      body: "Μηνιαία σύνοψη ασφαλίστρων, εισπράξεων και προμηθειών του γραφείου. Εντοπίζει καθυστερήσεις είσπραξης και αποκλίσεις εκκαθαρίσεων.",
      icon: <AssessmentIcon />, color: "#0b2545",
    },
    {
      to: "/app/producer-reconciliation",
      title: "Ταυτοποίηση Συνεργατών",
      body: "Σύγκριση δηλωμένων vs υπολογισμένων προμηθειών ανά συνεργάτη, ανά ασφαλιστική και ανά κανόνα προμήθειας.",
      icon: <VerifiedIcon />, color: "#1f7bb3",
    },
    {
      to: "/app/commission-distribution",
      title: "Καταμερισμός Προμηθειών",
      body: "Ποιος πήρε τι, ανά ιεραρχία. Πηγή δεδομένων: συμβόλαια, μηνιαία πινάκια υπερπρομηθειών, ή όλα μαζί.",
      icon: <AccountTreeIcon />, color: "#16a34a",
    },
  ];
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
        <BalanceIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Ταυτοποιήσεις &amp; Καταμερισμοί</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 900 }}>
        Όλα τα εργαλεία οικονομικής ταυτοποίησης και κατανομής προμηθειών του γραφείου σε μία σελίδα —
        από τη μηνιαία ροή του ταμείου μέχρι το ποιος έβγαλε τι, μαζί ή χωριστά με τα πινάκια υπερπρομηθειών.
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
export default ReconciliationHubPage;
