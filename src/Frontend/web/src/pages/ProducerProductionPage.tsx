import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { date, money, num } from "../utils/format";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type PolicyStatus = "Draft" | "Active" | "Expired" | "Cancelled" | "Renewed" | "PendingRenewal" | "Undelivered" | "AwaitingIssue";

interface ProductionRow {
  policyId: string;
  policyNumber: string;
  customerName: string;
  insuranceCompanyName: string;
  policyType: PolicyType;
  status: PolicyStatus;
  startDate: string;
  endDate: string;
  premium: number;
  hasCommissionEstimate: boolean;
  commissionRatePercent: number;
  expectedGrossCommission: number;
  taxWithholding: number;
  expectedNetCommission: number;
}

interface ProducerProduction {
  year: number;
  month: number;
  policyCount: number;
  totalPremium: number;
  expectedGrossCommission: number;
  totalTaxWithholding: number;
  expectedNetCommission: number;
  rows: ProductionRow[];
}

const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];

const TYPES: Array<{ value: PolicyType; label: string }> = [
  { value: "Auto", label: "Αυτοκίνητο" },
  { value: "Home", label: "Κατοικία" },
  { value: "Health", label: "Υγείας" },
  { value: "Life", label: "Ζωής" },
  { value: "Business", label: "Επιχείρησης" },
  { value: "Travel", label: "Ταξιδιού" },
  { value: "Other", label: "Άλλο" },
];

const STATUSES: Array<{ value: PolicyStatus; label: string }> = [
  { value: "Draft", label: "Πρόχειρο" },
  { value: "Active", label: "Ενεργό" },
  { value: "Expired", label: "Έληξε" },
  { value: "Cancelled", label: "Ακυρωμένο" },
  { value: "Renewed", label: "Ανανεώθηκε" },
  { value: "PendingRenewal", label: "Προς ανανέωση" },
  { value: "Undelivered", label: "Απαράδοτο" },
  { value: "AwaitingIssue", label: "Αναμονή έκδοσης" },
];

function statusLabel(status: PolicyStatus) {
  return STATUSES.find(x => x.value === status)?.label ?? status;
}

function statusColor(status: PolicyStatus): "default" | "success" | "warning" | "error" | "info" {
  if (status === "Active") return "success";
  if (status === "Cancelled") return "error";
  if (status === "PendingRenewal" || status === "Undelivered" || status === "AwaitingIssue") return "warning";
  if (status === "Renewed") return "info";
  return "default";
}

function policyTypeLabel(type: PolicyType) {
  return TYPES.find(x => x.value === type)?.label ?? type;
}

