import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { EntityAuditTimeline } from "./EntityAuditTimeline";
import { PropagateChangesDialog, type PropagatableChanges } from "./PropagateChangesDialog";
import { SearchableSelect } from "./SearchableSelect";

// Mirrors PolicyDetailDto from the backend (see PolicyDetailQuery.cs).
export interface PolicyDetail {
  id: string; policyNumber: string; policyType: string; status: string;
  startDate: string; endDate: string;
  createdAt: string; updatedAt: string | null; createdByName: string | null;
  customerId: string; customerDisplay: string;
  customerEmail: string | null; customerPhone: string | null; customerVat: string | null;
  insuranceCompanyId: string; insuranceCompanyName: string; insuranceCompanyCode: string | null;
  producerId: string | null; producerName: string | null; producerCode: string | null;
  premium: number; currency: string;
  paymentFrequency: string; premiumIncludesVat: boolean;
  specialCommissionPercent: number | null;
  specsJson: string | null;
  nextRenewalDate: string | null;
  renewalTransferToProducerId: string | null; renewalTransferToProducerName: string | null;
  renewalTransferToCarrierId: string | null; renewalTransferToCarrierName: string | null;
  retainCommissionsOnRenewal: boolean; retainDocumentNumberOnRenewal: boolean; retainSpecialCommissionsOnRenewal: boolean;
  renewalInstructions: string | null;
  deliveredAt: string | null; deliveredTo: string | null; deliveryMethod: string | null;
  paymentCollectionMethod: string | null;
  renewedFromPolicyId: string | null; renewedFromPolicyNumber: string | null;
  endorsementCount: number; cancellationCount: number; claimCount: number; commissionTxnCount: number;
  documentCount: number; receiptCount: number;
  totalReceived: number; outstanding: number; totalCommissions: number;
  covers: PolicyCoverRow[]; coversGrossTotal: number;
  netPremium: number | null;
  vatAmount: number | null;
  stampDutyAmount: number | null;
  insuranceContributionAmount: number | null;
  otherChargesAmount: number | null;
  // ALIS-parity fields
  applicationNumber: string | null;
  contractPartyCustomerId: string | null;
  contractPartyDisplay: string | null;
  previousInsuranceCompanyId: string | null;
  previousInsuranceCompanyName: string | null;
  issuedAt: string | null;
  vehicleRegistrationPlate: string | null;
  // Motor-only extras
  driverVatNumber: string | null;
  reasonForCirculation: string | null;
  // Per-policy commission override (JSON blob {"Producer":15,"Manager":3,...})
  specialLevelPercentsJson: string | null;
}

export interface PolicyCoverRow {
  id: string;
  coverCode: string;
  coverName: string | null;
  grossPremium: number;
  netPremium: number;
  coverageAmount: number | null;
  // Per-cover commission %; null → falls back to the matching CommissionRule.
  commissionPercent: number | null;
  agencyCommissionPercent: number | null;
}

