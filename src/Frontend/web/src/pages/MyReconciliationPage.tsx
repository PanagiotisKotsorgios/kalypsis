import { useState } from "react";
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, Dialog, DialogContent,
  DialogTitle, Divider, IconButton, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography
} from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ReportGmailerrorredIcon from "@mui/icons-material/ReportGmailerrorred";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { money } from "../utils/format";

interface ComparisonRow {
  insuranceCompanyId: string | null;
  insuranceCompanyName: string;
  policyType: string | null;
  vehicleUseCategory: string | null;
  myExpectedPercent: number | null;
  agencyConfiguredPercent: number | null;
  policyCount: number;
  policiesPremiumTotal: number;
  myExpectedAmount: number;
  agencyExpectedAmount: number;
  differenceAmount: number;
  status: "match" | "diff_small" | "diff_large" | "no_mine" | "no_agency" | string;
}

const POLICY_TYPE_LABEL: Record<string, string> = {
  Auto: "Οχήματα", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Marine: "Μεταφορές", Other: "Άλλο"
};

const STATUS_LABEL: Record<string, string> = {
  match: "Συμφωνία",
  diff_small: "Μικρή διαφορά",
  diff_large: "Διαφορά",
  no_mine: "Χωρίς δική μου παραμ.",
  no_agency: "Χωρίς παραμ. γραφείου"
};
const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  match: "success",
  diff_small: "warning",
  diff_large: "error",
  no_mine: "default",
  no_agency: "default"
};

/** Producer-facing reconciliation view: their «παραμετροποίηση προμηθειών» vs
 * the agency's CommissionRules. Every row is one (Company × Package × Vehicle
 * use) key that at least one side has declared for. Row-level ⓘ opens a Greek
 * explanation of what the numbers mean and what to do next. */
export function MyReconciliationPage() {
  const [explain, setExplain] = useState<ComparisonRow | null>(null);

  const q = useQuery({
    queryKey: ["my-rate-comparison"],
    queryFn: async () => (await api.get<ComparisonRow[]>("/producer-portal/rate-comparison")).data
  });

  const rows = q.data ?? [];
  const flagged = rows.filter(r => r.status === "diff_large" || r.status === "diff_small").length;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5, display: "grid", placeItems: "center",
            bgcolor: "rgba(30,167,225,0.10)", color: "secondary.main",
            border: "1px solid rgba(30,167,225,0.22)"
          }}>
            <CompareArrowsIcon />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Σύγκριση με γραφείο</Typography>
            <Typography color="text.secondary">
              Ζωντανή αντιπαραβολή της παραμετροποίησής σας έναντι της παραμετροποίησης προμηθειών του γραφείου σας,
              ανά εταιρεία και πακέτο.
            </Typography>
          </Box>
        </Stack>
        {flagged > 0 && (
          <Chip icon={<ReportGmailerrorredIcon />} color="error"
            label={`${flagged} προς έλεγχο`} sx={{ fontWeight: 800 }} />
        )}
      </Stack>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <CompareArrowsIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1 }} />
            <Typography>Δεν υπάρχει ακόμα παραμετροποίηση για σύγκριση.</Typography>
            <Typography variant="body2" mt={1}>
              Καταχωρήστε τα ποσοστά που δικαιούστε στη σελίδα «Παραμετροποίηση Προμηθειών μου».
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {flagged > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <b>Υπάρχουν {flagged} διαφορές.</b>{" "}
              Πατήστε το εικονίδιο ⓘ σε κάθε γραμμή για αναλυτική επεξήγηση και τι να πείτε στο γραφείο σας.
            </Alert>
          )}
          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Εταιρεία</TableCell>
                  <TableCell>Πακέτο</TableCell>
                  <TableCell align="right">Δικό μου %</TableCell>
                  <TableCell align="right">Γραφείο %</TableCell>
                  <TableCell align="right">Συμβόλαια</TableCell>
                  <TableCell align="right">Δικό μου (€)</TableCell>
                  <TableCell align="right">Γραφείο (€)</TableCell>
                  <TableCell align="right">Διαφορά</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                  <TableCell align="center">Επεξήγηση</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => {
                  const color = STATUS_COLOR[r.status] ?? "default";
                  return (
                    <TableRow key={i} hover>
                      <TableCell><Typography fontWeight={700}>{r.insuranceCompanyName}</Typography></TableCell>
                      <TableCell>{r.policyType ? (POLICY_TYPE_LABEL[r.policyType] ?? r.policyType) : "Όλα"}</TableCell>
                      <TableCell align="right">
                        {r.myExpectedPercent !== null
                          ? <Typography fontWeight={700} color="secondary.main">{r.myExpectedPercent}%</Typography>
                          : <Typography color="text.secondary">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        {r.agencyConfiguredPercent !== null
                          ? <Typography fontWeight={700}>{r.agencyConfiguredPercent}%</Typography>
                          : <Typography color="text.secondary">—</Typography>}
                      </TableCell>
                      <TableCell align="right">{r.policyCount}</TableCell>
                      <TableCell align="right"><Typography>{money(r.myExpectedAmount, "EUR")}</Typography></TableCell>
                      <TableCell align="right"><Typography>{money(r.agencyExpectedAmount, "EUR")}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={800} color={color === "default" ? "text.secondary" : `${color}.main`}>
                          {r.differenceAmount > 0 ? "+" : ""}{money(r.differenceAmount, "EUR")}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={color} variant={color === "default" ? "outlined" : "filled"}
                          label={STATUS_LABEL[r.status] ?? r.status} sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => setExplain(r)}>
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <ExplainDialog open={!!explain} row={explain} onClose={() => setExplain(null)} />
    </Box>
  );
}

