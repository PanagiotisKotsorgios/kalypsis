import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { money, date } from "../utils/format";

interface UpcomingRow {
  policyId: string;
  policyNumber: string;
  customerDisplay: string;
  insuranceCompanyName: string;
  policyType: string;
  endDate: string;
  premium: number;
  currency: string;
  daysToRenewal: number;
}

const WINDOWS = [
  { value: 30, label: "30 ημέρες" },
  { value: 60, label: "60 ημέρες" },
  { value: 90, label: "90 ημέρες" },
  { value: 180, label: "6 μήνες" },
  { value: 365, label: "12 μήνες" },
];

export function RenewalsPage() {
  const qc = useQueryClient();
  const [windowDays, setWindowDays] = useState(90);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["renewals-upcoming", windowDays],
    queryFn: async () => (await api.get<UpcomingRow[]>("/renewals/upcoming",
      { params: { days: windowDays } })).data
  });

  const bulk = useMutation({
    mutationFn: async () => (await api.post<number>("/renewals/bulk", {
      policyIds: Array.from(selected), renewalTermDays: 365
    })).data,
    onSuccess: (n) => {
      setSuccess(`Ανανεώθηκαν ${n} συμβόλαια.`);
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["renewals-upcoming"] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const rows = q.data ?? [];
  // Group rows by month for the calendar-style view.
  const grouped = useMemo(() => {
    const out = new Map<string, UpcomingRow[]>();
    for (const r of rows) {
      const key = r.endDate.slice(0, 7); // yyyy-MM
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    }
    return Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const monthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("el-GR", { month: "long", year: "numeric" });
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleMonth = (monthRows: UpcomingRow[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = monthRows.every(r => next.has(r.policyId));
      if (allSelected) monthRows.forEach(r => next.delete(r.policyId));
      else monthRows.forEach(r => next.add(r.policyId));
      return next;
    });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <EventRepeatIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Ανανεώσεις</Typography>
            <Typography color="text.secondary">
              Συμβόλαια που λήγουν εντός του παραθύρου. Επιλέξτε για μαζική ανανέωση.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField select size="small" label="Παράθυρο" value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))} sx={{ minWidth: 160 }}>
            {WINDOWS.map(w => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
          </TextField>
          <Button
            variant="contained" startIcon={<AutorenewIcon />}
            disabled={selected.size === 0 || bulk.isPending}
            onClick={() => {
              if (confirm(`Ανανέωση ${selected.size} συμβολαίων;`)) bulk.mutate();
            }}>
            {bulk.isPending ? <CircularProgress size={18} color="inherit" />
              : `Μαζική ανανέωση (${selected.size})`}
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : grouped.length === 0 ? (
        <Card sx={{ p: 4, textAlign: "center" }} variant="outlined">
          <Typography color="text.secondary">
            Καμία ανανέωση εντός του παραθύρου.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {grouped.map(([month, monthRows]) => {
            const monthTotal = monthRows.reduce((s, r) => s + r.premium, 0);
            const allSel = monthRows.every(r => selected.has(r.policyId));
            return (
              <Card key={month} variant="outlined">
                <Stack direction="row" alignItems="center" spacing={2}
                  sx={{ p: 2, bgcolor: "rgba(11,37,69,0.04)" }}>
                  <Checkbox checked={allSel} indeterminate={!allSel && monthRows.some(r => selected.has(r.policyId))}
                    onChange={() => toggleMonth(monthRows)} />
                  <Typography fontWeight={800} sx={{ flex: 1, textTransform: "capitalize" }}>
                    {monthLabel(month)}
                  </Typography>
                  <Chip size="small" label={`${monthRows.length} συμβόλαια`} />
                  <Typography fontWeight={700}>{money(monthTotal)}</Typography>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={42} />
                      <TableCell>Αρ. συμβολαίου</TableCell>
                      <TableCell>Πελάτης</TableCell>
                      <TableCell>Εταιρία</TableCell>
                      <TableCell>Κλάδος</TableCell>
                      <TableCell>Λήξη</TableCell>
                      <TableCell align="right">Ημέρες</TableCell>
                      <TableCell align="right">Ασφάλιστρο</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthRows.map(r => (
                      <TableRow key={r.policyId} hover>
                        <TableCell>
                          <Checkbox checked={selected.has(r.policyId)} onChange={() => toggle(r.policyId)} />
                        </TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</TableCell>
                        <TableCell>{r.customerDisplay}</TableCell>
                        <TableCell>{r.insuranceCompanyName}</TableCell>
                        <TableCell>{r.policyType}</TableCell>
                        <TableCell>{date(r.endDate)}</TableCell>
                        <TableCell align="right">
                          <Chip size="small"
                            color={r.daysToRenewal <= 14 ? "error" : r.daysToRenewal <= 30 ? "warning" : "default"}
                            label={r.daysToRenewal} />
                        </TableCell>
                        <TableCell align="right">{money(r.premium, r.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