interface Props {
  policyId: string | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "info" | "error"> = {
  Active: "success", Draft: "default", Expired: "warning", Cancelled: "error",
  Renewed: "info", PendingRenewal: "warning"
};

const FREQUENCIES = ["Annual", "Semiannual", "Quarterly", "Monthly", "Single"];
const DELIVERY_METHODS = ["Hand", "Post", "Email", "Courier"];
const COLLECTION_METHODS = ["Cash", "BankDeposit", "Card", "DebitOrder", "Cheque", "Other"];
const COLLECTION_METHODS_LABEL: Record<string, string> = {
  Cash: "Μετρητά",
  BankDeposit: "Κατάθεση τραπέζης",
  Card: "Κάρτα",
  DebitOrder: "Πάγια εντολή",
  Cheque: "Επιταγή",
  Other: "Άλλο",
};

export function PolicyDetailDrawer({ policyId, open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [changeProducerOpen, setChangeProducerOpen] = useState(false);

  const q = useQuery({
    queryKey: ["policy-detail", policyId],
    enabled: !!policyId && open,
    queryFn: async () => (await api.get<PolicyDetail>(`/policies/${policyId}/detail`)).data
  });

  // Editable extended form (Phase 12 fields). Initialized from query data.
  const [form, setForm] = useState({
    paymentFrequency: "Annual",
    premiumIncludesVat: true,
    specialCommissionPercent: "",
    specsJson: "",
    nextRenewalDate: "",
    renewalTransferToProducerId: "",
    renewalTransferToCarrierId: "",
    retainCommissionsOnRenewal: false,
    retainDocumentNumberOnRenewal: false,
    retainSpecialCommissionsOnRenewal: false,
    renewalInstructions: "",
    deliveredAt: "",
    deliveredTo: "",
    deliveryMethod: "",
    paymentCollectionMethod: "",
    // ALIS-parity fields
    applicationNumber: "",
    contractPartyCustomerId: "",
    previousInsuranceCompanyId: "",
    issuedAt: "",
    vehicleRegistrationPlate: "",
    driverVatNumber: "",
    reasonForCirculation: "",
    specialLevelPercentsJson: ""
  });
  useEffect(() => {
    if (q.data) {
      setForm({
        paymentFrequency: q.data.paymentFrequency,
        premiumIncludesVat: q.data.premiumIncludesVat,
        specialCommissionPercent: q.data.specialCommissionPercent?.toString() ?? "",
        specsJson: q.data.specsJson ?? "",
        nextRenewalDate: q.data.nextRenewalDate ?? "",
        renewalTransferToProducerId: q.data.renewalTransferToProducerId ?? "",
        renewalTransferToCarrierId: q.data.renewalTransferToCarrierId ?? "",
        retainCommissionsOnRenewal: q.data.retainCommissionsOnRenewal,
        retainDocumentNumberOnRenewal: q.data.retainDocumentNumberOnRenewal,
        retainSpecialCommissionsOnRenewal: q.data.retainSpecialCommissionsOnRenewal,
        renewalInstructions: q.data.renewalInstructions ?? "",
        deliveredAt: q.data.deliveredAt ?? "",
        deliveredTo: q.data.deliveredTo ?? "",
        deliveryMethod: q.data.deliveryMethod ?? "",
        paymentCollectionMethod: q.data.paymentCollectionMethod ?? "",
        applicationNumber: q.data.applicationNumber ?? "",
        contractPartyCustomerId: q.data.contractPartyCustomerId ?? "",
        previousInsuranceCompanyId: q.data.previousInsuranceCompanyId ?? "",
        issuedAt: q.data.issuedAt ?? "",
        vehicleRegistrationPlate: q.data.vehicleRegistrationPlate ?? "",
        driverVatNumber: q.data.driverVatNumber ?? "",
        reasonForCirculation: q.data.reasonForCirculation ?? "",
        specialLevelPercentsJson: q.data.specialLevelPercentsJson ?? ""
      });
    }
  }, [q.data]);

  // Lookups for the SUMMARY tab's ALIS-parity fields — loaded once when the
  // drawer opens, cached across every policy the user opens in this session.
  const customersLookup = useQuery({
    queryKey: ["customers-lookup"],
    enabled: open,
    queryFn: async () => (await api.get<Array<{ id: string; firstName?: string; lastName?: string; companyName?: string; vatNumber?: string }>>("/customers")).data
  });
  const carriersLookup = useQuery({
    queryKey: ["carriers-lookup"],
    enabled: open,
    queryFn: async () => (await api.get<Array<{ id: string; name: string; code?: string }>>("/insurance-companies")).data
  });

  // Tab-specific data sources (loaded only when the tab is opened).
  const endorsements = useQuery({
    queryKey: ["policy-endorsements", policyId],
    enabled: open && tab === 5 && !!policyId,
    queryFn: async () => (await api.get<any[]>("/endorsements", { params: { policyId } })).data.filter((e: any) => e.policyId === policyId)
  });
  const claims = useQuery({
    queryKey: ["policy-claims", policyId],
    enabled: open && tab === 6 && !!policyId,
    queryFn: async () => (await api.get<any[]>("/claims", { params: { policyId } })).data
  });
  const receipts = useQuery({
    queryKey: ["policy-receipts", policyId],
    enabled: open && tab === 7 && !!policyId,
    queryFn: async () => (await api.get<any[]>("/receipts")).data.filter((r: any) => r.policyId === policyId)
  });
  const communications = useQuery({
    queryKey: ["policy-communications", policyId],
    enabled: open && tab === 13 && !!policyId,
    queryFn: async () => (await api.get<PolicyCommunicationRow[]>(`/policies/${policyId}/communications`)).data
  });
  const commissionMatrix = useQuery({
    queryKey: ["policy-commission-matrix", policyId],
    enabled: open && tab === 14 && !!policyId,
    queryFn: async () => (await api.get<PolicyCommissionMatrix>(`/policies/${policyId}/commission-splits`)).data
  });

  // Snapshot of the fields that support propagation to sibling policies —
  // captured BEFORE save so we can diff against the response and show the
  // «apply to other contracts of this customer» prompt afterwards.
  const [propagateChanges, setPropagateChanges] = useState<PropagatableChanges | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const before = {
        paymentFrequency: q.data?.paymentFrequency,
        specialCommissionPercent: q.data?.specialCommissionPercent,
        renewalTransferToProducerId: q.data?.renewalTransferToProducerId,
        renewalTransferToCarrierId: q.data?.renewalTransferToCarrierId,
        paymentCollectionMethod: q.data?.paymentCollectionMethod,
      };
      const saved = (await api.put<PolicyDetail>(`/policies/${policyId}/extended`, {
        paymentFrequency: form.paymentFrequency,
        premiumIncludesVat: form.premiumIncludesVat,
        specialCommissionPercent: form.specialCommissionPercent ? Number(form.specialCommissionPercent) : null,
        specsJson: form.specsJson || null,
        nextRenewalDate: form.nextRenewalDate || null,
        renewalTransferToProducerId: form.renewalTransferToProducerId || null,
        renewalTransferToCarrierId: form.renewalTransferToCarrierId || null,
        retainCommissionsOnRenewal: form.retainCommissionsOnRenewal,
        retainDocumentNumberOnRenewal: form.retainDocumentNumberOnRenewal,
        retainSpecialCommissionsOnRenewal: form.retainSpecialCommissionsOnRenewal,
        renewalInstructions: form.renewalInstructions || null,
        deliveredAt: form.deliveredAt || null,
        deliveredTo: form.deliveredTo || null,
        deliveryMethod: form.deliveryMethod || null,
        paymentCollectionMethod: form.paymentCollectionMethod || null,
        applicationNumber: form.applicationNumber.trim() || null,
        contractPartyCustomerId: form.contractPartyCustomerId || null,
        previousInsuranceCompanyId: form.previousInsuranceCompanyId || null,
        issuedAt: form.issuedAt || null,
        vehicleRegistrationPlate: form.vehicleRegistrationPlate.trim() || null,
        driverVatNumber: form.driverVatNumber.trim() || null,
        reasonForCirculation: form.reasonForCirculation.trim() || null,
        specialLevelPercentsJson: form.specialLevelPercentsJson.trim() || null
      })).data;
      // Diff the fields that map to propagatable ones.
      const diff: PropagatableChanges = {};
      if (saved.paymentFrequency !== before.paymentFrequency)
        diff.paymentFrequency = saved.paymentFrequency;
      if (saved.specialCommissionPercent !== before.specialCommissionPercent)
        diff.specialCommissionPercent = saved.specialCommissionPercent ?? null;
      if (saved.renewalTransferToProducerId !== before.renewalTransferToProducerId)
        diff.renewalTransferToProducerId = saved.renewalTransferToProducerId ?? null;
      if (saved.renewalTransferToCarrierId !== before.renewalTransferToCarrierId)
        diff.renewalTransferToCarrierId = saved.renewalTransferToCarrierId ?? null;
      if (saved.paymentCollectionMethod !== before.paymentCollectionMethod)
        diff.paymentCollectionMethod = saved.paymentCollectionMethod ?? null;
      return diff;
    },
    onSuccess: (diff) => {
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Trigger the propagation prompt only when at least one propagatable
      // field actually moved. Dialog auto-dismisses silently if the
      // customer has no other contracts.
      if (Object.keys(diff).length > 0) setPropagateChanges(diff);
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  // ALIS-parity function-key shortcuts. F2 = Summary, F5 = Renewal,
  // F6 = Financials, F8 = Delivery, F9 = Commissions matrix, F12 = History.
  // Ignore while the operator is typing in an editable element so keyboard
  // shortcuts never eat form input.
  useEffect(() => {
    if (!open) return;
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    };
    const map: Record<string, number> = {
      F2: 0,   // Summary («Γενικά»)
      F6: 1,   // Financials («Οικονομικά»)
      F5: 3,   // Renewal («Αίτηση ανανέωσης»)
      F8: 4,   // Delivery («Παράδοση»)
      F9: 14,  // Commissions matrix («Προμήθειες»)
      F12: 12, // History («Ιστορικό»)
    };
    const onKey = (e: KeyboardEvent) => {
      const target = map[e.key];
      if (target === undefined) return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      setTab(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const p = q.data;

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", md: 720 } } }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Sticky header */}
        <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>
              {t("policyDetail.header")}
            </Typography>
            <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
          {q.isLoading ? <CircularProgress size={20} /> : p ? (
            <>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "monospace" }}>{p.policyNumber}</Typography>
                <Chip size="small" color={STATUS_COLOR[p.status] ?? "default"} label={p.status} />
                <Chip size="small" variant="outlined" label={p.policyType} />
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {p.customerDisplay} · {p.insuranceCompanyName}
              </Typography>
              <Stack direction="row" spacing={3} mt={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("policyDetail.premium")}</Typography>
                  <Typography fontWeight={700}>{p.premium.toFixed(2)} {p.currency}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("policyDetail.received")}</Typography>
                  <Typography fontWeight={700} color="success.main">{p.totalReceived.toFixed(2)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("policyDetail.outstanding")}</Typography>
                  <Typography fontWeight={700} color={p.outstanding > 0 ? "error.main" : "text.primary"}>
                    {p.outstanding.toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("policyDetail.commissions")}</Typography>
                  <Typography fontWeight={700}>{p.totalCommissions.toFixed(2)}</Typography>
                </Box>
              </Stack>
              {p.documentCount === 0 && (
                <Alert severity="warning" sx={{ mt: 2, fontWeight: 700 }} action={
                  <Button color="inherit" size="small" onClick={() => setTab(8)}>
                    Ανέβασμα αρχείου
                  </Button>
                }>
                  Δεν υπάρχει συνημμένο αρχείο συμβολαίου. Ανεβάστε το PDF ή το σχετικό έγγραφο για να παραμείνει μαζί με την καρτέλα του.
                </Alert>
              )}
            </>
          ) : null}
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ px: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tab label={t("policyDetail.tab.summary")} />
          <Tab label={t("policyDetail.tab.financials")} />
          <Tab label={t("policyDetail.tab.parties")} />
          <Tab label={t("policyDetail.tab.renewal")} />
          <Tab label={t("policyDetail.tab.delivery")} />
          <Tab label={`${t("policyDetail.tab.endorsements")} (${p?.endorsementCount ?? 0})`} />
          <Tab label={`${t("policyDetail.tab.claims")} (${p?.claimCount ?? 0})`} />
          <Tab label={`${t("policyDetail.tab.receipts")} (${p?.receiptCount ?? 0})`} />
          <Tab label={`PDF Συμβολαίου (${p?.documentCount ?? 0})`} />
          <Tab label="Αντικείμενα" />
          <Tab label="Καλύψεις" />
          <Tab label="Δόσεις" />
          <Tab label="Ιστορικό" />
          <Tab label="Επικοινωνία" />
          <Tab label="Προμήθειες" />
        </Tabs>

        {/* Scrollable content */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
          {saved && <Alert severity="success" sx={{ mb: 2 }}>{t("common.savedOk")}</Alert>}

          {!p ? <CircularProgress /> : (
            <>
              {/* SUMMARY */}
              {tab === 0 && (
                <Stack spacing={2}>
                  <KV label={t("policyDetail.policyNumber")} value={p.policyNumber} mono />
                  <KV label={t("policyDetail.policyType")} value={p.policyType} />
                  <KV label={t("policyDetail.status")} value={<Chip size="small" color={STATUS_COLOR[p.status]} label={p.status} />} />
                  <KV label={t("policyDetail.startDate")} value={p.startDate} />
                  <KV label={t("policyDetail.endDate")} value={p.endDate} />
                  <Divider />
                  <KV label={t("policyDetail.createdAt")} value={new Date(p.createdAt).toLocaleString("el-GR")} />
                  {p.updatedAt && <KV label={t("policyDetail.updatedAt")} value={new Date(p.updatedAt).toLocaleString("el-GR")} />}
                  {p.createdByName && <KV label={t("policyDetail.createdBy")} value={p.createdByName} />}
                  {p.renewedFromPolicyNumber && (
                    <KV label={t("policyDetail.renewedFrom")} value={p.renewedFromPolicyNumber} mono />
                  )}

                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>
                    Πρόσθετα στοιχεία
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField fullWidth label="Αρ. αίτησης"
                      value={form.applicationNumber}
                      onChange={e => setForm({ ...form, applicationNumber: e.target.value })}
                      helperText="Ο αριθμός αίτησης που εκδίδει η εταιρεία πριν το οριστικό policy number." />
                    <TextField fullWidth type="date" label="Ημ. έκδοσης" InputLabelProps={{ shrink: true }}
                      value={form.issuedAt}
                      onChange={e => setForm({ ...form, issuedAt: e.target.value })}
                      helperText="Πότε εκδόθηκε το συμβόλαιο από την εταιρεία." />
                  </Stack>
                  <TextField fullWidth label="Αρ. κυκλοφορίας"
                    value={form.vehicleRegistrationPlate}
                    onChange={e => setForm({ ...form, vehicleRegistrationPlate: e.target.value.toUpperCase() })}
                    helperText="Πινακίδα οχήματος (μόνο για κλάδο αυτοκινήτου)." />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField fullWidth label="ΑΦΜ οδηγού"
                      value={form.driverVatNumber}
                      onChange={e => setForm({ ...form, driverVatNumber: e.target.value })}
                      helperText="Όταν ο οδηγός διαφέρει από τον ασφαλιζόμενο (π.χ. παιδί οδηγεί όχημα γονέα)." />
                    <TextField fullWidth label="Λόγος κυκλοφορίας"
                      value={form.reasonForCirculation}
                      onChange={e => setForm({ ...form, reasonForCirculation: e.target.value })}
                      placeholder="π.χ. Ιδιωτική, Επαγγελματική, Ταξί, Ασθενοφόρο"
                      helperText="Distinct από τη χρήση οχήματος (ΕΙΧ/ΦΔΧ) — αφορά τον σκοπό χρήσης." />
                  </Stack>
                  <SearchableSelect
                    label="Συμβαλλόμενος (αν διαφέρει από τον ασφαλιζόμενο)"
                    value={form.contractPartyCustomerId}
                    onChange={(v) => setForm({ ...form, contractPartyCustomerId: v })}
                    emptyLabel="— Ίδιος με τον ασφαλιζόμενο —"
                    options={(customersLookup.data ?? []).map(c => ({
                      value: c.id,
                      label: c.companyName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—",
                      hint: c.vatNumber ?? undefined
                    }))}
                    helperText="Το πρόσωπο που υπογράφει τη σύμβαση και έχει την υποχρέωση καταβολής." />
                  <SearchableSelect
                    label="Προηγούμενη ασφαλιστική εταιρεία"
                    value={form.previousInsuranceCompanyId}
                    onChange={(v) => setForm({ ...form, previousInsuranceCompanyId: v })}
                    emptyLabel="— Δεν αναφέρεται —"
                    options={(carriersLookup.data ?? []).map(c => ({
                      value: c.id, label: c.name, hint: c.code
                    }))}
                    helperText="Από πού μεταφέρθηκε το συμβόλαιο. Χρησιμοποιείται για churn / win-back analytics." />
                </Stack>
              )}

              {/* FINANCIALS */}
              {tab === 1 && (
                <Stack spacing={2.5}>
                  <KV label={t("policyDetail.premium")} value={`${p.premium.toFixed(2)} ${p.currency}`} />

                  {/* Tax / duty breakdown: rendered only when at least one
                      of the split-out numbers exists so cover-less legacy
                      policies stay compact. */}
                  {(p.netPremium !== null || p.vatAmount !== null || p.stampDutyAmount !== null
                    || p.insuranceContributionAmount !== null || p.otherChargesAmount !== null) && (
                    <TaxBreakdown p={p} />
                  )}

                  {/* Covers breakdown — shown only when the policy actually
                      has PolicyCover rows on file. Highlights any drift
                      between the stated premium and the sum of covers so the
                      operator can spot bad data before it feeds commission
                      calculations. */}
                  {p.covers && p.covers.length > 0 && <CoversBreakdown p={p} />}
                  <TextField select fullWidth label={t("policyDetail.paymentFrequency")} value={form.paymentFrequency}
                    onChange={e => setForm({ ...form, paymentFrequency: e.target.value })}>
                    {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth label="Τρόπος είσπραξης" value={form.paymentCollectionMethod}
                    onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })}>
                    <MenuItem value="">—</MenuItem>
                    {COLLECTION_METHODS.map(m => <MenuItem key={m} value={m}>{COLLECTION_METHODS_LABEL[m]}</MenuItem>)}
                  </TextField>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch checked={form.premiumIncludesVat} onChange={e => setForm({ ...form, premiumIncludesVat: e.target.checked })} />
                    <Typography>{t("policyDetail.premiumIncludesVat")}</Typography>
                  </Stack>
                  <TextField type="number" fullWidth label={t("policyDetail.specialCommission")}
                    value={form.specialCommissionPercent}
                    onChange={e => setForm({ ...form, specialCommissionPercent: e.target.value })}
                    helperText={t("policyDetail.specialCommissionHelp")} />
                  <Divider />
                  <KV label={t("policyDetail.totalReceived")} value={`${p.totalReceived.toFixed(2)} ${p.currency}`} />
                  <KV label={t("policyDetail.outstanding")} value={`${p.outstanding.toFixed(2)} ${p.currency}`} />
                  <KV label={t("policyDetail.totalCommissions")} value={`${p.totalCommissions.toFixed(2)} ${p.currency}`} />
                </Stack>
              )}

              {/* PARTIES */}
              {tab === 2 && (
                <Stack spacing={2}>
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>{t("policyDetail.customer")}</Typography>
                  <KV label={t("policyDetail.name")} value={p.customerDisplay} />
                  {p.customerVat && <KV label="ΑΦΜ" value={p.customerVat} mono />}
                  {p.customerEmail && <KV label="Email" value={<a href={`mailto:${p.customerEmail}`}>{p.customerEmail}</a>} />}
                  {p.customerPhone && <KV label={t("policyDetail.phone")} value={<a href={`tel:${p.customerPhone}`}>{p.customerPhone}</a>} />}
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>{t("policyDetail.insurer")}</Typography>
                  <KV label={t("policyDetail.name")} value={p.insuranceCompanyName} />
                  {p.insuranceCompanyCode && <KV label={t("policyDetail.code")} value={p.insuranceCompanyCode} mono />}
                  <Divider />
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="overline" color="text.secondary" fontWeight={700}>{t("policyDetail.producer")}</Typography>
                    <Button size="small" variant="text" onClick={() => setChangeProducerOpen(true)}>
                      Αλλαγή συνεργάτη
                    </Button>
                  </Stack>
                  <KV label={t("policyDetail.name")} value={p.producerName ?? "—"} />
                  {p.producerCode && <KV label={t("policyDetail.code")} value={p.producerCode} mono />}
                </Stack>
              )}

              {/* RENEWAL */}
              {tab === 3 && (
                <Stack spacing={2.5}>
                  <TextField type="date" fullWidth label={t("policyDetail.nextRenewal")} InputLabelProps={{ shrink: true }}
                    value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch checked={form.retainCommissionsOnRenewal} onChange={e => setForm({ ...form, retainCommissionsOnRenewal: e.target.checked })} />
                    <Typography>{t("policyDetail.retainCommissions")}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch checked={form.retainDocumentNumberOnRenewal} onChange={e => setForm({ ...form, retainDocumentNumberOnRenewal: e.target.checked })} />
                    <Typography>{t("policyDetail.retainDocNumber")}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch checked={form.retainSpecialCommissionsOnRenewal} onChange={e => setForm({ ...form, retainSpecialCommissionsOnRenewal: e.target.checked })} />
                    <Typography>{t("policyDetail.retainSpecialCommissions")}</Typography>
                  </Stack>
                  <TextField fullWidth multiline rows={3} label={t("policyDetail.renewalInstructions")}
                    value={form.renewalInstructions} onChange={e => setForm({ ...form, renewalInstructions: e.target.value })}
                    placeholder={t("policyDetail.renewalInstructionsPlaceholder")} />
                </Stack>
              )}

              {/* DELIVERY */}
              {tab === 4 && (
                <Stack spacing={2.5}>
                  <TextField type="date" fullWidth label={t("policyDetail.deliveredAt")} InputLabelProps={{ shrink: true }}
                    value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                  <TextField fullWidth label={t("policyDetail.deliveredTo")} value={form.deliveredTo}
                    onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                  <TextField select fullWidth label={t("policyDetail.deliveryMethod")} value={form.deliveryMethod}
                    onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}>
                    <MenuItem value="">—</MenuItem>
                    {DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{t(`deliveryMethod.${m}`, m)}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth label="Τρόπος πληρωμής" value={form.paymentCollectionMethod}
                    onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })}
                    helperText="Πώς εισπράττεται το ασφάλιστρο από τον πελάτη.">
                    <MenuItem value="">—</MenuItem>
                    {COLLECTION_METHODS.map(m => <MenuItem key={m} value={m}>{COLLECTION_METHODS_LABEL[m]}</MenuItem>)}
                  </TextField>
                </Stack>
              )}

