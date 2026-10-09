import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
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
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
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

const PACKAGE_META = [
  {
    code: "BackOffice",
    name: "BackOffice",
    description:
      "Πελάτες, συμβόλαια, εταιρείες, συνεργάτες, οχήματα, ζημιές, ταμείο και παραγωγή.",
    color: BLUE,
  },
  {
    code: "CRM",
    name: "CRM & Πύλη Πελάτη",
    description:
      "Ομάδες, επικοινωνίες, εργασίες, follow-up, καμπάνιες και ασφαλής ψηφιακή πύλη.",
    color: "#496de8",
  },
  {
    code: "Intelligence",
    name: "Αναφορές & Νοημοσύνη",
    description:
      "Στόχοι, αναφορές, προβλέψεις, εξαγωγή δεδομένων και εργαλεία AI ανά γραφείο.",
    color: "#155783",
  },
  {
    code: "Integrations",
    name: "Διασυνδέσεις & Συμμόρφωση",
    description:
      "Εξωτερικά συστήματα, γέφυρες, πληρωμές, myDATA και ελεγχόμενες διασυνδέσεις.",
    color: "#244f78",
  },
  {
    code: "Ermes",
    name: "ΕΡΜΗΣ",
    description:
      "Ασφαλή μηνύματα και συναντήσεις για το γραφείο και τους χρήστες του.",
    color: "#2b7a78",
  },
] as const;

const PACKAGE_DETAILS = [
  {
    numeral: "I",
    code: "BackOffice",
    title: "BackOffice — Το λογιστήριο του γραφείου",
    lead: "Πελάτες, συμβόλαια, ταμείο, προμήθειες.",
    body: "Ο πυρήνας του γραφείου σας: ψηφιακό αρχείο πελατών, κατάλογος ασφαλιστικών εταιρειών, παραγωγοί δικτύου, χειροκίνητη ή αυτοματοποιημένη καταχώρηση συμβολαίων. Ταμειακές, εισπράξεις, διαχείριση προμηθειών και υπερπρομηθειών, συμφωνία τραπεζικών εκτυπώσεων, λογιστικές εξαγωγές για τον λογιστή σας. Γέφυρες προς παλιά back-office προγράμματα για ομαλή μετάβαση.",
    image:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=82",
    color: BLUE,
  },
  {
    numeral: "II",
    code: "CRM",
    title: "CRM & Πύλη Πελάτη — Η εμπειρία του πελάτη σας",
    lead: "Αυτοεξυπηρέτηση, ραντεβού, καμπάνιες.",
    body: "Ο πελάτης σας ζει μέσα στην εφαρμογή σας. Πύλη πελάτη και mobile εφαρμογή για iOS και Android, αιτήματα και εκκρεμότητες, ραντεβού, αυτόματες υπενθυμίσεις λήξης μέσω email/SMS/Viber, διαχείριση εγγράφων και ψηφιακές υπογραφές. Καμπάνιες marketing και μαζική επικοινωνία, αρχείο συγκαταθέσεων GDPR.",
    image:
      "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=82",
    color: "#496de8",
  },
  {
    numeral: "III",
    code: "Intelligence",
    title: "Αναλυτικά & Νοημοσύνη — Η επιχειρηματική σας εικόνα",
    lead: "Αναφορές, στόχοι, AI, audit.",
    body: "Παρακολούθηση παραγωγής με στόχους ανά συνεργάτη και υποκατάστημα. Δημιουργός αναφορών drag-and-drop με αυτόματη αποστολή μέσω email, εξαγωγή σε Excel ή PDF. AI εξαγωγή στοιχείων από PDF συμβολαίου, AI πρόβλεψη απώλειας πελατών, AI σύνταξη επικοινωνιών. Audit logs για κάθε ενέργεια χρήστη και πλήρες ιστορικό μεταβολών.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=82",
    color: "#155783",
  },
  {
    numeral: "IV",
    code: "Integrations",
    title: "Ενσωματώσεις & Συμμόρφωση — Το ελληνικό οικοσύστημα",
    lead: "myDATA, τηλεφωνία, online πληρωμές.",
    body: "Όλο το ελληνικό περιβάλλον μέσα στην εφαρμογή. Υποβολή myDATA στην Ανεξάρτητη Αρχή, ηλεκτρονικά τιμολόγια, online πληρωμές μέσω e-pos τραπεζών, ePay, DIAS και Viva Wallet. Τηλεφωνία VoIP με ηχογράφηση και αυτόματη απομαγνητοφώνηση κλήσεων στα ελληνικά. Συγχρονισμός email Gmail/Outlook μέσω IMAP, πολλαπλά υποκαταστήματα, B2B portal συνεργατών.",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82",
    color: "#244f78",
  },
  {
    numeral: "V",
    code: "Ermes",
    title: "ΕΡΜΗΣ — Ασφαλής επικοινωνία",
    lead: "Ασφαλής επικοινωνία γραφείου.",
    body: "Εσωτερικά μηνύματα, ομάδες, συνημμένα, κρυπτογραφημένη επικοινωνία και ασφαλείς συναντήσεις.",
    image:
      "https://images.unsplash.com/photo-1525182008055-f88b95ff7980?auto=format&fit=crop&w=1200&q=82",
    color: "#2b7a78",
  },
] as const;

