import { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, LinearProgress, Link, Stack, Typography
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import HistoryIcon from "@mui/icons-material/History";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

// GDPR + IDD compliance dashboard για το γραφείο-controller.
// Δείχνει σε ένα κοίταγμα ποιοι πελάτες έχουν την απαιτούμενη τεκμηρίωση
// και ποιοι όχι, ώστε ο AgencyAdmin να καλύψει τα κενά προτού γίνουν
// audit issue.

interface GapCustomer {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
}

interface Dashboard {
  totalCustomers: number;
  customersWithPrivacyNotice: number;
  customersMissingPrivacyNotice: number;
  sensitivePolicyCustomers: number;
  sensitivePolicyCustomersWithHealthConsent: number;
  sensitivePolicyCustomersMissingHealthConsent: number;
  customersWithIddNeedsAssessment: number;
  customersMissingIddNeedsAssessment: number;
  highValueCustomers: number;
  highValueCustomersWithAmlKyc: number;
  highValueCustomersMissingAmlKyc: number;
  missingPrivacyNoticeSample: GapCustomer[];
  missingHealthConsentSample: GapCustomer[];
  missingIddSample: GapCustomer[];
  missingAmlKycSample: GapCustomer[];
}

interface BackfillResult {
  created: number;
  alreadyPresent: number;
}

export function ComplianceDashboardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["compliance-dashboard"],
    queryFn: async () => (await api.get<Dashboard>("/compliance-dashboard")).data,
    staleTime: 60_000
  });

  const backfill = useMutation({
    mutationFn: async () => (await api.post<BackfillResult>("/compliance-dashboard/backfill-privacy-notice")).data,
    onSuccess: (res) => {
      setBackfillResult(res);
      setBackfillError(null);
      void qc.invalidateQueries({ queryKey: ["compliance-dashboard"] });
    },
    onError: (e) => setBackfillError(extractErrorMessage(e))
  });

  if (q.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!q.data) return null;
  const d = q.data;

  const pct = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 100) : 100;
  const privacyPct = pct(d.customersWithPrivacyNotice, d.totalCustomers);
  const healthPct  = pct(d.sensitivePolicyCustomersWithHealthConsent, d.sensitivePolicyCustomers);
  // Denominator για IDD = πελάτες με τουλάχιστον ένα συμβόλαιο, το ανακατασκευάζουμε
  // από τα δύο counts (with + missing) — ο controller δεν το εκθέτει ξεχωριστά.
  const iddDen = d.customersWithIddNeedsAssessment + d.customersMissingIddNeedsAssessment;
  const iddPctFixed = pct(d.customersWithIddNeedsAssessment, iddDen);
  const amlPct = pct(d.highValueCustomersWithAmlKyc, d.highValueCustomers);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <GavelIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {t("complianceDashboard.title", "Πίνακας Συμμόρφωσης")}
            </Typography>
            <Typography color="text.secondary">
              {t("complianceDashboard.subtitle",
                "GDPR + IDD + AML/KYC status του γραφείου σας — τι είναι μαζί, τι εκκρεμεί.")}
            </Typography>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setBackfillOpen(true)}>
          {t("complianceDashboard.backfillBtn", "Backfill παλαιών πελατών")}
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2}>
        <ComplianceCard
          title={t("complianceDashboard.gdpr13Title", "Ενημέρωση Υποκειμένου")}
          legalRef="Άρθρο 13 GDPR"
          description={t("complianceDashboard.gdpr13Body",
            "Κάθε πελάτης πρέπει να έχει παραλάβει την Ενημέρωση Υποκειμένου κατά τη συλλογή των στοιχείων του.")}
          numerator={d.customersWithPrivacyNotice}
          denominator={d.totalCustomers}
          missing={d.customersMissingPrivacyNotice}
          percent={privacyPct}
          gapSample={d.missingPrivacyNoticeSample}
          gapCta={t("complianceDashboard.gdpr13Cta",
            "Καταγράψτε consent από την καρτέλα κάθε πελάτη ή δημιουργήστε ξανά με το checkbox της φόρμας.")}
        />
        <ComplianceCard
          title={t("complianceDashboard.gdpr9Title", "Δεδομένα Υγείας")}
          legalRef="Άρθρο 9 GDPR"
          description={t("complianceDashboard.gdpr9Body",
            "Πελάτες με συμβόλαιο Ζωής ή Υγείας πρέπει να έχουν δώσει ρητή συγκατάθεση για επεξεργασία δεδομένων υγείας.")}
          numerator={d.sensitivePolicyCustomersWithHealthConsent}
          denominator={d.sensitivePolicyCustomers}
          missing={d.sensitivePolicyCustomersMissingHealthConsent}
          percent={healthPct}
          gapSample={d.missingHealthConsentSample}
          gapCta={t("complianceDashboard.gdpr9Cta",
            "Ζητήστε από κάθε πελάτη να υπογράψει τη Ρητή Συγκατάθεση (βλ. Νομικά Έντυπα Πελατών).")}
        />
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2}>
        <ComplianceCard
          title={t("complianceDashboard.iddTitle", "Ανάλυση Απαιτήσεων & Αναγκών")}
          legalRef="Ν. 4583/2018 · IDD Άρθρο 27"
          description={t("complianceDashboard.iddBody",
            "Ο διαμεσολαβητής υπογράφει με κάθε πελάτη Ανάλυση Αναγκών πριν προτείνει προϊόν.")}
          numerator={d.customersWithIddNeedsAssessment}
          denominator={iddDen}
          missing={d.customersMissingIddNeedsAssessment}
          percent={iddPctFixed}
          gapSample={d.missingIddSample}
          gapCta={t("complianceDashboard.iddCta",
            "Πάρτε το IDD Demands & Needs έντυπο και υπογράψτε το με τον πελάτη.")}
        />
        <ComplianceCard
          title={t("complianceDashboard.amlTitle", "Δήλωση Πραγματικού Δικαιούχου (AML/KYC)")}
          legalRef="Ν. 4557/2018"
          description={t("complianceDashboard.amlBody",
            "Πελάτες με συμβόλαιο Ζωής ή ετήσιο ασφάλιστρο ≥15.000€ πρέπει να έχουν καταθέσει KYC/AML δήλωση.")}
          numerator={d.highValueCustomersWithAmlKyc}
          denominator={d.highValueCustomers}
          missing={d.highValueCustomersMissingAmlKyc}
          percent={amlPct}
          gapSample={d.missingAmlKycSample}
          gapCta={t("complianceDashboard.amlCta",
            "Συλλέξτε τη Δήλωση Πραγματικού Δικαιούχου + Πηγής Χρημάτων από κάθε πελάτη του dataset.")}
        />
      </Stack>

      <Alert severity="info">
        {t("complianceDashboard.footer",
          "Οι τιμές υπολογίζονται σε πραγματικό χρόνο. Πάνω από 90% σε κάθε δείκτη = συμμορφούμενο γραφείο έναντι ελέγχου ΑΠΔΠΧ/ΤτΕ.")}
      </Alert>

      {/* Backfill dialog — μία φορά για όλους τους παλιούς πελάτες */}
      <Dialog open={backfillOpen} onClose={() => setBackfillOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("complianceDashboard.backfillTitle", "Backfill Ενημέρωσης Υποκειμένου")}</DialogTitle>
        <DialogContent>
          {backfillResult ? (
            <Alert severity="success">
              Δημιουργήθηκαν {backfillResult.created} νέα records. Ήδη υπήρχαν {backfillResult.alreadyPresent}.
            </Alert>
          ) : (
            <>
              <Typography paragraph>
                Η ενέργεια αυτή δημιουργεί ένα ConsentRecord PrivacyNotice
                (Method=Verbal, Version=«backfill-legacy») για κάθε ενεργό πελάτη
                του γραφείου σας που δεν έχει ήδη. Είναι για <strong>παλαιούς
                πελάτες</strong> που δημιουργήθηκαν πριν την ενεργοποίηση του
                mandatory checkbox στη φόρμα δημιουργίας.
              </Typography>
              <Typography paragraph color="warning.main">
                Πατώντας «Εκτέλεση» δηλώνετε ότι είχατε δώσει προφορικά την
                Ενημέρωση Υποκειμένου σε όλους αυτούς τους πελάτες. Η ενέργεια
                γίνεται log στο audit trail με timestamp και IP.
              </Typography>
              {backfillError && (
                <Alert severity="error" onClose={() => setBackfillError(null)}>
                  {backfillError}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBackfillOpen(false); setBackfillResult(null); }}>
            {backfillResult ? "Κλείσιμο" : "Ακύρωση"}
          </Button>
          {!backfillResult && (
            <Button variant="contained" color="warning"
              disabled={backfill.isPending}
              onClick={() => backfill.mutate()}>
              {backfill.isPending ? <CircularProgress size={18} /> : "Εκτέλεση Backfill"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ComplianceCard({
  title, legalRef, description, numerator, denominator, missing, percent, gapSample, gapCta
}: {
  title: string;
  legalRef?: string;
  description: string;
  numerator: number;
  denominator: number;
  missing: number;
  percent: number;
  gapSample: GapCustomer[];
  gapCta: string;
}) {
  const status: "success" | "warning" | "error" =
    percent >= 90 ? "success" : percent >= 60 ? "warning" : "error";
  const barColor = status === "success" ? "success" : status === "warning" ? "warning" : "error";

  return (
    <Card variant="outlined" sx={{ flex: 1 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography fontWeight={700}>{title}</Typography>
            {legalRef && (
              <Chip size="small" label={legalRef} color="primary" variant="outlined" sx={{ mt: 0.5 }} />
            )}
          </Box>
          <Chip
            size="small"
            icon={status === "success" ? <CheckCircleIcon /> : <WarningAmberIcon />}
            label={`${percent}%`}
            color={status}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2} mt={1}>{description}</Typography>

        <Box mb={2}>
          <LinearProgress
            variant="determinate"
            value={percent}
            color={barColor}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Stack direction="row" justifyContent="space-between" mt={0.5}>
            <Typography variant="caption" color="text.secondary">
              {numerator} από {denominator}
            </Typography>
            {missing > 0 && (
              <Typography variant="caption" color="error" fontWeight={700}>
                {missing} εκκρεμότητες
              </Typography>
            )}
          </Stack>
        </Box>

        {gapSample.length > 0 && (
          <>
            <Typography variant="caption" fontWeight={700} display="block" mb={1}>
              Πρόσφατα κενά — δείτε τους πελάτες:
            </Typography>
            <Stack spacing={0.5} mb={1.5}>
              {gapSample.slice(0, 5).map(c => (
                <Link key={c.id} href={`/app/customers/${c.id}`}
                  sx={{ fontSize: 13, textDecoration: "none",
                    "&:hover": { textDecoration: "underline" } }}>
                  {c.displayName} {c.email ? `· ${c.email}` : c.phone ? `· ${c.phone}` : ""}
                </Link>
              ))}
              {gapSample.length > 5 && (
                <Typography variant="caption" color="text.secondary">
                  … και {gapSample.length - 5} ακόμη
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
              {gapCta}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
