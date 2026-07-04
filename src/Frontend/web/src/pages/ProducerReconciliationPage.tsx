import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
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
import SearchIcon from "@mui/icons-material/Search";
import VerifiedIcon from "@mui/icons-material/Verified";
import ReportGmailerrorredIcon from "@mui/icons-material/ReportGmailerrorred";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { DataExportButton } from "../components/DataExportButton";
import { money, date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

interface ProducerDeclarationDto {
  id: string;
  policyId: string;
  policyNumber: string;
  producerId: string;
  producerName: string;
  expectedAmount: number;
  expectedPercent: number | null;
  recordedAmount: number | null;
  differenceAmount: number | null;
  reconciliationStatus: "match" | "diff_small" | "diff_large" | "missing" | string;
  currency: string;
  notes: string | null;
  declaredAt: string;
}

interface ProducerLite { id: string; code: string; name: string; }

const STATUS_LABEL: Record<string, string> = {
  match: "Συμφωνία",
  diff_small: "Μικρή διαφορά",
  diff_large: "Διαφορά",
  missing: "Χωρίς εκκαθάριση"
};

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  match: "success",
  diff_small: "warning",
  diff_large: "error",
  missing: "default"
};

/**
 * AgencyAdmin/staff view of producer reconciliation declarations. Shows each
 * declaration with the diff vs the recorded CommissionRunLine and a status chip
 * so the office can triage discrepancies quickly. Premium-gated by the page
 * route wrapper.
 */
export function ProducerReconciliationPage() {
  const [producerId, setProducerId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const producersQ = useQuery({
    queryKey: ["producers-lite"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data
  });

  const q = useQuery({
    queryKey: ["producer-reconciliation", producerId],
    queryFn: async () => (await api.get<ProducerDeclarationDto[]>("/producer-reconciliation", {
      params: producerId ? { producerId } : undefined
    })).data
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const s = search.trim().toLowerCase();
    return all.filter(r => {
      if (statusFilter && r.reconciliationStatus !== statusFilter) return false;
      if (s && !(r.policyNumber.toLowerCase().includes(s)
        || r.producerName.toLowerCase().includes(s)
        || (r.notes ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [q.data, search, statusFilter]);

  const flagged = rows.filter(r => r.reconciliationStatus === "diff_large" || r.reconciliationStatus === "missing").length;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            display: "grid", placeItems: "center",
            bgcolor: "rgba(30,167,225,0.10)", color: "secondary.main",
            border: "1px solid rgba(30,167,225,0.22)"
          }}>
            <VerifiedIcon />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Ταυτοποίηση Συνεργατών</Typography>
            <Typography color="text.secondary">
              Δηλώσεις συνεργατών για αναμενόμενες προμήθειες, με ζωντανή σύγκριση έναντι της παραμετροποίησης προμηθειών του γραφείου
              (ίδιος υπολογισμός με τις Λίστες Παραγωγής).
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {flagged > 0 && (
            <Chip
              icon={<ReportGmailerrorredIcon />}
              color="error"
              label={`${flagged} προς έλεγχο`}
              sx={{ fontWeight: 800 }}
            />
          )}
          <DataExportButton entity="producers" />
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              placeholder="Αναζήτηση σε συμβόλαιο, συνεργάτη, σημείωση…"
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <SearchableTextField
              select size="small" label="Συνεργάτης"
              value={producerId} onChange={(e) => setProducerId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Όλοι</MenuItem>
              {(producersQ.data ?? []).map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </SearchableTextField>
            <SearchableTextField
              select size="small" label="Κατάσταση"
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Όλες</MenuItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </SearchableTextField>
          </Stack>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : q.isError ? (
        <Alert severity="error">Αδυναμία φόρτωσης δηλώσεων.</Alert>
      ) : rows.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <VerifiedIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1 }} />
            <Typography>Δεν υπάρχουν δηλώσεις με αυτά τα κριτήρια.</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {flagged > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <b>Υπάρχουν {flagged} δηλώσεις προς έλεγχο.</b>{" "}
              Οι γραμμές με «Διαφορά» εμφανίζουν μη-μηδενική διαφορά μεταξύ αυτού που δηλώνει ο συνεργάτης και του
              υπολογισμού του γραφείου. Επικοινωνήστε με τον συνεργάτη, ελέγξτε τη σύμβασή σας ή προσαρμόστε την
              παραμετροποίηση προμηθειών.
            </Alert>
          )}
          <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ημ/νία</TableCell>
                <TableCell>Συνεργάτης</TableCell>
                <TableCell>Συμβόλαιο</TableCell>
                <TableCell align="right">Δηλωμένο (συνεργάτης)</TableCell>
                <TableCell align="right">Παραμετροποίηση (γραφείο)</TableCell>
                <TableCell align="right">Διαφορά</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell>Ενέργεια</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => {
                const statusKey = r.reconciliationStatus in STATUS_LABEL ? r.reconciliationStatus : "missing";
                const color = STATUS_COLOR[statusKey] ?? "default";
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                      {date(r.declaredAt)}
                    </TableCell>
                    <TableCell><Typography fontWeight={700}>{r.producerName}</Typography></TableCell>
                    <TableCell><Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</Typography></TableCell>
                    <TableCell align="right"><Typography fontWeight={700}>{money(r.expectedAmount, r.currency)}</Typography></TableCell>
                    <TableCell align="right">
                      {r.recordedAmount !== null
                        ? <Typography>{money(r.recordedAmount, r.currency)}</Typography>
                        : <Typography color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      {r.differenceAmount !== null
                        ? <Typography fontWeight={800} color={color === "default" ? "text.secondary" : `${color}.main`}>
                            {r.differenceAmount > 0 ? "+" : ""}{money(r.differenceAmount, r.currency)}
                          </Typography>
                        : <Typography color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_LABEL[statusKey] ?? statusKey} color={color} variant={color === "default" ? "outlined" : "filled"} sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", maxWidth: 260 }}>
                      {statusKey === "match" ? (
                        <Typography variant="caption" color="success.main" fontWeight={700}>
                          Συμφωνεί με τη σύμβαση.
                        </Typography>
                      ) : statusKey === "missing" ? (
                        <Typography variant="caption" color="text.secondary">
                          Δεν υπάρχει κανόνας προμήθειας για αυτό το συμβόλαιο — προσθέστε τον από «Παραμετροποίηση Προμηθειών».
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="warning.main" fontWeight={700}>
                          Επικοινωνία με τον συνεργάτη ή αναθεώρηση της σύμβασής σας — η παραμετροποίηση δίνει διαφορετικό αποτέλεσμα.
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
        </>
      )}
    </Box>
  );
}
