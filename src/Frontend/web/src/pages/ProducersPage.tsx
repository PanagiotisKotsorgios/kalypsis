import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { CredentialsDialog } from "./TenantsPage";
import { ProducerDetailDrawer } from "../components/ProducerDetailDrawer";
import { useTableState } from "../components/useTableState";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";

type ProducerStatus = "Active" | "Suspended" | "Terminated";
type ProducerTier = "None" | "A" | "B" | "C" | "D" | "E";

interface ProducerDto {
  id: string; code: string; name: string;
  email: string | null; phone: string | null;
  status: ProducerStatus; tier: ProducerTier;
  policyCount: number; createdAt: string;
}

const STATUS_COLOR: Record<ProducerStatus, "success" | "warning" | "default"> = {
  Active: "success", Suspended: "warning", Terminated: "default"
};
const TIER_COLOR: Record<ProducerTier, "default" | "warning" | "primary" | "info" | "success"> = {
  A: "warning", B: "primary", C: "info", D: "success", E: "default", None: "default"
};
const TIER_LABEL: Record<ProducerTier, string> = {
  A: "Κατ. Α", B: "Κατ. Β", C: "Κατ. Γ", D: "Κατ. Δ", E: "Κατ. Ε", None: "—"
};

export function ProducersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProducerDto | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuedCreds, setIssuedCreds] = useState<{ email: string; password: string } | null>(null);

  const q = useQuery({
    queryKey: ["producers"],
    queryFn: async () => (await api.get<ProducerDto[]>("/producers")).data
  });

  const issuePortal = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ email: string; temporaryPassword: string }>(`/producers/${id}/portal-account`, {})).data,
    onSuccess: (data) => setIssuedCreds({ email: data.email, password: data.temporaryPassword }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/producers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["producers"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const [statusFilter, setStatusFilter] = useState<ProducerStatus | "">("");
  const [tierFilter, setTierFilter] = useState<ProducerTier | "">("");
  const [hasPoliciesOnly, setHasPoliciesOnly] = useState(false);
  const rawProducers = q.data ?? [];
  const allRows = rawProducers.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (tierFilter && p.tier !== tierFilter) return false;
    if (hasPoliciesOnly && p.policyCount === 0) return false;
    return true;
  });
  const table = useTableState<ProducerDto>({
    rows: allRows,
    searchableText: (p) => `${p.code} ${p.name} ${p.email ?? ""} ${p.phone ?? ""} ${p.status}`,
    pageSize: 25
  });
  const rows = table.paged;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("producers.title")}</Typography>
            <HelpHint id="page.producers" />
          </Stack>
          <Typography color="text.secondary">{t("producers.subtitle")}</Typography>
        </Box>
        <Button data-tour="producers-new" variant="contained" size="large" startIcon={<AddIcon />} onClick={() => { setError(null); setCreateOpen(true); }}>
          {t("producers.create")}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField select size="small" label={t("producers.col.status")}
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProducerStatus | "")}
            sx={{ minWidth: { sm: 200 } }}>
            <MenuItem value="">Όλες</MenuItem>
            {(["Active","Suspended","Terminated"] as const).map(s =>
              <MenuItem key={s} value={s}>{t(`producers.statuses.${s}`)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Κατηγορία"
            value={tierFilter} onChange={(e) => setTierFilter(e.target.value as ProducerTier | "")}
            sx={{ minWidth: { sm: 180 } }}>
            <MenuItem value="">Όλες</MenuItem>
            {(["A","B","C","D","E"] as const).map(t =>
              <MenuItem key={t} value={t}>{TIER_LABEL[t as ProducerTier]}</MenuItem>)}
            <MenuItem value="None">Χωρίς κατηγορία</MenuItem>
          </TextField>
          <Stack direction="row" alignItems="center" spacing={1}>
            <input type="checkbox" id="has-policies-only" checked={hasPoliciesOnly}
              onChange={(e) => setHasPoliciesOnly(e.target.checked)} />
            <Box component="label" htmlFor="has-policies-only" sx={{ fontSize: 14, cursor: "pointer" }}>
              Μόνο με συμβόλαια
            </Box>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => { setStatusFilter(""); setTierFilter(""); setHasPoliciesOnly(false); }}>
            Καθαρισμός
          </Button>
        </Stack>
      </Card>

      <Box sx={{ mb: 2 }}>
        <TableToolbar<ProducerDto>
          query={table.query} onQuery={table.setQuery}
          count={allRows.length} filteredCount={table.filtered.length}
          pageSize={table.pageSize} onPageSize={table.setPageSize}
          exportRows={table.filtered}
          exportFileName={`producers-${new Date().toISOString().slice(0, 10)}`}
          serverEntity="producers"
          serverParams={{ search: table.query }}
          exportColumns={[
            { key: "code", label: "Κωδικός" },
            { key: "name", label: "Όνομα" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Τηλέφωνο" },
            { key: "status", label: "Κατάσταση" },
            { key: "policyCount", label: "Συμβόλαια" }
          ]}
        />
      </Box>
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("producers.col.code")}</TableCell>
                  <TableCell>{t("producers.col.name")}</TableCell>
                  <TableCell>Κατηγορία</TableCell>
                  <TableCell>{t("producers.col.email")}</TableCell>
                  <TableCell>{t("producers.col.phone")}</TableCell>
                  <TableCell align="right">{t("producers.col.policies")}</TableCell>
                  <TableCell>{t("producers.col.status")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p, idx) => (
                  <TableRow key={p.id} hover sx={{ cursor: "pointer" }}
                    data-tour={idx === 0 ? "producers-row" : undefined}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, .MuiIconButton-root")) return;
                      setDetailId(p.id);
                    }}>
                    <TableCell><Chip label={p.code} size="small" variant="outlined" /></TableCell>
                    <TableCell><Typography fontWeight={600}>{p.name}</Typography></TableCell>
                    <TableCell>
                      {p.tier && p.tier !== "None"
                        ? <Chip size="small" color={TIER_COLOR[p.tier]} label={TIER_LABEL[p.tier]} sx={{ fontWeight: 800 }} />
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{p.email ?? "—"}</TableCell>
                    <TableCell>{p.phone ?? "—"}</TableCell>
                    <TableCell align="right">{p.policyCount}</TableCell>
                    <TableCell><Chip size="small" color={STATUS_COLOR[p.status]} label={t(`producers.statuses.${p.status}`)} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" title={t("producers.issuePortal")}
                          disabled={!p.email || p.status !== "Active" || issuePortal.isPending}
                          onClick={() => issuePortal.mutate(p.id)}>
                          <VpnKeyIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setEditing(p)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => { if (confirm(t("producers.confirmDelete", { name: p.name }))) del.mutate(p.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={7}>
                    <Typography textAlign="center" color="text.secondary" py={4}>{t("producers.empty")}</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} />
          </Box>
        </Card>
      )}

      <ProducerDialog
        open={createOpen} onClose={() => setCreateOpen(false)} producer={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["producers"] }); setCreateOpen(false); }}
      />
      <ProducerDialog
        open={!!editing} onClose={() => setEditing(null)} producer={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["producers"] }); setEditing(null); }}
      />

      <CredentialsDialog
        open={!!issuedCreds}
        email={issuedCreds?.email ?? ""}
        password={issuedCreds?.password ?? ""}
        onClose={() => setIssuedCreds(null)}
        title={t("producers.portalCreated")}
        introKey="producers.portalCreatedBody"
      />

      <ProducerDetailDrawer
        producerId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />
    </Box>
  );
}

