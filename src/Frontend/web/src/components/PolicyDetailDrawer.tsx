import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, MenuItem,
  Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { EntityAuditTimeline } from "./EntityAuditTimeline";

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
    paymentCollectionMethod: ""
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
        paymentCollectionMethod: q.data.paymentCollectionMethod ?? ""
      });
    }
  }, [q.data]);

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

  const save = useMutation({
    mutationFn: async () => (await api.put<PolicyDetail>(`/policies/${policyId}/extended`, {
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
      paymentCollectionMethod: form.paymentCollectionMethod || null
    })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

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
                </Stack>
              )}

              {/* FINANCIALS */}
              {tab === 1 && (
                <Stack spacing={2.5}>
                  <KV label={t("policyDetail.premium")} value={`${p.premium.toFixed(2)} ${p.currency}`} />
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
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>{t("policyDetail.producer")}</Typography>
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
                    {DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
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
                    { key: "status", label: t("common.status") },
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
                    { key: "method", label: t("policyDetail.method") },
                    { key: "amount", label: t("policyDetail.amount"), numeric: true }
                  ]}
                  emptyKey="policyDetail.noReceipts" />
              )}
              {tab === 8 && <PolicyContractPdf policyId={p.id} />}
              {tab === 9 && <PolicyObjectsTab policyId={p.id} />}
              {tab === 10 && <PolicyCoversTab policyId={p.id} />}
              {tab === 11 && <PolicyInstallmentsTab policyId={p.id} />}
              {tab === 12 && <EntityAuditTimeline entityName="Policy" entityId={p.id} />}
            </>
          )}
        </Box>

        {/* Sticky footer with save (only on editable tabs) */}
        {(tab >= 1 && tab <= 4) && (
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
    </Drawer>
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
  cols: { key: string; label: string; numeric?: boolean }[];
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
            {cols.map(c => (
              <TableCell key={c.key} align={c.numeric ? "right" : "left"}
                sx={{ fontFamily: c.key.toLowerCase().includes("number") || c.key.toLowerCase().includes("no") ? "monospace" : undefined }}>
                {c.numeric && typeof row[c.key] === "number" ? row[c.key].toFixed(2) : (row[c.key] ?? "—")}
              </TableCell>
            ))}
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
      const w = window.open(url, "_blank");
      if (!w) { setErr("Ο φυλλομετρητής μπλόκαρε το άνοιγμα — επιτρέψτε pop-ups."); return; }
      w.addEventListener("load", () => { try { w.print(); } catch { /* user dismissed */ } });
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
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["policy-covers", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/covers`)).data
  });
  const objects = useQuery({
    queryKey: ["policy-objects", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/objects`)).data
  });
  const [form, setForm] = useState({ coverCode: "", coverName: "", policyObjectId: "", grossPremium: "", netPremium: "", coverageAmount: "" });
  const add = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/covers`, {
      coverCode: form.coverCode, coverName: form.coverName || null,
      policyObjectId: form.policyObjectId || null,
      grossPremium: Number(form.grossPremium) || 0,
      netPremium: Number(form.netPremium) || 0,
      coverageAmount: form.coverageAmount ? Number(form.coverageAmount) : null
    })).data,
    onSuccess: () => {
      setForm({ coverCode: "", coverName: "", policyObjectId: "", grossPremium: "", netPremium: "", coverageAmount: "" });
      void qc.invalidateQueries({ queryKey: ["policy-covers", policyId] });
    }
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/policies/${policyId}/covers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-covers", policyId] })
  });

  return (
    <Stack spacing={2}>
      <Typography variant="overline" color="text.secondary" fontWeight={700}>Καλύψεις</Typography>
      {q.isLoading ? <CircularProgress size={20} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Κωδικός</TableCell>
              <TableCell>Όνομα</TableCell>
              <TableCell align="right">Μικτά</TableCell>
              <TableCell align="right">Καθαρά</TableCell>
              <TableCell align="right">Κεφάλαιο</TableCell>
              <TableCell width={42} />
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                Δεν υπάρχουν καταχωρημένες καλύψεις.
              </TableCell></TableRow>
            )}
            {(q.data ?? []).map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.coverCode}</TableCell>
                <TableCell>{c.coverName ?? "—"}</TableCell>
                <TableCell align="right">{c.grossPremium.toFixed(2)}</TableCell>
                <TableCell align="right">{c.netPremium.toFixed(2)}</TableCell>
                <TableCell align="right">{c.coverageAmount ? c.coverageAmount.toFixed(2) : "—"}</TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => { if (confirm("Διαγραφή;")) del.mutate(c.id); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">Νέα κάλυψη</Typography>
        <Stack spacing={1.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" label="Κωδικός" value={form.coverCode}
              onChange={e => setForm({ ...form, coverCode: e.target.value.toUpperCase() })} sx={{ width: 140 }} />
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
            <Button variant="contained" onClick={() => add.mutate()} disabled={!form.coverCode.trim() || add.isPending}>
              {add.isPending ? <CircularProgress size={18} /> : "Προσθήκη"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
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
