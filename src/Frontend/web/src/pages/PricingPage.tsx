import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Container, Divider,
  FormControlLabel, Checkbox, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BusinessIcon from "@mui/icons-material/Business";
import CalculateIcon from "@mui/icons-material/Calculate";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExtensionIcon from "@mui/icons-material/Extension";
import GroupsIcon from "@mui/icons-material/Groups";
import HubIcon from "@mui/icons-material/Hub";
import LanguageIcon from "@mui/icons-material/Language";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import SchoolIcon from "@mui/icons-material/School";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { PublicShell } from "../components/PublicShell";
import { PresentationRequestDialog } from "../components/PresentationRequestDialog";

interface PricingFeature { key: string; label: string; description?: string; sortOrder: number; isActive: boolean; iconKey?: string | null }
interface Plan { code: string; name: string; tagline: string; description: string; pricePerYear: number; includedOffices: number; includedUsers: number; extraOfficePerYear: number; extraUserPerYear: number; includedPackages: number; packages: string[]; featureKeys?: string[]; isFeatured: boolean; isActive: boolean; sortOrder: number; buttonText: string; buttonUrl: string; badge?: string | null; iconKey?: string | null }
interface Addon { code: string; name: string; description: string; pricePerYear: number; isActive: boolean; sortOrder: number; iconKey?: string | null }
interface Service { code: string; name: string; description: string; unitLabel: string; unitPrice: number | null; pricingType: string; isActive: boolean; sortOrder: number; iconKey?: string | null }
interface PricingSettings { pricesIncludeVat: boolean; vatRate: number; currency: string; publicTitle: string; publicSubtitle: string; vatLabel: string }
interface Catalog { version: number; plans: Plan[]; addons: Addon[]; services: Service[]; features: PricingFeature[]; settings: PricingSettings }
interface Calculation { planCode: string; planName: string; baseAmount: number; extraOfficesAmount: number; extraUsersAmount: number; addonsAmount: number; servicesAmount: number; totalAmount: number; netAmount: number; vatAmount: number; pricesIncludeVat: boolean; vatRate: number; currency: string; requiresQuote: boolean; lines: { code: string; label: string; amount: number }[] }

const BLUE = "#1265d8";
const NAVY = "#0a2b67";
const RULE = "#d7e7f5";
const RED = "#c62828";
const EUR = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const money = (amount: number | null | undefined) => amount == null ? "Κατά περίπτωση" : EUR.format(amount);

function iconFor(key?: string | null, color = BLUE) {
  const props = { sx: { color, fontSize: 28 } };
  switch (key) {
    case "person": return <PersonIcon {...props} />;
    case "people": return <PeopleIcon {...props} />;
    case "groups": return <GroupsIcon {...props} />;
    case "business": return <BusinessIcon {...props} />;
    case "hub": return <HubIcon {...props} />;
    case "language": return <LanguageIcon {...props} />;
    case "smart": return <SmartToyIcon {...props} />;
    case "extension": return <ExtensionIcon {...props} />;
    case "support": return <SupportAgentIcon {...props} />;
    case "school": return <SchoolIcon {...props} />;
    default: return <WorkspacePremiumIcon {...props} />;
  }
}

function SectionHeading({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ mb: 2 }}>
      <Chip label={number} size="small" sx={{ bgcolor: "#e4f2ff", color: BLUE, fontWeight: 900, mt: .35 }} />
      <Box><Typography variant="h5" sx={{ color: NAVY, fontWeight: 950 }}>{title}</Typography><Typography variant="body2" color="text.secondary">{subtitle}</Typography></Box>
    </Stack>
  );
}

