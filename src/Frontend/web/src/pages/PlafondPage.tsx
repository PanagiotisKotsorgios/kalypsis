import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import AddIcon from "@mui/icons-material/Add";
import SavingsIcon from "@mui/icons-material/Savings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type Regime = "TypoPlirono" | "PlironoTypono" | "Koumparas";

interface PlafondDto {
  id: string;
  producerId: string;
  regime: Regime;
  creditLimit: number;
  currentBalance: number;
  graceDays: number;
  isLocked: boolean;
  lockedAt: string | null;
  lockReason: string | null;
}
interface ProducerLite { id: string; code: string; name: string; }

const REGIME_LABELS: Record<Regime, string> = {
  TypoPlirono: "Τυπώνω-Πληρώνω",
  PlironoTypono: "Πληρώνω-Τυπώνω",
  Koumparas: "Κουμπαράς"
};

export function PlafondPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState<PlafondDto | null>(null);

  const plafonds = useQuery({
    queryKey: ["plafonds"],
    queryFn: async () => (await api.get<PlafondDto[]>("/plafond")).data
  });
  const producers = useQuery({
    queryKey: ["producers-for-plafond"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data
  });

  const lock = useMutation({
    mutationFn: async (vars: { producerId: string; reason: string }) =>
      api.post(`/plafond/${vars.producerId}/lock?reason=${encodeURIComponent(vars.reason)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["plafonds"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const unlock = useMutation({
    mutationFn: async (producerId: string) => api.post(`/plafond/${producerId}/unlock`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["plafonds"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const producerName = (id: string) =>
    (producers.data ?? []).find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AccountBalanceWalletIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Πλαφόν συνεργατών</Typography>
            <Typography color="text.secondary">
              Καθεστώτα Τ-Π / Π-Τ / Κουμπαράς, όρια πίστωσης, και αυτόματο κλείδωμα όταν υπερβαίνεται.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setConfigureOpen(true)}>
          Διαμόρφωση πλαφόν
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {plafonds.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Συνεργάτης</TableCell>
                <TableCell>Καθεστώς</TableCell>
                <TableCell align="right">Όριο πίστωσης</TableCell>
                <TableCell align="right">Τρέχον υπόλοιπο</TableCell>
                <TableCell>Χρήση</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(plafonds.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Κανένα πλαφόν διαμορφωμένο.
                </TableCell></TableRow>
              )}
              {(plafonds.data ?? []).map((p) => {
                const usage = p.creditLimit === 0 ? 0
                  : Math.min(100, Math.max(0, (-p.currentBalance / p.creditLimit) * 100));
                const balanceColor = p.currentBalance < 0 ? "error.main" : "success.main";
                return (
                  <TableRow key={p.id} hover>
                    <TableCell><Typography fontWeight={600}>{producerName(p.producerId)}</Typography></TableCell>
                    <TableCell><Chip size="small" label={REGIME_LABELS[p.regime]} /></TableCell>
                    <TableCell align="right">{p.creditLimit.toFixed(2)} €</TableCell>
                    <TableCell align="right" sx={{ color: balanceColor, fontWeight: 700 }}>
                      {p.currentBalance.toFixed(2)} €
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <LinearProgress variant="determinate" value={usage}
                        color={usage > 80 ? "error" : usage > 50 ? "warning" : "success"}
                        sx={{ height: 6, borderRadius: 3 }} />
                      <Typography variant="caption" color="text.secondary">{usage.toFixed(0)}%</Typography>
                    </TableCell>
                    <TableCell>
                      {p.isLocked ? (
                        <Chip size="small" color="error" icon={<LockIcon />} label={p.lockReason ?? "Κλειδωμένο"} />
                      ) : (
                        <Chip size="small" color="success" label="Ενεργό" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {p.regime === "Koumparas" && (
                        <IconButton size="small" title="Κατάθεση" onClick={() => setTopupOpen(p)}>
                          <SavingsIcon fontSize="small" />
                        </IconButton>
                      )}
                      {p.isLocked ? (
                        <IconButton size="small" color="success" title="Ξεκλείδωμα" onClick={() => unlock.mutate(p.producerId)}>
                          <LockOpenIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton size="small" color="error" title="Κλείδωμα" onClick={() => {
                          const reason = prompt("Λόγος κλειδώματος;") || "Manual lock";
                          lock.mutate({ producerId: p.producerId, reason });
                        }}>
                          <LockIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfigureDialog open={configureOpen} onClose={() => setConfigureOpen(false)} producers={producers.data ?? []}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["plafonds"] }); setConfigureOpen(false); }} />

      {topupOpen && (
        <TopupDialog plafond={topupOpen} producerName={producerName(topupOpen.producerId)}
          onClose={() => setTopupOpen(null)}
          onSaved={() => { void qc.invalidateQueries({ queryKey: ["plafonds"] }); setTopupOpen(null); }} />
      )}
    </Box>
  );
}

function ConfigureDialog({ open, onClose, producers, onSaved }: {
  open: boolean; onClose: () => void; producers: ProducerLite[]; onSaved: () => void;
}) {
  const [producerId, setProducerId] = useState("");
  const [regime, setRegime] = useState<Regime>("TypoPlirono");
  const [creditLimit, setCreditLimit] = useState(0);
  const [graceDays, setGraceDays] = useState(15);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => api.post("/plafond/configure", { producerId, regime, creditLimit: Number(creditLimit), graceDays: Number(graceDays) }),
    onSuccess: () => { setProducerId(""); setCreditLimit(0); onSaved(); },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Διαμόρφωση πλαφόν συνεργάτη</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField select label="Συνεργάτης" fullWidth value={producerId} onChange={(e) => setProducerId(e.target.value)}>
            {producers.map((p) => <MenuItem key={p.id} value={p.id}>{p.code} · {p.name}</MenuItem>)}
          </TextField>
          <TextField select label="Καθεστώς" fullWidth value={regime} onChange={(e) => setRegime(e.target.value as Regime)}>
            <MenuItem value="TypoPlirono">Τυπώνω-Πληρώνω (πίστωση)</MenuItem>
            <MenuItem value="PlironoTypono">Πληρώνω-Τυπώνω (προπληρωμή ανά συμβόλαιο)</MenuItem>
            <MenuItem value="Koumparas">Κουμπαράς (συνολική προπληρωμή)</MenuItem>
          </TextField>
          <TextField type="number" label="Όριο πίστωσης (€)" fullWidth value={creditLimit}
            onChange={(e) => setCreditLimit(Number(e.target.value))} />
          <TextField type="number" label="Ημέρες χάριτος" fullWidth value={graceDays}
            onChange={(e) => setGraceDays(Number(e.target.value))} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !producerId} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TopupDialog({ plafond, producerName, onClose, onSaved }: {
  plafond: PlafondDto; producerName: string; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const topup = useMutation({
    mutationFn: async () => api.post("/plafond/topup", { producerId: plafond.producerId, amount: Number(amount), reference }),
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>Κατάθεση στον κουμπαρά — {producerName}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField type="number" label="Ποσό (€)" fullWidth value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <TextField label="Αναφορά / αρ. απόδειξης" fullWidth value={reference} onChange={(e) => setReference(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={topup.isPending || amount <= 0} onClick={() => topup.mutate()}>
          {topup.isPending ? <CircularProgress size={18} /> : "Κατάθεση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
