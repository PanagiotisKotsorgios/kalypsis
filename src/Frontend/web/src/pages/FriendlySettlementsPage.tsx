import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HandshakeIcon from "@mui/icons-material/Handshake";
import PeopleIcon from "@mui/icons-material/People";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, num } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

interface SettlementDto {
  id: string; claimId: string; claimNumber: string;
  settlementFileNumber: string; declarationDate: string;
  settlementAuthority: string | null; settlementDate: string | null;
  agreedAmount: number | null; vatAmount: number | null;
  feeAmount: number | null; interestAmount: number | null;
  currency: string; status: string;
  otherPartyInsurer: string | null; otherPartyPolicy: string | null;
  appraisorName: string | null; appraisalDate: string | null;
  notes: string | null; victimCount: number;
}
interface VictimDto {
  id: string; claimId: string; friendlySettlementId: string | null;
  fullName: string; afm: string | null; phone: string | null; address: string | null;
  victimType: string; vehiclePlate: string | null; description: string | null;
  reserveAmount: number | null; paidAmount: number | null;
  currency: string; status: string;
}
interface ClaimLite { id: string; claimNumber: string; }

const STATUSES = ["Open", "InProgress", "Closed", "Disputed"];
const VICTIM_TYPES = ["Person", "Vehicle", "Property"];
const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  Open: "info", InProgress: "warning", Closed: "success", Disputed: "error"
};

