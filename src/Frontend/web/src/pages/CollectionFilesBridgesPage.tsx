import { useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

// «Γέφυρες αρχείων εισπράξεων» — πραγματική ροή upload → preview →
// commit για Ατλαντική Ένωση (αρχείο Filcoldt.txt μέσα σε
// Collect_YYYYMMDDhhmmss.zip). Οι υπόλοιπες εταιρίες παραμένουν
// «υπό ανάπτυξη» μέχρι να γραφτεί ο αντίστοιχος αναλυτής.
const ATLANTIC_KEY = /ATLANTIC|ATLANTIKI|ΑΤΛΑΝΤΙΚΗ/i;

interface AvailableCarrier {
  insuranceCompanyId: string;
  name: string;
  code: string;
  bridgeAvailable: boolean;
  bridgeFormat: string | null;
  unavailableReason: string | null;
}
interface CollectionRow {
  index: number;
  rawLine: string;
  branchCode: string | null;
  partyNumber: string | null;
  policyNumber: string | null;
  year: number | null;
  instalment: number | null;
  receiptNumber: string | null;
  receivedOn: string | null;
  amount: number | null;
  methodCode: string | null;
  matchedPolicyId: string | null;
  matchedPolicyCustomerName: string | null;
  status: "Ready" | "Unmatched" | "Duplicate" | "Error";
  note: string | null;
}
interface CollectionPreview {
  carrierName: string;
  rowCount: number;
  readyCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  errorCount: number;
  totalAmount: number;
  rows: CollectionRow[];
}
interface CommitResult { created: number; skipped: number; failed: number; totalAmount: number; }

const STATUS_LABEL: Record<CollectionRow["status"], { label: string; color: "success" | "warning" | "error" | "info" }> = {
  Ready:     { label: "Έτοιμη",         color: "success" },
  Unmatched: { label: "Χωρίς σύνδεση",  color: "warning" },
  Duplicate: { label: "Έχει καταχωρηθεί", color: "info" },
  Error:     { label: "Σφάλμα",          color: "error" },
};

const eur = (n: number | null | undefined) => n == null ? "—"
  : `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function CollectionFilesBridgesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AvailableCarrier | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CollectionPreview | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ready" | "unmatched" | "duplicate" | "error">("all");

  const carriers = useQuery({
    queryKey: ["available-bridges"],
    queryFn: async () => (await api.get<AvailableCarrier[]>("/carrier-bridges/available")).data
  });

  const all = carriers.data ?? [];
  const s = search.trim().toLowerCase();
  // Consider Atlantiki carriers the only *ready* ones for now — every other
  // carrier keeps the «Υπό ανάπτυξη» affordance until its parser exists.
  const isAtlanticCarrier = (c: AvailableCarrier) => ATLANTIC_KEY.test(`${c.code} ${c.name}`);
  const filtered = s
    ? all.filter(c => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s))
    : all;

  const preview$ = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      let bin = ""; const arr = new Uint8Array(buf);
      for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
      const b64 = btoa(bin);
      return (await api.post<CollectionPreview>("/collection-file-bridges/preview", {
        insuranceCompanyId: selected!.insuranceCompanyId,
        fileName: file.name,
        fileContentBase64: b64,
      })).data;
    },
    onSuccess: (p) => { setPreview(p); setErr(null); },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const commit$ = useMutation({
    mutationFn: async () => (await api.post<CommitResult>("/collection-file-bridges/commit", {
      insuranceCompanyId: selected!.insuranceCompanyId,
      fileName: fileName ?? "collect.zip",
      rows: preview!.rows,
    })).data,
    onSuccess: (r) => {
      setCommitted(r);
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["financial-summary"] });
      qc.invalidateQueries({ queryKey: ["financial-movements"] });
    },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const visibleRows = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter(r => {
      switch (filter) {
        case "ready":     return r.status === "Ready";
        case "unmatched": return r.status === "Unmatched";
        case "duplicate": return r.status === "Duplicate";
        case "error":     return r.status === "Error";
        default:          return true;
      }
    });
  }, [preview, filter]);

  const pickFile = () => fileRef.current?.click();
  const onFilePicked = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]; if (!f) return;
    setFileName(f.name); setCommitted(null); setPreview(null); setErr(null);
    preview$.mutate(f);
  };
  const reset = () => {
    setSelected(null); setPreview(null); setCommitted(null); setFileName(null); setErr(null); setFilter("all");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <ReceiptLongIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("collectionFilesBridges.title", "Γέφυρες αρχείων εισπράξεων")}
          </Typography>
          <Typography color="text.secondary">
            {t("collectionFilesBridges.subtitle",
              "Αυτόματη εισαγωγή εισπράξεων / πληρωμών από αρχεία της κάθε ασφαλιστικής εταιρείας.")}
          </Typography>
        </Box>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {/* Step 1 — carrier grid */}
      {!selected && (
        <Card sx={{ p: 3 }}>
          <TextField
            fullWidth autoFocus
            placeholder={t("carrierBridges.searchPlaceholder", "Αναζήτηση εταιρείας…")}
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{
              sx: { fontSize: 20, py: 0.5 },
              endAdornment: search ? <IconButton onClick={() => setSearch("")}><CloseIcon /></IconButton> : null,
            }}
            sx={{ mb: 2 }}
          />
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            {filtered.length} από {all.length} · <b>Ενεργή γέφυρα</b> προς το παρόν: Ατλαντική Ένωση.
          </Typography>

          {carriers.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : (
            <Box sx={{
              display: "grid", gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(3,1fr)" }
            }}>
              {filtered.map(c => {
                const ready = isAtlanticCarrier(c);
                return (
                  <Card key={c.insuranceCompanyId} variant="outlined" sx={{
                    p: 2, cursor: "pointer",
                    borderColor: ready ? "success.main" : "divider",
                    borderWidth: 1.5,
                    transition: "all 0.15s",
                    "&:hover": { boxShadow: 3, transform: "translateY(-1px)",
                      borderColor: ready ? "success.dark" : "primary.main" }
                  }} onClick={() => ready ? setSelected(c) : setPickedName(c.name)}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography fontWeight={700}>{c.name}</Typography>
                      {ready
                        ? <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Ενεργή" />
                        : <Chip size="small" icon={<HelpOutlineIcon />} label="Υπό ανάπτυξη" variant="outlined" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {c.code}
                    </Typography>
                  </Card>
                );
              })}
              {filtered.length === 0 && (
                <Alert severity="info" sx={{ gridColumn: "1/-1" }}
                  action={<Button size="small" onClick={() => setSearch("")}>Επαναφορά</Button>}>
                  Καμία εταιρεία δεν ταιριάζει στα φίλτρα.
                </Alert>
              )}
            </Box>
          )}
        </Card>
      )}

      {/* Step 2 — file upload */}
      {selected && !preview && (
        <Card sx={{ p: 3, mb: 2 }}>
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <ReceiptLongIcon color="primary" sx={{ fontSize: 48 }} />
            <Typography variant="h6">{selected.name}</Typography>
            <Typography color="text.secondary" textAlign="center" sx={{ maxWidth: 520 }}>
              Ανεβάστε το αρχείο <b>Collect_YYYYMMDDhhmmss.zip</b> (ή το εσωτερικό <b>Filcoldt.txt</b>) που στέλνει η Ατλαντική Ένωση.
              Θα δείτε προεπισκόπηση εγγραφών πριν οτιδήποτε αποθηκευτεί.
            </Typography>
            <input ref={fileRef} type="file" hidden
              accept=".zip,.txt,application/zip,text/plain"
              onChange={onFilePicked} />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={reset}>Πίσω</Button>
              <Button variant="contained" startIcon={<CloudUploadIcon />}
                disabled={preview$.isPending} onClick={pickFile}>
                {preview$.isPending ? "Ανάλυση…" : "Επιλογή αρχείου"}
              </Button>
            </Stack>
            {preview$.isPending && <LinearProgress sx={{ width: "100%" }} />}
          </Stack>
        </Card>
      )}

      {/* Step 3 — preview + commit */}
      {preview && (
        <>
          <Card sx={{ p: 2.5, mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Kpi label="Σύνολο γραμμών" value={preview.rowCount} />
                <Kpi label="Έτοιμες" value={preview.readyCount} color="success" />
                <Kpi label="Χωρίς σύνδεση" value={preview.unmatchedCount} color="warning" />
                <Kpi label="Έχουν καταχωρηθεί" value={preview.duplicateCount} color="info" />
                <Kpi label="Σφάλματα" value={preview.errorCount} color="error" />
                <Kpi label="Σύνολο ποσού" value={preview.totalAmount} money />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button onClick={reset}>Ακύρωση</Button>
                <Button variant="contained" disabled={preview.readyCount === 0 || commit$.isPending}
                  onClick={() => commit$.mutate()}>
                  {commit$.isPending ? <CircularProgress size={18} />
                    : committed ? `Νέα εισαγωγή ${preview.readyCount} έτοιμων`
                    : `Εισαγωγή ${preview.readyCount} εισπράξεων`}
                </Button>
              </Stack>
            </Stack>
            {committed && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Δημιουργήθηκαν <b>{committed.created}</b> εισπράξεις ({eur(committed.totalAmount)}) ·
                {" "}Παραλείφθηκαν {committed.skipped} · Απέτυχαν {committed.failed}.
              </Alert>
            )}
          </Card>

          <Card sx={{ p: 1.5, mb: 1.5 }}>
            <TextField
              select size="small" label="Φίλτρο εμφάνισης" value={filter}
              onChange={e => setFilter(e.target.value as typeof filter)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 260 }}
            >
              <option value="all">Όλες οι γραμμές ({preview.rowCount})</option>
              <option value="ready">Έτοιμες ({preview.readyCount})</option>
              <option value="unmatched">Χωρίς σύνδεση ({preview.unmatchedCount})</option>
              <option value="duplicate">Έχουν καταχωρηθεί ({preview.duplicateCount})</option>
              <option value="error">Σφάλματα ({preview.errorCount})</option>
            </TextField>
          </Card>

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                  <TableCell>Ασφαλιστήριο</TableCell>
                  <TableCell>Πελάτης</TableCell>
                  <TableCell>Παραστατικό</TableCell>
                  <TableCell>Ημ/νία</TableCell>
                  <TableCell align="right">Ποσό</TableCell>
                  <TableCell>Μέθοδος</TableCell>
                  <TableCell>Σημείωση</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map(r => {
                  const sc = STATUS_LABEL[r.status];
                  return (
                    <TableRow key={r.index} hover
                      sx={{ "&:nth-of-type(odd)": { bgcolor: "rgba(255,244,196,0.15)" } }}>
                      <TableCell>{r.index}</TableCell>
                      <TableCell><Chip size="small" color={sc.color} label={sc.label} /></TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber ?? "—"}</TableCell>
                      <TableCell>{r.matchedPolicyCustomerName ?? "—"}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{r.receiptNumber ?? "—"}</TableCell>
                      <TableCell>{r.receivedOn ?? "—"}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace" }}>{eur(r.amount)}</TableCell>
                      <TableCell>{r.methodCode ?? "—"}</TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{r.note ?? ""}</TableCell>
                    </TableRow>
                  );
                })}
                {visibleRows.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Καμία γραμμή στο φίλτρο.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Under-development modal (non-Atlantiki) */}
      <Dialog open={!!pickedName} onClose={() => setPickedName(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <HelpOutlineIcon color="warning" />
            <span>Υπό ανάπτυξη</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Η γέφυρα αρχείων εισπράξεων για την εταιρεία «{pickedName ?? ""}» είναι υπό ανάπτυξη.
            Θα ενεργοποιηθεί σε επόμενη έκδοση.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setPickedName(null)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Kpi({ label, value, color, money }: {
  label: string; value: number; color?: "success" | "warning" | "error" | "info"; money?: boolean;
}) {
  const c = color ? `${color}.main` : "text.primary";
  return (
    <Box sx={{ minWidth: 90 }}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color: c }}>
        {money ? `${value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : value}
      </Typography>
    </Box>
  );
}