const COVERAGE_ROWS = [
  ["Πελάτες, συμβόλαια και παραγωγή", "BackOffice"],
  ["Ταμείο, εισπράξεις, πληρωμές και οικονομικά", "BackOffice"],
  ["Ομάδες πελατών, επικοινωνίες και καμπάνιες", "CRM"],
  ["Portal πελάτη και ψηφιακές εργασίες", "CRM"],
  ["Στόχοι, αναφορές και προηγμένα στατιστικά", "Intelligence"],
  ["AI βοηθός και αυτοματισμοί ανάλυσης", "Intelligence"],
  ["Γέφυρες εταιρειών και εξωτερικά API", "Integrations"],
  ["Ασφαλή μηνύματα και συναντήσεις", "Ermes"],
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

function packageIsIncluded(plan: PlanDefinition, code: string) {
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

function Price({
  value,
  suffix = "/ έτος",
}: {
  value: number;
  suffix?: string;
}) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="baseline" flexWrap="wrap">
      <Typography
        sx={{
          color: RED,
          fontSize: { xs: 28, md: 34 },
          fontWeight: 950,
          letterSpacing: "-0.03em",
        }}
      >
        {EUR.format(value)}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", fontWeight: 700 }}
      >
        {suffix}
      </Typography>
    </Stack>
  );
}

