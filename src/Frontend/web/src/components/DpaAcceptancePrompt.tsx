import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Link, Stack, Typography
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

// Post-login legal-suite acceptance gate. Το endpoint ονομάζεται «/gdpr/dpa/*»
// για συμβατότητα με τον υπάρχοντα κώδικα, αλλά από version «suite-v1.0» και
// πάνω η αποδοχή αφορά ΤΕΣΣΕΡΑ έγγραφα ως ενιαία δέσμη:
//
//   1. Σύμβαση Παροχής Υπηρεσιών Πλατφόρμας (MSA)   — /subscription-agreement
//   2. Σύμβαση Επεξεργασίας Προσωπικών Δεδομένων    — /dpa
//   3. Συμφωνία Επιπέδου Υπηρεσίας (SLA)             — /sla
//   4. Πολιτική Αποδεκτής Χρήσης (AUP)               — /acceptable-use
//
// Ο AgencyAdmin πρέπει να τσεκάρει και τα 4 checkboxes για να ενεργοποιηθεί το
// «Αποδέχομαι» button — legal best practice απαιτεί ξεχωριστή θετική ενέργεια
// ανά έγγραφο, όχι blanket click-through. Άλλοι ρόλοι δεν βλέπουν το modal.

interface DpaStatus {
  currentVersion: string;
  acceptedCurrent: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

interface LegalDoc {
  key: "msa" | "dpa" | "sla" | "aup";
  title: string;
  href: string;
  tag: string;
  summary: string;
}

const DOCS: LegalDoc[] = [
  {
    key: "msa",
    title: "Σύμβαση Παροχής Υπηρεσιών Πλατφόρμας",
    href: "/subscription-agreement",
    tag: "Master Agreement",
    summary: "Η κύρια εμπορική σύμβαση: όροι παροχής, οικονομικά, διάρκεια, εγγυήσεις, ευθύνη, δωσιδικία Μεσολογγίου."
  },
  {
    key: "dpa",
    title: "Σύμβαση Επεξεργασίας Προσωπικών Δεδομένων (DPA)",
    href: "/dpa",
    tag: "GDPR Άρθρο 28",
    summary: "Καθορίζει τη σχέση Kalypsis-Processor / Γραφείο-Controller για τα δεδομένα των πελατών σας."
  },
  {
    key: "sla",
    title: "Συμφωνία Επιπέδου Υπηρεσίας (SLA)",
    href: "/sla",
    tag: "Παράρτημα MSA",
    summary: "Διαθεσιμότητα ≥99,5% μηνιαία, χρόνοι απόκρισης υποστήριξης, backups, credits για παραβίαση στόχων."
  },
  {
    key: "aup",
    title: "Πολιτική Αποδεκτής Χρήσης (AUP)",
    href: "/acceptable-use",
    tag: "Παράρτημα MSA",
    summary: "Τι επιτρέπεται και τι όχι στην Πλατφόρμα. Παραβίαση = άμεση αναστολή πρόσβασης."
  }
];

export function DpaAcceptancePrompt() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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

  useEffect(() => { if (status.data?.acceptedCurrent) setError(null); }, [status.data?.acceptedCurrent]);

  if (!shouldCheck || status.isLoading || !status.data) return null;
  if (status.data.acceptedCurrent) return null;

  const version = status.data.currentVersion;
  const allChecked = DOCS.every(d => checked[d.key]);

  return (
    <Dialog open onClose={() => { /* modal — δεν κλείνει χωρίς αποδοχή */ }}
      maxWidth="md" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <GavelIcon color="primary" />
          <span>
            {t("legalSuite.prompt.title",
              "Απαιτείται αποδοχή του νομικού πλαισίου της Πλατφόρμας")}
          </span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography paragraph>
          {t("legalSuite.prompt.body",
            "Πριν συνεχίσετε να χρησιμοποιείτε την Πλατφόρμα, το γραφείο σας οφείλει να διαβάσει και να αποδεχθεί ρητά τα ακόλουθα τέσσερα έγγραφα ως ενιαία δέσμη.")}
        </Typography>

        <Box sx={{ p: 1.5, bgcolor: "rgba(11,37,69,0.04)", borderRadius: 1.5, mb: 2 }}>
          <Typography variant="body2" fontWeight={700}>
            {t("legalSuite.prompt.currentVersion", "Έκδοση δέσμης:")} {version}
          </Typography>
          {status.data.acceptedVersion && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              {t("legalSuite.prompt.previous",
                "Είχατε αποδεχθεί την έκδοση {{version}} στις {{date}} — απαιτείται νέα αποδοχή για την τρέχουσα δέσμη.", {
                version: status.data.acceptedVersion,
                date: status.data.acceptedAt ? new Date(status.data.acceptedAt).toLocaleDateString("el-GR") : ""
              })}
            </Typography>
          )}
        </Box>

        <Stack spacing={1.5} mb={2}>
          {DOCS.map(doc => (
            <Box key={doc.key} sx={{
              p: 2,
              border: 1,
              borderColor: checked[doc.key] ? "success.main" : "divider",
              borderRadius: 1.5,
              transition: "border-color 0.15s"
            }}>
              <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                <Checkbox
                  checked={!!checked[doc.key]}
                  onChange={e => setChecked(prev => ({ ...prev, [doc.key]: e.target.checked }))}
                  sx={{ p: 0, mt: 0.5 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={0.5} flexWrap="wrap">
                    <Typography fontWeight={700} sx={{ fontSize: 14.5 }}>{doc.title}</Typography>
                    <Chip size="small" label={doc.tag} color="primary" variant="outlined" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {doc.summary}
                  </Typography>
                  <Link href={doc.href} target="_blank" rel="noopener"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5,
                      fontSize: 13, fontWeight: 600 }}>
                    {t("legalSuite.prompt.openDoc", "Άνοιγμα σε νέα καρτέλα")}
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </Link>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Typography variant="caption" color="text.secondary" display="block">
          {t("legalSuite.prompt.footer",
            "Πατώντας «Αποδέχομαι» δηλώνετε ότι έχετε διαβάσει και αποδέχεστε ενσυνείδητα ΚΑΙ ΤΑ ΤΕΣΣΕΡΑ ανωτέρω έγγραφα. Η IP διεύθυνση, το user-agent, η ημερομηνία/ώρα και ο χρήστης καταγράφονται για λόγους non-repudiation.")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => accept.mutate(version)}
          variant="contained"
          disabled={accept.isPending || !allChecked}
          startIcon={accept.isPending ? <CircularProgress size={18} color="inherit" /> : undefined}>
          {accept.isPending
            ? t("legalSuite.prompt.submitting", "Υποβολή…")
            : allChecked
              ? t("legalSuite.prompt.accept",
                  "Αποδέχομαι και τα τέσσερα έγγραφα ({{version}})", { version })
              : t("legalSuite.prompt.needAll",
                  "Τσεκάρετε και τα 4 checkboxes")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