export function FriendlySettlementsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [victimsOf, setVictimsOf] = useState<SettlementDto | null>(null);

  const q = useQuery({ queryKey: ["friendly-settlements"], queryFn: async () =>
    (await api.get<SettlementDto[]>("/friendly-settlements")).data });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <HandshakeIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("friendly.title")}</Typography>
              <HelpHint id="page.friendly" />
            </Stack>
            <Typography color="text.secondary">{t("friendly.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
          {t("friendly.create")}
        </Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("friendly.fileNumber")}</TableCell>
              <TableCell>{t("friendly.claim")}</TableCell>
              <TableCell>{t("friendly.declarationDate")}</TableCell>
              <TableCell>{t("friendly.otherInsurer")}</TableCell>
              <TableCell align="right">{t("friendly.agreedAmount")}</TableCell>
              <TableCell align="center">{t("friendly.victims")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("friendly.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{s.settlementFileNumber}</TableCell>
                  <TableCell>{s.claimNumber}</TableCell>
                  <TableCell>{s.declarationDate}</TableCell>
                  <TableCell>{s.otherPartyInsurer ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{s.agreedAmount != null ? money(s.agreedAmount, s.currency) : "—"}</TableCell>
                  <TableCell align="center">{s.victimCount}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[s.status] ?? "default"} label={s.status} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => setVictimsOf(s)}><PeopleIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["friendly-settlements"] }); setCreateOpen(false); }} />
      <VictimsDialog settlement={victimsOf} onClose={() => setVictimsOf(null)} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    claimId: "", settlementFileNumber: "", declarationDate: today,
    settlementAuthority: "", settlementDate: "",
    agreedAmount: "", vatAmount: "", feeAmount: "", interestAmount: "",
    currency: "EUR", status: "Open",
    otherPartyInsurer: "", otherPartyPolicy: "",
    appraisorName: "", appraisalDate: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const claims = useQuery({ queryKey: ["claims-lite-fs"], enabled: open,
    queryFn: async () => (await api.get<ClaimLite[]>("/claims")).data });

  useEffect(() => {
    if (open) setForm({
      claimId: "",
      settlementFileNumber: `ΦΔ-${Date.now().toString().slice(-6)}`,
      declarationDate: today, settlementAuthority: "", settlementDate: "",
      agreedAmount: "", vatAmount: "", feeAmount: "", interestAmount: "",
      currency: "EUR", status: "Open",
      otherPartyInsurer: "", otherPartyPolicy: "",
      appraisorName: "", appraisalDate: "", notes: ""
    });
    // eslint-disable-next-line
  }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/friendly-settlements", {
      claimId: form.claimId, settlementFileNumber: form.settlementFileNumber.trim(),
      declarationDate: form.declarationDate,
      settlementAuthority: form.settlementAuthority || null,
      settlementDate: form.settlementDate || null,
      agreedAmount: form.agreedAmount ? Number(form.agreedAmount) : null,
      vatAmount: form.vatAmount ? Number(form.vatAmount) : null,
      feeAmount: form.feeAmount ? Number(form.feeAmount) : null,
      interestAmount: form.interestAmount ? Number(form.interestAmount) : null,
      currency: form.currency.toUpperCase(), status: form.status,
      otherPartyInsurer: form.otherPartyInsurer || null,
      otherPartyPolicy: form.otherPartyPolicy || null,
      appraisorName: form.appraisorName || null,
      appraisalDate: form.appraisalDate || null,
      notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("friendly.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label={t("friendly.claim")}
              required
              value={form.claimId}
              onChange={(v) => setForm({ ...form, claimId: v })}
              options={(claims.data ?? []).map(c => ({ value: c.id, label: c.claimNumber }))}
            />
            <TextField required label={t("friendly.fileNumber")} value={form.settlementFileNumber}
              onChange={e => setForm({ ...form, settlementFileNumber: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("friendly.declarationDate")} InputLabelProps={{ shrink: true }}
              value={form.declarationDate} onChange={e => setForm({ ...form, declarationDate: e.target.value })} fullWidth />
            <TextField type="date" label={t("friendly.settlementDate")} InputLabelProps={{ shrink: true }}
              value={form.settlementDate} onChange={e => setForm({ ...form, settlementDate: e.target.value })} fullWidth />
            <SearchableTextField label={t("common.status")} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })} sx={{ width: 160 }}>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <TextField label={t("friendly.authority")} value={form.settlementAuthority}
            onChange={e => setForm({ ...form, settlementAuthority: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("friendly.otherInsurer")} value={form.otherPartyInsurer}
              onChange={e => setForm({ ...form, otherPartyInsurer: e.target.value })} fullWidth />
            <TextField label={t("friendly.otherPolicy")} value={form.otherPartyPolicy}
              onChange={e => setForm({ ...form, otherPartyPolicy: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("friendly.agreedAmount")} value={form.agreedAmount}
              onChange={e => setForm({ ...form, agreedAmount: e.target.value })} fullWidth />
            <TextField type="number" label="ΦΠΑ" value={form.vatAmount}
              onChange={e => setForm({ ...form, vatAmount: e.target.value })} fullWidth />
            <TextField type="number" label={t("friendly.fees")} value={form.feeAmount}
              onChange={e => setForm({ ...form, feeAmount: e.target.value })} fullWidth />
            <TextField type="number" label={t("friendly.interest")} value={form.interestAmount}
              onChange={e => setForm({ ...form, interestAmount: e.target.value })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 90 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("friendly.appraisor")} value={form.appraisorName}
              onChange={e => setForm({ ...form, appraisorName: e.target.value })} fullWidth />
            <TextField type="date" label={t("friendly.appraisalDate")} InputLabelProps={{ shrink: true }}
              value={form.appraisalDate} onChange={e => setForm({ ...form, appraisalDate: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.claimId || !form.settlementFileNumber.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function VictimsDialog({ settlement, onClose }: { settlement: SettlementDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    fullName: "", afm: "", phone: "", address: "",
    victimType: "Person", vehiclePlate: "", description: "",
    reserveAmount: "", currency: "EUR", status: "Open"
  });
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["victims", settlement?.id], enabled: !!settlement,
    queryFn: async () => (await api.get<VictimDto[]>("/claim-victims", { params: { settlementId: settlement!.id } })).data
  });
  const add = useMutation({
    mutationFn: async () => (await api.post("/claim-victims", {
      claimId: settlement!.claimId, friendlySettlementId: settlement!.id,
      fullName: form.fullName.trim(), afm: form.afm || null,
      phone: form.phone || null, address: form.address || null,
      victimType: form.victimType, vehiclePlate: form.vehiclePlate || null,
      description: form.description || null,
      reserveAmount: form.reserveAmount ? Number(form.reserveAmount) : null,
      currency: form.currency, status: form.status
    })).data,
    onSuccess: () => { setAdding(false); void qc.invalidateQueries({ queryKey: ["victims", settlement?.id] }); void qc.invalidateQueries({ queryKey: ["friendly-settlements"] }); },
    onError: e => setErr(extractErrorMessage(e))
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/claim-victims/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["victims", settlement?.id] })
  });

  return (
    <Dialog open={!!settlement} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("friendly.victimsOf")} {settlement?.settlementFileNumber}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={t("friendly.victimsTab")} />
        </Tabs>
        {!adding ? (
          <Box>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setAdding(true)} sx={{ mb: 2 }}>
              {t("friendly.addVictim")}
            </Button>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{t("friendly.victimName")}</TableCell>
                <TableCell>{t("friendly.victimType")}</TableCell>
                <TableCell>{t("friendly.afm")}</TableCell>
                <TableCell>{t("friendly.phone")}</TableCell>
                <TableCell align="right">{t("friendly.reserveAmount")}</TableCell>
                <TableCell align="right">{t("friendly.paidAmount")}</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell align="right" />
              </TableRow></TableHead>
              <TableBody>
                {(q.data ?? []).map(v => (
                  <TableRow key={v.id}>
                    <TableCell>{v.fullName}</TableCell>
                    <TableCell>{v.victimType}</TableCell>
                    <TableCell>{v.afm ?? "—"}</TableCell>
                    <TableCell>{v.phone ?? "—"}</TableCell>
                    <TableCell align="right">{v.reserveAmount != null ? num(v.reserveAmount) : "—"}</TableCell>
                    <TableCell align="right">{v.paidAmount != null ? num(v.paidAmount) : "—"}</TableCell>
                    <TableCell>{v.status}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(v.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Stack spacing={2} mt={1}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField required label={t("friendly.victimName")} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} fullWidth />
              <SearchableTextField label={t("friendly.victimType")} value={form.victimType} onChange={e => setForm({ ...form, victimType: e.target.value })} sx={{ width: 160 }}>
                {VICTIM_TYPES.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </SearchableTextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label={t("friendly.afm")} value={form.afm} onChange={e => setForm({ ...form, afm: e.target.value })} fullWidth />
              <TextField label={t("friendly.phone")} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth />
              {form.victimType === "Vehicle" && (
                <TextField label={t("friendly.plate")} value={form.vehiclePlate} onChange={e => setForm({ ...form, vehiclePlate: e.target.value.toUpperCase() })} fullWidth />
              )}
            </Stack>
            <TextField label={t("friendly.address")} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} fullWidth />
            <TextField label={t("friendly.description")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
            <Stack direction="row" spacing={2}>
              <TextField type="number" label={t("friendly.reserveAmount")} value={form.reserveAmount} onChange={e => setForm({ ...form, reserveAmount: e.target.value })} fullWidth />
              <TextField label={t("common.currency")} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} sx={{ width: 100 }} />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {adding ? (
          <>
            <Button onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
            <Button variant="contained" onClick={() => add.mutate()} disabled={add.isPending || !form.fullName.trim()}>
              {add.isPending ? <CircularProgress size={18} /> : t("common.save")}
            </Button>
          </>
        ) : <Button onClick={onClose}>{t("common.close")}</Button>}
      </DialogActions>
    </Dialog>
  );
}
