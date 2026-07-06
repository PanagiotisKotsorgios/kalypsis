import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VerifiedIcon from "@mui/icons-material/Verified";
import ReportGmailerrorredIcon from "@mui/icons-material/ReportGmailerrorred";
import RuleIcon from "@mui/icons-material/Rule";
import DescriptionIcon from "@mui/icons-material/Description";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
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

interface RuleReconciliationDto {
  ruleId: string;
  producerId: string;
  producerName: string;
  insuranceCompanyId: string | null;
  insuranceCompanyName: string | null;
  policyType: string | null;
  vehicleUseCategory: string | null;
  coverCode: string | null;
  configuredPercent: number;
  policyCount: number;
  agencyExpectedTotal: number;
  declarationCount: number;
  producerDeclaredTotal: number;
  impliedProducerPercent: number | null;
  differenceAmount: number;
  status: "match" | "diff_small" | "diff_large" | "no_declarations" | "empty" | string;
  currency: string;
}

interface ProducerLite { id: string; code: string; name: string; }

type Mode = "rule" | "contract";

const STATUS_LABEL: Record<string, string> = {
  match: "Συμφωνία",
  diff_small: "Μικρή διαφορά",
  diff_large: "Διαφορά",
  missing: "Χωρίς εκκαθάριση",
  no_declarations: "Χωρίς δήλωση",
  empty: "Κενό"
};

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  match: "success",
  diff_small: "warning",
  diff_large: "error",
  missing: "default",
  no_declarations: "default",
  empty: "default"
};

const POLICY_TYPE_LABEL: Record<string, string> = {
  Auto: "Οχήματα",
  Home: "Κατοικία",
  Health: "Υγεία",
  Life: "Ζωή",
  Business: "Επιχείρηση",
  Travel: "Ταξίδι",
  Marine: "Μεταφορές",
  Other: "Άλλο"
};

function ruleScopeLabel(r: RuleReconciliationDto): string {
  const parts: string[] = [];
  if (r.insuranceCompanyName) parts.push(r.insuranceCompanyName);
  else parts.push("Όλες οι εταιρείες");
  if (r.policyType) parts.push(POLICY_TYPE_LABEL[r.policyType] ?? r.policyType);
  else parts.push("Όλα τα πακέτα");
  if (r.coverCode) parts.push(`Κάλυψη ${r.coverCode}`);
  if (r.vehicleUseCategory) parts.push(`Χρήση ${r.vehicleUseCategory}`);
  return parts.join(" · ");
}

