import { useEffect, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Link, Stack, Typography
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// GDPR Άρθρο 28 — υφιστάμενα γραφεία που εγγράφηκαν πριν την προσθήκη του DPA
// checkbox στο /register πρέπει να το αποδεχθούν την πρώτη φορά που θα
// μπουν μετά το deploy. Επίσης, σε νέα έκδοση του DPA (bump στο
// DpaController.CurrentVersion), όλοι πρέπει να ξανα-αποδεχθούν.
//
// Το modal εμφανίζεται μόνο σε AgencyAdmin — μόνο αυτοί έχουν εξουσιοδότηση
// να υπογράψουν εκ μέρους του γραφείου. Για AgencyUser/Producer παραβλέπεται
// σιωπηλά· ο administrator θα το δει και θα το αποδεχθεί όταν συνδεθεί.

interface DpaStatus {
  currentVersion: string;
  acceptedCurrent: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

export function DpaAcceptancePrompt() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const shouldCheck = !!user && user.role === "AgencyAdmin";

  const status = useQuery({
    queryKey: ["dpa-status"],
    enabled: shouldCheck,
    queryFn: async () => (await api.get<DpaStatus>("/gdpr/dpa/status")).data,
    staleTime: 5 * 60_000
  });

  const accept = useMutation({
    mutationFn: async (version: string) => {
      setError(null);
      return (await api.post<DpaStatus>("/gdpr/dpa/accept", { version })).data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["dpa-status"] }); },
    onError: e => setError(extractErrorMessage(e))
  });

  // Reset error μεταξύ dialog opens
  useEffect(() => { if (status.data?.acceptedCurrent) setError(null); }, [status.data?.acceptedCurrent]);

  if (!shouldCheck || status.isLoading || !status.data) return null;
  if (status.data.acceptedCurrent) return null;

  const version = status.data.currentVersion;

  return (
    <Dialog open onClose={() => { /* modal — δεν κλείνει χωρίς αποδοχή */ }} maxWidth="sm" fullWidth
      disableEscapeKeyDown>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <GavelIcon color="primary" />
          <span>{t("dpa.prompt.title", "Απαιτείται αποδοχή Σύμβασης Επεξεργασίας")}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography paragraph>
          {t("dpa.prompt.body", "Το Άρθρο 28 GDPR απαιτεί από κάθε γραφείο-Υπεύθυνο Επεξεργασίας να αποδεχθεί ρητά τη Σύμβαση Επεξεργασίας Προσωπικών Δεδομένων (DPA) με την Kalypsis-Εκτελών την Επεξεργασία, πριν την περαιτέρω χρήση της πλατφόρμας.")}
        </Typography>
        <Box sx={{ p: 2, bgcolor: "rgba(11,37,69,0.04)", borderRadius: 1.5, mb: 2 }}>
          <Typography fontWeight={700} mb={1}>
            {t("dpa.prompt.currentVersion", "Τρέχουσα έκδοση:")} {version}
          </Typography>
          <Typography variant="body2">
            {t("dpa.prompt.readFirst", "Παρακαλούμε διαβάστε πρώτα το πλήρες κείμενο:")}{" "}
            <Link component={RouterLink} to="/dpa" target="_blank" rel="noopener" fontWeight={700}>
              {t("dpa.prompt.openDpa", "Άνοιγμα DPA σε νέα καρτέλα")}
            </Link>
          </Typography>
          {status.data.acceptedVersion && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              {t("dpa.prompt.previous",
                "Είχατε αποδεχθεί την έκδοση {{version}} στις {{date}} — απαιτείται νέα αποδοχή για την τρέχουσα έκδοση.", {
                version: status.data.acceptedVersion,
                date: status.data.acceptedAt ? new Date(status.data.acceptedAt).toLocaleDateString("el-GR") : ""
              })}
            </Typography>
          )}
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary">
          {t("dpa.prompt.footer", "Πατώντας «Αποδέχομαι» δηλώνετε ότι έχετε διαβάσει και αποδέχεστε τους όρους της Σύμβασης. Η IP διεύθυνση και το user-agent σας καταγράφονται για λόγους non-repudiation.")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => accept.mutate(version)}
          variant="contained"
          disabled={accept.isPending}
          startIcon={accept.isPending ? <CircularProgress size={18} color="inherit" /> : undefined}>
          {accept.isPending
            ? t("dpa.prompt.submitting", "Υποβολή…")
            : t("dpa.prompt.accept", "Αποδέχομαι το DPA {{version}}", { version })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