              {/* RELATED LISTS */}
              {tab === 5 && (
                endorsements.isLoading ? <CircularProgress /> :
                <SimpleList rows={endorsements.data ?? []}
                  cols={[
                    { key: "endorsementNumber", label: t("policyDetail.endorsementNo") },
                    { key: "issuedAt", label: t("policyDetail.issuedAt") },
                    { key: "premiumDelta", label: "ΔΑσφάλιστρο", numeric: true },
                    { key: "description", label: t("common.description") }
                  ]}
                  emptyKey="policyDetail.noEndorsements" />
              )}
              {tab === 6 && (
                claims.isLoading ? <CircularProgress /> :
                <SimpleList rows={claims.data ?? []}
                  cols={[
                    { key: "claimNumber", label: t("policyDetail.claimNo") },
                    { key: "incidentDate", label: t("policyDetail.incidentDate") },
                    { key: "status", label: t("common.status"),
                      format: (v) => v ? String(t(`claimStatus.${v}`, v)) : "—" },
                    { key: "approvedAmount", label: t("policyDetail.amount"), numeric: true }
                  ]}
                  emptyKey="policyDetail.noClaims" />
              )}
              {tab === 7 && (
                receipts.isLoading ? <CircularProgress /> :
                <SimpleList rows={receipts.data ?? []}
                  cols={[
                    { key: "number", label: t("policyDetail.receiptNo") },
                    { key: "receivedOn", label: t("policyDetail.paidOn") },
                    { key: "method", label: t("policyDetail.method"),
                      format: (v) => v ? String(t(`paymentMethod.${v}`, v)) : "—" },
                    { key: "amount", label: t("policyDetail.amount"), numeric: true }
                  ]}
                  emptyKey="policyDetail.noReceipts" />
              )}
              {tab === 8 && <PolicyContractPdf policyId={p.id} />}
              {tab === 9 && <PolicyObjectsTab policyId={p.id} />}
              {tab === 10 && <PolicyCoversTab policyId={p.id} />}
              {tab === 11 && <PolicyInstallmentsTab policyId={p.id} />}
              {tab === 12 && <EntityAuditTimeline entityName="Policy" entityId={p.id} />}
              {tab === 13 && (
                <PolicyCommunicationsTab
                  policyId={p.id}
                  loading={communications.isLoading}
                  rows={communications.data ?? []}
                  onSaved={() => void qc.invalidateQueries({ queryKey: ["policy-communications", p.id] })}
                />
              )}
              {tab === 14 && (
                <PolicyCommissionMatrixTab
                  loading={commissionMatrix.isLoading}
                  matrix={commissionMatrix.data}
                  currency={p.currency}
                  overrideJson={form.specialLevelPercentsJson}
                  onOverrideChange={(next) => setForm({ ...form, specialLevelPercentsJson: next })}
                  onSave={() => save.mutate()}
                  saving={save.isPending}
                />
              )}
            </>
          )}
        </Box>

        {/* Sticky footer with save (Summary now editable via ALIS-parity fields). */}
        {(tab >= 0 && tab <= 4) && (
          <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={onClose}>{t("common.cancel")}</Button>
              <Button variant="contained" startIcon={<SaveIcon />} disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
      <PropagateChangesDialog
        open={!!propagateChanges}
        sourcePolicyId={policyId}
        changes={propagateChanges ?? {}}
        onClose={(result) => {
          setPropagateChanges(null);
          if (result && result.updatedCount > 0) {
            void qc.invalidateQueries({ queryKey: ["policies"] });
          }
        }}
      />

      {p && (
        <ChangeProducerDialog
          open={changeProducerOpen}
          onClose={() => setChangeProducerOpen(false)}
          policyId={p.id}
          policyNumber={p.policyNumber}
          currentProducerId={p.producerId}
          currentProducerName={p.producerName}
          onSaved={() => {
            setChangeProducerOpen(false);
            void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
            void qc.invalidateQueries({ queryKey: ["policies"] });
          }}
        />
      )}
    </Drawer>
  );
}

