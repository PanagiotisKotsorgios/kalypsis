import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface PolicyLite {
  id: string;
  policyNumber: string;
  customerDisplay: string;
  insuranceCompanyName: string;
  premium: number;
  currency: string;
}

interface ProducerDeclarationDto {
  id: string;
  policyId: string;
  policyNumber: string;
  expectedAmount: number;
  recordedAmount: number | null;
  differenceAmount: number | null;
  reconciliationStatus: "match" | "diff_small" | "diff_large" | "missing" | string;
  currency: string;
  notes: string | null;
  declaredAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  match: "Συμφωνία",
  diff_small: "Μικρή διαφορά",
  diff_large: "Διαφορά",
  missing: "Χωρίς εκκαθάριση"
};
const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  match: "success", diff_small: "warning", diff_large: "error", missing: "default"
};

/**
 * Producer-side form embedded in the producer dashboard. Lets the producer
 * pick one of their own policies, declare the expected commission, and submit.
 * The backend writes a notification to agency admins on a flagged discrepancy.
 */
export function ProducerDeclarationForm() {
  const qc = useQueryClient();
  const [policyId, setPolicyId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Producer self commissions list also exposes the producer's policies.
  const commissionsQ = useQuery({
    queryKey: ["producer-commissions"],
    queryFn: async () => (await api.get<any[]>("/producer/me/commissions")).data
  });
  // De-dup policies from the commission lines for the picker.
  const policies = useMemo(() => {
    const map = new Map<string, PolicyLite>();
    for (const l of commissionsQ.data ?? []) {
      if (!map.has(l.policyId ?? l.PolicyId)) {
        map.set(l.policyId ?? l.PolicyId, {
          id: l.policyId ?? l.PolicyId,
          policyNumber: l.policyNumber ?? l.PolicyNumber,
          customerDisplay: l.customerDisplay ?? l.CustomerDisplay ?? "",
          insuranceCompanyName: l.insuranceCompanyName ?? l.InsuranceCompanyName ?? "",
          premium: l.premium ?? l.Premium ?? 0,
          currency: "EUR"
        });
      }
    }
    return Array.from(map.values());
  }, [commissionsQ.data]);

  const declarationsQ = useQuery({
    queryKey: ["my-declarations"],
    queryFn: async () => (await api.get<ProducerDeclarationDto[]>("/producer/me/declarations")).data
  });

  const submit = useMutation({
    mutationFn: async () => {
      const value = parseFloat(amount.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) throw new Error("Μη έγκυρο ποσό.");
      if (!policyId) throw new Error("Επιλέξτε συμβόλαιο.");
      return (await api.post<ProducerDeclarationDto>("/producer/me/declarations", {
        policyId, expectedAmount: value, notes: notes.trim() || null, currency: "EUR"
      })).data;
    },
    onSuccess: () => {
      setSuccess("Η δήλωση καταχωρήθηκε. Σε περίπτωση διαφοράς ειδοποιήθηκε το γραφείο.");
      setError(null);
      setPolicyId(""); setAmount(""); setNotes("");
      void qc.invalidateQueries({ queryKey: ["my-declarations"] });
    },
    onError: (e) => { setError(extractErrorMessage(e)); setSuccess(null); }
  });

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            display: "grid", placeItems: "center",
            bgcolor: "rgba(30,167,225,0.10)", color: "secondary.main"
          }}>
            <VerifiedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800 }}>Δήλωση προμήθειας</Typography>
            <Typography variant="body2" color="text.secondary">
              Δηλώστε το ποσό που περιμένατε για ένα συμβόλαιο. Αν διαφέρει από αυτό που έχει το γραφείο, θα σταλεί ειδοποίηση για έλεγχο.
            </Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "flex-start" }}>
          <TextField
            select size="small" label="Συμβόλαιο"
            value={policyId} onChange={(e) => setPolicyId(e.target.value)}
            sx={{ flex: 1, minWidth: 280 }}
            disabled={commissionsQ.isLoading}
          >
            {commissionsQ.isLoading
              ? <MenuItem value="">Φόρτωση…</MenuItem>
              : policies.length === 0
                ? <MenuItem value="">Δεν υπάρχουν συμβόλαια</MenuItem>
                : policies.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.policyNumber} · {p.customerDisplay} · {p.insuranceCompanyName}</MenuItem>
                  ))}
          </TextField>
          <TextField
            size="small" label="Αναμενόμενο ποσό (€)"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            sx={{ width: 200 }}
            type="number"
            inputProps={{ min: 0, step: "0.01" }}
          />
          <TextField
            size="small" label="Σημείωση (προαιρετικό)"
            value={notes} onChange={(e) => setNotes(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button
            variant="contained"
            startIcon={submit.isPending ? <CircularProgress size={14} /> : <SendIcon />}
            disabled={submit.isPending || !policyId || !amount}
            onClick={() => submit.mutate()}
            sx={{ alignSelf: { md: "stretch" }, fontWeight: 700 }}
          >
            Υποβολή
          </Button>
        </Stack>

        {(declarationsQ.data ?? []).length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Προηγούμενες δηλώσεις
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ημ/νία</TableCell>
                  <TableCell>Συμβόλαιο</TableCell>
                  <TableCell align="right">Δηλωμένο</TableCell>
                  <TableCell align="right">Καταχωρημένο</TableCell>
                  <TableCell align="right">Διαφορά</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(declarationsQ.data ?? []).slice(0, 10).map(d => {
                  const statusKey = d.reconciliationStatus in STATUS_LABEL ? d.reconciliationStatus : "missing";
                  const color = STATUS_COLOR[statusKey] ?? "default";
                  return (
                    <TableRow key={d.id} hover>
                      <TableCell sx={{ color: "text.secondary" }}>{new Date(d.declaredAt).toLocaleDateString("el-GR")}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{d.policyNumber}</TableCell>
                      <TableCell align="right">{d.expectedAmount.toFixed(2)} {d.currency}</TableCell>
                      <TableCell align="right">{d.recordedAmount !== null ? `${d.recordedAmount.toFixed(2)} ${d.currency}` : "—"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: color === "default" ? "text.secondary" : `${color}.main` }}>
                        {d.differenceAmount !== null ? `${d.differenceAmount > 0 ? "+" : ""}${d.differenceAmount.toFixed(2)} ${d.currency}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={STATUS_LABEL[statusKey] ?? statusKey} color={color} variant={color === "default" ? "outlined" : "filled"} sx={{ fontWeight: 700 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
