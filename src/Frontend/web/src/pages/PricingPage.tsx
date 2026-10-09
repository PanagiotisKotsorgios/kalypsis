import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import CalculateIcon from "@mui/icons-material/Calculate";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import Groups2Icon from "@mui/icons-material/Groups2";
import TuneIcon from "@mui/icons-material/Tune";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { PublicShell } from "../components/PublicShell";

interface PlanDefinition {
  code: string;
  tagline: string;
  pricePerYear: number;
  includedOffices: number;
  includedUsers: number;
  extraOfficePerYear: number;
  extraUserPerYear: number;
  packages: string[];
}
interface AddonDefinition {
  code: string;
  description: string;
  pricePerYear: number;
}
interface ServiceDefinition {
  code: string;
  description: string;
  unitLabel: string;
  unitPrice: number;
}
interface PricingCatalog {
  version: number;
  plans: PlanDefinition[];
  addons: AddonDefinition[];
  services: ServiceDefinition[];
}

const EUR = new Intl.NumberFormat("el-GR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const RED = "#b42318";
const NAVY = "#0b2545";
const BLUE = "#1f7bb3";
const RULE = "#dce5ef";

const FALLBACK_CATALOG: PricingCatalog = {
  version: 1,
  plans: [
    {
      code: "Producer",
      tagline: "Για έναν συνεργάτη με portal",
      pricePerYear: 90,
      includedOffices: 0,
      includedUsers: 1,
      extraOfficePerYear: 0,
      extraUserPerYear: 60,
      packages: ["ProducerPortal"],
    },
    {
      code: "Standard",
      tagline: "Ένα γραφείο με τις βασικές λειτουργίες",
      pricePerYear: 550,
      includedOffices: 1,
      includedUsers: 4,
      extraOfficePerYear: 400,
      extraUserPerYear: 150,
      packages: ["BackOffice", "ClientPortal", "CRM", "AllBridges"],
    },
    {
      code: "Growth",
      tagline: "Για περισσότερα γραφεία και αναφορές",
      pricePerYear: 950,
      includedOffices: 2,
      includedUsers: 6,
      extraOfficePerYear: 350,
      extraUserPerYear: 180,
      packages: [
        "BackOffice",
        "ClientPortal",
        "CRM",
        "AllBridges",
        "Reporting",
      ],
    },
    {
      code: "Premium",
      tagline: "Πλήρης σουίτα και προτεραιότητα",
      pricePerYear: 1800,
      includedOffices: 3,
      includedUsers: 10,
      extraOfficePerYear: 500,
      extraUserPerYear: 240,
      packages: [
        "BackOffice",
        "ClientPortal",
        "CRM",
        "AllBridges",
        "Intelligence",
        "CustomIntegrations",
        "PrioritySupport",
      ],
    },
  ],
  addons: [
    {
      code: "FrontOffice",
      description: "Ιστοσελίδα γραφείου και φόρμες ενδιαφέροντος",
      pricePerYear: 400,
    },
    {
      code: "Intelligence",
      description: "Αναφορές, στόχοι και εργαλεία νοημοσύνης",
      pricePerYear: 300,
    },
    {
      code: "AdvancedBridges",
      description: "Προηγμένες γέφυρες ασφαλιστικών εταιρειών",
      pricePerYear: 200,
    },
    {
      code: "PrioritySupport",
      description: "Προτεραιότητα υποστήριξης",
      pricePerYear: 600,
    },
    {
      code: "CustomIntegrations",
      description: "Προσαρμοσμένες διασυνδέσεις και API",
      pricePerYear: 1200,
    },
  ],
  services: [
    {
      code: "RemoteTraining",
      description: "Εξ αποστάσεως εκπαίδευση",
      unitLabel: "ώρα",
      unitPrice: 15,
    },
    {
      code: "OnsiteTraining",
      description: "Εκπαίδευση στην έδρα",
      unitLabel: "ώρα",
      unitPrice: 45,
    },
    {
      code: "DataMigration",
      description: "Μεταφορά δεδομένων",
      unitLabel: "εφάπαξ",
      unitPrice: 500,
    },
    {
      code: "CustomDevelopment",
      description: "Προσαρμοσμένη ανάπτυξη",
      unitLabel: "ώρα",
      unitPrice: 200,
    },
  ],
};

const PACKAGE_DETAILS = [
  {
    numeral: "I",
    code: "BackOffice",
    title: "BackOffice — Το λογιστήριο του γραφείου",
    lead: "Πελάτες, συμβόλαια, ταμείο, προμήθειες.",
    body: "Ο πυρήνας του γραφείου σας: ψηφιακό αρχείο πελατών, κατάλογος ασφαλιστικών εταιρειών, παραγωγοί δικτύου, χειροκίνητη ή αυτοματοποιημένη καταχώρηση συμβολαίων. Ταμειακές, εισπράξεις, διαχείριση προμηθειών και υπερπρομηθειών, συμφωνία τραπεζικών εκτυπώσεων, λογιστικές εξαγωγές για τον λογιστή σας. Γέφυρες προς παλιά back-office προγράμματα για ομαλή μετάβαση.",
    color: BLUE,
  },
  {
    numeral: "II",
    code: "CRM",
    title: "CRM & Πύλη Πελάτη — Η εμπειρία του πελάτη σας",
    lead: "Αυτοεξυπηρέτηση, ραντεβού, καμπάνιες.",
    body: "Ο πελάτης σας ζει μέσα στην εφαρμογή σας. Πύλη πελάτη και mobile εφαρμογή για iOS και Android, αιτήματα και εκκρεμότητες, ραντεβού, αυτόματες υπενθυμίσεις λήξης μέσω email/SMS/Viber, διαχείριση εγγράφων και ψηφιακές υπογραφές. Καμπάνιες marketing και μαζική επικοινωνία, αρχείο συγκαταθέσεων GDPR.",
    color: "#496de8",
  },
  {
    numeral: "III",
    code: "Intelligence",
    title: "Αναλυτικά & Νοημοσύνη — Η επιχειρηματική σας εικόνα",
    lead: "Αναφορές, στόχοι, AI, audit.",
    body: "Παρακολούθηση παραγωγής με στόχους ανά συνεργάτη και υποκατάστημα. Δημιουργός αναφορών drag-and-drop με αυτόματη αποστολή μέσω email, εξαγωγή σε Excel ή PDF. AI εξαγωγή στοιχείων από PDF συμβολαίου, AI πρόβλεψη απώλειας πελατών, AI σύνταξη επικοινωνιών. Audit logs για κάθε ενέργεια χρήστη και πλήρες ιστορικό μεταβολών.",
    color: "#155783",
  },
  {
    numeral: "IV",
    code: "Integrations",
    title: "Ενσωματώσεις & Συμμόρφωση — Το ελληνικό οικοσύστημα",
    lead: "myDATA, τηλεφωνία, online πληρωμές.",
    body: "Όλο το ελληνικό περιβάλλον μέσα στην εφαρμογή. Υποβολή myDATA στην Ανεξάρτητη Αρχή, ηλεκτρονικά τιμολόγια, online πληρωμές μέσω e-pos τραπεζών, ePay, DIAS και Viva Wallet. Τηλεφωνία VoIP με ηχογράφηση και αυτόματη απομαγνητοφώνηση κλήσεων στα ελληνικά. Συγχρονισμός email Gmail/Outlook μέσω IMAP, πολλαπλά υποκαταστήματα, B2B portal συνεργατών.",
    color: "#244f78",
  },
  {
    numeral: "V",
    code: "Ermes",
    title: "ΕΡΜΗΣ — Ασφαλής επικοινωνία",
    lead: "Ασφαλής επικοινωνία γραφείου.",
    body: "Εσωτερικά μηνύματα, ομάδες, συνημμένα, κρυπτογραφημένη επικοινωνία και ασφαλείς συναντήσεις.",
    color: "#2b7a78",
  },
] as const;

const PLAN_LABELS: Record<string, string> = {
  Producer: "Συνεργάτης",
  Standard: "Βασικό",
  Growth: "Ανάπτυξη",
  Premium: "Πλήρες",
};
const ADDON_LABELS: Record<string, string> = {
  FrontOffice: "Ιστοσελίδα γραφείου",
  Intelligence: "Αναφορές & Νοημοσύνη",
  AdvancedBridges: "Προηγμένες γέφυρες",
  PrioritySupport: "Προτεραιότητα υποστήριξης",
  CustomIntegrations: "Προσαρμοσμένες διασυνδέσεις",
};
const SERVICE_LABELS: Record<string, string> = {
  RemoteTraining: "Εξ αποστάσεως εκπαίδευση",
  OnsiteTraining: "Εκπαίδευση στην έδρα",
  DataMigration: "Μεταφορά δεδομένων",
  CustomDevelopment: "Προσαρμοσμένη ανάπτυξη",
};

function planIncludes(plan: PlanDefinition, code: string) {
  if (code === "CRM")
    return (
      plan.packages.includes("CRM") || plan.packages.includes("ClientPortal")
    );
  if (code === "Integrations")
    return (
      plan.packages.includes("AllBridges") ||
      plan.packages.includes("CustomIntegrations")
    );
  if (code === "Intelligence")
    return (
      plan.packages.includes("Intelligence") ||
      plan.packages.includes("Reporting")
    );
  return plan.packages.includes(code);
}

function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="overline"
        sx={{ color: BLUE, fontWeight: 900, letterSpacing: ".13em" }}
      >
        {eyebrow}
      </Typography>
      <Typography
        variant="h3"
        sx={{
          mt: 0.25,
          color: NAVY,
          fontWeight: 950,
          fontSize: { xs: 27, md: 40 },
          letterSpacing: "-.035em",
        }}
      >
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.55 }}>
        {body}
      </Typography>
    </Box>
  );
}

