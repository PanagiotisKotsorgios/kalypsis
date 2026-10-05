import { useEffect, useState } from "react";
import {
  Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, LinearProgress, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Tabs, Tab, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DescriptionIcon from "@mui/icons-material/Description";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface ProducerDetail {
  id: string; code: string; name: string; email: string | null; phone: string | null; notes: string | null; status: string;
  secondaryEmail?: string | null; secondaryPhone?: string | null;
  taxId?: string | null; taxOffice?: string | null; businessType?: string | null; professionalCategory?: string | null;
  hasContract?: boolean; contractNumber?: string | null; contractStartDate?: string | null; contractEndDate?: string | null;
  address?: string | null; city?: string | null; postalCode?: string | null; website?: string | null; identityNumber?: string | null;
  professionalLicenseNumber?: string | null; licenseExpiryDate?: string | null; iban?: string | null; bankName?: string | null;
  paymentMethod?: string | null; additionalInfoJson?: string | null;
  tier?: string; hierarchyLevel?: string; parentProducerId?: string | null; parentProducerName?: string | null;
  totalPolicies: number; activePolicies: number; renewedPolicies: number; cancelledPolicies: number;
  newPoliciesThisYear: number; renewalsDueNext60Days: number;
  totalPremiumYtd: number; totalPremiumLastYear: number; premiumGrowthPercent: number;
  totalCommissionsEarned: number; commissionsThisYear: number;
  claimCount: number; claimRatio: number;
  renewalRate: number; customerCount: number;
  byCarrier: { carrierName: string; policyCount: number; totalPremium: number; }[];
  byPolicyType: { policyType: string; policyCount: number; totalPremium: number; }[];
  performanceGrade: string;
}

interface ProducerCommunication {
  id: string;
  kind: number;
  direction: number;
  outcome: number;
  occurredAt: string;
  subject: string;
  body: string | null;
}

const COMM_KIND: Record<number, string> = { 1: "Σημείωση", 2: "Τηλέφωνο", 3: "Email", 4: "Συνάντηση", 5: "SMS", 6: "Επίσκεψη" };
const COMM_OUTCOME: Record<number, string> = { 0: "Χωρίς αποτέλεσμα", 1: "Ολοκληρώθηκε", 2: "Απαιτείται follow-up", 3: "Δεν απάντησε", 4: "Ακυρώθηκε" };

const GRADE_COLOR: Record<string, string> = {
  A: "#1b873f", B: "#3aa56b", C: "#c98a1d", D: "#d65f2d", F: "#c43838"
};
const GRADE_LABEL: Record<string, string> = {
  A: "Άριστος", B: "Πολύ καλός", C: "Μέτριος", D: "Φτωχός", F: "Προβληματικός"
};

export function ProducerDetailDrawer({ producerId, open, onClose, onEdit }: {
  producerId: string | null; open: boolean; onClose: () => void; onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["producer-detail", producerId],
    enabled: open && !!producerId,
    queryFn: async () => (await api.get<ProducerDetail>(`/producers/${producerId}/detail`)).data
  });
  const communications = useQuery({
    queryKey: ["producer-communications", producerId],
    enabled: open && !!producerId,
    queryFn: async () => (await api.get<ProducerCommunication[]>(`/crm/producers/${producerId}/communications`)).data
  });

  const p = q.data;
  const [tab, setTab] = useState(0);
  useEffect(() => { if (open) setTab(0); }, [open, producerId]);

  const statusLabel = p?.status === "Active" ? "Ενεργός" : p?.status === "Prospect" ? "Πιθανός συνεργάτης" : p?.status === "Suspended" ? "Σε αναστολή" : p?.status === "Terminated" ? "Τερματισμένος" : p?.status ?? "—";
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { maxHeight: "calc(100vh - 28px)", borderRadius: 2, overflow: "hidden" } }}>
      <DialogTitle sx={{ px: 1.5, py: 1.15, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Stack direction="row" alignItems="center" spacing={1.25} minWidth={0}>
            <Box sx={{ width: 48, height: 48, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: GRADE_COLOR[p?.performanceGrade ?? ""] ?? "#78909c", color: "#fff", flexShrink: 0 }}><Typography fontWeight={900} sx={{ fontSize: 24 }}>{p?.performanceGrade ?? "—"}</Typography></Box>
            <Box minWidth={0}><Typography variant="caption" color="text.secondary" fontWeight={800}>{t("producerDetail.header")}</Typography><Typography variant="h6" fontWeight={900} noWrap>{p?.name ?? "Συνεργάτης"}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{p?.code ?? ""}</Typography></Box>
            {p && <Chip size="small" color={p.status === "Active" ? "success" : p.status === "Prospect" ? "warning" : "default"} label={statusLabel} />}
          </Stack>
          <Stack direction="row" spacing={.75} alignItems="center" justifyContent="flex-end">
            {onEdit && <Button size="small" variant="contained" color="success" sx={{ color: "#fff", fontWeight: 800 }} startIcon={<EditIcon />} onClick={onEdit}>Επεξεργασία συνεργάτη</Button>}
            <IconButton size="small" onClick={onClose} aria-label="Κλείσιμο"><CloseIcon /></IconButton>
          </Stack>
        </Stack>
        {p && <Stack direction="row" spacing={.75} mt={.9} flexWrap="wrap" useFlexGap>
          {p.email && <Chip size="small" icon={<EmailIcon fontSize="small" />} component="a" href={`mailto:${p.email}`} clickable label={p.email} />}
          {p.phone && <Chip size="small" icon={<PhoneIcon fontSize="small" />} component="a" href={`tel:${p.phone}`} clickable label={p.phone} />}
          <Chip size="small" variant="outlined" label={`${t("producerDetail.gradeLabel")}: ${GRADE_LABEL[p.performanceGrade] ?? p.performanceGrade}`} />
        </Stack>}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 1.25, overflowY: "auto", "&::-webkit-scrollbar": { width: 12 }, "&::-webkit-scrollbar-thumb": { background: "#0b2545", borderRadius: 999, border: "3px solid #eef3f8" } }}>
        {q.isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
        {q.isError && <Typography color="error">Δεν ήταν δυνατή η φόρτωση της καρτέλας συνεργάτη.</Typography>}
        {p && <>
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="standard" sx={{ position: "sticky", top: 0, zIndex: 4, mb: 1.25, px: .5, py: .5, border: "1px solid #263238", borderRadius: 2, bgcolor: "background.paper", boxShadow: "0 3px 10px rgba(15,23,42,.12)", overflow: "visible", "& .MuiTabs-scroller": { overflow: "visible !important" }, "& .MuiTabs-flexContainer": { gap: .65, flexWrap: "wrap" }, "& .MuiTabs-indicator": { display: "none" }, "& .MuiTab-root": { minHeight: 48, minWidth: { xs: 120, md: 156 }, px: 1.25, py: .6, border: "1px solid #263238", borderRadius: 1.5, background: "linear-gradient(180deg, #e5e7eb 0%, #b8c0c8 100%) !important", color: "#111827 !important", opacity: "1 !important", textTransform: "none", fontWeight: 750, fontSize: { xs: ".78rem", md: ".86rem" }, transition: "background .18s ease, color .18s ease, box-shadow .18s ease", "&:hover": { background: "linear-gradient(180deg, #d4d8de 0%, #9ca6b1 100%) !important", color: "#0b2545 !important", transform: "none" }, "&.Mui-selected": { background: "linear-gradient(135deg, #0b5cad 0%, #063b73 100%) !important", color: "#fff !important", borderColor: "#062f63 !important", boxShadow: "0 3px 8px rgba(6,47,99,.35)" } } }}>
            <Tab icon={<InfoOutlinedIcon fontSize="small" />} iconPosition="start" label="Σύνοψη" />
            <Tab icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="Παραγωγή & συμβόλαια" />
            <Tab icon={<AccountBalanceWalletIcon fontSize="small" />} iconPosition="start" label="Οικονομικά" />
            <Tab icon={<ContactPhoneIcon fontSize="small" />} iconPosition="start" label="Επικοινωνία" />
          </Tabs>
          <Stack spacing={1.25}>
            {tab === 0 && <Stack spacing={1.25}>
              <Box sx={{ display: "grid", gap: .8, gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" } }}>
                <KPI label={t("producerDetail.totalPolicies")} value={p.totalPolicies} hint={`${p.activePolicies} ${t("producerDetail.active").toLowerCase()}`} />
                <KPI label={t("producerDetail.customers")} value={p.customerCount} />
                <KPI label={t("producerDetail.newThisYear")} value={p.newPoliciesThisYear} />
                <KPI label={t("producerDetail.renewalsDue")} value={p.renewalsDueNext60Days} hint="επόμενες 60 ημέρες" />
              </Box>
              <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>Απόδοση συνεργάτη</Typography><PerfBar label={t("producerDetail.renewalRate")} value={p.renewalRate} target={70} unit="%" /><PerfBar label={t("producerDetail.premiumGrowth")} value={p.premiumGrowthPercent} target={10} unit="%" allowNegative /><PerfBar label={t("producerDetail.claimRatio")} value={p.claimRatio} target={25} unit="%" inverted /></Card>
              <Card variant="outlined" sx={{ p: 1.25 }}>
                <Typography fontWeight={800} mb={.85}>Επαγγελματικό & φορολογικό προφίλ</Typography>
                <Box sx={{ display: "grid", gap: .75, gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" } }}>
                  <InfoField label="ΑΦΜ" value={p.taxId} /><InfoField label="ΔΟΥ" value={p.taxOffice} />
                  <InfoField label="Τύπος επιχείρησης" value={p.businessType} /><InfoField label="Κατηγορία" value={p.professionalCategory} />
                  <InfoField label="Αρ. ταυτότητας" value={p.identityNumber} /><InfoField label="Κατηγορία προμηθειών" value={p.tier && p.tier !== "None" ? `Κατηγορία ${p.tier}` : null} />
                  <InfoField label="Επίπεδο ιεραρχίας" value={hierarchyLabel(p.hierarchyLevel)} /><InfoField label="Προϊστάμενος" value={p.parentProducerName} />
                </Box>
              </Card>
              <Card variant="outlined" sx={{ p: 1.25 }}>
                <Typography fontWeight={800} mb={.85}>Σύμβαση & επαγγελματική άδεια</Typography>
                <Box sx={{ display: "grid", gap: .75, gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" } }}>
                  <InfoField label="Σύμβαση" value={p.hasContract ? "Ναι" : "Όχι"} />
                  <InfoField label="Κατάσταση σύμβασης" value={contractStatus(p)} />
                  <InfoField label="Αριθμός σύμβασης" value={p.contractNumber} />
                  <InfoField label="Έναρξη" value={formatDate(p.contractStartDate)} />
                  <InfoField label="Λήξη" value={formatDate(p.contractEndDate)} />
                  <InfoField label="Αρ. άδειας / μητρώου" value={p.professionalLicenseNumber} />
                  <InfoField label="Λήξη άδειας" value={formatDate(p.licenseExpiryDate)} />
                </Box>
              </Card>
              <Card variant="outlined" sx={{ p: 1.25 }}>
                <Typography fontWeight={800} mb={.85}>Επικοινωνία, έδρα & πληρωμές</Typography>
                <Box sx={{ display: "grid", gap: .75, gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" } }}>
                  <InfoField label="Email" value={p.email} /><InfoField label="Δευτερεύον email" value={p.secondaryEmail} />
                  <InfoField label="Τηλέφωνο" value={p.phone} /><InfoField label="Δευτερεύον τηλέφωνο" value={p.secondaryPhone} />
                  <InfoField label="Διεύθυνση" value={p.address} /><InfoField label="Πόλη" value={p.city} />
                  <InfoField label="Τ.Κ." value={p.postalCode} /><InfoField label="Ιστοσελίδα" value={p.website} />
                  <InfoField label="Τράπεζα" value={p.bankName} /><InfoField label="IBAN" value={p.iban} />
                  <InfoField label="Τρόπος πληρωμής" value={p.paymentMethod} />
                </Box>
              </Card>
              {p.additionalInfoJson && <Card variant="outlined" sx={{ p: 1.25, bgcolor: "#fff8e1" }}><Typography fontWeight={800} mb={.5}>Πρόσθετες πληροφορίες</Typography><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.additionalInfoJson}</Typography></Card>}
              {p.notes && <Card variant="outlined" sx={{ p: 1.25, bgcolor: "rgba(245, 158, 11, .08)" }}><Typography variant="caption" color="text.secondary">Σημειώσεις συνεργάτη</Typography><Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{p.notes}</Typography></Card>}
            </Stack>}
            {tab === 1 && <Stack spacing={1.25}>
              {p.byCarrier.length > 0 && <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.byCarrier")}</Typography><Table size="small"><TableHead><TableRow><TableCell>{t("producerDetail.carrier")}</TableCell><TableCell align="right">{t("producerDetail.policies")}</TableCell><TableCell align="right">{t("producerDetail.premium")}</TableCell></TableRow></TableHead><TableBody>{p.byCarrier.map(c => <TableRow key={c.carrierName}><TableCell>{c.carrierName}</TableCell><TableCell align="right">{c.policyCount}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{c.totalPremium.toFixed(2)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
              {p.byPolicyType.length > 0 && <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.byType")}</Typography><Table size="small"><TableHead><TableRow><TableCell>{t("producerDetail.type")}</TableCell><TableCell align="right">{t("producerDetail.policies")}</TableCell><TableCell align="right">{t("producerDetail.premium")}</TableCell></TableRow></TableHead><TableBody>{p.byPolicyType.map(item => <TableRow key={item.policyType}><TableCell>{item.policyType}</TableCell><TableCell align="right">{item.policyCount}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{item.totalPremium.toFixed(2)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
              {p.byCarrier.length === 0 && p.byPolicyType.length === 0 && <Typography color="text.secondary">Δεν υπάρχουν ακόμη συμβόλαια ή στοιχεία παραγωγής.</Typography>}
            </Stack>}
            {tab === 2 && <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.financials")}</Typography><Box sx={{ display: "grid", gap: .5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" } }}><KV label={t("producerDetail.premiumYtd")} value={`${p.totalPremiumYtd.toFixed(2)} €`} /><KV label={t("producerDetail.premiumLastYear")} value={`${p.totalPremiumLastYear.toFixed(2)} €`} /><KV label={t("producerDetail.commissionsAll")} value={`${p.totalCommissionsEarned.toFixed(2)} €`} /><KV label={t("producerDetail.commissionsYtd")} value={`${p.commissionsThisYear.toFixed(2)} €`} /></Box></Card>}
            {tab === 3 && <Card variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" justifyContent="space-between" alignItems="center" mb={.75}><Typography fontWeight={800}>Ιστορικό επικοινωνίας</Typography><Chip size="small" label={`${communications.data?.length ?? 0}`} /></Stack>{communications.isLoading ? <CircularProgress size={20} /> : (communications.data ?? []).length === 0 ? <Typography variant="body2" color="text.secondary">Δεν έχει καταγραφεί ακόμη επικοινωνία με τον συνεργάτη.</Typography> : <Stack spacing={.75}>{(communications.data ?? []).map(item => <Box key={item.id} sx={{ p: 1, borderRadius: 1.25, bgcolor: "background.default", border: "1px solid", borderColor: "divider" }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={.5}><Typography variant="body2" fontWeight={700}>{COMM_KIND[item.kind] ?? "Επικοινωνία"} · {item.subject}</Typography><Typography variant="caption" color="text.secondary">{new Date(item.occurredAt).toLocaleString("el-GR")}</Typography></Stack><Typography variant="caption" color="text.secondary">{COMM_OUTCOME[item.outcome] ?? ""}</Typography>{item.body && <Typography variant="body2" sx={{ mt: .35, whiteSpace: "pre-wrap" }}>{item.body}</Typography>}</Box>)}</Stack>}</Card>}
          </Stack>
        </>}
      </DialogContent>
      <DialogActions sx={{ px: 1.5, py: 1 }}><Button color="error" variant="contained" sx={{ color: "#fff", fontWeight: 800 }} onClick={onClose}>Κλείσιμο</Button></DialogActions>
    </Dialog>
  );
}

function KPI({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(11,37,69,0.04)", border: "1px solid", borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
      <Typography variant="h5" fontWeight={800}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  );
}

function PerfBar({ label, value, target, unit, inverted, allowNegative }: {
  label: string; value: number; target: number; unit: string; inverted?: boolean; allowNegative?: boolean;
}) {
  const display = value.toFixed(1);
  // If inverted (lower is better), success when value <= target.
  const ok = inverted ? value <= target : value >= target;
  const color: "success" | "warning" | "error" = ok ? "success" : (inverted ? (value <= target * 1.5 ? "warning" : "error") : (value >= target * 0.5 ? "warning" : "error"));
  const percent = allowNegative
    ? Math.max(0, Math.min(100, value + 50))
    : Math.max(0, Math.min(100, value));
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={700} color={`${color}.main`}>{display}{unit}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} color={color} sx={{ height: 8, borderRadius: 1 }} />
    </Box>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.3 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

function InfoField({ label, value }: { label: string; value?: React.ReactNode | null }) {
  const present = value !== null && value !== undefined && value !== "" && value !== "—";
  return (
    <Box sx={{ p: .75, minWidth: 0, borderRadius: 1.25, bgcolor: present ? "#e8f5e9" : "#ffebee", border: "1px solid", borderColor: present ? "#a5d6a7" : "#ef9a9a" }}>
      <Typography variant="caption" sx={{ display: "block", color: present ? "#1b5e20" : "#b71c1c", fontWeight: 800, lineHeight: 1.2 }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: present ? "#1b5e20" : "#b71c1c", fontWeight: 700, wordBreak: "break-word" }}>{present ? value : "Δεν έχει καταχωρηθεί"}</Typography>
    </Box>
  );
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("el-GR");
}

function hierarchyLabel(value?: string) {
  const labels: Record<string, string> = {
    Producer: "Συνεργάτης", Manager: "Υπεύθυνος ομάδας", Unit: "Υπεύθυνος μονάδας",
    Assistant: "Βοηθός διοίκησης", Agency: "Γραφείο"
  };
  return value ? labels[value] ?? value : null;
}

function contractStatus(p: ProducerDetail) {
  if (!p.hasContract) return "Χωρίς σύμβαση";
  if (p.contractEndDate && new Date(p.contractEndDate) < new Date()) return "Ληγμένη";
  return "Ενεργή";
}
