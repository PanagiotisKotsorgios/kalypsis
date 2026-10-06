import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface GreenCard {
  id: string; policyId: string; policyNumber: string; customerId: string; customerName: string;
  cardNumber: string; status: string; validFrom: string; validTo: string;
  holderName: string; insuredName: string; vehicleRegistrationPlate: string;
  vehicleMakeModel: string | null; vehicleVin: string | null; territories: string | null;
  issuingOffice: string | null; deliveryMethod: string | null; notes: string | null;
  issuedAt: string | null; deliveredAt: string | null; policyDocumentId: string | null;
}

interface PolicyLite {
  id: string; policyNumber: string; customerDisplay: string; startDate: string; endDate: string;
  vehicleRegistrationPlate: string | null;
}

interface GreenCardForm {
  policyId: string; cardNumber: string; status: string; validFrom: string; validTo: string;
  holderName: string; insuredName: string; vehicleRegistrationPlate: string;
  vehicleMakeModel: string; vehicleVin: string; territories: string; issuingOffice: string;
  deliveryMethod: string; notes: string;
}

type CardTarget = Pick<GreenCard, "id" | "policyId"> & { deliveryMethod?: string | null };

const EMPTY_FORM: GreenCardForm = {
  policyId: "", cardNumber: "", status: "Draft", validFrom: "", validTo: "", holderName: "", insuredName: "",
  vehicleRegistrationPlate: "", vehicleMakeModel: "", vehicleVin: "", territories: "GR, AL, BG, IT",
  issuingOffice: "", deliveryMethod: "", notes: ""
};

const STATUS_LABELS: Record<string, string> = {
  Draft: "\u03a0\u03c1\u03cc\u03c7\u03b5\u03b9\u03c1\u03b7", Issued: "\u0395\u03ba\u03b4\u03cc\u03b8\u03b7\u03ba\u03b5",
  Delivered: "\u03a0\u03b1\u03c1\u03b1\u03b4\u03cc\u03b8\u03b7\u03ba\u03b5", Expired: "\u0388\u03bb\u03b7\u03be\u03b5", Cancelled: "\u0391\u03ba\u03c5\u03c1\u03ce\u03b8\u03b7\u03ba\u03b5"
};

function statusColor(status: string): "default" | "success" | "warning" | "error" | "info" {
  if (status === "Delivered") return "success";
  if (status === "Cancelled") return "error";
  if (status === "Expired") return "warning";
  if (status === "Issued") return "info";
  return "default";
}

const dateOnly = (value?: string | null) => value ? value.slice(0, 10) : "";

function toBody(form: GreenCardForm) {
  return {
    cardNumber: form.cardNumber.trim() || null, status: form.status, validFrom: form.validFrom, validTo: form.validTo,
    holderName: form.holderName.trim() || null, insuredName: form.insuredName.trim() || null,
    vehicleRegistrationPlate: form.vehicleRegistrationPlate.trim() || null,
    vehicleMakeModel: form.vehicleMakeModel.trim() || null, vehicleVin: form.vehicleVin.trim() || null,
    territories: form.territories.trim() || null, issuingOffice: form.issuingOffice.trim() || null,
    deliveryMethod: form.deliveryMethod.trim() || null, notes: form.notes.trim() || null
  };
}