function PlanCard({ plan, features }: { plan: Plan; features: PricingFeature[] }) {
  const included = plan.featureKeys ?? plan.packages ?? [];
  const actionUrl = plan.buttonUrl || "/register";
  const action: "contained" | "outlined" = plan.isFeatured ? "contained" : "outlined";
  return (
    <Card sx={{
      position: "relative", display: "flex", flexDirection: "column", minHeight: 430,
      border: plan.isFeatured ? `2px solid ${BLUE}` : `1px solid ${RULE}`,
      borderRadius: 3, bgcolor: "rgba(255,255,255,.97)",
      boxShadow: plan.isFeatured ? "0 18px 44px rgba(18,101,216,.2)" : "0 12px 30px rgba(19,84,146,.09)",
      overflow: "hidden", transition: "transform .2s ease, box-shadow .2s ease",
      "&:hover": { transform: "translateY(-4px)", boxShadow: "0 20px 48px rgba(19,84,146,.18)" }
    }}>
      {plan.isFeatured && <Box sx={{ bgcolor: BLUE, color: "white", textAlign: "center", py: .6, fontWeight: 900, fontSize: 13 }}>{plan.badge || "Πιο Δημοφιλές"}</Box>}
      <Stack spacing={1.2} sx={{ p: { xs: 2, md: 2.5 }, flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box><Typography variant="h5" sx={{ color: NAVY, fontWeight: 950 }}>{plan.name}</Typography><Typography variant="body2" color="text.secondary">{plan.description || plan.tagline}</Typography></Box>
          {iconFor(plan.iconKey)}
        </Stack>
        <Typography sx={{ color: BLUE, fontWeight: 950, fontSize: { xs: 32, md: 38 }, lineHeight: 1 }}>{money(plan.pricePerYear)}<Typography component="span" sx={{ color: "text.secondary", fontSize: 13, fontWeight: 700 }}> / έτος</Typography></Typography>
        <Divider />
        <Stack spacing={.45} sx={{ color: NAVY, fontSize: 13 }}>
          {plan.includedOffices > 0 && <Typography><b>{plan.includedOffices}</b> {plan.includedOffices === 1 ? "γραφείο" : "γραφεία"}</Typography>}
          <Typography><b>{plan.includedUsers}</b> {plan.includedUsers === 1 ? "χρήστης" : "χρήστες"}</Typography>
          {plan.includedPackages > 0 && <Typography><b>{plan.includedPackages}</b> {plan.includedPackages === 1 ? "πακέτο / ενότητα" : "πακέτα / ενότητες"}</Typography>}
        </Stack>
        <Stack spacing={.5} sx={{ mt: .4 }}>
          {features.filter(f => included.includes(f.key)).map(f => <Stack direction="row" alignItems="flex-start" gap={.65} key={f.key}><CheckCircleIcon sx={{ color: "#16803c", fontSize: 18, mt: .1 }} /><Typography variant="body2">{f.label}</Typography></Stack>)}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">Επιπλέον γραφείο: {money(plan.extraOfficePerYear)} / έτος · χρήστης: {money(plan.extraUserPerYear)} / έτος</Typography>
        {actionUrl.startsWith("http") ? <Button component="a" href={actionUrl} variant={action} endIcon={<ArrowForwardIcon />} sx={{ mt: .5, borderRadius: 2, fontWeight: 900, ...(plan.isFeatured ? { bgcolor: BLUE } : { color: BLUE, borderColor: BLUE }) }}>{plan.buttonText || "Επιλογή Πακέτου →"}</Button> : <Button component={RouterLink} to={actionUrl} variant={action} endIcon={<ArrowForwardIcon />} sx={{ mt: .5, borderRadius: 2, fontWeight: 900, ...(plan.isFeatured ? { bgcolor: BLUE } : { color: BLUE, borderColor: BLUE }) }}>{plan.buttonText || "Επιλογή Πακέτου →"}</Button>}
      </Stack>
    </Card>
  );
}

export function PricingPage() {
  const pricing = useQuery({
    queryKey: ["public-pricing"],
    queryFn: async () => (await api.get<Catalog>("/platform/pricing")).data,
    // Pricing is commercial configuration: refetch on each page visit so a
    // SuperAdmin change is visible without a frontend redeploy or stale cache.
    staleTime: 0,
    retry: 2
  });
  const catalog = pricing.data;
  const [planCode, setPlanCode] = useState("");
  const [extraOffices, setExtraOffices] = useState(0);
  const [extraUsers, setExtraUsers] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [presentationOpen, setPresentationOpen] = useState(false);
  useEffect(() => {
    if (catalog && !catalog.plans.some(p => p.code === planCode)) setPlanCode(catalog.plans.find(p => p.isActive)?.code ?? "");
  }, [catalog, planCode]);
  const activePlans = useMemo(() => (catalog?.plans ?? []).filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [catalog]);
  const activeFeatures = useMemo(() => (catalog?.features ?? []).filter(f => f.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [catalog]);
  const activeAddons = useMemo(() => (catalog?.addons ?? []).filter(a => a.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [catalog]);
  const activeServices = useMemo(() => (catalog?.services ?? []).filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [catalog]);
  const selectedCodes = activeAddons.filter(a => selectedAddons[a.code]).map(a => a.code);
  const selectedServiceCodes = activeServices.filter(s => selectedServices[s.code]).map(s => s.code);
  const calculation = useQuery({
    queryKey: ["public-pricing-calculate", planCode, extraOffices, extraUsers, selectedCodes.join(","), selectedServiceCodes.join(",")],
    enabled: Boolean(catalog && planCode),
    queryFn: async () => (await api.post<Calculation>("/platform/pricing/calculate", { planCode, extraOffices, extraUsers, addonCodes: selectedCodes, serviceCodes: selectedServiceCodes })).data,
    staleTime: 5_000
  });

  if (pricing.isLoading) return <PublicShell modernNav><Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box></PublicShell>;
  if (pricing.isError || !catalog) return <PublicShell modernNav><Container sx={{ py: 10 }}><Alert severity="error">Ο τιμοκατάλογος δεν είναι προσωρινά διαθέσιμος. Παρακαλούμε δοκιμάστε ξανά.</Alert></Container></PublicShell>;
  const settings = catalog.settings;
  return (
    <PublicShell modernNav>
      <Box className="kalypsis-pricing" sx={{ minHeight: "100vh", bgcolor: "#f4faff", overflow: "hidden", position: "relative", pb: 8,
        "&::before": { content: '""', position: "absolute", inset: "0 0 auto", height: 520, background: "radial-gradient(ellipse at 16% 8%, rgba(255,255,255,.95), transparent 45%), radial-gradient(ellipse at 85% 12%, rgba(45,164,236,.23), transparent 56%), linear-gradient(135deg,#e6f3ff 0%,#fafdff 45%,#dcefff 100%)", zIndex: 0 },
        "&::after": { content: '""', position: "absolute", top: 95, left: "-8%", right: "-8%", height: 185, borderTop: "2px solid rgba(255,255,255,.85)", borderRadius: "50%", transform: "rotate(-4deg)", boxShadow: "0 28px 0 rgba(255,255,255,.35), 0 60px 0 rgba(104,188,239,.13)", pointerEvents: "none", zIndex: 0 } }}>
        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1, pt: { xs: 2, md: 3 } }}>
          <Stack alignItems="center" textAlign="center" sx={{ mb: { xs: 3, md: 4 } }}>
            <KalypsisLogo size={122} crop />
            <Typography variant="h1" sx={{ color: NAVY, fontWeight: 950, letterSpacing: "-.045em", fontSize: { xs: 31, sm: 42, md: 56 }, mt: 1 }}>{settings.publicTitle}</Typography>
            <Typography sx={{ color: "#284c89", fontSize: { xs: 15, md: 18 }, maxWidth: 900, mt: .75 }}>{settings.publicSubtitle}</Typography>
          </Stack>

          <Card sx={{
            mb: { xs: 2.5, md: 3.5 }, p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 3,
            color: "#fff", overflow: "hidden", position: "relative",
            background: "linear-gradient(112deg, #08265f 0%, #1265d8 58%, #1ea7e1 100%)",
            boxShadow: "0 18px 42px rgba(18,101,216,.24)",
            border: "1px solid rgba(255,255,255,.3)",
            "&::after": { content: '""', position: "absolute", width: 260, height: 260, right: -90, top: -130, borderRadius: "50%", bgcolor: "rgba(255,255,255,.12)" }
          }}>
            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" gap={2} sx={{ position: "relative", zIndex: 1 }}>
              <Stack direction="row" alignItems="flex-start" gap={1.5}>
                <WorkspacePremiumIcon sx={{ fontSize: { xs: 34, md: 42 }, color: "#ffe08a", mt: .2 }} />
                <Box>
                  <Typography sx={{ color: "#ffe08a", fontWeight: 1000, letterSpacing: ".045em", fontSize: { xs: 18, md: 24 }, lineHeight: 1.1 }}>ΔΩΡΕΑΝ ΠΛΗΡΗΣ ΠΑΡΟΥΣΙΑΣΗ</Typography>
                  <Typography sx={{ mt: .65, fontWeight: 800, fontSize: { xs: 15, md: 18 } }}>Δωρεάν οι 2 πρώτοι μήνες χρήσης, ανεξαρτήτως πακέτου και πρόσθετων.</Typography>
                  <Typography sx={{ mt: .3, color: "rgba(255,255,255,.9)", fontSize: { xs: 14, md: 16 } }}>Δωρεάν προσαρμογή του προγράμματος για το γραφείο σας.</Typography>
                </Box>
              </Stack>
              <Button onClick={() => setPresentationOpen(true)} variant="contained" endIcon={<ArrowForwardIcon />} sx={{ flexShrink: 0, bgcolor: "#fff", color: NAVY, fontWeight: 950, borderRadius: 2, px: 2.5, py: 1.2, "&:hover": { bgcolor: "#fff4c7" } }}>Κλείστε παρουσίαση</Button>
            </Stack>
          </Card>

          <Alert
            severity="success"
            sx={{
              mb: { xs: 2.5, md: 3.5 },
              border: "1px solid rgba(255,255,255,.35)",
              borderRadius: 2.5,
              bgcolor: "#198754",
              color: "#fff",
              alignItems: "flex-start",
              boxShadow: "0 8px 22px rgba(25,135,84,.2)",
              "& .MuiAlert-icon": { color: "#fff", mt: ".1rem" }
            }}
          >
            <Typography component="span" sx={{ fontWeight: 950 }}>
              Η τελική τιμή προσαρμόζεται στις ανάγκες του γραφείου σας.
            </Typography>{" "}
            Οι τιμές μπορούν να μειωθούν αν δεν χρειάζεστε συγκεκριμένες λειτουργίες ή να αυξηθούν αν επιλέξετε επιπλέον δυνατότητες, γραφεία, χρήστες ή διασυνδέσεις. Επικοινωνήστε μαζί μας για μια εξατομικευμένη πρόταση.
          </Alert>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)", xl: "repeat(5,1fr)" }, gap: { xs: 2, lg: 2.5 }, alignItems: "stretch" }}>
            {activePlans.map(plan => <PlanCard key={plan.code} plan={plan} features={activeFeatures} />)}
          </Box>
          <Typography sx={{ color: RED, fontWeight: 800, fontSize: 13, textAlign: "right", mt: 1 }}>{settings.pricesIncludeVat ? settings.vatLabel : `Οι τιμές δεν περιλαμβάνουν ΦΠΑ (${settings.vatRate}%)`}</Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5, mt: 3 }}>
            <Paper sx={{ p: { xs: 2, md: 2.5 }, border: `1px solid ${RULE}`, borderRadius: 3, bgcolor: "rgba(255,255,255,.93)", boxShadow: "0 14px 38px rgba(19,84,146,.08)" }}>
              <SectionHeading number="01" title="Πρόσθετα Πακέτα" subtitle="Επεκτείνετε τη λειτουργικότητα του KALYPSIS με επιπλέον δυνατότητες." />
              <Table size="small"><TableHead><TableRow sx={{ bgcolor: "#e6f4ff" }}><TableCell sx={{ fontWeight: 900, color: NAVY }}>Πρόσθετο</TableCell><TableCell sx={{ fontWeight: 900, color: NAVY }}>Περιγραφή</TableCell><TableCell align="right" sx={{ fontWeight: 900, color: NAVY }}>Τιμή / έτος</TableCell></TableRow></TableHead><TableBody>
                {activeAddons.map(a => <TableRow key={a.code} hover><TableCell sx={{ fontWeight: 800, color: NAVY }}>{a.name}</TableCell><TableCell>{a.description}</TableCell><TableCell align="right" sx={{ color: BLUE, fontWeight: 950 }}>{money(a.pricePerYear)}</TableCell></TableRow>)}
              </TableBody></Table>
            </Paper>
            <Paper sx={{ p: { xs: 2, md: 2.5 }, border: `1px solid ${RULE}`, borderRadius: 3, bgcolor: "rgba(255,255,255,.93)", boxShadow: "0 14px 38px rgba(19,84,146,.08)" }}>
              <SectionHeading number="02" title="Υπηρεσίες με Χρέωση" subtitle="Εξειδικευμένες υπηρεσίες για να αξιοποιήσετε πλήρως την πλατφόρμα." />
              <Table size="small"><TableHead><TableRow sx={{ bgcolor: "#e6f4ff" }}><TableCell sx={{ fontWeight: 900, color: NAVY }}>Υπηρεσία</TableCell><TableCell sx={{ fontWeight: 900, color: NAVY }}>Περιγραφή</TableCell><TableCell align="right" sx={{ fontWeight: 900, color: NAVY }}>Τιμή</TableCell></TableRow></TableHead><TableBody>
                {activeServices.map(s => <TableRow key={s.code} hover><TableCell sx={{ fontWeight: 800, color: NAVY }}>{s.name}</TableCell><TableCell>{s.description}<Typography variant="caption" display="block" color="text.secondary">{s.unitLabel}</Typography></TableCell><TableCell align="right" sx={{ color: BLUE, fontWeight: 950, whiteSpace: "nowrap" }}>{s.pricingType === "custom_quote" ? "Κατά περίπτωση" : `${money(s.unitPrice)} / ${s.unitLabel}`}</TableCell></TableRow>)}
              </TableBody></Table>
            </Paper>
          </Box>

          <Paper sx={{ p: { xs: 2, md: 3 }, mt: 3, border: `2px solid ${BLUE}33`, borderRadius: 3, bgcolor: "rgba(255,255,255,.96)" }}>
            <SectionHeading number="03" title="Υπολόγισε το δικό σου σύνολο" subtitle="Επίλεξε πλάνο, πρόσθετα γραφεία/χρήστες και πρόσθετα για ζωντανή εκτίμηση." />
            <Stack direction={{ xs: "column", md: "row" }} gap={2} alignItems="stretch">
              <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} sx={{ flex: 1 }}>
                <TextField select label="Βασικό πλάνο" value={planCode} onChange={e => setPlanCode(e.target.value)} fullWidth>{activePlans.map(p => <MenuItem value={p.code} key={p.code}>{p.name} · {money(p.pricePerYear)} / έτος</MenuItem>)}</TextField>
                <TextField type="number" label="Επιπλέον γραφεία" value={extraOffices} onChange={e => setExtraOffices(Math.max(0, Number(e.target.value)))} inputProps={{ min: 0 }} />
                <TextField type="number" label="Επιπλέον χρήστες" value={extraUsers} onChange={e => setExtraUsers(Math.max(0, Number(e.target.value)))} inputProps={{ min: 0 }} />
              </Stack>
              <Stack direction="row" gap={.5} flexWrap="wrap" alignItems="center" sx={{ maxWidth: { md: 420 } }}>
                {activeAddons.map(a => <FormControlLabel key={a.code} control={<Checkbox size="small" checked={!!selectedAddons[a.code]} onChange={e => setSelectedAddons(v => ({ ...v, [a.code]: e.target.checked }))} />} label={<Typography variant="caption">{a.name}</Typography>} />)}
                {activeServices.map(s => <FormControlLabel key={s.code} control={<Checkbox size="small" checked={!!selectedServices[s.code]} onChange={e => setSelectedServices(v => ({ ...v, [s.code]: e.target.checked }))} />} label={<Typography variant="caption">{s.name}</Typography>} />)}
              </Stack>
              <Card sx={{ minWidth: { md: 250 }, p: 2, bgcolor: "#eef7ff", border: `1px solid ${BLUE}44` }}>
                <Stack direction="row" gap={1} alignItems="center"><CalculateIcon sx={{ color: BLUE }} /><Typography fontWeight={950} color={NAVY}>Ετήσιο σύνολο</Typography></Stack>
                <Typography sx={{ color: BLUE, fontWeight: 950, fontSize: 30, mt: .5 }}>{calculation.data ? money(calculation.data.totalAmount) : <CircularProgress size={22} />}</Typography>
                {calculation.data && <Typography variant="caption" color="text.secondary">Καθαρά {money(calculation.data.netAmount)} · ΦΠΑ {money(calculation.data.vatAmount)}{calculation.data.requiresQuote ? " · περιλαμβάνει υπηρεσία κατόπιν προσφοράς" : ""}</Typography>}
              </Card>
            </Stack>
          </Paper>

          <Paper sx={{ mt: 3, overflowX: "auto", border: `1px solid ${RULE}`, borderRadius: 3, bgcolor: "rgba(255,255,255,.94)" }}>
            <Box sx={{ p: { xs: 2, md: 2.5 }, pb: 1 }}><SectionHeading number="04" title="Σύγκριση δυνατοτήτων" subtitle="Μια καθαρή εικόνα του τι περιλαμβάνει κάθε ενεργό πακέτο." /></Box>
            <Table size="small" sx={{ minWidth: 760 }}><TableHead><TableRow sx={{ bgcolor: "#e6f4ff" }}><TableCell sx={{ fontWeight: 900, color: NAVY }}>Δυνατότητα</TableCell>{activePlans.map(p => <TableCell align="center" key={p.code} sx={{ fontWeight: 900, color: NAVY }}>{p.name}</TableCell>)}</TableRow></TableHead><TableBody>{activeFeatures.map(f => <TableRow hover key={f.key}><TableCell sx={{ fontWeight: 800, color: NAVY }}>{f.label}</TableCell>{activePlans.map(p => <TableCell align="center" key={p.code}>{(p.featureKeys ?? p.packages).includes(f.key) ? <CheckCircleIcon sx={{ color: "#16803c" }} /> : "—"}</TableCell>)}</TableRow>)}</TableBody></Table>
          </Paper>

          <Stack alignItems="center" textAlign="center" sx={{ mt: 4 }}><Typography variant="h5" fontWeight={950} color={NAVY}>Θέλεις να το προσαρμόσουμε στο γραφείο σου;</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Επικοινώνησε μαζί μας για ενεργοποίηση πακέτων ή ειδική τιμολόγηση.</Typography><Button component={RouterLink} to="/contact" variant="contained" endIcon={<ArrowForwardIcon />} sx={{ mt: 1.5, bgcolor: NAVY, fontWeight: 900 }}>Ζήτησε διαμόρφωση</Button></Stack>
        </Container>
        <PresentationRequestDialog open={presentationOpen} onClose={() => setPresentationOpen(false)} />
      </Box>
    </PublicShell>
  );
}

// Kept as a compatibility export for older route imports; pricing is now live.
export function PricingComingSoonPage() { return <PricingPage />; }
