import { useEffect, useMemo, useState } from "react";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SavingsIcon from "@mui/icons-material/Savings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, num } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";

interface ProvisionDto {
  id: string; claimId: string; claimNumber: string;
  reserveAmount: number; incurredButNotReported: number | null;
  currency: string; evaluationDate: string; assessorName: string | null; notes: string | null;
}
interface ClaimLite { id: string; claimNumber: string; }

export function ClaimProvisionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({ queryKey: ["provisions"], queryFn: async () => (await api.get<ProvisionDto[]>("/claim-provisions")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/claim-provisions/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["provisions"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const totalReserve = (q.data ?? []).reduce((s, p) => s + p.reserveAmount, 0);
  const totalIbnr = (q.data ?? []).reduce((s, p) => s + (p.incurredButNotReported ?? 0), 0);

  const [sortKey, setSortKey] = useState<keyof ProvisionDto | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sortedRows = useMemo(() => {
    const rows = q.data ?? [];
    if (!sortKey) return rows;
    const arr = rows.slice();
    arr.sort((a, b) => {
      const va: any = a[sortKey] ?? "";
      const vb: any = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "el");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [q.data, sortKey, sortDir]);
  const inferType = (key: string): ColumnType =>
    key === "evaluationDate" ? "date" : (key === "reserve" || key === "ibnr") ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof ProvisionDto> = {
        claim: "claimNumber", evaluationDate: "evaluationDate",
        assessor: "assessorName", reserve: "reserveAmount", ibnr: "incurredButNotReported",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      setSortKey(dtoKey);
      setSortDir(dir);
    },
  });
  const rowMenu = useRowContextMenu<ProvisionDto>({
    entityLabel: "εκτίμησης",
    onDelete: (p) => { if (confirm(t("common.confirmDelete"))) del.mutate(p.id); },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SavingsIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("provisions.title")}</Typography>
              <HelpHint id="page.provisions" />
            </Stack>
            <Typography color="text.secondary">{t("provisions.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("provisions.totalsLabel")}</Typography>
            <Typography variant="body1" fontWeight={800}>
              {t("provisions.reserve")} {money(totalReserve)} · IBNR {money(totalIbnr)}
            </Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("provisions.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              {[
                ["claim", t("provisions.claim"), "left"],
                ["evaluationDate", t("provisions.evaluationDate"), "left"],
                ["assessor", t("provisions.assessor"), "left"],
                ["reserve", t("provisions.reserve"), "right"],
                ["ibnr", "IBNR", "right"],
              ].map(([k, label, align]) => (
                <TableCell key={k as string} align={align as "left" | "right"} sx={{ userSelect: "none" }}
                  onContextMenu={(e) => headerMenu.open(e, { key: k as string, label: label as string, type: inferType(k as string), canHide: false })}
                >{label}</TableCell>
              ))}
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {sortedRows.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("provisions.empty")}</TableCell></TableRow>
              )}
              {sortedRows.map(p => (
                <TableRow key={p.id} hover onContextMenu={(e) => rowMenu.open(e, p)}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{p.claimNumber}</TableCell>
                  <TableCell>{p.evaluationDate}</TableCell>
                  <TableCell>{p.assessorName ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(p.reserveAmount, p.currency)}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{num(p.incurredButNotReported ?? 0)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(p.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["provisions"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    claimId: "", reserveAmount: 0, incurredButNotReported: "",
    currency: "EUR", evaluationDate: today, assessorName: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const claims = useQuery({ queryKey: ["claims-lite"], enabled: open,
    queryFn: async () => (await api.get<ClaimLite[]>("/claims")).data });

  useEffect(() => { if (open) setForm({ claimId: "", reserveAmount: 0, incurredButNotReported: "", currency: "EUR", evaluationDate: today, assessorName: "", notes: "" }); /* eslint-disable-next-line */ }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/claim-provisions", {
      claimId: form.claimId, reserveAmount: Number(form.reserveAmount),
      incurredButNotReported: form.incurredButNotReported ? Number(form.incurredButNotReported) : null,
      currency: form.currency, evaluationDate: form.evaluationDate,
      assessorName: form.assessorName || null, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("provisions.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <SearchableSelect
            label={t("provisions.claim")}
            required
            value={form.claimId}
            onChange={(v) => setForm({ ...form, claimId: v })}
            options={(claims.data ?? []).map(c => ({ value: c.id, label: c.claimNumber }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required type="number" label={t("provisions.reserve")} value={form.reserveAmount}
              onChange={e => setForm({ ...form, reserveAmount: Number(e.target.value) })} fullWidth />
            <TextField type="number" label="IBNR" value={form.incurredButNotReported}
              onChange={e => setForm({ ...form, incurredButNotReported: e.target.value })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("provisions.evaluationDate")} InputLabelProps={{ shrink: true }}
              value={form.evaluationDate} onChange={e => setForm({ ...form, evaluationDate: e.target.value })} fullWidth />
            <TextField label={t("provisions.assessor")} value={form.assessorName}
              onChange={e => setForm({ ...form, assessorName: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.claimId || form.reserveAmount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
