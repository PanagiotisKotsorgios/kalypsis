import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Stack, TextField, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

// «Γέφυρες αρχείων εισπράξεων» — ίδια λίστα εταιρειών με τις κανονικές
// γέφυρες αλλά όλες σημαίνονται ως «υπό ανάπτυξη». Δεν υπάρχει parser
// για κανένα format εισπράξεων ακόμη — η σελίδα υπάρχει ως placeholder
// ώστε τα γραφεία να ξέρουν ότι έρχεται και να μπορούν να ζητήσουν
// προτεραιότητα για τη δική τους ασφαλιστική.

interface AvailableCarrier {
  insuranceCompanyId: string;
  name: string;
  code: string;
  bridgeAvailable: boolean;
  bridgeFormat: string | null;
  unavailableReason: string | null;
}

export function CollectionFilesBridgesPage() {
  const { t } = useTranslation();
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const carriers = useQuery({
    queryKey: ["available-bridges"],
    queryFn: async () => (await api.get<AvailableCarrier[]>("/carrier-bridges/available")).data
  });

  const all = carriers.data ?? [];
  const s = search.trim().toLowerCase();
  const filtered = s
    ? all.filter(c => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s))
    : all;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <ReceiptLongIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("collectionFilesBridges.title", "Γέφυρες αρχείων εισπράξεων")}
          </Typography>
          <Typography color="text.secondary">
            {t("collectionFilesBridges.subtitle",
              "Αυτόματη εισαγωγή εισπράξεων / πληρωμών από αρχεία της κάθε ασφαλιστικής εταιρείας.")}
          </Typography>
        </Box>
      </Stack>

      <Card sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }} spacing={2} mb={2.5}>
          <Box>
            <Typography fontWeight={700}>
              {t("collectionFilesBridges.pickCarrier", "Επιλέξτε ασφαλιστική")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("collectionFilesBridges.countSummary",
                "{{shown}} από {{total}}", { shown: filtered.length, total: all.length })}
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder={t("carrierBridges.searchPlaceholder", "Αναζήτηση: όνομα ή κωδικός…")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              endAdornment: search
                ? <IconButton size="small" onClick={() => setSearch("")}><CloseIcon fontSize="small" /></IconButton>
                : null
            }}
            sx={{ minWidth: { md: 320 } }}
          />
        </Stack>

        {carriers.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : all.length === 0 ? (
          <Alert severity="info">
            {t("collectionFilesBridges.noCarriers", "Δεν υπάρχουν διαθέσιμες ασφαλιστικές εταιρείες.")}
          </Alert>
        ) : (
          <Box sx={{
            display: "grid", gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(3,1fr)" }
          }}>
            {filtered.map(c => (
              <Card key={c.insuranceCompanyId} variant="outlined" sx={{
                p: 2, cursor: "pointer",
                transition: "all 0.15s",
                "&:hover": { borderColor: "primary.main", boxShadow: 2, transform: "translateY(-1px)" }
              }} onClick={() => setPickedName(c.name)}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography fontWeight={700}>{c.name}</Typography>
                  <Chip size="small" icon={<HelpOutlineIcon />}
                    label={t("carrierBridges.unavailable", "Υπό ανάπτυξη")} variant="outlined" />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                  {c.code}
                </Typography>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Alert severity="info" sx={{ gridColumn: "1/-1" }}
                action={<Button size="small" onClick={() => setSearch("")}>
                  {t("common.reset", "Επαναφορά")}
                </Button>}>
                {t("carrierBridges.noMatches", "Καμία εταιρεία δεν ταιριάζει στα φίλτρα.")}
              </Alert>
            )}
          </Box>
        )}
      </Card>

      <Dialog open={!!pickedName} onClose={() => setPickedName(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <HelpOutlineIcon color="warning" />
            <span>{t("collectionFilesBridges.underDevTitle", "Υπό ανάπτυξη")}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t("collectionFilesBridges.underDevBody",
              "Η γέφυρα αρχείων εισπράξεων για την εταιρεία «{{carrier}}» είναι υπό ανάπτυξη. Θα ενεργοποιηθεί σε επόμενη έκδοση.", {
              carrier: pickedName ?? ""
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setPickedName(null)}>
            {t("common.close", "Κλείσιμο")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