/**
 * "Αλλαγή συνεργάτη" popup — accessed from the Συνεργάτης section of the
 * policy detail. Meant for correcting a wrong producer link (typically
 * from a bridge auto-mapping). Optionally lets the operator propagate the
 * same change to every future renewal (not older ones — historical
 * production stays intact under the original συνεργάτης).
 */
function ChangeProducerDialog({ open, onClose, policyId, policyNumber, currentProducerId, currentProducerName, onSaved }: {
  open: boolean;
  onClose: () => void;
  policyId: string;
  policyNumber: string;
  currentProducerId: string | null;
  currentProducerName: string | null;
  onSaved: () => void;
}) {
  const [newProducerId, setNewProducerId] = useState<string>("");
  const [transferRenewals, setTransferRenewals] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const producersQ = useQuery({
    queryKey: ["producers-lite-for-change"],
    enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data
  });

  useEffect(() => {
    if (open) { setNewProducerId(""); setTransferRenewals(false); setErr(null); }
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      // Bulk-update endpoint with a single-policy array — same payload the
      // multi-select toolbar uses. Handles both the direct producer change
      // and the optional renewal-transfer flag in one server round trip.
      return (await api.post("/policies/bulk-update", {
        policyIds: [policyId],
        producerId: newProducerId,
        renewalTransferToProducerId: transferRenewals ? newProducerId : null,
        renewalTransferToCarrierId: null,
        status: null,
        paymentCollectionMethod: null,
      })).data;
    },
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  const options = (producersQ.data ?? [])
    .filter(p => p.id !== currentProducerId)
    .map(p => ({ value: p.id, label: p.name, hint: p.code }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Αλλαγή συνεργάτη — συμβόλαιο {policyNumber}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Τρέχων συνεργάτης: <strong>{currentProducerName ?? "— κανένας —"}</strong>.
          Επιλέξτε άλλον για να διορθώσετε λανθασμένη αντιστοίχιση (π.χ. από γέφυρα).
          Οι προηγούμενες προμήθειες παραμένουν άθικτες.
        </Alert>
        <Stack spacing={2} mt={0.5}>
          <SearchableSelect
            label="Νέος συνεργάτης"
            value={newProducerId}
            onChange={v => setNewProducerId(v as string)}
            options={options}
          />
          <FormControlLabel
            control={<Switch checked={transferRenewals} onChange={e => setTransferRenewals(e.target.checked)} />}
            label="Μεταφορά ανανεώσεων στον νέο συνεργάτη"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={!newProducerId || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Καθαρό / ΦΠΑ / Χαρτόσημο / Εισφορές / Λοιπά — the split-out numbers that
 * make up the gross premium. Only fields that are non-null render; a policy
 * that only tracks the top-line stays uncluttered.
 */
function TaxBreakdown({ p }: { p: PolicyDetail }) {
  const rows: { label: string; value: number | null }[] = [
    { label: "Καθαρό ασφάλιστρο", value: p.netPremium },
    { label: "ΦΠΑ",                value: p.vatAmount },
    { label: "Χαρτόσημο",          value: p.stampDutyAmount },
    { label: "Ασφαλιστική εισφορά", value: p.insuranceContributionAmount },
    { label: "Λοιπές επιβαρύνσεις", value: p.otherChargesAmount },
  ].filter(r => r.value !== null && r.value !== 0);
  if (rows.length === 0) return null;
  const breakdownSum = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const grossMatches = Math.abs(breakdownSum - p.premium) < 0.02;
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Ανάλυση</Typography>
        {!grossMatches && (
          <Chip size="small" color="warning" variant="outlined"
            label={`Διαφορά με μεικτό: ${(p.premium - breakdownSum).toFixed(2)} ${p.currency}`}
            sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
        )}
      </Stack>
      <Stack spacing={0.5}>
        {rows.map(r => (
          <Stack key={r.label} direction="row" justifyContent="space-between">
            <Typography sx={{ color: "text.secondary" }}>{r.label}</Typography>
            <Typography sx={{ fontFamily: "monospace" }}>{(r.value ?? 0).toFixed(2)} {p.currency}</Typography>
          </Stack>
        ))}
        <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.75, borderTop: "1px dashed", borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 700 }}>Άθροισμα ανάλυσης</Typography>
          <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{breakdownSum.toFixed(2)} {p.currency}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

/**
 * Coverage breakdown for the Financials tab. Shows every PolicyCover row
 * with its gross premium and (when set) its per-cover commission %, then a
 * totals row. When the stated policy premium doesn't match the sum of
 * covers, a red drift warning appears so the operator knows to reconcile
 * before commissions run.
 */
function CoversBreakdown({ p }: { p: PolicyDetail }) {
  const drift = Math.abs(p.premium - p.coversGrossTotal);
  const hasDrift = drift > 0.01;
  const anyProducerRate = p.covers.some(c => c.commissionPercent !== null);
  const anyAgencyRate   = p.covers.some(c => c.agencyCommissionPercent !== null);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>
          Καλύψεις ({p.covers.length})
        </Typography>
        {hasDrift && (
          <Chip size="small" color="error" variant="outlined"
            label={`Διαφορά με ασφάλιστρο: ${drift.toFixed(2)} ${p.currency}`}
            sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
        )}
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Κωδικός</TableCell>
            <TableCell>Όνομα</TableCell>
            <TableCell align="right">Μεικτό</TableCell>
            {anyProducerRate && <TableCell align="right">Προμ. συν. %</TableCell>}
            {anyAgencyRate   && <TableCell align="right">Προμ. γρ. %</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {p.covers.map(c => (
            <TableRow key={c.id}>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.coverCode}</TableCell>
              <TableCell>{c.coverName ?? "—"}</TableCell>
              <TableCell align="right">{c.grossPremium.toFixed(2)}</TableCell>
              {anyProducerRate && (
                <TableCell align="right" sx={{ color: c.commissionPercent === null ? "text.disabled" : undefined }}>
                  {c.commissionPercent === null ? "—" : `${c.commissionPercent.toFixed(2)}%`}
                </TableCell>
              )}
              {anyAgencyRate && (
                <TableCell align="right" sx={{ color: c.agencyCommissionPercent === null ? "text.disabled" : undefined }}>
                  {c.agencyCommissionPercent === null ? "—" : `${c.agencyCommissionPercent.toFixed(2)}%`}
                </TableCell>
              )}
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Σύνολο από καλύψεις</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>{p.coversGrossTotal.toFixed(2)} {p.currency}</TableCell>
            {anyProducerRate && <TableCell />}
            {anyAgencyRate   && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
      {(anyProducerRate || anyAgencyRate) && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          «—» στα ποσοστά σημαίνει ότι η κάλυψη κληρονομεί το ποσοστό από τον κανόνα προμηθειών.
        </Typography>
      )}
    </Box>
  );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
      <Typography sx={{ width: 200, color: "text.secondary", flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontFamily: mono ? "monospace" : undefined, fontWeight: 500, wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function SimpleList({ rows, cols, emptyKey }: {
  rows: any[];
  cols: {
    key: string; label: string; numeric?: boolean;
    /** Optional per-column formatter — use for enum values that need i18n. */
    format?: (value: any, row: any) => React.ReactNode;
  }[];
  emptyKey: string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>{t(emptyKey)}</Typography>;
  }
  return (
    <Table size="small">
      <TableHead><TableRow>
        {cols.map(c => <TableCell key={c.key} align={c.numeric ? "right" : "left"}>{c.label}</TableCell>)}
      </TableRow></TableHead>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={row.id ?? i} hover>
            {cols.map(c => {
              const raw = row[c.key];
              const rendered = c.format
                ? c.format(raw, row)
                : (c.numeric && typeof raw === "number" ? raw.toFixed(2) : (raw ?? "—"));
              return (
                <TableCell key={c.key} align={c.numeric ? "right" : "left"}
                  sx={{ fontFamily: c.key.toLowerCase().includes("number") || c.key.toLowerCase().includes("no") ? "monospace" : undefined }}>
                  {rendered}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ============================================================================
   Contract PDF — list, in-browser preview, print, upload (new/replace), delete.
   Backend already exposes:
     GET    /api/documents?policyId=...
     POST   /api/documents/upload   (multipart)
     GET    /api/documents/{id}/download
     DELETE /api/documents/{id}
   ============================================================================ */
interface PolicyDoc {
  id: string; policyId: string; documentType: string;
  fileName: string; mimeType: string; sizeBytes: number;
  createdAt: string;
}

function PolicyContractPdf({ policyId }: { policyId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  // Cleanup blob URLs when the component unmounts.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const docsQ = useQuery({
    queryKey: ["policy-documents", policyId],
    queryFn: async () => (await api.get<PolicyDoc[]>("/documents", { params: { policyId } })).data
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("policyId", policyId);
      // Backend DocumentType enum is Policy | GreenCard | Roadside |
      // Invoice | Other. «Contract» does NOT exist and the model binder
      // rejects the whole multipart with a generic 400 — which surfaced
      // as «Something went wrong» in the drawer. The policy contract PDF
      // is tagged as «Policy».
      fd.append("type", "Policy");
      fd.append("file", file);
      return (await api.post<PolicyDoc>("/documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      })).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-documents", policyId] });
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-documents", policyId] });
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewName(null); }
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  // Authenticated blob download — returns a fresh object URL the caller owns.
  async function fetchBlobUrl(docId: string): Promise<string> {
    const res = await api.get(`/documents/${docId}/download`, { responseType: "blob" });
    return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  }

  const preview = async (d: PolicyDoc) => {
    try {
      const url = await fetchBlobUrl(d.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url); setPreviewName(d.fileName); setErr(null);
    } catch (e) { setErr(extractErrorMessage(e)); }
  };

  const download = async (d: PolicyDoc) => {
    try {
      const url = await fetchBlobUrl(d.id);
      const a = document.createElement("a");
      a.href = url; a.download = d.fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErr(extractErrorMessage(e)); }
  };

  const print = async (d: PolicyDoc) => {
    try {
      const url = await fetchBlobUrl(d.id);
      // Use a hidden iframe instead of window.open so browsers can't
      // block the action as a popup. The iframe is injected into the
      // DOM, waits for the PDF to load, triggers the print dialog from
      // its contentWindow, then removes itself. Same UX as opening a new
      // tab and printing, no popup blocker involvement.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
        catch { /* user dismissed */ }
        // Give the print dialog time to detach from the iframe before we
        // remove it, else some browsers cancel the dialog mid-print.
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 5000);
      };
    } catch (e) { setErr(extractErrorMessage(e)); }
  };

  const onPick = (file?: File | null) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setErr("Το αρχείο είναι μεγαλύτερο από 50MB."); return; }
    upload.mutate(file);
  };

  const docs = docsQ.data ?? [];

  return (
    <Stack spacing={2}>
      {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}

      {/* Upload bar */}
      <Box sx={{
        p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2,
        display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap"
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} sx={{ fontSize: 14 }}>
            {docs.length > 0 ? "Αντικατάσταση ή προσθήκη νέου αρχείου" : "Προσθέστε το PDF του συμβολαίου"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Δεκτά: PDF και εικόνες · έως 50MB · αποθηκεύεται κρυπτογραφημένα.
          </Typography>
        </Box>
        <Button component="label" variant="contained" disabled={upload.isPending}>
          {upload.isPending ? <CircularProgress size={18} /> : "Επιλογή αρχείου"}
          <input hidden type="file" accept="application/pdf,image/*"
            onChange={(e) => onPick(e.target.files?.[0])} />
        </Button>
      </Box>

      {/* List of attached docs */}
      {docsQ.isLoading ? <CircularProgress /> : (
        <Stack spacing={1}>
          {docs.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Δεν υπάρχει συνημμένο PDF συμβολαίου ακόμα.
            </Typography>
          )}
          {docs.map(d => (
            <Box key={d.id} sx={{
              p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2,
              display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap"
            }}>
              <Box sx={{
                width: 36, height: 44, borderRadius: 0.75,
                bgcolor: "error.main", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 11, letterSpacing: "0.1em"
              }}>
                PDF
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} sx={{ fontSize: 14,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.documentType} · {(d.sizeBytes / 1024).toFixed(0)} KB ·
                  {d.createdAt ? ` ${new Date(d.createdAt).toLocaleDateString("el-GR")}` : ""}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Button size="small" onClick={() => preview(d)}>Προβολή</Button>
                <Button size="small" onClick={() => print(d)}>Εκτύπωση</Button>
                <Button size="small" onClick={() => download(d)}>Λήψη</Button>
                <Button size="small" color="error"
                  onClick={() => { if (confirm("Διαγραφή του αρχείου;")) del.mutate(d.id); }}>
                  Διαγραφή
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* In-browser PDF preview */}
      {previewUrl && (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between"
            sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", bgcolor: "grey.50" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {previewName}
            </Typography>
            <IconButton size="small"
              onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewName(null); }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box component="iframe" src={previewUrl} title="PDF preview"
            sx={{ width: "100%", height: 520, border: 0, display: "block" }} />
        </Box>
      )}
    </Stack>
  );
}

/* ============== EXTENSION TABS ============== */

function PolicyObjectsTab({ policyId }: { policyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["policy-objects", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/objects`)).data
  });
  const [form, setForm] = useState({ objectKind: "", identifier: "", description: "", characteristic: "", fbcLinkCode: "" });
  const add = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/objects`, form)).data,
    onSuccess: () => {
      setForm({ objectKind: "", identifier: "", description: "", characteristic: "", fbcLinkCode: "" });
      void qc.invalidateQueries({ queryKey: ["policy-objects", policyId] });
    }
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/policies/${policyId}/objects/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-objects", policyId] })
  });

  return (
    <Stack spacing={2}>
      <Typography variant="overline" color="text.secondary" fontWeight={700}>Αντικείμενα</Typography>
      {q.isLoading ? <CircularProgress size={20} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Είδος</TableCell>
              <TableCell>Αναγνωριστικό</TableCell>
              <TableCell>Περιγραφή</TableCell>
              <TableCell>FBC</TableCell>
              <TableCell width={42} />
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                Δεν υπάρχουν καταχωρημένα αντικείμενα.
              </TableCell></TableRow>
            )}
            {(q.data ?? []).map((o: any) => (
              <TableRow key={o.id} hover>
                <TableCell>{o.objectKind}</TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{o.identifier ?? "—"}</TableCell>
                <TableCell>{o.description ?? "—"}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{o.fbcLinkCode ?? "—"}</TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => { if (confirm("Διαγραφή;")) del.mutate(o.id); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">Νέο αντικείμενο</Typography>
        <Stack spacing={1.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" label="Είδος" value={form.objectKind}
              onChange={e => setForm({ ...form, objectKind: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Αναγνωριστικό" value={form.identifier}
              onChange={e => setForm({ ...form, identifier: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="FBC" value={form.fbcLinkCode}
              onChange={e => setForm({ ...form, fbcLinkCode: e.target.value })} sx={{ width: 120 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" label="Περιγραφή" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Χαρακτηριστικό" value={form.characteristic}
              onChange={e => setForm({ ...form, characteristic: e.target.value })} sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => add.mutate()} disabled={!form.objectKind.trim() || add.isPending}>
              {add.isPending ? <CircularProgress size={18} /> : "Προσθήκη"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}

function PolicyCoversTab({ policyId }: { policyId: string }) {
  return <PolicyCoversTabInner policyId={policyId} />;
}

interface CoverRow {
  id: string;
  policyObjectId: string | null;
  coverCode: string;
  coverName: string | null;
  grossPremium: number;
  netPremium: number;
  coverageAmount: number | null;
  commissionPercent: number | null;
  agencyCommissionPercent: number | null;
}

interface CoverFormState {
  coverCode: string;
  coverName: string;
  policyObjectId: string;
  grossPremium: string;
  netPremium: string;
  coverageAmount: string;
  commissionPercent: string;
  agencyCommissionPercent: string;
}

const EMPTY_COVER_FORM: CoverFormState = {
  coverCode: "", coverName: "", policyObjectId: "",
  grossPremium: "", netPremium: "", coverageAmount: "",
  commissionPercent: "", agencyCommissionPercent: ""
};

function toBody(f: CoverFormState) {
  return {
    coverCode: f.coverCode.trim().toUpperCase(),
    coverName: f.coverName.trim() || null,
    policyObjectId: f.policyObjectId || null,
    grossPremium: Number(f.grossPremium) || 0,
    netPremium: Number(f.netPremium) || 0,
    coverageAmount: f.coverageAmount ? Number(f.coverageAmount) : null,
    commissionPercent: f.commissionPercent === "" ? null : Number(f.commissionPercent),
    agencyCommissionPercent: f.agencyCommissionPercent === "" ? null : Number(f.agencyCommissionPercent),
  };
}

function PolicyCoversTabInner({ policyId }: { policyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["policy-covers", policyId],
    queryFn: async () => (await api.get<CoverRow[]>(`/policies/${policyId}/covers`)).data
  });
  const objects = useQuery({
    queryKey: ["policy-objects", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/objects`)).data
  });
  const [form, setForm] = useState<CoverFormState>(EMPTY_COVER_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId !== null;

  // Invalidate BOTH the covers list AND the policy detail. The drawer's
  // Financials tab renders a breakdown table + drift chip pulled from
  // detail, so we need both to refetch or the two views diverge.
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["policy-covers", policyId] });
    void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
  };

  const add = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/covers`, toBody(form))).data,
    onSuccess: () => { setForm(EMPTY_COVER_FORM); invalidate(); }
  });
  const update = useMutation({
    mutationFn: async () => (await api.put(`/policies/${policyId}/covers/${editingId}`, toBody(form))).data,
    onSuccess: () => { setEditingId(null); setForm(EMPTY_COVER_FORM); invalidate(); }
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/policies/${policyId}/covers/${id}`),
    onSuccess: invalidate
  });

  const startEdit = (c: CoverRow) => {
    setEditingId(c.id);
    setForm({
      coverCode: c.coverCode,
      coverName: c.coverName ?? "",
      policyObjectId: c.policyObjectId ?? "",
      grossPremium: String(c.grossPremium),
      netPremium: String(c.netPremium),
      coverageAmount: c.coverageAmount === null ? "" : String(c.coverageAmount),
      commissionPercent: c.commissionPercent === null ? "" : String(c.commissionPercent),
      agencyCommissionPercent: c.agencyCommissionPercent === null ? "" : String(c.agencyCommissionPercent),
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_COVER_FORM); };

  const rows = q.data ?? [];
  const totalGross = rows.reduce((s, c) => s + c.grossPremium, 0);
  const totalNet   = rows.reduce((s, c) => s + c.netPremium, 0);

  const [bulkOpen, setBulkOpen] = useState(false);
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Καλύψεις</Typography>
        <Chip size="small" label={`${rows.length}`} sx={{ height: 20, fontSize: 11 }} />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="text" onClick={() => setBulkOpen(true)}>
          Μαζική εισαγωγή CSV
        </Button>
      </Stack>
      <BulkCoversImportDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        policyId={policyId}
        onImported={() => { setBulkOpen(false); invalidate(); }}
      />
      {q.isLoading ? <CircularProgress size={20} /> : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Κωδικός</TableCell>
                <TableCell>Όνομα</TableCell>
                <TableCell align="right">Μικτά</TableCell>
                <TableCell align="right">Καθαρά</TableCell>
                <TableCell align="right">Κεφάλαιο</TableCell>
                <TableCell align="right">Προμ. συν. %</TableCell>
                <TableCell align="right">Προμ. γρ. %</TableCell>
                <TableCell width={80} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 3 }}>
                  Δεν υπάρχουν καταχωρημένες καλύψεις.
                </TableCell></TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id} hover selected={editingId === c.id}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.coverCode}</TableCell>
                  <TableCell>{c.coverName ?? "—"}</TableCell>
                  <TableCell align="right">{c.grossPremium.toFixed(2)}</TableCell>
                  <TableCell align="right">{c.netPremium.toFixed(2)}</TableCell>
                  <TableCell align="right">{c.coverageAmount === null ? "—" : c.coverageAmount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: c.commissionPercent === null ? "text.disabled" : undefined }}>
                    {c.commissionPercent === null ? "—" : `${c.commissionPercent.toFixed(2)}%`}
                  </TableCell>
                  <TableCell align="right" sx={{ color: c.agencyCommissionPercent === null ? "text.disabled" : undefined }}>
                    {c.agencyCommissionPercent === null ? "—" : `${c.agencyCommissionPercent.toFixed(2)}%`}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => startEdit(c)} disabled={editing && editingId !== c.id}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error"
                      onClick={() => { if (confirm(`Διαγραφή της κάλυψης ${c.coverCode};`)) del.mutate(c.id); }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow>
                  <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Σύνολο</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totalGross.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totalNet.toFixed(2)}</TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}
      <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {editing ? `Επεξεργασία κάλυψης · ${form.coverCode}` : "Νέα κάλυψη"}
        </Typography>
        <Stack spacing={1.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" label="Κωδικός" value={form.coverCode}
              onChange={e => setForm({ ...form, coverCode: e.target.value.toUpperCase() })}
              disabled={editing} sx={{ width: 140 }} />
            <TextField size="small" label="Όνομα" value={form.coverName}
              onChange={e => setForm({ ...form, coverName: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" select label="Αντικείμενο" value={form.policyObjectId}
              onChange={e => setForm({ ...form, policyObjectId: e.target.value })} sx={{ width: 200 }}>
              <MenuItem value="">—</MenuItem>
              {(objects.data ?? []).map((o: any) => <MenuItem key={o.id} value={o.id}>{o.objectKind}{o.identifier ? ` · ${o.identifier}` : ""}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" type="number" label="Μικτά" value={form.grossPremium}
              onChange={e => setForm({ ...form, grossPremium: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" type="number" label="Καθαρά" value={form.netPremium}
              onChange={e => setForm({ ...form, netPremium: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" type="number" label="Κεφάλαιο" value={form.coverageAmount}
              onChange={e => setForm({ ...form, coverageAmount: e.target.value })} sx={{ flex: 1 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
            <TextField size="small" type="number" label="Προμ. συνεργάτη %"
              value={form.commissionPercent}
              onChange={e => setForm({ ...form, commissionPercent: e.target.value })}
              helperText="Κενό = από κανόνα"
              sx={{ flex: 1 }} />
            <TextField size="small" type="number" label="Προμ. γραφείου %"
              value={form.agencyCommissionPercent}
              onChange={e => setForm({ ...form, agencyCommissionPercent: e.target.value })}
              helperText="Κενό = από κανόνα"
              sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1}>
              {editing && (
                <Button variant="text" onClick={cancelEdit}>Άκυρο</Button>
              )}
              <Button variant="contained"
                onClick={() => (editing ? update.mutate() : add.mutate())}
                disabled={!form.coverCode.trim() || add.isPending || update.isPending}>
                {(add.isPending || update.isPending) ? <CircularProgress size={18} /> : (editing ? "Αποθήκευση" : "Προσθήκη")}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Το ασφάλιστρο του συμβολαίου συγχρονίζεται αυτόματα με το σύνολο των Μικτών των καλύψεων.
        Ποσοστά που αφήνετε κενά κληρονομούνται από τον κανόνα προμηθειών.
      </Typography>
    </Stack>
  );
}

/**
 * CSV-paste bulk import for policy covers. Accepts the shape:
 *   coverCode,coverName,grossPremium,netPremium,coverageAmount,commissionPercent,agencyCommissionPercent
 * one row per line. Empty fields → null. First line optionally a header.
 * "Αντικατάσταση υπαρχόντων" checkbox flips the ReplaceExisting server flag
 * so existing covers with the same code get UPDATED instead of duplicated.
 */
function BulkCoversImportDialog({
  open, onClose, policyId, onImported
}: {
  open: boolean; onClose: () => void; policyId: string; onImported: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updatedExisting: number; skipped: number } | null>(null);

  const parsed = useMemo(() => {
    const lines = csv.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const rows: any[] = [];
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 3) continue;
      // Skip a header line if the first cell isn't a code-like token.
      if (rows.length === 0 && /coverCode|Κωδικός/i.test(parts[0])) continue;
      const num = (s: string): number | null => {
        if (!s) return null;
        const n = Number(s.replace(",", "."));
        return isNaN(n) ? null : n;
      };
      rows.push({
        coverCode: parts[0],
        coverName: parts[1] || null,
        grossPremium: num(parts[2]) ?? 0,
        netPremium: num(parts[3] ?? "") ?? 0,
        coverageAmount: num(parts[4] ?? ""),
        commissionPercent: num(parts[5] ?? ""),
        agencyCommissionPercent: num(parts[6] ?? ""),
      });
    }
    return rows;
  }, [csv]);

  const importMut = useMutation({
    mutationFn: async () => (await api.post<{ created: number; updatedExisting: number; skipped: number }>(
      `/policies/${policyId}/covers/bulk-import`,
      { rows: parsed, replaceExisting })).data,
    onSuccess: (r) => setResult(r),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Μαζική εισαγωγή καλύψεων</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Ολοκληρώθηκε: {result.created} νέες, {result.updatedExisting} ενημερώθηκαν,
            {" "}{result.skipped} παραλείφθηκαν.
          </Alert>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Μία κάλυψη ανά γραμμή, τιμές χωρισμένες με κόμμα:
          <br />
          <code>κωδικός,όνομα,μεικτά,καθαρά,κεφάλαιο,%συν.,%γρ.</code>
          <br />
          Παράδειγμα: <code>MTPL,Αστική ευθύνη,240.50,220.00,,15,0</code>
        </Typography>
        <TextField
          fullWidth multiline minRows={8}
          placeholder="MTPL,Αστική ευθύνη,240.50,220.00,,15,0"
          value={csv} onChange={(e) => setCsv(e.target.value)}
          sx={{ fontFamily: "monospace" }}
        />
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
            <Typography variant="body2">Αντικατάσταση υπαρχόντων με ίδιο κωδικό</Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Chip label={`${parsed.length} γραμμές έτοιμες`} size="small"
            color={parsed.length > 0 ? "primary" : "default"} sx={{ fontWeight: 700 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setCsv(""); setResult(null); onClose(); }}>Κλείσιμο</Button>
        <Button variant="contained"
          disabled={parsed.length === 0 || importMut.isPending}
          onClick={() => { setErr(null); setResult(null); importMut.mutate(); }}>
          {importMut.isPending ? <CircularProgress size={18} /> : `Εισαγωγή (${parsed.length})`}
        </Button>
        {result && (
          <Button variant="text" onClick={() => { onImported(); }}>Ανανέωση καλύψεων</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function PolicyInstallmentsTab({ policyId }: { policyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["policy-installments", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/installments`)).data
  });
  const generate = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/installments/generate`)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-installments", policyId] })
  });
  const markPaid = useMutation({
    mutationFn: async (id: string) => (await api.post(`/policies/${policyId}/installments/${id}/mark-paid`, {
      paidVia: "Cash", receiptReference: null
    })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-installments", policyId] })
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Δόσεις</Typography>
        <Button size="small" variant="outlined" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <CircularProgress size={16} /> : "Δημιουργία δόσεων"}
        </Button>
      </Stack>
      {q.isLoading ? <CircularProgress size={20} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Λήξη</TableCell>
              <TableCell align="right">Ποσό</TableCell>
              <TableCell>Πληρώθηκε</TableCell>
              <TableCell>Τρόπος</TableCell>
              <TableCell width={120} />
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                Δεν υπάρχουν δόσεις. Πατήστε «Δημιουργία δόσεων» για να δημιουργηθεί πλάνο.
              </TableCell></TableRow>
            )}
            {(q.data ?? []).map((i: any) => (
              <TableRow key={i.id} hover>
                <TableCell>{i.ordinal}</TableCell>
                <TableCell>{i.dueDate}</TableCell>
                <TableCell align="right">{i.amount.toFixed(2)} {i.currency}</TableCell>
                <TableCell>{i.paidAt ?? "—"}</TableCell>
                <TableCell>{i.paidVia ?? "—"}</TableCell>
                <TableCell>
                  {!i.paidAt && (
                    <Button size="small" onClick={() => markPaid.mutate(i.id)} disabled={markPaid.isPending}>
                      Πληρώθηκε
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}

/* ============================================================================
   Per-policy communication log — ALIS parity item #12. Each entry captures
   a phone / email / meeting / SMS / note tied to this policy so brokers can
   track «γιατί άλλαξε αυτό το συμβόλαιο» without digging through the
   customer-level timeline.
   ============================================================================ */

interface PolicyCommunicationRow {
  id: string;
  customerId: string;
  kind: string;              // Note / Phone / Email / Meeting / Sms / WalkIn
  direction: string;         // Internal / Inbound / Outbound
  outcome: string;           // None / Resolved / FollowUpRequired / NoAnswer / Cancelled
  occurredAt: string;
  durationSeconds: number | null;
  subject: string;
  body: string | null;
  relatedPolicyNumber: string | null;
  relatedPolicyId: string | null;
}

const COMM_KIND_LABEL: Record<string, string> = {
  Note: "Σημείωση", Phone: "Τηλέφωνο", Email: "Email",
  Meeting: "Συνάντηση", Sms: "SMS", WalkIn: "Επίσκεψη"
};
const COMM_DIRECTION_LABEL: Record<string, string> = {
  Internal: "Εσωτερικά", Inbound: "Εισερχόμενο", Outbound: "Εξερχόμενο"
};
const COMM_OUTCOME_LABEL: Record<string, string> = {
  None: "—", Resolved: "Ολοκληρώθηκε", FollowUpRequired: "Χρειάζεται επανάληψη",
  NoAnswer: "Χωρίς απάντηση", Cancelled: "Ακυρώθηκε"
};

function PolicyCommunicationsTab({ policyId, loading, rows, onSaved }: {
  policyId: string;
  loading: boolean;
  rows: PolicyCommunicationRow[];
  onSaved: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "Note",
    direction: "Internal",
    outcome: "None",
    subject: "",
    body: ""
  });
  const save = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/communications`, {
      kind: form.kind,
      direction: form.direction,
      outcome: form.outcome,
      subject: form.subject.trim(),
      body: form.body.trim() || null,
      occurredAt: new Date().toISOString(),
      durationSeconds: null,
      relatedPolicyId: null // server forces this to the policy id anyway
    })).data,
    onSuccess: () => {
      setCreating(false);
      setForm({ kind: "Note", direction: "Internal", outcome: "None", subject: "", body: "" });
      onSaved();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Καταγραφές επικοινωνίας για αυτό το συμβόλαιο. Οι εγγραφές εμφανίζονται και στο ενοποιημένο timeline του πελάτη.
        </Typography>
        <Button size="small" variant="contained" onClick={() => setCreating(true)} disabled={creating}>
          Νέα καταγραφή
        </Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}

      {creating && (
        <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField select size="small" fullWidth label="Είδος"
                value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(COMM_KIND_LABEL).map(([k, v]) =>
                  <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField select size="small" fullWidth label="Κατεύθυνση"
                value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
                {Object.entries(COMM_DIRECTION_LABEL).map(([k, v]) =>
                  <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField select size="small" fullWidth label="Αποτέλεσμα"
                value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })}>
                {Object.entries(COMM_OUTCOME_LABEL).map(([k, v]) =>
                  <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField size="small" fullWidth required label="Θέμα"
              value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="π.χ. «Ενημέρωση για λήξη — κ. Παπαδοπούλου»" />
            <TextField size="small" fullWidth multiline rows={3} label="Λεπτομέρειες"
              value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setCreating(false)}>Ακύρωση</Button>
              <Button variant="contained" onClick={() => save.mutate()}
                disabled={save.isPending || !form.subject.trim()}>
                {save.isPending ? <CircularProgress size={18} /> : "Καταχώρηση"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          Δεν υπάρχει καμία καταγραφή επικοινωνίας για αυτό το συμβόλαιο ακόμα.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {rows.map(r => (
            <Box key={r.id} sx={{ p: 1.75, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Chip size="small" label={COMM_KIND_LABEL[r.kind] ?? r.kind} />
                <Chip size="small" variant="outlined" label={COMM_DIRECTION_LABEL[r.direction] ?? r.direction} />
                {r.outcome !== "None" && (
                  <Chip size="small" variant="outlined" color="info"
                    label={COMM_OUTCOME_LABEL[r.outcome] ?? r.outcome} />
                )}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(r.occurredAt).toLocaleString("el-GR")}
                </Typography>
              </Stack>
              <Typography fontWeight={700}>{r.subject}</Typography>
              {r.body && (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                  {r.body}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/* ============================================================================
   ALIS-parity commissions matrix — the F9 «Προμήθειες» view. Backend
   materialises one PolicyCommissionSplit row per hierarchy level for which
   the matched CommissionRule defines a percent; this tab renders them as
   a table with %, €, tax withholding, and net columns plus a totals row.
   Read-only in v1 — per-level overrides ship in a follow-up.
   ============================================================================ */

interface PolicyCommissionSplitRow {
  id: string;
  hierarchyLevel: string;      // Producer / Manager / Unit / Assistant / Agency
  hierarchyLevelLabel: string; // Greek label from the backend
  producerId: string | null;
  producerName: string | null;
  percent: number;
  grossAmount: number;
  taxWithholdingAmount: number;
  netAmount: number;
  currency: string;
}

interface PolicyCommissionMatrix {
  rows: PolicyCommissionSplitRow[];
  totalGross: number;
  totalTaxWithholding: number;
  totalNet: number;
  currency: string;
}

function PolicyCommissionMatrixTab({ loading, matrix, currency, overrideJson, onOverrideChange, onSave, saving }: {
  loading: boolean;
  matrix: PolicyCommissionMatrix | undefined;
  currency: string;
  overrideJson: string;
  onOverrideChange: (nextJson: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>;
  }
  if (!matrix || matrix.rows.length === 0) {
    return (
      <Stack spacing={2}>
        <Alert severity="info">
          Δεν έχει οριστεί ιεραρχική κατανομή προμηθειών για αυτό το συμβόλαιο.
          Ρυθμίστε ποσοστά ανά επίπεδο στην «Παραμετροποίηση Προμηθειών» ή αντιστοιχίστε
          τον συνεργάτη σε ιεραρχία (Παραγωγός → Manager → Unit → Assistant → Γραφείο).
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Ο πίνακας δείχνει, για κάθε επίπεδο ιεραρχίας που πληρώνεται σε αυτό το συμβόλαιο,
          το ποσοστό, το μεικτό ποσό, την παρακράτηση φόρου και την καθαρή προμήθεια — όπως στην
          οθόνη F9 της ALIS.
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Ιεραρχική κατανομή προμηθειών όπως προκύπτει από την παραμετροποίηση του γραφείου
        και το ασφάλιστρο του συμβολαίου. Η παρακράτηση φόρου εφαρμόζεται σε όλα τα επίπεδα
        εκτός του Γραφείου.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Επίπεδο</TableCell>
            <TableCell>Συνεργάτης</TableCell>
            <TableCell align="right">%</TableCell>
            <TableCell align="right">Μεικτό</TableCell>
            <TableCell align="right">Παρακρ. φόρου</TableCell>
            <TableCell align="right">Καθαρή προμήθεια</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matrix.rows.map(r => (
            <TableRow key={r.id} hover>
              <TableCell>
                <Chip size="small" label={r.hierarchyLevelLabel}
                  color={r.hierarchyLevel === "Agency" ? "primary" : "default"}
                  variant={r.hierarchyLevel === "Agency" ? "filled" : "outlined"} />
              </TableCell>
              <TableCell>{r.producerName ?? <Typography color="text.secondary" component="span" fontStyle="italic">—</Typography>}</TableCell>
              <TableCell align="right"><Typography fontWeight={700}>{r.percent.toFixed(2)}%</Typography></TableCell>
              <TableCell align="right">{r.grossAmount.toFixed(2)} {r.currency}</TableCell>
              <TableCell align="right" sx={{ color: r.taxWithholdingAmount > 0 ? "warning.main" : "text.secondary" }}>
                {r.taxWithholdingAmount > 0 ? `−${r.taxWithholdingAmount.toFixed(2)}` : "—"}
              </TableCell>
              <TableCell align="right">
                <Typography fontWeight={800} color="success.main">
                  {r.netAmount.toFixed(2)} {r.currency}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell colSpan={3}><Typography fontWeight={800}>Σύνολο</Typography></TableCell>
            <TableCell align="right"><Typography fontWeight={800}>{matrix.totalGross.toFixed(2)} {matrix.currency || currency}</Typography></TableCell>
            <TableCell align="right"><Typography fontWeight={800} color="warning.main">−{matrix.totalTaxWithholding.toFixed(2)}</Typography></TableCell>
            <TableCell align="right"><Typography fontWeight={800} color="success.main">{matrix.totalNet.toFixed(2)} {matrix.currency || currency}</Typography></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <PolicyCommissionOverrideEditor
        overrideJson={overrideJson}
        onChange={onOverrideChange}
        onSave={onSave}
        saving={saving}
      />
    </Stack>
  );
}

/* Per-policy commission override — 5 editable percent inputs that get
   serialised into SpecialLevelPercentsJson and beat the rule at compute
   time. Only affects THIS specific policy. Empty inputs mean "don't
   override that level" — the rule takes over. Clear button wipes the
   whole blob. */
function PolicyCommissionOverrideEditor({ overrideJson, onChange, onSave, saving }: {
  overrideJson: string;
  onChange: (nextJson: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const parsed = useMemo(() => {
    if (!overrideJson.trim()) return {} as Record<string, number>;
    try { return JSON.parse(overrideJson) as Record<string, number>; } catch { return {}; }
  }, [overrideJson]);
  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    Producer:  parsed.Producer  != null ? String(parsed.Producer)  : "",
    Manager:   parsed.Manager   != null ? String(parsed.Manager)   : "",
    Unit:      parsed.Unit      != null ? String(parsed.Unit)      : "",
    Assistant: parsed.Assistant != null ? String(parsed.Assistant) : "",
    Agency:    parsed.Agency    != null ? String(parsed.Agency)    : "",
  }));
  useEffect(() => {
    if (!editing) return;
    setDraft({
      Producer:  parsed.Producer  != null ? String(parsed.Producer)  : "",
      Manager:   parsed.Manager   != null ? String(parsed.Manager)   : "",
      Unit:      parsed.Unit      != null ? String(parsed.Unit)      : "",
      Assistant: parsed.Assistant != null ? String(parsed.Assistant) : "",
      Agency:    parsed.Agency    != null ? String(parsed.Agency)    : "",
    });
  }, [editing, parsed]);

  const commit = () => {
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(draft)) {
      const n = Number(v);
      if (v.trim() !== "" && Number.isFinite(n) && n > 0) map[k] = n;
    }
    onChange(Object.keys(map).length > 0 ? JSON.stringify(map) : "");
    onSave();
    setEditing(false);
  };
  const clearOverride = () => {
    onChange("");
    onSave();
    setEditing(false);
  };

  const hasOverride = Object.keys(parsed).length > 0;
  return (
    <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: hasOverride ? "rgba(31,123,179,0.05)" : undefined }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Box>
          <Typography fontWeight={700}>Ειδικά ποσοστά για αυτό το συμβόλαιο</Typography>
          <Typography variant="body2" color="text.secondary">
            {hasOverride
              ? "Ενεργό — τα ποσοστά κάτω αντικαθιστούν τους κανόνες του γραφείου για το συγκεκριμένο συμβόλαιο."
              : "Προαιρετικό — ορίστε ποσοστά μόνο για συμβόλαια με ειδική συμφωνία. Αλλιώς εφαρμόζονται οι κανόνες του γραφείου."}
          </Typography>
        </Box>
        {!editing ? (
          <Button size="small" variant={hasOverride ? "outlined" : "contained"} onClick={() => setEditing(true)}>
            {hasOverride ? "Επεξεργασία" : "Προσθήκη"}
          </Button>
        ) : (
          <Button size="small" onClick={() => setEditing(false)}>Άκυρο</Button>
        )}
      </Stack>

      {editing && (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={1.5} flexWrap="wrap" useFlexGap>
            {(["Producer", "Manager", "Unit", "Assistant", "Agency"] as const).map(level => (
              <TextField key={level}
                size="small" type="number" label={`${LEVEL_LABEL[level]} %`}
                value={draft[level]}
                onChange={e => setDraft({ ...draft, [level]: e.target.value })}
                inputProps={{ step: 0.1, min: 0, max: 100 }}
                sx={{ minWidth: 130, flex: 1 }} />
            ))}
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            {hasOverride && (
              <Button color="error" onClick={clearOverride} disabled={saving}>Κατάργηση</Button>
            )}
            <Button variant="contained" onClick={commit} disabled={saving}>
              {saving ? <CircularProgress size={18} /> : "Αποθήκευση"}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}

const LEVEL_LABEL: Record<string, string> = {
  Producer: "Παραγωγός",
  Manager: "Manager",
  Unit: "Unit",
  Assistant: "Assistant",
  Agency: "Γραφείο"
};
