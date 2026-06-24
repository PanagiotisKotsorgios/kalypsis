import { useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CakeIcon from "@mui/icons-material/Cake";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface NameDayDto { id: string; name: string; month: number; day: number; notes: string | null; isActive: boolean; }
interface CelebrantDto { customerId: string; customerName: string; customerNumber: string; phone: string | null; email: string | null; nameDay: string; }

const MONTHS = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];

export function NameDaysPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <CakeIcon sx={{ fontSize: 36, color: "#d6336c" }} />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("nameDays.title")}</Typography>
            <HelpHint id="page.nameDays" />
          </Stack>
          <Typography color="text.secondary">{t("nameDays.subtitle")}</Typography>
        </Box>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t("nameDays.tabToday")} />
        <Tab label={t("nameDays.tabCalendar")} />
      </Tabs>
      {tab === 0 && <CelebrantsPanel />}
      {tab === 1 && <CalendarPanel />}
    </Box>
  );
}

function CelebrantsPanel() {
  const { t } = useTranslation();
  const now = new Date();
  const [day, setDay] = useState(now.getDate());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const q = useQuery({
    queryKey: ["celebrants", day, month],
    queryFn: async () => (await api.get<CelebrantDto[]>("/name-days/celebrating", { params: { day, month } })).data
  });

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <Typography>{t("nameDays.lookupOn")}</Typography>
        <TextField type="number" label={t("nameDays.day")} value={day} onChange={e => setDay(Number(e.target.value))} sx={{ width: 100 }} inputProps={{ min: 1, max: 31 }} />
        <TextField select label={t("nameDays.month")} value={month} onChange={e => setMonth(Number(e.target.value))} sx={{ width: 140 }}>
          {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">{(q.data ?? []).length} {t("nameDays.celebrate")}</Typography>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("nameDays.customerNumber")}</TableCell>
              <TableCell>{t("nameDays.customerName")}</TableCell>
              <TableCell>{t("nameDays.celebrating")}</TableCell>
              <TableCell>{t("nameDays.contact")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("nameDays.noCelebrants")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(c => (
                <TableRow key={c.customerId} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{c.customerNumber}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{c.customerName}</TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontStyle: "italic" }}>{c.nameDay}</Typography></TableCell>
                  <TableCell>
                    {c.phone && <Typography variant="body2"><PhoneIcon sx={{ fontSize: 14, mr: 0.5 }} />{c.phone}</Typography>}
                    {c.email && <Typography variant="body2"><EmailIcon sx={{ fontSize: 14, mr: 0.5 }} />{c.email}</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    {c.phone && <Button size="small" href={`tel:${c.phone}`}>{t("nameDays.call")}</Button>}
                    {c.email && <Button size="small" href={`mailto:${c.email}?subject=${encodeURIComponent("Χρόνια Πολλά!")}`}>{t("nameDays.wish")}</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}

function CalendarPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["name-days", filter], queryFn: async () =>
    (await api.get<NameDayDto[]>("/name-days", { params: filter ? { month: filter } : {} })).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/name-days/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["name-days"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Stack direction="row" spacing={2} mb={2}>
        <TextField select label={t("nameDays.filterMonth")} value={filter} onChange={e => setFilter(Number(e.target.value))} sx={{ width: 200 }}>
          <MenuItem value={0}>{t("common.all")}</MenuItem>
          {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("nameDays.add")}</Button>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("nameDays.dayLabel")}</TableCell>
              <TableCell>{t("nameDays.name")}</TableCell>
              <TableCell>{t("common.notes")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map(n => (
                <TableRow key={n.id} hover>
                  <TableCell>{n.day} {MONTHS[n.month - 1]}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{n.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{n.notes ?? "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(n.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["name-days"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", month: 1, day: 1, notes: "", isActive: true });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post("/name-days", {
      name: form.name.trim(), month: Number(form.month), day: Number(form.day),
      notes: form.notes || null, isActive: form.isActive
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("nameDays.addTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField required label={t("nameDays.name")} value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} fullWidth placeholder="π.χ. Γιώργος" />
          <Stack direction="row" spacing={2}>
            <TextField type="number" required label={t("nameDays.day")} value={form.day}
              onChange={e => setForm({ ...form, day: Number(e.target.value) })} sx={{ width: 120 }} inputProps={{ min: 1, max: 31 }} />
            <TextField select required label={t("nameDays.month")} value={form.month}
              onChange={e => setForm({ ...form, month: Number(e.target.value) })} fullWidth>
              {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label={t("common.notes")} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth placeholder="π.χ. Αγ. Γεωργίου" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