export function ProducerReconciliationPage() {
  const [mode, setMode] = useState<Mode>("rule");
  const [producerId, setProducerId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [explain, setExplain] = useState<{ kind: "rule"; row: RuleReconciliationDto }
    | { kind: "contract"; row: ProducerDeclarationDto } | null>(null);

  const producersQ = useQuery({
    queryKey: ["producers-lite"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data
  });

  const contractQ = useQuery({
    queryKey: ["producer-reconciliation", producerId],
    queryFn: async () => (await api.get<ProducerDeclarationDto[]>("/producer-reconciliation", {
      params: producerId ? { producerId } : undefined
    })).data,
    enabled: mode === "contract"
  });

  const ruleQ = useQuery({
    queryKey: ["producer-reconciliation-by-rule", producerId],
    queryFn: async () => (await api.get<RuleReconciliationDto[]>("/producer-reconciliation/by-rule", {
      params: producerId ? { producerId } : undefined
    })).data,
    enabled: mode === "rule"
  });

  const contractRows = useMemo(() => {
    const all = contractQ.data ?? [];
    const s = search.trim().toLowerCase();
    return all.filter(r => {
      if (statusFilter && r.reconciliationStatus !== statusFilter) return false;
      if (s && !(r.policyNumber.toLowerCase().includes(s)
        || r.producerName.toLowerCase().includes(s)
        || (r.notes ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [contractQ.data, search, statusFilter]);

  const ruleRows = useMemo(() => {
    const all = ruleQ.data ?? [];
    const s = search.trim().toLowerCase();
    return all.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (s) {
        const bag = `${r.producerName} ${r.insuranceCompanyName ?? ""} ${r.policyType ?? ""} ${r.coverCode ?? ""}`.toLowerCase();
        if (!bag.includes(s)) return false;
      }
      return true;
    });
  }, [ruleQ.data, search, statusFilter]);

  const flaggedRule = ruleRows.filter(r => r.status === "diff_large" || r.status === "diff_small").length;
  const flaggedContract = contractRows.filter(r => r.reconciliationStatus === "diff_large" || r.reconciliationStatus === "missing").length;
  const flagged = mode === "rule" ? flaggedRule : flaggedContract;

  const q = mode === "rule" ? ruleQ : contractQ;

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
              {mode === "rule"
                ? "Σύγκριση παραμετροποίησης προμηθειών ανά συνεργάτη × εταιρεία × πακέτο έναντι των δηλώσεων του συνεργάτη."
                : "Ανάλυση δήλωση-προς-δήλωση: κάθε συμβόλαιο ξεχωριστά με ζωντανό υπολογισμό από την παραμετροποίηση."}
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
            <ToggleButtonGroup
              value={mode}
              exclusive
              size="small"
              onChange={(_e, v) => v && setMode(v)}
              sx={{ mr: { md: 1 } }}
            >
              <ToggleButton value="rule" sx={{ px: 1.5, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}>
                <RuleIcon fontSize="small" sx={{ mr: 0.75 }} />
                Ανά παραμετροποίηση
              </ToggleButton>
              <ToggleButton value="contract" sx={{ px: 1.5, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}>
                <DescriptionIcon fontSize="small" sx={{ mr: 0.75 }} />
                Ανά συμβόλαιο
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              placeholder={mode === "rule"
                ? "Αναζήτηση σε συνεργάτη, εταιρεία, πακέτο, κάλυψη…"
                : "Αναζήτηση σε συμβόλαιο, συνεργάτη, σημείωση…"}
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
              {Object.entries(STATUS_LABEL)
                .filter(([k]) => mode === "rule"
                  ? ["match", "diff_small", "diff_large", "no_declarations", "empty"].includes(k)
                  : ["match", "diff_small", "diff_large", "missing"].includes(k))
                .map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
            </SearchableTextField>
          </Stack>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : q.isError ? (
        <Alert severity="error">Αδυναμία φόρτωσης δεδομένων.</Alert>
      ) : (mode === "rule" ? ruleRows.length === 0 : contractRows.length === 0) ? (
        <Card variant="outlined">
          <CardContent sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <VerifiedIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1 }} />
            <Typography>
              {mode === "rule"
                ? "Δεν υπάρχει παραμετροποίηση προμηθειών για συνεργάτη. Ρυθμίστε κανόνες στη «Παραμετροποίηση Προμηθειών»."
                : "Δεν υπάρχουν δηλώσεις με αυτά τα κριτήρια."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {flagged > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <b>Υπάρχουν {flagged} γραμμές προς έλεγχο.</b>{" "}
              {mode === "rule"
                ? "Πατήστε το εικονίδιο ⓘ σε κάθε γραμμή για αναλυτική επεξήγηση της διαφοράς και τι να πείτε στον συνεργάτη."
                : "Πατήστε το εικονίδιο ⓘ για αναλυτική επεξήγηση κάθε διαφοράς."}
            </Alert>
          )}
          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            {mode === "rule" ? (
              <RuleTable rows={ruleRows} onExplain={(row) => setExplain({ kind: "rule", row })} />
            ) : (
              <ContractTable rows={contractRows} onExplain={(row) => setExplain({ kind: "contract", row })} />
            )}
          </Card>
        </>
      )}

      <ExplainDialog open={!!explain} data={explain} onClose={() => setExplain(null)} />
    </Box>
  );
}

// ────────────────────────── Rule (aggregate) view ─────────────────────────

function RuleTable({ rows, onExplain }: {
  rows: RuleReconciliationDto[];
  onExplain: (r: RuleReconciliationDto) => void;
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Συνεργάτης</TableCell>
          <TableCell>Παραμετροποίηση</TableCell>
          <TableCell align="right">Ρυθμιστ. %</TableCell>
          <TableCell align="right">Δηλωμένο (συν.)</TableCell>
          <TableCell align="right">Γραφείο (συν.)</TableCell>
          <TableCell align="right">Διαφορά</TableCell>
          <TableCell>Κατάσταση</TableCell>
          <TableCell align="center">Επεξήγηση</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(r => {
          const statusKey = r.status;
          const color = STATUS_COLOR[statusKey] ?? "default";
          return (
            <TableRow key={`${r.ruleId}-${r.producerId}`} hover>
              <TableCell><Typography fontWeight={700}>{r.producerName}</Typography></TableCell>
              <TableCell>
                <Typography variant="body2">{ruleScopeLabel(r)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {r.policyCount} συμβόλαια · {r.declarationCount} δηλώσεις
                </Typography>
              </TableCell>
              <TableCell align="right"><Typography fontWeight={700}>{r.configuredPercent}%</Typography></TableCell>
              <TableCell align="right">
                <Typography fontWeight={700}>{money(r.producerDeclaredTotal, r.currency)}</Typography>
                {r.impliedProducerPercent !== null && (
                  <Typography variant="caption" color="text.secondary">≈ {r.impliedProducerPercent}%</Typography>
                )}
              </TableCell>
              <TableCell align="right"><Typography fontWeight={700}>{money(r.agencyExpectedTotal, r.currency)}</Typography></TableCell>
              <TableCell align="right">
                <Typography fontWeight={800} color={color === "default" ? "text.secondary" : `${color}.main`}>
                  {r.differenceAmount > 0 ? "+" : ""}{money(r.differenceAmount, r.currency)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip size="small" label={STATUS_LABEL[statusKey] ?? statusKey} color={color} variant={color === "default" ? "outlined" : "filled"} sx={{ fontWeight: 700 }} />
              </TableCell>
              <TableCell align="center">
                <IconButton size="small" onClick={() => onExplain(r)}>
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ────────────────────────── Contract (per-row) view ───────────────────────

function ContractTable({ rows, onExplain }: {
  rows: ProducerDeclarationDto[];
  onExplain: (r: ProducerDeclarationDto) => void;
}) {
  return (
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
          <TableCell align="center">Επεξήγηση</TableCell>
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
              <TableCell align="center">
                <IconButton size="small" onClick={() => onExplain(r)}>
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ────────────────────────── Explain dialog ────────────────────────────────

function ExplainDialog({ open, data, onClose }: {
  open: boolean;
  data: { kind: "rule"; row: RuleReconciliationDto } | { kind: "contract"; row: ProducerDeclarationDto } | null;
  onClose: () => void;
}) {
  if (!data) return <Dialog open={open} onClose={onClose} />;
  const isMatch = data.kind === "rule"
    ? data.row.status === "match"
    : data.row.reconciliationStatus === "match";
  const isMissing = data.kind === "rule"
    ? data.row.status === "no_declarations" || data.row.status === "empty"
    : data.row.reconciliationStatus === "missing";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Ανάλυση διαφοράς
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {data.kind === "rule" ? <RuleExplain row={data.row} /> : <ContractExplain row={data.row} />}
        <Divider sx={{ my: 2 }} />
        {isMatch ? (
          <Alert severity="success">
            Όλα σωστά — η παραμετροποίησή σας δίνει ακριβώς το ποσό που δηλώνει ο συνεργάτης.
          </Alert>
        ) : isMissing ? (
          <Alert severity="info">
            Δεν υπάρχουν αντίστοιχες δηλώσεις για αυτή την παραμετροποίηση. Είτε ο συνεργάτης δεν έχει καταχωρήσει
            ακόμα τι περιμένει, είτε δεν υπάρχει ενεργό συμβόλαιο σε αυτό το scope.
          </Alert>
        ) : (
          <Alert severity="warning">
            <b>Υπάρχει απόκλιση.</b> Είτε ο συνεργάτης νομίζει ότι δικαιούται διαφορετική προμήθεια απ' ό,τι λέει η
            σύμβασή σας, είτε η παραμετροποίηση προμηθειών του γραφείου χρειάζεται ενημέρωση. Ξεκινήστε με μια
            συζήτηση: ελέγξτε τη σύμβασή σας, βεβαιωθείτε ότι το ποσοστό στην παραμετροποίηση αντικατοπτρίζει
            πράγματι τη συμφωνία, και αν χρειάζεται, αναπροσαρμόστε το.
          </Alert>
        )}
        <Button fullWidth variant="contained" onClick={onClose} sx={{ mt: 2 }}>
          Κατάλαβα
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function RuleExplain({ row: r }: { row: RuleReconciliationDto }) {
  return (
    <Stack spacing={1.5}>
      <ExplainRow label="Συνεργάτης" value={r.producerName} />
      <ExplainRow label="Παραμετροποίηση" value={ruleScopeLabel(r)} />
      <Divider />
      <Typography variant="body2">
        Η παραμετροποίηση του γραφείου σας ορίζει για αυτόν τον συνεργάτη προμήθεια
        {" "}<b>{r.configuredPercent}%</b>. Πάνω σε <b>{r.policyCount} ενεργά συμβόλαια</b> που πέφτουν σε
        αυτό το scope, το γραφείο υπολογίζει συνολική προμήθεια <b>{money(r.agencyExpectedTotal, r.currency)}</b>.
      </Typography>
      <Typography variant="body2">
        Ο συνεργάτης έχει δηλώσει σε <b>{r.declarationCount} δηλώσεις</b> ότι αναμένει συνολικά
        {" "}<b>{money(r.producerDeclaredTotal, r.currency)}</b>
        {r.impliedProducerPercent !== null && (<> — δηλαδή θεωρεί πως δικαιούται περίπου <b>{r.impliedProducerPercent}%</b></>)}.
      </Typography>
      <Typography variant="body2" fontWeight={800}
        color={Math.abs(r.differenceAmount) < 0.01 ? "success.main" : "warning.main"}>
        Διαφορά: {r.differenceAmount > 0 ? "+" : ""}{money(r.differenceAmount, r.currency)}
      </Typography>
    </Stack>
  );
}

function ContractExplain({ row: r }: { row: ProducerDeclarationDto }) {
  return (
    <Stack spacing={1.5}>
      <ExplainRow label="Συνεργάτης" value={r.producerName} />
      <ExplainRow label="Συμβόλαιο" value={r.policyNumber} mono />
      <ExplainRow label="Ημ/νία δήλωσης" value={date(r.declaredAt)} />
      <Divider />
      <Typography variant="body2">
        Ο συνεργάτης δήλωσε ότι αναμένει προμήθεια <b>{money(r.expectedAmount, r.currency)}</b>
        {r.expectedPercent !== null && (<> (≈ <b>{r.expectedPercent}%</b>)</>)}.
      </Typography>
      <Typography variant="body2">
        Η παραμετροποίηση του γραφείου σας για αυτό το συμβόλαιο δίνει
        {" "}<b>{r.recordedAmount !== null ? money(r.recordedAmount, r.currency) : "—"}</b>.
      </Typography>
      <Typography variant="body2" fontWeight={800}
        color={(r.differenceAmount ?? 0) === 0 ? "success.main" : "warning.main"}>
        Διαφορά: {r.differenceAmount !== null
          ? `${r.differenceAmount > 0 ? "+" : ""}${money(r.differenceAmount, r.currency)}`
          : "—"}
      </Typography>
      {r.notes && (
        <>
          <Divider />
          <Typography variant="caption" color="text.secondary">Σημείωση συνεργάτη:</Typography>
          <Typography variant="body2" fontStyle="italic">«{r.notes}»</Typography>
        </>
      )}
    </Stack>
  );
}

function ExplainRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack direction="row" spacing={2} alignItems="baseline">
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={mono ? { fontFamily: "monospace" } : undefined}>
        {value}
      </Typography>
    </Stack>
  );
}