function ExplainDialog({ open, row, onClose }: {
  open: boolean; row: ComparisonRow | null; onClose: () => void;
}) {
  if (!row) return <Dialog open={open} onClose={onClose} />;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Ανάλυση διαφοράς
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Row label="Εταιρεία" value={row.insuranceCompanyName} />
          <Row label="Πακέτο" value={row.policyType ? (POLICY_TYPE_LABEL[row.policyType] ?? row.policyType) : "Όλα"} />
          {row.vehicleUseCategory && <Row label="Χρήση" value={row.vehicleUseCategory} />}
          <Divider />
          <Typography variant="body2">
            Σε αυτό το scope έχετε <b>{row.policyCount} ενεργά συμβόλαια</b> με συνολικά ασφάλιστρα
            {" "}<b>{money(row.policiesPremiumTotal, "EUR")}</b>.
          </Typography>
          {row.myExpectedPercent !== null ? (
            <Typography variant="body2">
              Έχετε δηλώσει ότι δικαιούστε <b>{row.myExpectedPercent}%</b> → σύνολο
              {" "}<b>{money(row.myExpectedAmount, "EUR")}</b>.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Δεν έχετε δηλώσει ακόμα ποσοστό γι' αυτό το scope. Καταχωρήστε το στο «Παραμετροποίηση Προμηθειών μου».
            </Typography>
          )}
          {row.agencyConfiguredPercent !== null ? (
            <Typography variant="body2">
              Το γραφείο σας έχει ρυθμίσει <b>{row.agencyConfiguredPercent}%</b> → σύνολο
              {" "}<b>{money(row.agencyExpectedAmount, "EUR")}</b>.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Το γραφείο δεν έχει ρυθμίσει ειδικό κανόνα γι' αυτό το scope.
            </Typography>
          )}
          <Typography variant="body2" fontWeight={800}
            color={Math.abs(row.differenceAmount) < 0.01 ? "success.main" : "warning.main"}>
            Διαφορά: {row.differenceAmount > 0 ? "+" : ""}{money(row.differenceAmount, "EUR")}
          </Typography>
          <Divider />
          {row.status === "match" ? (
            <Alert severity="success">Το ποσοστό σας συμφωνεί με του γραφείου — όλα σωστά.</Alert>
          ) : row.status === "no_mine" ? (
            <Alert severity="info">
              Δεν έχετε δηλώσει τι περιμένετε. Καταχωρήστε το ποσοστό στη σελίδα «Παραμετροποίηση Προμηθειών μου»
              για να ελεγχθεί έναντι της παραμετροποίησης του γραφείου.
            </Alert>
          ) : row.status === "no_agency" ? (
            <Alert severity="info">
              Δεν υπάρχει αντίστοιχος κανόνας από το γραφείο. Επικοινωνήστε μαζί τους ώστε να προστεθεί ρητός κανόνας
              στην παραμετροποίηση προμηθειών.
            </Alert>
          ) : (
            <Alert severity="warning">
              Υπάρχει απόκλιση μεταξύ του ποσοστού που δηλώνετε και της παραμετροποίησης του γραφείου. Ελέγξτε τη σύμβασή
              σας και επικοινωνήστε με το γραφείο για διευκρίνιση ή επικαιροποίηση του κανόνα.
            </Alert>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2} alignItems="baseline">
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={700}>{value}</Typography>
    </Stack>
  );
}
