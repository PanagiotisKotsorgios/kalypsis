import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, LinearProgress, Link, Stack, Typography
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

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
  missingPrivacyNoticeSample: GapCustomer[];
  missingHealthConsentSample: GapCustomer[];
}

export function ComplianceDashboardPage() {
  const { t } = useTranslation();

  const q = useQuery({
    queryKey: ["compliance-dashboard"],
    queryFn: async () => (await api.get<Dashboard>("/compliance-dashboard")).data,
    staleTime: 60_000
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

  const privacyPct = d.totalCustomers > 0
    ? Math.round((d.customersWithPrivacyNotice / d.totalCustomers) * 100)
    : 100;
  const healthPct = d.sensitivePolicyCustomers > 0
    ? Math.round((d.sensitivePolicyCustomersWithHealthConsent / d.sensitivePolicyCustomers) * 100)
    : 100;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <GavelIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("complianceDashboard.title", "Πίνακας Συμμόρφωσης")}
          </Typography>
          <Typography color="text.secondary">
            {t("complianceDashboard.subtitle",
              "GDPR + IDD status του γραφείου σας — πόσους πελάτες καλύπτουν οι υποχρεωτικές συγκαταθέσεις.")}
          </Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2}>
        <ComplianceCard
          title={t("complianceDashboard.gdpr13Title", "Ενημέρωση Υποκειμένου (Άρθρο 13 GDPR)")}
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
          title={t("complianceDashboard.gdpr9Title", "Δεδομένα Υγείας (Άρθρο 9 GDPR)")}
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

      <Alert severity="info">
        {t("complianceDashboard.footer",
          "Οι τιμές υπολογίζονται σε πραγματικό χρόνο. Πάνω από 90% σε κάθε δείκτη = συμμορφούμενο γραφείο έναντι έλεγχου ΑΠΔΠΧ.")}
      </Alert>
    </Box>
  );
}

function ComplianceCard({
  title, description, numerator, denominator, missing, percent, gapSample, gapCta
}: {
  title: string;
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
          <Typography fontWeight={700}>{title}</Typography>
          <Chip
            size="small"
            icon={status === "success" ? <CheckCircleIcon /> : <WarningAmberIcon />}
            label={`${percent}%`}
            color={status}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>{description}</Typography>

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