function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="overline"
        sx={{ color: BLUE, fontWeight: 900, letterSpacing: "0.14em" }}
      >
        {eyebrow}
      </Typography>
      <Typography
        variant="h3"
        sx={{
          mt: 0.5,
          color: NAVY,
          fontWeight: 950,
          letterSpacing: "-0.035em",
          fontSize: { xs: 30, md: 46 },
        }}
      >
        {title}
      </Typography>
      {body && (
        <Typography
          sx={{
            mt: 1.25,
            color: "text.secondary",
            lineHeight: 1.7,
            maxWidth: 820,
          }}
        >
          {body}
        </Typography>
      )}
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
  const packageRailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!catalog.plans.some((p) => p.code === planCode))
      setPlanCode(catalog.plans[0]?.code ?? "");
  }, [catalog.plans, planCode]);
  const plan =
    catalog.plans.find((p) => p.code === planCode) ?? catalog.plans[0];
  const baseAnnual = plan?.pricePerYear ?? 0;
  const extraOfficeCost = (plan?.extraOfficePerYear ?? 0) * extraOffices;
  const extraUserCost = (plan?.extraUserPerYear ?? 0) * extraUsers;
  const addonsCost = useMemo(
    () =>
      catalog.addons
        .filter((a) => selectedAddons[a.code])
        .reduce((sum, a) => sum + a.pricePerYear, 0),
    [catalog.addons, selectedAddons],
  );
  const annualTotal = baseAnnual + extraOfficeCost + extraUserCost + addonsCost;

  return (
    <PublicShell>
      <Box sx={{ bgcolor: "#f7f9fc", minHeight: "100vh", pb: 10 }}>
        <Box
          sx={{
            bgcolor: NAVY,
            color: "#fff",
            py: { xs: 7, md: 10 },
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              width: 420,
              height: 420,
              borderRadius: "50%",
              bgcolor: "rgba(31,123,179,.22)",
              right: -160,
              top: -170,
            }}
          />
          <Container maxWidth="xl" sx={{ position: "relative" }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={4}
              justifyContent="space-between"
              alignItems={{ md: "end" }}
            >
              <Box sx={{ maxWidth: 780 }}>
                <Chip
                  label="KALYPSIS · ΤΙΜΟΚΑΤΑΛΟΓΟΣ"
                  sx={{
                    bgcolor: "rgba(255,255,255,.12)",
                    color: "#fff",
                    fontWeight: 900,
                    mb: 2,
                  }}
                />
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 950,
                    letterSpacing: "-0.055em",
                    lineHeight: 1.03,
                    fontSize: { xs: 40, md: 70 },
                  }}
                >
                  Διάλεξε βάση, πρόσθεσε λειτουργίες, δες το τελικό σύνολο.
                </Typography>
                <Typography
                  sx={{
                    mt: 2,
                    color: "rgba(255,255,255,.82)",
                    lineHeight: 1.75,
                    fontSize: { xs: 16, md: 19 },
                  }}
                >
                  Οι τιμές υπολογίζονται αναλυτικά ανά πλάνο, γραφείο, χρήστη
                  και πρόσθετη λειτουργία. Δεν υπάρχουν κρυφές γραμμές: κάθε
                  επιλογή εμφανίζεται στο σύνολο.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={<BusinessCenterIcon />}
                  label="Ανά γραφείο"
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}
                  variant="outlined"
                />
                <Chip
                  icon={<WorkspacePremiumIcon />}
                  label="Ετήσια χρέωση"
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Container>
        </Box>
        <Container
          maxWidth="xl"
          sx={{ mt: { xs: -3, md: -4 }, position: "relative" }}
        >
          <Paper
            elevation={4}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              border: "1px solid #dce5ef",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CalculateIcon sx={{ color: BLUE, fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" fontWeight={900}>
                    Η τιμή με μια ματιά
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Βάση + επιπλέον γραφεία + χρήστες + πρόσθετα = ετήσιο
                    σύνολο.
                  </Typography>
                </Box>
              </Stack>
              <Typography
                sx={{
                  color: RED,
                  fontWeight: 950,
                  fontSize: { xs: 27, md: 34 },
                }}
              >
                {EUR.format(annualTotal)} / έτος
              </Typography>
            </Stack>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 8 }}>
          <SectionTitle
            eyebrow="01 · ΠΛΑΝΑ"
            title="Σύγκριση τιμών και περιεχομένου"
            body="Κάθε πλάνο δείχνει τι περιλαμβάνει, πόσα γραφεία και χρήστες καλύπτει και τι χρεώνεται επιπλέον. Οι κόκκινες τιμές είναι οι τελικές ετήσιες χρεώσεις."
          />
          {pricing.isError && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ο ζωντανός κατάλογος δεν ήταν διαθέσιμος προσωρινά· εμφανίζονται
              οι βασικές τιμές και θα ενημερωθούν αυτόματα.
            </Alert>
          )}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(4, 1fr)",
              },
            }}
          >
            {catalog.plans.map((p, index) => (
              <Card
                key={p.code}
                sx={{
                  borderRadius: 2.5,
                  border: "1px solid #dce5ef",
                  borderTop: `5px solid ${[BLUE, "#496de8", "#2b7a78", RED][index % 4]}`,
                  height: "100%",
                  transition: "transform .2s, box-shadow .2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 5 },
                }}
              >
                <CardContent
                  sx={{
                    p: 2.75,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1}
                  >
                    <Typography variant="h5" fontWeight={950} color={NAVY}>
                      {PLAN_LABELS[p.code] ?? p.code}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${p.packages.length} λειτουργίες`}
                      sx={{ fontWeight: 800 }}
                    />
                  </Stack>
                  <Typography
                    color="text.secondary"
                    sx={{ minHeight: 48, lineHeight: 1.5 }}
                  >
                    {p.tagline}
                  </Typography>
                  <Box sx={{ my: 2 }}>
                    <Price value={p.pricePerYear} />
                  </Box>
                  <Divider />
                  <Stack spacing={0.8} sx={{ mt: 2, flex: 1 }}>
                    <Typography variant="body2">
                      <b>{p.includedOffices || 1}</b> γραφείο
                      {p.includedOffices === 1 ? "" : "α"} περιλαμβάνεται
                    </Typography>
                    <Typography variant="body2">
                      <b>{p.includedUsers}</b> χρήστες περιλαμβάνονται
                    </Typography>
                    <Typography variant="body2">
                      +{EUR.format(p.extraOfficePerYear)} / επιπλέον γραφείο
                    </Typography>
                    <Typography variant="body2">
                      +{EUR.format(p.extraUserPerYear)} / επιπλέον χρήστη
                    </Typography>
                  </Stack>
                  <Box
                    sx={{ mt: 2, display: "flex", gap: 0.75, flexWrap: "wrap" }}
                  >
                    {PACKAGE_META.map(
                      (pkg) =>
                        packageIsIncluded(p, pkg.code) && (
                          <Chip
                            key={pkg.code}
                            size="small"
                            label={pkg.name}
                            sx={{
                              bgcolor: `${pkg.color}16`,
                              color: pkg.color,
                              fontWeight: 800,
                            }}
                          />
                        ),
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 9 }}>
          <SectionTitle
            eyebrow="ΠΑΚΕΤΑ KALYPSIS"
            title="Κάθε πακέτο έχει ξεκάθαρο ρόλο"
            body="Δες αναλυτικά τι παίρνει το γραφείο σου σε κάθε επίπεδο. Τα πακέτα μπορούν να συνδυαστούν και να προσαρμοστούν ανά γραφείο."
          />
          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={0.75}
            sx={{ mb: 1.25 }}
          >
            <IconButton
              aria-label="Προηγούμενο πακέτο"
              onClick={() =>
                packageRailRef.current?.scrollBy({
                  left: -420,
                  behavior: "smooth",
                })
              }
              sx={{
                color: NAVY,
                bgcolor: "#fff",
                border: "1px solid #dce5ef",
                "&:hover": { bgcolor: "#eaf4fb", borderColor: BLUE },
              }}
            >
              <ArrowBackIosNewIcon sx={{ fontSize: 17 }} />
            </IconButton>
            <IconButton
              aria-label="Επόμενο πακέτο"
              onClick={() =>
                packageRailRef.current?.scrollBy({
                  left: 420,
                  behavior: "smooth",
                })
              }
              sx={{
                color: NAVY,
                bgcolor: "#fff",
                border: "1px solid #dce5ef",
                "&:hover": { bgcolor: "#eaf4fb", borderColor: BLUE },
              }}
            >
              <ArrowForwardIosIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Stack>
          <Box
            ref={packageRailRef}
            sx={{
              display: "flex",
              gap: 2,
              overflowX: "auto",
              pb: 2,
              scrollBehavior: "smooth",
              scrollSnapType: "x mandatory",
              overscrollBehaviorX: "contain",
              scrollbarWidth: "thin",
              scrollbarColor: `${BLUE} #dce5ef`,
              "&::-webkit-scrollbar": { height: 9 },
              "&::-webkit-scrollbar-track": {
                bgcolor: "#e6edf4",
                borderRadius: 99,
              },
              "&::-webkit-scrollbar-thumb": { bgcolor: BLUE, borderRadius: 99 },
              "& > *": {
                flex: {
                  xs: "0 0 88%",
                  sm: "0 0 66%",
                  md: "0 0 47%",
                  lg: "0 0 34%",
                },
                minWidth: 0,
                scrollSnapAlign: "start",
              },
            }}
          >
            {PACKAGE_DETAILS.map((pkg) => (
              <Card
                key={pkg.code}
                sx={{
                  borderRadius: 2.5,
                  border: "1px solid #dce5ef",
                  borderTop: `5px solid ${pkg.color}`,
                  height: "100%",
                  overflow: "hidden",
                  transition: "transform .2s, box-shadow .2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 5 },
                }}
              >
                <Box
                  sx={{
                    height: { xs: 150, md: 185 },
                    position: "relative",
                    overflow: "hidden",
                    bgcolor: `${pkg.color}22`,
                  }}
                >
                  <Box
                    component="img"
                    src={pkg.image}
                    alt=""
                    loading="lazy"
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(135deg, ${pkg.color}d9 0%, transparent 72%)`,
                    }}
                  />
                  <Typography
                    sx={{
                      position: "absolute",
                      left: 18,
                      bottom: 12,
                      color: "#fff",
                      fontSize: 56,
                      lineHeight: 1,
                      fontWeight: 950,
                      textShadow: "0 2px 12px rgba(0,0,0,.35)",
                    }}
                  >
                    {pkg.numeral}
                  </Typography>
                </Box>
                <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    mb={1.5}
                  >
                    <Typography
                      sx={{
                        color: pkg.color,
                        fontSize: 42,
                        lineHeight: 1,
                        fontWeight: 950,
                      }}
                    >
                      {pkg.numeral}
                    </Typography>
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{
                          color: pkg.color,
                          fontWeight: 950,
                          letterSpacing: ".12em",
                        }}
                      >
                        ΠΑΚΕΤΟ
                      </Typography>
                      <Typography variant="h5" fontWeight={950} color={NAVY}>
                        {pkg.title}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography fontWeight={900} sx={{ color: NAVY, mb: 1 }}>
                    {pkg.lead}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {pkg.body}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 9 }}>
          <SectionTitle
            eyebrow="02 · ΤΙ ΚΑΛΥΠΤΕΙ"
            title="Λειτουργία προς λειτουργία"
            body="Δες σε ποιο πακέτο βρίσκεται κάθε βασική δυνατότητα, χωρίς να χρειάζεται να μαντέψεις τι αγοράζεις."
          />
          <Paper
            sx={{
              overflowX: "auto",
              border: "1px solid #dce5ef",
              borderRadius: 2.5,
            }}
          >
            <Table sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#eaf0f6" }}>
                  <TableCell sx={{ fontWeight: 950, color: NAVY }}>
                    Τι περιλαμβάνει
                  </TableCell>
                  {PACKAGE_META.map((pkg) => (
                    <TableCell
                      key={pkg.code}
                      align="center"
                      sx={{ fontWeight: 950, color: pkg.color }}
                    >
                      {pkg.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {COVERAGE_ROWS.map(([label, code]) => (
                  <TableRow key={label} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{label}</TableCell>
                    {PACKAGE_META.map((pkg) => (
                      <TableCell key={pkg.code} align="center">
                        {pkg.code === code ? (
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
        <Container maxWidth="xl" sx={{ mt: 9 }}>
          <SectionTitle
            eyebrow="03 · ΣΥΝΔΥΑΣΜΟΙ"
            title="Αυτό + αυτό = το πακέτο που χρειάζεσαι"
            body="Οι συνδυασμοί είναι ενδεικτικοί. Ο τελικός υπολογισμός γίνεται από το πλάνο, τα επιπλέον γραφεία/χρήστες και τα πρόσθετα που επιλέγεις."
          />
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            }}
          >
            {[
              [
                "BackOffice",
                "CRM",
                "BackOffice + CRM",
                "Οργάνωση γραφείου + πελατοκεντρική επικοινωνία",
              ],
              [
                "BackOffice",
                "Αναφορές & Νοημοσύνη",
                "BackOffice + Intelligence",
                "Παραγωγή + στόχοι + αποφάσεις με δεδομένα",
              ],
              [
                "CRM",
                "ΕΡΜΗΣ",
                "CRM + ΕΡΜΗΣ",
                "Επικοινωνία πελατών + ασφαλή μηνύματα και συναντήσεις",
              ],
            ].map(([a, b, result, covers]) => (
              <Card
                key={result}
                sx={{ borderRadius: 2.5, border: "1px solid #dce5ef" }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Chip
                      label={a}
                      sx={{ fontWeight: 900, bgcolor: "#edf3f9", color: NAVY }}
                    />
                    <Typography fontWeight={950} color={RED}>
                      +
                    </Typography>
                    <Chip
                      label={b}
                      sx={{ fontWeight: 900, bgcolor: "#edf3f9", color: NAVY }}
                    />
                  </Stack>
                  <Typography
                    variant="h6"
                    fontWeight={950}
                    sx={{ mt: 2, color: NAVY }}
                  >
                    {result}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 0.75, lineHeight: 1.55 }}
                  >
                    {covers}
                  </Typography>
                  <Typography sx={{ mt: 2, color: RED, fontWeight: 900 }}>
                    Υπολογίζεται στο τελικό πλάνο
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 9 }}>
          <SectionTitle
            eyebrow="04 · ΥΠΟΛΟΓΙΣΜΟΣ"
            title="Φτιάξε το δικό σου σύνολο"
            body="Δοκίμασε διαφορετικό αριθμό γραφείων, χρηστών και πρόσθετων. Ο υπολογισμός χρησιμοποιεί τον ζωντανό κατάλογο τιμών."
          />
          <Paper
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 2.5,
              border: `2px solid ${BLUE}40`,
            }}
          >
            <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
              <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  select
                  label="Βασικό πλάνο"
                  value={plan?.code ?? ""}
                  onChange={(e) => setPlanCode(e.target.value)}
                  fullWidth
                >
                  {catalog.plans.map((p) => (
                    <MenuItem value={p.code} key={p.code}>
                      {PLAN_LABELS[p.code] ?? p.code} ·{" "}
                      {EUR.format(p.pricePerYear)} / έτος
                    </MenuItem>
                  ))}
                </TextField>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    type="number"
                    label="Επιπλέον γραφεία"
                    value={extraOffices}
                    onChange={(e) =>
                      setExtraOffices(Math.max(0, Number(e.target.value)))
                    }
                    inputProps={{ min: 0 }}
                    fullWidth
                  />
                  <TextField
                    type="number"
                    label="Επιπλέον χρήστες"
                    value={extraUsers}
                    onChange={(e) =>
                      setExtraUsers(Math.max(0, Number(e.target.value)))
                    }
                    inputProps={{ min: 0 }}
                    fullWidth
                  />
                </Stack>
                <Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={900}
                    sx={{ mb: 1 }}
                  >
                    Πρόσθετα πακέτα
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5}>
                    {catalog.addons.map((a) => (
                      <FormControlLabel
                        key={a.code}
                        control={
                          <Checkbox
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
                          <Typography variant="body2">
                            {ADDON_LABELS[a.code] ?? a.code} (+
                            {EUR.format(a.pricePerYear)})
                          </Typography>
                        }
                      />
                    ))}
                  </Stack>
                </Box>
              </Stack>
              <Paper
                variant="outlined"
                sx={{ p: 2.5, minWidth: { lg: 330 }, bgcolor: "#fbfcfe" }}
              >
                <Typography
                  variant="overline"
                  sx={{ color: BLUE, fontWeight: 900, letterSpacing: ".12em" }}
                >
                  ΑΝΑΛΥΣΗ ΣΥΝΟΛΟΥ
                </Typography>
                <Stack spacing={1} sx={{ mt: 1.25 }}>
                  <CalcRow
                    label={`Βάση ${PLAN_LABELS[plan?.code ?? ""] ?? plan?.code ?? ""}`}
                    value={baseAnnual}
                  />
                  <CalcRow
                    label={`${extraOffices} επιπλέον γραφεία`}
                    value={extraOfficeCost}
                  />
                  <CalcRow
                    label={`${extraUsers} επιπλέον χρήστες`}
                    value={extraUserCost}
                  />
                  <CalcRow label="Επιλεγμένα πρόσθετα" value={addonsCost} />
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                >
                  <Typography fontWeight={950}>Ετήσιο σύνολο</Typography>
                  <Typography
                    sx={{ color: RED, fontWeight: 950, fontSize: 30 }}
                  >
                    {EUR.format(annualTotal)}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", textAlign: "right" }}
                >
                  ≈ {EUR.format(Math.round(annualTotal / 12))} / μήνα
                </Typography>
              </Paper>
            </Stack>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 9 }}>
          <Paper
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 2.5,
              bgcolor: "#fff5f4",
              border: "1px solid #f1c4bf",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TuneIcon sx={{ color: RED }} />
                  <Typography variant="h5" fontWeight={950} color={NAVY}>
                    Παραμετροποίηση ανά γραφείο
                  </Typography>
                </Stack>
                <Typography
                  sx={{
                    mt: 1,
                    color: "text.secondary",
                    lineHeight: 1.65,
                    maxWidth: 800,
                  }}
                >
                  Ναι, γίνεται. Ο διαχειριστής της πλατφόρμας μπορεί να
                  επεξεργάζεται τον κεντρικό τιμοκατάλογο, ενώ κάθε γραφείο
                  μπορεί να έχει δικά του ενεργά πακέτα, πρόσθετα, αριθμό
                  γραφείων και χρήστες. Οι αλλαγές εφαρμόζονται με ασφάλεια ανά
                  γραφείο και εμφανίζονται στο οικονομικό καθολικό.
                </Typography>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                sx={{ flexShrink: 0 }}
              >
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
                  Ρύθμιση ανά γραφείο
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
        <Container maxWidth="xl" sx={{ mt: 8 }}>
          <SectionTitle
            eyebrow="05 · ΥΠΗΡΕΣΙΕΣ"
            title="Προαιρετικές υπηρεσίες"
            body="Υπηρεσίες που προστίθενται όταν χρειάζονται, με ξεκάθαρη μονάδα χρέωσης."
          />
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(4, 1fr)",
              },
            }}
          >
            {catalog.services.map((s) => (
              <Card key={s.code} variant="outlined">
                <CardContent sx={{ p: 2 }}>
                  <Typography fontWeight={900} color={NAVY}>
                    {SERVICE_LABELS[s.code] ?? s.description}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {s.unitLabel}
                  </Typography>
                  <Typography
                    sx={{ color: RED, fontWeight: 950, fontSize: 22, mt: 1 }}
                  >
                    {EUR.format(s.unitPrice)} / {s.unitLabel}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>
        <Container maxWidth="md" sx={{ mt: 10, textAlign: "center" }}>
          <Typography variant="h4" fontWeight={950} color={NAVY}>
            Θες να το προσαρμόσουμε στο γραφείο σου;
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.7 }}>
            Επικοινώνησε μαζί μας για ενεργοποίηση πακέτων, ειδική τιμολόγηση ή
            μετάβαση από άλλο σύστημα.
          </Typography>
          <Button
            component={RouterLink}
            to="/contact"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            sx={{
              mt: 3,
              bgcolor: NAVY,
              fontWeight: 900,
              px: 3,
              "&:hover": { bgcolor: "#17417f" },
            }}
          >
            Ζήτησε διαμόρφωση
          </Button>
        </Container>
      </Box>
    </PublicShell>
  );
}

function CalcRow({ label, value }: { label: string; value: number }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={800}
        sx={{ color: value ? RED : "text.disabled" }}
      >
        {EUR.format(value)}
      </Typography>
    </Stack>
  );
}