export function PricingPage() {
  const pricing = useQuery({
    queryKey: ["public-pricing"],
    queryFn: async () =>
      (await api.get<PricingCatalog>("/platform/pricing")).data,
    staleTime: 5 * 60 * 1000,
  });
  const catalog = pricing.data ?? FALLBACK_CATALOG;
  const [planCode, setPlanCode] = useState(catalog.plans[0]?.code ?? "");
  const [extraOffices, setExtraOffices] = useState(0);
  const [extraUsers, setExtraUsers] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>(
    {},
  );
  useEffect(() => {
    if (!catalog.plans.some((p) => p.code === planCode))
      setPlanCode(catalog.plans[0]?.code ?? "");
  }, [catalog.plans, planCode]);
  const plan =
    catalog.plans.find((p) => p.code === planCode) ?? catalog.plans[0];
  const base = plan?.pricePerYear ?? 0;
  const officeCost = (plan?.extraOfficePerYear ?? 0) * extraOffices;
  const userCost = (plan?.extraUserPerYear ?? 0) * extraUsers;
  const addonCost = useMemo(
    () =>
      catalog.addons
        .filter((a) => selectedAddons[a.code])
        .reduce((sum, a) => sum + a.pricePerYear, 0),
    [catalog.addons, selectedAddons],
  );
  const total = base + officeCost + userCost + addonCost;

  return (
    <PublicShell>
      <Box sx={{ bgcolor: "#f7f9fc", minHeight: "100vh", pb: 8 }}>
        <Box sx={{ bgcolor: NAVY, color: "#fff", py: { xs: 5, md: 7 } }}>
          <Container maxWidth="xl">
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ md: "end" }}
              gap={2}
            >
              <Box sx={{ maxWidth: 850 }}>
                <Chip
                  label="KALYPSIS · ΤΙΜΟΚΑΤΑΛΟΓΟΣ"
                  sx={{
                    bgcolor: "rgba(255,255,255,.13)",
                    color: "#fff",
                    fontWeight: 900,
                    mb: 1.5,
                  }}
                />
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 950,
                    fontSize: { xs: 36, md: 57 },
                    lineHeight: 1.04,
                    letterSpacing: "-.05em",
                  }}
                >
                  Όλα τα πακέτα και οι τιμές σε μία καθαρή εικόνα.
                </Typography>
                <Typography
                  sx={{
                    mt: 1.5,
                    color: "rgba(255,255,255,.82)",
                    lineHeight: 1.65,
                  }}
                >
                  Σύγκρινε τι καλύπτει κάθε πακέτο, πρόσθεσε γραφεία/χρήστες και
                  δες αμέσως το ετήσιο σύνολο.
                </Typography>
              </Box>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                <Chip
                  icon={<BusinessCenterIcon />}
                  label="Ανά γραφείο"
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,.35)" }}
                  variant="outlined"
                />
                <Chip
                  icon={<WorkspacePremiumIcon />}
                  label="Ετήσια τιμή"
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,.35)" }}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Container>
        </Box>
        <Container maxWidth="xl" sx={{ mt: 3 }}>
          {pricing.isError && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ο ζωντανός κατάλογος δεν ήταν διαθέσιμος προσωρινά· εμφανίζονται
              οι βασικές τιμές.
            </Alert>
          )}
          <SectionTitle
            eyebrow="01 · ΣΥΓΚΡΙΣΗ"
            title="Πλάνα, τιμές και περιεχόμενο"
            body="Ο πίνακας είναι ο βασικός οδηγός: κάθε στήλη είναι ένα πλάνο και κάθε γραμμή εξηγεί ακριβώς τι περιλαμβάνεται."
          />
          <Paper
            sx={{
              overflowX: "auto",
              border: `1px solid ${RULE}`,
              borderRadius: 2,
            }}
          >
            <Table stickyHeader sx={{ minWidth: 960 }}>
              <TableHead>
                <TableRow>
                  {[
                    "Πλάνο",
                    ...catalog.plans.map((p) => PLAN_LABELS[p.code] ?? p.code),
                  ].map((label, i) => (
                    <TableCell
                      key={label}
                      align={i ? "center" : "left"}
                      sx={{
                        bgcolor: "#eaf0f6",
                        color: NAVY,
                        fontWeight: 950,
                        minWidth: i ? 180 : 250,
                      }}
                    >
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Ετήσια τιμή</TableCell>
                  {catalog.plans.map((p) => (
                    <TableCell key={p.code} align="center">
                      <Typography
                        sx={{ color: RED, fontWeight: 950, fontSize: 25 }}
                      >
                        {EUR.format(p.pricePerYear)}
                      </Typography>
                      <Typography variant="caption">/ έτος</Typography>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow hover>
                  <TableCell sx={{ fontWeight: 900 }}>Περιγραφή</TableCell>
                  {catalog.plans.map((p) => (
                    <TableCell key={p.code} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {p.tagline}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow hover>
                  <TableCell sx={{ fontWeight: 900 }}>
                    Γραφεία / χρήστες
                  </TableCell>
                  {catalog.plans.map((p) => (
                    <TableCell key={p.code} align="center">
                      <Typography variant="body2">
                        {p.includedOffices || 1} γραφείο · {p.includedUsers}{" "}
                        χρήστες
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        +{EUR.format(p.extraOfficePerYear)} / γραφείο · +
                        {EUR.format(p.extraUserPerYear)} / χρήστη
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
                {PACKAGE_DETAILS.map((pkg) => (
                  <TableRow hover key={pkg.code}>
                    <TableCell sx={{ fontWeight: 900 }}>
                      <Chip
                        size="small"
                        label={pkg.numeral}
                        sx={{
                          mr: 0.75,
                          bgcolor: `${pkg.color}18`,
                          color: pkg.color,
                          fontWeight: 950,
                        }}
                      />
                      {pkg.code === "Ermes" ? "ΕΡΜΗΣ" : pkg.code}
                    </TableCell>
                    {catalog.plans.map((p) => (
                      <TableCell key={p.code} align="center">
                        {planIncludes(p, pkg.code) ? (
                          <CheckCircleOutlineIcon sx={{ color: "#16803c" }} />
                        ) : (
                          <Typography color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <SectionTitle
            eyebrow="02 · ΠΑΚΕΤΑ"
            title="Τι περιλαμβάνει το κάθε πακέτο"
            body="Συμπυκνωμένη περιγραφή ανά πακέτο, με όλο το περιεχόμενο διαθέσιμο σε μία γραμμή πίνακα."
          />
          <Paper
            sx={{
              overflowX: "auto",
              border: `1px solid ${RULE}`,
              borderRadius: 2,
            }}
          >
            <Table sx={{ minWidth: 1050 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#eaf0f6" }}>
                  <TableCell sx={{ fontWeight: 950, color: NAVY, width: 255 }}>
                    Πακέτο
                  </TableCell>
                  <TableCell sx={{ fontWeight: 950, color: NAVY, width: 270 }}>
                    Καλύπτει
                  </TableCell>
                  <TableCell sx={{ fontWeight: 950, color: NAVY }}>
                    Αναλυτικά
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {PACKAGE_DETAILS.map((pkg) => (
                  <TableRow hover key={pkg.code}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography
                          sx={{
                            color: pkg.color,
                            fontWeight: 950,
                            fontSize: 24,
                          }}
                        >
                          {pkg.numeral}
                        </Typography>
                        <Box>
                          <Typography fontWeight={950} color={NAVY}>
                            {pkg.title}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: pkg.color, fontWeight: 800 }}
                          >
                            ΠΑΚΕΤΟ
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={850}>{pkg.lead}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.6 }}
                      >
                        {pkg.body}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <SectionTitle
            eyebrow="03 · ΣΥΝΔΥΑΣΜΟΙ"
            title="Αυτό + αυτό = αυτό"
            body="Ενδεικτικές συνθέσεις για να καταλάβεις γρήγορα το αποτέλεσμα."
          />
          <Paper
            sx={{
              overflowX: "auto",
              border: `1px solid ${RULE}`,
              borderRadius: 2,
            }}
          >
            <Table sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#eaf0f6" }}>
                  {["Συνδυασμός", "Αποτέλεσμα", "Καλύπτει"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 950, color: NAVY }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  [
                    "BackOffice + CRM",
                    "Ολοκληρωμένη λειτουργία γραφείου",
                    "Διαχείριση + πελατοκεντρική επικοινωνία",
                  ],
                  [
                    "BackOffice + Αναλυτικά & Νοημοσύνη",
                    "Γραφείο με πλήρη εικόνα",
                    "Παραγωγή + στόχοι + αναφορές + AI",
                  ],
                  [
                    "CRM + ΕΡΜΗΣ",
                    "Συνεχής επικοινωνία",
                    "Portal + μηνύματα + συναντήσεις",
                  ],
                ].map(([combo, result, covers]) => (
                  <TableRow hover key={combo}>
                    <TableCell sx={{ fontWeight: 900, color: NAVY }}>
                      {combo}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{result}</TableCell>
                    <TableCell color="text.secondary">{covers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <SectionTitle
            eyebrow="04 · ΥΠΟΛΟΓΙΣΜΟΣ"
            title="Υπολόγισε το δικό σου σύνολο"
            body="Μία μικρή φόρμα, δίπλα στο αποτέλεσμα, χωρίς να χρειάζεται να αλλάξεις σελίδα."
          />
          <Paper
            sx={{
              p: { xs: 2, md: 2.5 },
              border: `2px solid ${BLUE}40`,
              borderRadius: 2,
            }}
          >
            <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ flex: 1 }}
              >
                <TextField
                  select
                  size="small"
                  label="Βασικό πλάνο"
                  value={plan?.code ?? ""}
                  onChange={(e) => setPlanCode(e.target.value)}
                  fullWidth
                >
                  {catalog.plans.map((p) => (
                    <MenuItem value={p.code} key={p.code}>
                      {PLAN_LABELS[p.code] ?? p.code} ·{" "}
                      {EUR.format(p.pricePerYear)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="number"
                  label="Επιπλέον γραφεία"
                  value={extraOffices}
                  onChange={(e) =>
                    setExtraOffices(Math.max(0, Number(e.target.value)))
                  }
                  inputProps={{ min: 0 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Επιπλέον χρήστες"
                  value={extraUsers}
                  onChange={(e) =>
                    setExtraUsers(Math.max(0, Number(e.target.value)))
                  }
                  inputProps={{ min: 0 }}
                />
              </Stack>
              <Stack
                direction="row"
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                gap={0.25}
              >
                {catalog.addons.map((a) => (
                  <FormControlLabel
                    key={a.code}
                    control={
                      <Checkbox
                        size="small"
                        checked={!!selectedAddons[a.code]}
                        onChange={(e) =>
                          setSelectedAddons((s) => ({
                            ...s,
                            [a.code]: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={
                      <Typography variant="caption">
                        {ADDON_LABELS[a.code] ?? a.code} (+
                        {EUR.format(a.pricePerYear)})
                      </Typography>
                    }
                  />
                ))}
              </Stack>
              <Box
                sx={{
                  minWidth: { lg: 230 },
                  borderLeft: { lg: `1px solid ${RULE}` },
                  pl: { lg: 2 },
                }}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  <CalculateIcon sx={{ color: BLUE }} />
                  <Typography fontWeight={950}>Σύνολο</Typography>
                </Stack>
                <Typography sx={{ color: RED, fontWeight: 950, fontSize: 29 }}>
                  {EUR.format(total)} / έτος
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Βάση {EUR.format(base)} + γραφεία {EUR.format(officeCost)} +
                  χρήστες {EUR.format(userCost)} + πρόσθετα{" "}
                  {EUR.format(addonCost)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <Paper
            sx={{
              p: { xs: 2, md: 2.5 },
              bgcolor: "#fff5f4",
              border: "1px solid #f1c4bf",
              borderRadius: 2,
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
              gap={2}
            >
              <Box>
                <Stack direction="row" alignItems="center" gap={1}>
                  <TuneIcon sx={{ color: RED }} />
                  <Typography variant="h6" fontWeight={950} color={NAVY}>
                    Παραμετροποίηση ανά γραφείο
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Ο διαχειριστής μπορεί να επεξεργάζεται τις κεντρικές τιμές και
                  να ρυθμίζει ενεργά πακέτα, γραφεία και χρήστες ανά γραφείο.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                <Button
                  component={RouterLink}
                  to="/app/platform/finance?tab=plans"
                  variant="contained"
                  startIcon={<TuneIcon />}
                  sx={{
                    bgcolor: RED,
                    fontWeight: 900,
                    "&:hover": { bgcolor: "#8f1c13" },
                  }}
                >
                  Επεξεργασία τιμών
                </Button>
                <Button
                  component={RouterLink}
                  to="/app/platform/finance?tab=billing"
                  variant="outlined"
                  startIcon={<Groups2Icon />}
                  sx={{ borderColor: RED, color: RED, fontWeight: 900 }}
                >
                  Ανά γραφείο
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          <Typography
            variant="overline"
            sx={{ color: BLUE, fontWeight: 900, letterSpacing: ".13em" }}
          >
            05 · ΠΡΟΑΙΡΕΤΙΚΕΣ ΥΠΗΡΕΣΙΕΣ
          </Typography>
          <Paper
            sx={{
              mt: 1,
              overflowX: "auto",
              border: `1px solid ${RULE}`,
              borderRadius: 2,
            }}
          >
            <Table sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#eaf0f6" }}>
                  <TableCell sx={{ fontWeight: 950, color: NAVY }}>
                    Υπηρεσία
                  </TableCell>
                  <TableCell sx={{ fontWeight: 950, color: NAVY }}>
                    Μονάδα
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 950, color: NAVY }}
                  >
                    Τιμή
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.services.map((s) => (
                  <TableRow hover key={s.code}>
                    <TableCell>
                      {SERVICE_LABELS[s.code] ?? s.description}
                    </TableCell>
                    <TableCell>{s.unitLabel}</TableCell>
                    <TableCell align="right">
                      <Typography sx={{ color: RED, fontWeight: 950 }}>
                        {EUR.format(s.unitPrice)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Container>
        <Container maxWidth="md" sx={{ mt: 5, textAlign: "center" }}>
          <Typography variant="h5" fontWeight={950} color={NAVY}>
            Θες να το προσαρμόσουμε στο γραφείο σου;
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Επικοινώνησε μαζί μας για ενεργοποίηση πακέτων ή ειδική τιμολόγηση.
          </Typography>
          <Button
            component={RouterLink}
            to="/contact"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            sx={{ mt: 2, bgcolor: NAVY, fontWeight: 900 }}
          >
            Ζήτησε διαμόρφωση
          </Button>
        </Container>
      </Box>
    </PublicShell>
  );
}

/**
 * Temporary public placeholder for pricing while the new catalogue is being
 * finalised.  The full PricingPage stays available in the source so it can be
 * re-enabled without rebuilding the pricing model from scratch.
 */
export function PricingComingSoonPage() {
  return (
    <PublicShell modernNav>
      <Box
        sx={{
          minHeight: { xs: "68vh", md: "72vh" },
          display: "grid",
          placeItems: "center",
          px: { xs: 2, md: 4 },
          py: { xs: 7, md: 12 },
          background:
            "radial-gradient(circle at 15% 10%, rgba(31,123,179,.14), transparent 38%), linear-gradient(180deg, #f8fbfe 0%, #eef5fa 100%)",
        }}
      >
        <Container maxWidth="md">
          <Paper
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              border: `1px solid ${RULE}`,
              borderRadius: 4,
              px: { xs: 3, md: 7 },
              py: { xs: 4, md: 6 },
              textAlign: "center",
              boxShadow: "0 24px 70px rgba(11,37,69,.12)",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: "0 0 auto",
                height: 6,
                background: `linear-gradient(90deg, ${NAVY}, ${BLUE}, #36a271)`,
              },
            }}
          >
            <Chip
              label="ΣΥΝΤΟΜΑ"
              sx={{
                mb: 2,
                bgcolor: "#e4f1fa",
                color: NAVY,
                border: `1px solid ${BLUE}`,
                fontWeight: 950,
                letterSpacing: ".12em",
              }}
            />
            <Typography
              variant="h2"
              sx={{
                color: NAVY,
                fontWeight: 950,
                letterSpacing: "-.035em",
                fontSize: { xs: "2rem", md: "3rem" },
              }}
            >
              Ο τιμοκατάλογος ετοιμάζεται
            </Typography>
            <Typography
              sx={{
                mt: 1.5,
                mx: "auto",
                maxWidth: 600,
                color: "#526579",
                fontSize: { xs: "1rem", md: "1.1rem" },
                lineHeight: 1.75,
              }}
            >
              Ετοιμάζουμε μια ξεκάθαρη, ευέλικτη παρουσίαση των πακέτων και των
              δυνατοτήτων του KALYPSIS. Θα είναι σύντομα διαθέσιμη.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="center"
              sx={{ mt: 3.5 }}
            >
              <Button
                component={RouterLink}
                to="/"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  px: 3,
                  bgcolor: NAVY,
                  fontWeight: 900,
                  "&:hover": { bgcolor: BLUE },
                }}
              >
                Επιστροφή στην αρχική
              </Button>
              <Button
                component={RouterLink}
                to="/contact"
                variant="outlined"
                sx={{
                  px: 3,
                  color: NAVY,
                  borderColor: "#a9bdcf",
                  fontWeight: 900,
                }}
              >
                Επικοινωνήστε μαζί μας
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </PublicShell>
  );
}
