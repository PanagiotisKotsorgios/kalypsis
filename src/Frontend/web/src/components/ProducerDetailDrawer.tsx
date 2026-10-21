import { DetailProfileTabs } from "./profile/DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, profileFieldGridSx, useProfileFieldEditor, type ProfileFieldSession } from "./profile/ProfileFieldEditor";
import { PRODUCER_FIELDS, producerUpdatePayload } from "./profile/producerProfile";
import { useEffect, useState } from "react";
import {
  Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, LinearProgress, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import BarChartIcon from "@mui/icons-material/BarChart";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DescriptionIcon from "@mui/icons-material/Description";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { ProducerBalancesPanel } from "./ProducerBalancesPanel";

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

  const qc = useQueryClient();
  const producerOptions = useQuery({ queryKey: ["producers"], enabled: open && !!onEdit,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data });
  const session = useProfileFieldEditor({
    sessionKey: open ? producerId ?? "" : "", values: Object.fromEntries(PRODUCER_FIELDS.map(([key]) => [key, String(p?.[key] ?? "")])), onClose,
    refresh: () => { void qc.invalidateQueries({ queryKey: ["producer-detail", producerId] }); void qc.invalidateQueries({ queryKey: ["producers"] }); },
    write: async (changes, accept) => {
      if (!onEdit || !p) throw new Error("Δεν επιτρέπεται η επεξεργασία συνεργάτη.");
      if (!Object.keys(changes).length) return;
      const current = qc.getQueryData<ProducerDetail>(["producer-detail", producerId]) ?? p;
      const saved = (await api.put("/producers/" + producerId, producerUpdatePayload({ ...current }, changes))).data;
      qc.setQueryData(["producer-detail", producerId], { ...current, ...saved }); accept(Object.keys(changes));
    }
  });
  const statusLabel = p?.status === "Active" ? "Ενεργός" : p?.status === "Prospect" ? "Πιθανός συνεργάτης" : p?.status === "Suspended" ? "Σε αναστολή" : p?.status === "Terminated" ? "Τερματισμένος" : p?.status ?? "—";
  return (
    <Dialog open={open} onClose={session.requestClose} fullWidth maxWidth="xl" PaperProps={{ sx: profileDialogPaperSx }}>
      <DialogTitle sx={{ px: 1.5, py: 1.15, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Stack direction="row" alignItems="center" spacing={1.25} minWidth={0}>
            <Box sx={{ width: 48, height: 48, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: GRADE_COLOR[p?.performanceGrade ?? ""] ?? "#78909c", color: "#fff", flexShrink: 0 }}><Typography fontWeight={900} sx={{ fontSize: 24 }}>{p?.performanceGrade ?? "—"}</Typography></Box>
            <Box minWidth={0}><Typography variant="caption" color="text.secondary" fontWeight={800}>{t("producerDetail.header")}</Typography><Typography variant="h6" fontWeight={900} noWrap>{p?.name ?? "Συνεργάτης"}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{p?.code ?? ""}</Typography></Box>
            {p && <Chip size="small" color={p.status === "Active" ? "success" : p.status === "Prospect" ? "warning" : "default"} label={statusLabel} />}
          </Stack>
          <Stack direction="row" spacing={.75} alignItems="center" justifyContent="flex-end">

            <IconButton size="small" onClick={session.requestClose} aria-label="Κλείσιμο"><CloseIcon /></IconButton>
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
          <DetailProfileTabs value={tab} onChange={setTab} items={[
            {label: "Γενικά", icon: <InfoOutlinedIcon />}, {label: "Παραγωγή & συμβόλαια", icon: <DescriptionIcon />},
            {label: "Οικονομικά", icon: <AccountBalanceWalletIcon />}, {label: "Επικοινωνία", icon: <ContactPhoneIcon />},
            {label: "Στατιστικά", icon: <BarChartIcon />},
          ]} />
          <ProfileEditorFeedback session={session} />

          <Stack spacing={1.25}>
            {tab === 0 && <ProducerProfileFields session={onEdit ? session : undefined} values={session.values} parents={(producerOptions.data ?? []).filter(row => row.id !== producerId)} />}
            {tab === 4 && <Stack spacing={.75}>
              <PerfBar label={t("producerDetail.renewalRate")} value={p.renewalRate} target={70} unit="%" />
              <PerfBar label={t("producerDetail.premiumGrowth")} value={p.premiumGrowthPercent} target={10} unit="%" allowNegative />
              <PerfBar label={t("producerDetail.claimRatio")} value={p.claimRatio} target={25} unit="%" inverted />
              <Box sx={{ display: "grid", gap: .8, gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" } }}>
                <KPI label={t("producerDetail.totalPolicies")} value={p.totalPolicies} hint={`${p.activePolicies} ${t("producerDetail.active").toLowerCase()}`} />
                <KPI label={t("producerDetail.customers")} value={p.customerCount} />
                <KPI label={t("producerDetail.newThisYear")} value={p.newPoliciesThisYear} />
                <KPI label={t("producerDetail.renewalsDue")} value={p.renewalsDueNext60Days} hint="επόμενες 60 ημέρες" />
              </Box>
</Stack>}
            {tab === 1 && <Stack spacing={1.25}>
              {p.byCarrier.length > 0 && <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.byCarrier")}</Typography><Table size="small"><TableHead><TableRow><TableCell>{t("producerDetail.carrier")}</TableCell><TableCell align="right">{t("producerDetail.policies")}</TableCell><TableCell align="right">{t("producerDetail.premium")}</TableCell></TableRow></TableHead><TableBody>{p.byCarrier.map(c => <TableRow key={c.carrierName}><TableCell>{c.carrierName}</TableCell><TableCell align="right">{c.policyCount}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{c.totalPremium.toFixed(2)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
              {p.byPolicyType.length > 0 && <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.byType")}</Typography><Table size="small"><TableHead><TableRow><TableCell>{t("producerDetail.type")}</TableCell><TableCell align="right">{t("producerDetail.policies")}</TableCell><TableCell align="right">{t("producerDetail.premium")}</TableCell></TableRow></TableHead><TableBody>{p.byPolicyType.map(item => <TableRow key={item.policyType}><TableCell>{item.policyType}</TableCell><TableCell align="right">{item.policyCount}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{item.totalPremium.toFixed(2)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
              {p.byCarrier.length === 0 && p.byPolicyType.length === 0 && <Typography color="text.secondary">Δεν υπάρχουν ακόμη συμβόλαια ή στοιχεία παραγωγής.</Typography>}
            </Stack>}
            {tab === 2 && <Stack gap={1.25}>
              <ProducerBalancesPanel key={p.id} producerId={p.id} />
              <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.financials")}</Typography><Box sx={profileFieldGridSx}>
                <KV label={t("producerDetail.premiumYtd")} value={`${p.totalPremiumYtd.toFixed(2)} €`} />
                <KV label={t("producerDetail.premiumLastYear")} value={`${p.totalPremiumLastYear.toFixed(2)} €`} />
                <KV label={t("producerDetail.commissionsAll")} value={`${p.totalCommissionsEarned.toFixed(2)} €`} />
                <KV label={t("producerDetail.commissionsYtd")} value={`${p.commissionsThisYear.toFixed(2)} €`} />
              </Box></Card>
            </Stack>}
            {tab === 3 && <Card variant="outlined" sx={{ p: 1.25 }}><Stack direction="row" justifyContent="space-between" alignItems="center" mb={.75}><Typography fontWeight={800}>Ιστορικό επικοινωνίας</Typography><Chip size="small" label={`${communications.data?.length ?? 0}`} /></Stack>{communications.isLoading ? <CircularProgress size={20} /> : (communications.data ?? []).length === 0 ? <Typography variant="body2" color="text.secondary">Δεν έχει καταγραφεί ακόμη επικοινωνία με τον συνεργάτη.</Typography> : <Stack spacing={.75}>{(communications.data ?? []).map(item => <Box key={item.id} sx={{ p: 1, borderRadius: 1.25, bgcolor: "background.default", border: "1px solid", borderColor: "divider" }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={.5}><Typography variant="body2" fontWeight={700}>{COMM_KIND[item.kind] ?? "Επικοινωνία"} · {item.subject}</Typography><Typography variant="caption" color="text.secondary">{new Date(item.occurredAt).toLocaleString("el-GR")}</Typography></Stack><Typography variant="caption" color="text.secondary">{COMM_OUTCOME[item.outcome] ?? ""}</Typography>{item.body && <Typography variant="body2" sx={{ mt: .35, whiteSpace: "pre-wrap" }}>{item.body}</Typography>}</Box>)}</Stack>}</Card>}
          </Stack>
        </>}
      </DialogContent>
      <DialogActions sx={{ px: 1.25, py: .6 }}>{onEdit ? <ProfileEditorActions session={session} label="συνεργάτη" /> : <Button color="error" variant="contained" onClick={session.requestClose}>Κλείσιμο</Button>}</DialogActions>
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
  return <ProfileEditableField label={label} value={String(value ?? "")} />;
}

export function ProducerProfileFields({ session, values, parents = [] }: { session?: ProfileFieldSession; values: Record<string, string>; parents?: {id: string; name: string}[] }) {
  const enums: Record<string, { value: string; label: string }[]> = {
    status: [{value:"Active",label:"Ενεργός"}, {value:"Prospect",label:"Πιθανός συνεργάτης"}, {value:"Suspended",label:"Σε αναστολή"}, {value:"Terminated",label:"Τερματισμένος"}],
    hasContract: [{value:"true",label:"Ναι"}, {value:"false",label:"Όχι"}],
    tier: ["None", "A", "B", "C", "D", "E"].map(value => ({value,label: value === "None" ? "Χωρίς κατηγορία" : "Κατηγορία " + value})),
    hierarchyLevel: Object.entries({Producer:"Συνεργάτης", Manager:"Υπεύθυνος ομάδας", Unit:"Μονάδα", Assistant:"Βοηθός διοίκησης", Agency:"Γραφείο"}).map(([value,label]) => ({value,label})),
    parentProducerId: [{value:"",label:"Χωρίς προϊστάμενο"}, ...parents.map(row => ({value:row.id,label:row.name}))],
  };
  if (values.parentProducerId && !enums.parentProducerId.some(option => option.value === values.parentProducerId)) enums.parentProducerId.push({value: values.parentProducerId, label:"Τρέχων προϊστάμενος"});
  return <Box sx={profileFieldGridSx}>{PRODUCER_FIELDS.map(([key,label]) =>
    <ProfileEditableField key={key} label={label} field={session ? key : undefined} session={session} value={values[key]} options={enums[key]}
      type={/Date$/.test(key) ? "date" : /email/i.test(key) ? "email" : "text"} multiline={key === "notes" || key === "additionalInfoJson"} />
  )}</Box>;
}