export function ProducerProductionPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [policyType, setPolicyType] = useState<PolicyType | "">("");
  const [status, setStatus] = useState<PolicyStatus | "">("");

  const production = useQuery({
    queryKey: ["producer-self-production", year, month, policyType, status],
    queryFn: async () => (await api.get<ProducerProduction>("/producer/me/production", {
      params: {
        year,
        month,
        ...(policyType ? { policyType } : {}),
        ...(status ? { status } : {}),
      },
    })).data,
  });

  const data = production.data;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>Λίστα παραγωγής μου</Typography>
        <Typography color="text.secondary">
          Τα συμβόλαια που το γραφείο έχει συνδέσει με εσάς, με την αναμενόμενη καθαρή προμήθειά σας.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Βλέπετε μόνο τα δικά σας συμβόλαια. Τα ποσά προκύπτουν από την προμήθεια που έχει ορίσει το γραφείο για κάθε συμβόλαιο· η τελική εκκαθάριση μπορεί να διαφέρει.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              select
              size="small"
              label="Μήνας έναρξης"
              value={month}
              onChange={event => setMonth(Number(event.target.value))}
              sx={{ minWidth: 175 }}
            >
              {MONTHS.map((name, index) => <MenuItem key={name} value={index + 1}>{name}</MenuItem>)}
            </TextField>
            <TextField
              size="small"
              label="Έτος"
              type="number"
              value={year}
              onChange={event => setYear(Number(event.target.value) || today.getFullYear())}
              inputProps={{ min: 2000, max: 2100 }}
              sx={{ width: 120 }}
            />
            <TextField
              select
              size="small"
              label="Κλάδος"
              value={policyType}
              onChange={event => setPolicyType(event.target.value as PolicyType | "")}
              sx={{ minWidth: 165 }}
            >
              <MenuItem value="">Όλοι οι κλάδοι</MenuItem>
              {TYPES.map(type => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Κατάσταση"
              value={status}
              onChange={event => setStatus(event.target.value as PolicyStatus | "")}
              sx={{ minWidth: 175 }}
            >
              <MenuItem value="">Όλες οι καταστάσεις</MenuItem>
              {STATUSES.map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {production.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : production.isError ? (
        <Alert severity="error">{extractErrorMessage(production.error, "Δεν ήταν δυνατή η φόρτωση της παραγωγής σας.")}</Alert>
      ) : data && (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, mb: 3 }}>
            <Kpi label="Συμβόλαια" value={num(data.policyCount)} />
            <Kpi label="Ασφάλιστρα" value={money(data.totalPremium)} />
            <Kpi label="Μικτή προμήθεια" value={money(data.expectedGrossCommission)} />
            <Kpi label="Παρακράτηση" value={money(data.totalTaxWithholding)} />
            <Kpi label="Καθαρά αναμενόμενα" value={money(data.expectedNetCommission)} emphasis />
          </Box>

          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2} flexWrap="wrap" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>Συμβόλαια {MONTHS[(data.month || month) - 1]} {data.year || year}</Typography>
                  <Typography variant="body2" color="text.secondary">Η περίοδος φιλτράρει με βάση την ημερομηνία έναρξης του συμβολαίου.</Typography>
                  <Typography variant="caption" color="text.secondary">Μικτά = το ποσοστό σας επί των καθαρών ασφαλίστρων. Η παρακράτηση είναι ο φόρος επί της προμήθειας και τα καθαρά είναι το ποσό που αναμένεται να λάβετε.</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">Ποσοστά και ποσά είναι μόνο δικά σας.</Typography>
              </Stack>

              {data.rows.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={5}>Δεν υπάρχουν δικά σας συμβόλαια για τα επιλεγμένα φίλτρα.</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: "calc(100vh - 330px)" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Συμβόλαιο</TableCell>
                        <TableCell>Έναρξη</TableCell>
                        <TableCell>Πελάτης</TableCell>
                        <TableCell>Ασφαλιστική</TableCell>
                        <TableCell>Κλάδος</TableCell>
                        <TableCell>Κατάσταση</TableCell>
                        <TableCell align="right">Ασφάλιστρο</TableCell>
                        <TableCell align="right">Ποσοστό</TableCell>
                        <TableCell align="right">Μικτά</TableCell>
                        <TableCell align="right">Παρακράτηση</TableCell>
                        <TableCell align="right">Καθαρά</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.rows.map(row => (
                        <TableRow key={row.policyId} hover>
                          <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{row.policyNumber}</TableCell>
                          <TableCell>{date(row.startDate)}</TableCell>
                          <TableCell>{row.customerName}</TableCell>
                          <TableCell>{row.insuranceCompanyName}</TableCell>
                          <TableCell>{policyTypeLabel(row.policyType)}</TableCell>
                          <TableCell><Chip size="small" label={statusLabel(row.status)} color={statusColor(row.status)} /></TableCell>
                          <TableCell align="right">{money(row.premium)}</TableCell>
                          {row.hasCommissionEstimate ? (
                            <>
                              <TableCell align="right">{num(row.commissionRatePercent)}%</TableCell>
                              <TableCell align="right">{money(row.expectedGrossCommission)}</TableCell>
                              <TableCell align="right">{money(row.taxWithholding)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: "primary.main" }}>{money(row.expectedNetCommission)}</TableCell>
                            </>
                          ) : (
                            <TableCell colSpan={4} align="center">
                              <Chip size="small" label="Δεν έχει οριστεί προμήθεια από το γραφείο" variant="outlined" color="warning" />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}

function Kpi({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card sx={emphasis ? { border: "1px solid", borderColor: "primary.light" } : undefined}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.7 }}>{label}</Typography>
        <Typography variant="h5" fontWeight={800} color={emphasis ? "primary.main" : undefined}>{value}</Typography>
      </CardContent>
    </Card>
  );
}