function ProducerDialog({ open, onClose, producer, onSaved }: {
  open: boolean; onClose: () => void; producer: ProducerDto | null; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!producer;
  const [form, setForm] = useState({
    code: "", name: "", email: "", phone: "",
    status: "Active" as ProducerStatus,
    tier: "None" as ProducerTier
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (producer) {
      setForm({
        code: producer.code, name: producer.name,
        email: producer.email ?? "", phone: producer.phone ?? "",
        status: producer.status, tier: producer.tier ?? "None"
      });
    } else if (open) {
      setForm({ code: "", name: "", email: "", phone: "", status: "Active", tier: "None" });
    }
  }, [producer, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return (await api.put(`/producers/${producer!.id}`, form)).data;
      return (await api.post("/producers", form)).data;
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editing ? t("producers.form.editTitle") : t("producers.form.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField label={t("producers.col.code")} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} fullWidth required disabled={editing} />
            <TextField select label={t("producers.col.status")} value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ProducerStatus })} fullWidth>
              {(["Active","Suspended","Terminated"] as const).map(s => <MenuItem key={s} value={s}>{t(`producers.statuses.${s}`)}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField select label="Κατηγορία προμηθειών" value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value as ProducerTier })} fullWidth
            helperText="Επιλέξτε την κατηγορία Α/Β/Γ/Δ/Ε ώστε ο συνεργάτης να παίρνει αυτόματα την προμήθεια που έχετε ορίσει στην παραμετροποίηση για την κατηγορία του.">
            <MenuItem value="None">— Χωρίς κατηγορία —</MenuItem>
            {(["A","B","C","D","E"] as const).map(tier =>
              <MenuItem key={tier} value={tier}>{TIER_LABEL[tier as ProducerTier]}</MenuItem>)}
          </TextField>
          <TextField label={t("producers.col.name")} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
          <TextField label={t("producers.col.email")} type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <TextField label={t("producers.col.phone")} value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