export function GreenCardsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState<GreenCardForm>(EMPTY_FORM);

  const cardsQuery = useQuery({
    queryKey: ["green-cards", search, status, from, to],
    queryFn: async () => (await api.get<GreenCard[]>("/green-cards", {
      params: { search: search || undefined, status: status || undefined, validFrom: from || undefined, validTo: to || undefined }
    })).data
  });
  const policiesQuery = useQuery({
    queryKey: ["green-card-auto-policies"],
    queryFn: async () => (await api.get<PolicyLite[]>("/policies", { params: { type: "Auto" } })).data
  });

  const cards = cardsQuery.data ?? [];
  const policies = policiesQuery.data ?? [];
  const visible = useMemo(() => cards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [cards, page, rowsPerPage]);
  const selectedPolicy = (id: string) => policies.find(policy => policy.id === id);
  const setField = <K extends keyof GreenCardForm>(key: K, value: GreenCardForm[K]) => setForm(current => ({ ...current, [key]: value }));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["green-cards"] });
    if (form.policyId) {
      void queryClient.invalidateQueries({ queryKey: ["policy-green-cards", form.policyId] });
      void queryClient.invalidateQueries({ queryKey: ["policy-documents", form.policyId] });
    }
  };
  const saveMutation = useMutation({
    mutationFn: async () => editingId
      ? (await api.put<GreenCard>(`/policies/${form.policyId}/green-cards/${editingId}`, toBody(form))).data
      : (await api.post<GreenCard>(`/policies/${form.policyId}/green-cards`, toBody(form))).data,
    onSuccess: () => { invalidate(); setDialogOpen(false); }, onError: exception => setError(extractErrorMessage(exception))
  });
  const issueMutation = useMutation({
    mutationFn: async (target: CardTarget) => (await api.post<GreenCard>(`/policies/${target.policyId}/green-cards/${target.id}/issue`)).data,
    onSuccess: () => { invalidate(); setDialogOpen(false); }, onError: exception => setError(extractErrorMessage(exception))
  });
  const deliverMutation = useMutation({
    mutationFn: async (target: CardTarget) => (await api.post<GreenCard>(`/policies/${target.policyId}/green-cards/${target.id}/deliver`, { deliveryMethod: target.deliveryMethod || "Email" })).data,
    onSuccess: () => invalidate(), onError: exception => setError(extractErrorMessage(exception))
  });
  const cancelMutation = useMutation({
    mutationFn: async (target: CardTarget) => api.delete(`/policies/${target.policyId}/green-cards/${target.id}`),
    onSuccess: () => invalidate(), onError: exception => setError(extractErrorMessage(exception))
  });
  const isBusy = saveMutation.isPending || issueMutation.isPending;

  const openCreate = () => {
    const policy = policies[0];
    setEditingId(null); setViewOnly(false); setError(null);
    setForm({ ...EMPTY_FORM, policyId: policy?.id ?? "", validFrom: dateOnly(policy?.startDate), validTo: dateOnly(policy?.endDate), holderName: policy?.customerDisplay ?? "", insuredName: policy?.customerDisplay ?? "", vehicleRegistrationPlate: policy?.vehicleRegistrationPlate ?? "" });
    setDialogOpen(true);
  };
  const openCard = (card: GreenCard, onlyView: boolean) => {
    setEditingId(card.id); setViewOnly(onlyView); setError(null);
    setForm({ policyId: card.policyId, cardNumber: card.cardNumber, status: card.status, validFrom: dateOnly(card.validFrom), validTo: dateOnly(card.validTo), holderName: card.holderName ?? "", insuredName: card.insuredName ?? "", vehicleRegistrationPlate: card.vehicleRegistrationPlate ?? "", vehicleMakeModel: card.vehicleMakeModel ?? "", vehicleVin: card.vehicleVin ?? "", territories: card.territories ?? "", issuingOffice: card.issuingOffice ?? "", deliveryMethod: card.deliveryMethod ?? "", notes: card.notes ?? "" });
    setDialogOpen(true);
  };
  const exportCsv = () => {
    const header = ["\u0391\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2 \u03ba\u03ac\u03c1\u03c4\u03b1\u03c2", "\u03a3\u03c5\u03bc\u03b2\u03cc\u03bb\u03b1\u03b9\u03bf", "\u03a0\u03b5\u03bb\u03ac\u03c4\u03b7\u03c2", "\u03a0\u03b9\u03bd\u03b1\u03ba\u03af\u03b4\u03b1", "\u0388\u03bd\u03b1\u03c1\u03be\u03b7", "\u039b\u03ae\u03be\u03b7", "\u039a\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7", "\u03a7\u03ce\u03c1\u03b5\u03c2"].join(";");
    const body = cards.map(card => [card.cardNumber, card.policyNumber, card.customerName, card.vehicleRegistrationPlate, card.validFrom, card.validTo, STATUS_LABELS[card.status] ?? card.status, card.territories ?? ""].map(value => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "prasines-kartes.csv"; anchor.click(); URL.revokeObjectURL(url);
  };

  return <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1500, mx: "auto" }}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={1.5} sx={{ mb: 2 }}>
      <Box><Typography variant="h4" fontWeight={850}>{"\u03a0\u03c1\u03ac\u03c3\u03b9\u03bd\u03b5\u03c2 \u03ba\u03ac\u03c1\u03c4\u03b5\u03c2"}</Typography><Typography color="text.secondary">{"\u03a7\u03b5\u03b9\u03c1\u03bf\u03ba\u03af\u03bd\u03b7\u03c4\u03b7 \u03ad\u03ba\u03b4\u03bf\u03c3\u03b7, \u03c0\u03b1\u03c1\u03b1\u03ba\u03bf\u03bb\u03bf\u03cd\u03b8\u03b7\u03c3\u03b7 \u03ba\u03b1\u03b9 \u03b1\u03c1\u03c7\u03b5\u03b9\u03bf\u03b8\u03ad\u03c4\u03b7\u03c3\u03b7 \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03c9\u03bd \u03ba\u03b1\u03c1\u03c4\u03ce\u03bd \u03b1\u03bd\u03ac \u03c3\u03c5\u03bc\u03b2\u03cc\u03bb\u03b1\u03b9\u03bf."}</Typography></Box>
      <Stack direction="row" spacing={1} flexWrap="wrap"><Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!cards.length}>{"\u0395\u03be\u03b1\u03b3\u03c9\u03b3\u03ae CSV"}</Button><Button variant="contained" color="success" startIcon={<AddIcon />} onClick={openCreate}>{"\u039d\u03ad\u03b1 \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03b7 \u03ba\u03ac\u03c1\u03c4\u03b1"}</Button></Stack>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    <Card variant="outlined" sx={{ p: 1.5, mb: 2 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
      <TextField size="small" label={"\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7"} placeholder={"\u0391\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2, \u03c3\u03c5\u03bc\u03b2\u03cc\u03bb\u03b1\u03b9\u03bf, \u03c0\u03b5\u03bb\u03ac\u03c4\u03b7\u03c2, \u03c0\u03b9\u03bd\u03b1\u03ba\u03af\u03b4\u03b1"} value={search} onChange={event => { setPage(0); setSearch(event.target.value); }} sx={{ flex: 1, minWidth: 240 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      <TextField select size="small" label={"\u039a\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7"} value={status} onChange={event => { setPage(0); setStatus(event.target.value); }} sx={{ minWidth: 155 }}><MenuItem value="">{"\u038c\u03bb\u03b5\u03c2"}</MenuItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField size="small" type="date" label={"\u0391\u03c0\u03cc"} value={from} onChange={event => { setPage(0); setFrom(event.target.value); }} InputLabelProps={{ shrink: true }} /><TextField size="small" type="date" label={"\u0388\u03c9\u03c2"} value={to} onChange={event => { setPage(0); setTo(event.target.value); }} InputLabelProps={{ shrink: true }} />
      <Button color="error" variant="outlined" onClick={() => { setSearch(""); setStatus(""); setFrom(""); setTo(""); setPage(0); }}>{"\u039a\u03b1\u03b8\u03b1\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2"}</Button>
    </Stack></Card>
    <Card variant="outlined">{cardsQuery.isLoading ? <Box sx={{ p: 5, textAlign: "center" }}><CircularProgress /></Box> : <TableContainer sx={{ maxHeight: "calc(100vh - 310px)" }}><Table stickyHeader size="small">
      <TableHead><TableRow>{["\u039a\u03ac\u03c1\u03c4\u03b1", "\u03a3\u03c5\u03bc\u03b2\u03cc\u03bb\u03b1\u03b9\u03bf", "\u03a0\u03b5\u03bb\u03ac\u03c4\u03b7\u03c2", "\u03a0\u03b9\u03bd\u03b1\u03ba\u03af\u03b4\u03b1", "\u0399\u03c3\u03c7\u03cd\u03c2", "\u039a\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7", "\u0395\u03bd\u03ad\u03c1\u03b3\u03b5\u03b9\u03b5\u03c2"].map(header => <TableCell key={header} sx={{ bgcolor: "grey.100", fontWeight: 800 }}>{header}</TableCell>)}</TableRow></TableHead>
      <TableBody>{visible.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: "text.secondary" }}>{"\u0394\u03b5\u03bd \u03b2\u03c1\u03ad\u03b8\u03b7\u03ba\u03b1\u03bd \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03b5\u03c2 \u03ba\u03ac\u03c1\u03c4\u03b5\u03c2."}</TableCell></TableRow> : visible.map(card => <TableRow key={card.id} hover onClick={() => openCard(card, true)} sx={{ cursor: "pointer" }}>
        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{card.cardNumber}</TableCell><TableCell>{card.policyNumber}</TableCell><TableCell>{card.customerName}</TableCell><TableCell>{card.vehicleRegistrationPlate || "—"}</TableCell><TableCell>{dateOnly(card.validFrom)} → {dateOnly(card.validTo)}</TableCell><TableCell><Chip size="small" color={statusColor(card.status)} label={STATUS_LABELS[card.status] ?? card.status} /></TableCell>
        <TableCell onClick={event => event.stopPropagation()}><Stack direction="row" spacing={.25}><Tooltip title={"\u03a0\u03c1\u03bf\u03b2\u03bf\u03bb\u03ae"}><IconButton size="small" color="primary" onClick={() => openCard(card, true)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip><Tooltip title={"\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1"}><IconButton size="small" color="success" onClick={() => openCard(card, false)}><EditIcon fontSize="small" /></IconButton></Tooltip>{card.status !== "Issued" && card.status !== "Delivered" && card.status !== "Cancelled" && <Tooltip title={"\u0388\u03ba\u03b4\u03bf\u03c3\u03b7 PDF"}><IconButton size="small" color="success" onClick={() => issueMutation.mutate(card)} disabled={issueMutation.isPending}><PictureAsPdfIcon fontSize="small" /></IconButton></Tooltip>}{card.status === "Issued" && <Tooltip title={"\u03a0\u03b1\u03c1\u03b1\u03b4\u03cc\u03b8\u03b7\u03ba\u03b5"}><IconButton size="small" color="success" onClick={() => deliverMutation.mutate(card)} disabled={deliverMutation.isPending}><DownloadIcon fontSize="small" /></IconButton></Tooltip>}{card.status !== "Cancelled" && <Tooltip title={"\u0391\u03ba\u03cd\u03c1\u03c9\u03c3\u03b7"}><IconButton size="small" color="error" onClick={() => { if (window.confirm("\u0391\u03ba\u03cd\u03c1\u03c9\u03c3\u03b7 \u03c4\u03b7\u03c2 \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03b7\u03c2 \u03ba\u03ac\u03c1\u03c4\u03b1\u03c2;")) cancelMutation.mutate(card); }} disabled={cancelMutation.isPending}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>}</Stack></TableCell>
      </TableRow>)}</TableBody></Table></TableContainer>}
      <TablePagination component="div" count={cards.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} labelRowsPerPage={"\u0391\u03bd\u03ac \u03c3\u03b5\u03bb\u03af\u03b4\u03b1"} />
    </Card>

    <Dialog open={dialogOpen} onClose={() => isBusy ? undefined : setDialogOpen(false)} fullWidth maxWidth="md"><DialogTitle>{viewOnly ? "\u03a0\u03c1\u03bf\u03b2\u03bf\u03bb\u03ae \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03b7\u03c2 \u03ba\u03ac\u03c1\u03c4\u03b1\u03c2" : editingId ? "\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1 \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03b7\u03c2 \u03ba\u03ac\u03c1\u03c4\u03b1\u03c2" : "\u039d\u03ad\u03b1 \u03c0\u03c1\u03ac\u03c3\u03b9\u03bd\u03b7 \u03ba\u03ac\u03c1\u03c4\u03b1"}</DialogTitle><DialogContent dividers><Stack spacing={1.25} sx={{ pt: .5 }}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <TextField select size="small" label={"\u03a3\u03c5\u03bc\u03b2\u03cc\u03bb\u03b1\u03b9\u03bf \u03b1\u03c5\u03c4\u03bf\u03ba\u03b9\u03bd\u03ae\u03c4\u03bf\u03c5"} value={form.policyId} onChange={event => { const policy = selectedPolicy(event.target.value); setField("policyId", event.target.value); if (!editingId && policy) setForm(current => ({ ...current, policyId: policy.id, validFrom: dateOnly(policy.startDate), validTo: dateOnly(policy.endDate), holderName: policy.customerDisplay, insuredName: policy.customerDisplay, vehicleRegistrationPlate: policy.vehicleRegistrationPlate ?? "" })); }} disabled={!!editingId || viewOnly} fullWidth required>{policies.map(policy => <MenuItem key={policy.id} value={policy.id}>{policy.policyNumber} · {policy.customerDisplay} · {policy.vehicleRegistrationPlate || "χωρίς πινακίδα"}</MenuItem>)}</TextField>
      {policies.length === 0 && !policiesQuery.isLoading && <Alert severity="info">{"\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03b1\u03c5\u03c4\u03bf\u03ba\u03af\u03bd\u03b7\u03c4\u03b1 \u03c3\u03c5\u03bc\u03b2\u03cc\u03bb\u03b1\u03b9\u03b1 \u03b3\u03b9\u03b1 \u03c3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7."}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" label={"\u0391\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2 \u03ba\u03ac\u03c1\u03c4\u03b1\u03c2"} value={form.cardNumber} onChange={event => setField("cardNumber", event.target.value)} disabled={viewOnly} fullWidth /><TextField select size="small" label={"\u039a\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7"} value={form.status} onChange={event => setField("status", event.target.value)} disabled={viewOnly} sx={{ minWidth: 165 }}>{Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" type="date" label={"\u0388\u03bd\u03b1\u03c1\u03be\u03b7 \u03b9\u03c3\u03c7\u03cd\u03bf\u03c2"} value={form.validFrom} onChange={event => setField("validFrom", event.target.value)} disabled={viewOnly} InputLabelProps={{ shrink: true }} fullWidth /><TextField size="small" type="date" label={"\u039b\u03ae\u03be\u03b7 \u03b9\u03c3\u03c7\u03cd\u03bf\u03c2"} value={form.validTo} onChange={event => setField("validTo", event.target.value)} disabled={viewOnly} InputLabelProps={{ shrink: true }} fullWidth /></Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" label={"\u039a\u03ac\u03c4\u03bf\u03c7\u03bf\u03c2"} value={form.holderName} onChange={event => setField("holderName", event.target.value)} disabled={viewOnly} fullWidth /><TextField size="small" label={"\u0391\u03c3\u03c6\u03b1\u03bb\u03b9\u03c3\u03bc\u03ad\u03bd\u03bf\u03c2"} value={form.insuredName} onChange={event => setField("insuredName", event.target.value)} disabled={viewOnly} fullWidth /></Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" label={"\u03a0\u03b9\u03bd\u03b1\u03ba\u03af\u03b4\u03b1"} value={form.vehicleRegistrationPlate} onChange={event => setField("vehicleRegistrationPlate", event.target.value)} disabled={viewOnly} fullWidth /><TextField size="small" label={"\u039c\u03ac\u03c1\u03ba\u03b1 / \u03bc\u03bf\u03bd\u03c4\u03ad\u03bb\u03bf"} value={form.vehicleMakeModel} onChange={event => setField("vehicleMakeModel", event.target.value)} disabled={viewOnly} fullWidth /><TextField size="small" label="VIN" value={form.vehicleVin} onChange={event => setField("vehicleVin", event.target.value)} disabled={viewOnly} fullWidth /></Stack>
      <TextField size="small" label={"\u03a7\u03ce\u03c1\u03b5\u03c2 \u03b9\u03c3\u03c7\u03cd\u03bf\u03c2"} value={form.territories} onChange={event => setField("territories", event.target.value)} disabled={viewOnly} fullWidth helperText={"\u03a7\u03c9\u03c1\u03af\u03c3\u03c4\u03b5 \u03c4\u03b9\u03c2 \u03c7\u03ce\u03c1\u03b5\u03c2 \u03bc\u03b5 \u03ba\u03cc\u03bc\u03bc\u03b1."} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" label={"\u0393\u03c1\u03b1\u03c6\u03b5\u03af\u03bf \u03ad\u03ba\u03b4\u03bf\u03c3\u03b7\u03c2"} value={form.issuingOffice} onChange={event => setField("issuingOffice", event.target.value)} disabled={viewOnly} fullWidth /><TextField size="small" label={"\u03a4\u03c1\u03cc\u03c0\u03bf\u03c2 \u03c0\u03b1\u03c1\u03ac\u03b4\u03bf\u03c3\u03b7\u03c2"} value={form.deliveryMethod} onChange={event => setField("deliveryMethod", event.target.value)} disabled={viewOnly} fullWidth /></Stack>
      <TextField size="small" label={"\u03a0\u03b1\u03c1\u03b1\u03c4\u03b7\u03c1\u03ae\u03c3\u03b5\u03b9\u03c2"} value={form.notes} onChange={event => setField("notes", event.target.value)} disabled={viewOnly} multiline minRows={2} fullWidth />
    </Stack></DialogContent><DialogActions>
      <Button color="error" variant="contained" onClick={() => setDialogOpen(false)} disabled={isBusy}>{"\u039a\u03bb\u03b5\u03af\u03c3\u03b9\u03bc\u03bf"}</Button>
      {viewOnly && <Button color="success" variant="contained" startIcon={<EditIcon />} onClick={() => setViewOnly(false)}>{"\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1"}</Button>}
      {!viewOnly && <Button color="success" variant="contained" onClick={() => saveMutation.mutate()} disabled={isBusy || !form.policyId || !form.validFrom || !form.validTo}>{isBusy ? <CircularProgress size={18} /> : "\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7"}</Button>}
      {!viewOnly && editingId && <Button color="primary" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => issueMutation.mutate({ id: editingId, policyId: form.policyId })} disabled={isBusy}>{"\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7 & \u03ad\u03ba\u03b4\u03bf\u03c3\u03b7 PDF"}</Button>}
    </DialogActions></Dialog>
  </Box>;
}
