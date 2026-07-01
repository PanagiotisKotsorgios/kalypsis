import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  Divider, IconButton, LinearProgress, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import HubIcon from "@mui/icons-material/Hub";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AddIcon from "@mui/icons-material/Add";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { NumberedPager } from "../components/TableToolbar";
import { num } from "../utils/format";

interface AvailableCarrier {
  insuranceCompanyId: string; name: string; code: string;
  bridgeAvailable: boolean; bridgeFormat: string | null; unavailableReason: string | null;
}
interface ImportNote { field: string; severity: string; message: string; }
interface ImportRow {
  index: number;
  policyNumber: string | null; proposalNumber: string | null;
  customerName: string | null; customerVat: string | null;
  issueDate: string | null; startDate: string | null; endDate: string | null;
  grossPremium: number | null; netPremium: number | null;
  partnerCommission: number | null; agencyCommission: number | null;
  carrierName: string | null; partnerCode: string | null;
  raw: Record<string, string>;
  notes: ImportNote[];
  status: string;
  rowType: string;
  linkedPolicyId: string | null;
  linkedPolicyNumber: string | null;
  plateNumber: string | null;
}
interface PreviewResult {
  carrier: string; format: string; rowCount: number;
  rows: ImportRow[];
  readyCount: number; warnCount: number; errorCount: number; duplicateCount: number;
}

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  Ready: "success", WarnDiff: "warning", Error: "error", Duplicate: "info"
};

/** Single-glance verdict for a row — what will actually happen on commit. */
function preflightTag(row: ImportRow): { label: string; color: "success" | "warning" | "error" | "info" | "default" } {
  if (row.status === "Error")               return { label: "Σφάλμα — θα παραλειφθεί", color: "error" };
  if (row.status === "Duplicate")           return { label: "Έχει εισαχθεί",           color: "info"  };
  if (row.rowType === "Renewal" && !row.linkedPolicyId)
                                            return { label: "Ασύνδετο — απαιτεί σύνδεση", color: "error" };
  if (row.rowType === "Cancellation")       return { label: "Ακυρωτική κίνηση",        color: "warning" };
  if (row.status === "WarnDiff")            return { label: "Έτοιμο με διαφορές",      color: "warning" };
  return { label: "Έτοιμο προς εισαγωγή", color: "success" };
}

/** A row is included in the commit "Import" action only when it has passed all checks. */
function isImportable(row: ImportRow): boolean {
  if (row.status === "Error" || row.status === "Duplicate") return false;
  if (row.rowType === "Renewal" && !row.linkedPolicyId) return false;
  return true;
}
const ROWTYPE_COLOR: Record<string, "default" | "primary" | "warning" | "error" | "info" | "secondary"> = {
  New: "primary", Renewal: "info", Cancellation: "error", Endorsement: "warning", GreenCard: "secondary"
};
const ROWTYPE_LABEL: Record<string, string> = {
  New: "Νέο", Renewal: "Ανανέωση", Cancellation: "Ακυρωτικό", Endorsement: "Πρόσθετη", GreenCard: "Πρ. Κάρτα"
};

const SEV_ICON = (sev: string) => sev === "error" ? <ErrorOutlineIcon fontSize="small" color="error" />
  : sev === "warn" ? <WarningAmberIcon fontSize="small" color="warning" />
  : <InfoOutlinedIcon fontSize="small" color="info" />;

export function CarrierBridgesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AvailableCarrier | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [committed, setCommitted] = useState<{
    created: number; skipped: number; failed: number;
    lifecycles: number; financialMovements: number; documentWarnings: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<ImportRow | null>(null);

  const carriers = useQuery({
    queryKey: ["available-bridges"],
    queryFn: async () => (await api.get<AvailableCarrier[]>("/carrier-bridges/available")).data
  });

  const uploadAndPreview = useMutation({
    mutationFn: async ({ file, lob }: { file: File; lob: "auto" | "fire" }) => {
      setErr(null); setPreview(null); setRevealedIndex(0); setCommitted(null);
      const fd = new FormData();
      fd.append("insuranceCompanyId", selected!.insuranceCompanyId);
      fd.append("lob", lob);
      fd.append("file", file);
      return (await api.post<PreviewResult>("/carrier-bridges/preview", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: r => { setPreview(r); setFileName(fileRef.current?.files?.[0]?.name ?? null); },
    onError: e => setErr(extractErrorMessage(e))
  });
  const [pendingLob, setPendingLob] = useState<"auto" | "fire">("auto");
  const [filter, setFilter] = useState<"all" | "unlinked" | "renewal" | "new" | "cancellation" | "greencard" | "duplicate">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const commit = useMutation({
    mutationFn: async () => (await api.post<{
      rowsCreated: number; rowsSkipped: number; rowsFailed: number;
      lifecycleRowsApplied: number; financialMovementsCreated: number; documentWarnings: number;
    }>("/carrier-bridges/commit", {
      insuranceCompanyId: selected!.insuranceCompanyId,
      sourceFile: fileName ?? "import.xlsx",
      rows: preview!.rows
    })).data,
    onSuccess: r => {
      setCommitted({
        created: r.rowsCreated,
        skipped: r.rowsSkipped,
        failed: r.rowsFailed,
        lifecycles: r.lifecycleRowsApplied,
        financialMovements: r.financialMovementsCreated,
        documentWarnings: r.documentWarnings
      });
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["financial-movements"] });
      qc.invalidateQueries({ queryKey: ["financial-summary"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: e => setErr(extractErrorMessage(e))
  });

  // Row-by-row reveal animation while user reviews the preview.
  useEffect(() => {
    if (!preview) return;
    setRevealedIndex(0);
    const id = window.setInterval(() => {
      setRevealedIndex(i => {
        if (i >= preview.rows.length) { window.clearInterval(id); return i; }
        return i + 1;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [preview]);

  // Filter + search + paging for the preview table.
  const filteredRows = useMemo(() => {
    if (!preview) return [];
    const revealed = preview.rows.slice(0, revealedIndex);
    const s = search.trim().toLowerCase();
    return revealed.filter(r => {
      switch (filter) {
        case "unlinked":     if (!(r.rowType === "Renewal" && !r.linkedPolicyId)) return false; break;
        case "renewal":      if (r.rowType !== "Renewal") return false; break;
        case "new":          if (r.rowType !== "New") return false; break;
        case "cancellation": if (r.rowType !== "Cancellation") return false; break;
        case "greencard":    if (r.rowType !== "GreenCard") return false; break;
        case "duplicate":    if (r.status !== "Duplicate") return false; break;
      }
      if (!s) return true;
      const hay = [r.policyNumber, r.customerName, r.plateNumber, r.proposalNumber, r.partnerCode, r.carrierName]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [preview, revealedIndex, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const visibleRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <HubIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("carrierBridges.title")}</Typography>
            <HelpHint id="page.carrierBridges" />
          </Stack>
          <Typography color="text.secondary">{t("carrierBridges.subtitle")}</Typography>
        </Box>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {/* Step 1 — pick carrier */}
      {!selected && (
        <Card sx={{ p: 3 }}>
          <Typography fontWeight={700} mb={2}>{t("carrierBridges.pickCarrier")}</Typography>
          {carriers.isLoading ? <CircularProgress /> : (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(3,1fr)" } }}>
              {(carriers.data ?? []).map(c => (
                <Card key={c.insuranceCompanyId} variant="outlined" sx={{
                  p: 2, cursor: c.bridgeAvailable ? "pointer" : "not-allowed",
                  opacity: c.bridgeAvailable ? 1 : 0.45,
                  "&:hover": { borderColor: c.bridgeAvailable ? "primary.main" : undefined }
                }} onClick={() => c.bridgeAvailable && setSelected(c)}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography fontWeight={700}>{c.name}</Typography>
                    {c.bridgeAvailable
                      ? <Chip size="small" color="success" icon={<CheckCircleIcon />} label={c.bridgeFormat} />
                      : <Tooltip title={t("carrierBridges.unavailableReason")}>
                          <Chip size="small" icon={<HelpOutlineIcon />} label={t("carrierBridges.unavailable")} />
                        </Tooltip>}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{c.code}</Typography>
                </Card>
              ))}
              {(carriers.data ?? []).length === 0 && (
                <Alert severity="info" sx={{ gridColumn: "1/-1" }}>{t("carrierBridges.noCarriers")}</Alert>
              )}
            </Box>
          )}
        </Card>
      )}

      {/* Step 2 — upload file (separate slots for Auto vs Fire — only one allowed at a time) */}
      {selected && !preview && !uploadAndPreview.isPending && (
        <Card sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography fontWeight={700}>{t("carrierBridges.uploadFor")} <strong>{selected.name}</strong></Typography>
            <Button onClick={() => setSelected(null)}>{t("carrierBridges.changeCarrier")}</Button>
          </Stack>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t("carrierBridges.formatNote", { format: selected.bridgeFormat ?? "ERGO" })}
            <br />
            {t("carrierBridges.lobNote", "Επιλέξτε τον κλάδο του αρχείου. Επιτρέπεται ένα αρχείο τη φορά.")}
          </Alert>
          <input ref={fileRef} type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAndPreview.mutate({ file: f, lob: pendingLob }); }} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Card variant="outlined" sx={{ p: 2.5, flex: 1, cursor: "pointer",
              "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}
              onClick={() => { setPendingLob("auto"); fileRef.current?.click(); }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <DirectionsCarIcon color="primary" sx={{ fontSize: 36 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700}>{t("carrierBridges.lob.auto", "Αυτοκίνητο")}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("carrierBridges.lob.autoHelp", "Συμβόλαια οχημάτων με πινακίδα.")}
                  </Typography>
                </Box>
                <CloudUploadIcon color="action" />
              </Stack>
            </Card>
            <Card variant="outlined" sx={{ p: 2.5, flex: 1, cursor: "pointer",
              "&:hover": { borderColor: "error.main", bgcolor: "action.hover" } }}
              onClick={() => { setPendingLob("fire"); fileRef.current?.click(); }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <LocalFireDepartmentIcon color="error" sx={{ fontSize: 36 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700}>{t("carrierBridges.lob.fire", "Πυρός / Περιουσίας")}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("carrierBridges.lob.fireHelp", "Κατοικίες, επιχειρήσεις, ζημιές περιουσίας.")}
                  </Typography>
                </Box>
                <CloudUploadIcon color="action" />
              </Stack>
            </Card>
          </Stack>
        </Card>
      )}

      {uploadAndPreview.isPending && (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress />
          <Typography mt={2}>{t("carrierBridges.parsing")}</Typography>
        </Card>
      )}

      {/* Step 3 — preview table */}
      {preview && (
        <>
          <Card sx={{ p: 2.5, mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Kpi label={t("carrierBridges.totalRows")} value={preview.rowCount} />
                <Kpi label={t("carrierBridges.readyToImport", "Έτοιμα προς εισαγωγή")}
                  value={preview.rows.filter(isImportable).length} color="success" />
                <Kpi label={t("carrierBridges.unlinked", "Ασύνδετα")}
                  value={preview.rows.filter(r => r.rowType === "Renewal" && !r.linkedPolicyId).length} color="error" />
                <Kpi label={t("carrierBridges.errors")} value={preview.errorCount} color="error" />
                <Kpi label={t("carrierBridges.duplicates")} value={preview.duplicateCount} color="info" />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => { setPreview(null); setSelected(null); setCommitted(null); }}>{t("common.cancel")}</Button>
                <Button variant="contained" disabled={commit.isPending || revealedIndex < preview.rows.length || !!committed}
                  onClick={() => commit.mutate()}>
                  {commit.isPending
                    ? <CircularProgress size={18} />
                    : committed
                      ? t("carrierBridges.imported")
                      : t("carrierBridges.confirmImport", { count: preview.rows.filter(isImportable).length })}
                </Button>
              </Stack>
            </Stack>
            {revealedIndex < preview.rows.length && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={Math.round(revealedIndex / preview.rows.length * 100)} />
                <Typography variant="caption" color="text.secondary">{t("carrierBridges.previewing", { current: revealedIndex, total: preview.rows.length })}</Typography>
              </Box>
            )}
            {committed && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Alert severity="success">
                  {t("carrierBridges.committed", { created: committed.created, skipped: committed.skipped, failed: committed.failed })}
                  {committed.lifecycles > 0 && ` · ${committed.lifecycles} πρόσθετες πράξεις/ακυρώσεις συνδέθηκαν αυτόματα.`}
                  {committed.financialMovements > 0 && ` · Δημιουργήθηκαν ${committed.financialMovements} οικονομικές κινήσεις.`}
                </Alert>
                {committed.documentWarnings > 0 && (
                  <Alert severity="warning" action={
                    <Button component={RouterLink} to="/app/policies" color="inherit" size="small">
                      Άνοιγμα συμβολαίων
                    </Button>
                  }>
                    {committed.documentWarnings} συμβόλαια ή κινήσεις από τη γέφυρα δεν έχουν συνημμένο αρχείο. Ανεβάστε το PDF ή το σχετικό έγγραφο στην καρτέλα του συμβολαίου.
                  </Alert>
                )}
              </Stack>
            )}
          </Card>

          {/* Filter chips + search */}
          <Card sx={{ p: 1.5, mb: 1.5 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ flex: 1 }}>
                {([
                  ["all",          t("carrierBridges.filter.all", "Όλα"),                preview.rows.length],
                  ["unlinked",     t("carrierBridges.filter.unlinked", "Μόνο ασύνδετα"), preview.rows.filter(r => r.rowType === "Renewal" && !r.linkedPolicyId).length],
                  ["renewal",      t("carrierBridges.rowType.Renewal", "Ανανέωση"),      preview.rows.filter(r => r.rowType === "Renewal").length],
                  ["new",          t("carrierBridges.rowType.New", "Νέο"),               preview.rows.filter(r => r.rowType === "New").length],
                  ["cancellation", t("carrierBridges.rowType.Cancellation", "Ακυρωτικό"),preview.rows.filter(r => r.rowType === "Cancellation").length],
                  ["greencard",    t("carrierBridges.rowType.GreenCard", "Πρ. Κάρτα"),   preview.rows.filter(r => r.rowType === "GreenCard").length],
                  ["duplicate",    t("carrierBridges.filter.duplicate", "Έχει εισαχθεί"),preview.rows.filter(r => r.status === "Duplicate").length],
                ] as const).map(([key, label, count]) => (
                  <Chip key={key}
                    label={`${label} · ${count}`}
                    color={filter === key ? "primary" : "default"}
                    variant={filter === key ? "filled" : "outlined"}
                    size="small"
                    onClick={() => { setFilter(key as typeof filter); setPage(1); }}
                  />
                ))}
              </Stack>
              <TextField size="small" placeholder={t("carrierBridges.searchRows", "Αναζήτηση συμβολαίου, πελάτη, πινακίδας…") ?? ""}
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} sx={{ minWidth: 260 }} />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                {t("carrierBridges.showing", { n: filteredRows.length, total: preview.rows.length })
                  ?? `${filteredRows.length}/${preview.rows.length}`}
              </Typography>
            </Stack>
          </Card>

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
              <TableHead><TableRow>
                <TableCell>#</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell>{t("carrierBridges.col.rowType", "Είδος")}</TableCell>
                <TableCell>{t("carrierBridges.col.policy")}</TableCell>
                <TableCell>{t("carrierBridges.col.customer")}</TableCell>
                <TableCell>{t("carrierBridges.col.plate", "Πινακίδα / Πρότ.")}</TableCell>
                <TableCell>{t("carrierBridges.col.start")}</TableCell>
                <TableCell>{t("carrierBridges.col.end")}</TableCell>
                <TableCell align="right">{t("carrierBridges.col.gross")}</TableCell>
                <TableCell align="right">{t("carrierBridges.col.net")}</TableCell>
                <TableCell align="right">{t("carrierBridges.col.partnerComm")}</TableCell>
                <TableCell align="right">{t("carrierBridges.col.agencyComm")}</TableCell>
                <TableCell>{t("carrierBridges.col.notes")}</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.index} hover sx={{
                    cursor: "pointer",
                    bgcolor: row.status === "Error" ? "rgba(196,56,56,0.04)"
                           : row.status === "Duplicate" ? "rgba(31,123,179,0.04)"
                           : row.status === "WarnDiff" ? "rgba(201,168,106,0.06)"
                           : undefined,
                    animation: "rowFadeIn 250ms ease-out"
                  }}
                    onClick={() => setDetailRow(row)}>
                    <TableCell sx={{ fontFamily: "monospace", color: "text.secondary" }}>{row.index}</TableCell>
                    <TableCell>
                      {(() => { const tag = preflightTag(row);
                        return <Chip size="small" color={tag.color} label={tag.label} sx={{ fontWeight: 700 }} />; })()}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip size="small" color={ROWTYPE_COLOR[row.rowType] ?? "default"}
                          label={ROWTYPE_LABEL[row.rowType] ?? row.rowType} />
                        {row.linkedPolicyNumber && (
                          <Tooltip title={t("carrierBridges.linkedTo", { num: row.linkedPolicyNumber })}>
                            <LinkIcon fontSize="small" color="action" />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{row.policyNumber ?? "—"}</TableCell>
                    <TableCell>{row.customerName ?? "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {row.plateNumber ?? row.proposalNumber ?? "—"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{row.startDate ?? "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{row.endDate ?? "—"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{row.grossPremium != null ? num(row.grossPremium) : "—"}</TableCell>
                    <TableCell align="right">{row.netPremium != null ? num(row.netPremium) : "—"}</TableCell>
                    <TableCell align="right">{row.partnerCommission != null ? num(row.partnerCommission) : "—"}</TableCell>
                    <TableCell align="right">{row.agencyCommission != null ? num(row.agencyCommission) : "—"}</TableCell>
                    <TableCell>
                      {(() => {
                        const shownNotes = row.linkedPolicyId
                          ? row.notes.filter(n => !(n.field === "Τύπος" && n.message.includes("χωρίς σύνδεση")))
                          : row.notes;
                        return shownNotes.length === 0
                          ? <Chip size="small" variant="outlined" color="success" label="OK" />
                          : (
                            <Stack spacing={0.3}>
                              {shownNotes.map((n, i) => (
                                <Stack key={i} direction="row" alignItems="center" spacing={0.5}>
                                  {SEV_ICON(n.severity)}
                                  <Typography variant="caption">{n.field}: {n.message}</Typography>
                                </Stack>
                              ))}
                            </Stack>
                          );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
              <NumberedPager page={page} totalPages={totalPages} onPage={setPage} />
            </Box>
            <style>{`@keyframes rowFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          </Card>
        </>
      )}

      <RowDetailDialog
        row={detailRow}
        onClose={() => setDetailRow(null)}
        onUpdate={(updated) => {
          if (!preview) return;
          const next = preview.rows.map(r => r.index === updated.index ? updated : r);
          setPreview({ ...preview, rows: next });
          setDetailRow(updated);
        }}
      />
    </Box>
  );
}

interface PolicyLite { id: string; policyNumber: string; customerDisplay: string; insuranceCompanyName: string; startDate: string; endDate: string; }

function RowDetailDialog({ row, onClose, onUpdate }: {
  row: ImportRow | null; onClose: () => void; onUpdate: (r: ImportRow) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [options, setOptions] = useState<PolicyLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkedPolicy, setLinkedPolicy] = useState<PolicyLite | null>(null);

  useEffect(() => { setTab(0); setSearchValue(""); setOptions([]); setLinkedPolicy(null); }, [row?.index]);

  // When the row IS linked, fetch the linked policy details for the "Ασφαλιστήριο" tab.
  useEffect(() => {
    if (!row?.linkedPolicyId) { setLinkedPolicy(null); return; }
    api.get<PolicyLite>(`/policies/${row.linkedPolicyId}`)
      .then(r => setLinkedPolicy({
        id: r.data.id, policyNumber: r.data.policyNumber,
        customerDisplay: (r.data as any).customerDisplay ?? "—",
        insuranceCompanyName: (r.data as any).insuranceCompanyName ?? "—",
        startDate: r.data.startDate, endDate: r.data.endDate
      }))
      .catch(() => setLinkedPolicy(null));
  }, [row?.linkedPolicyId]);

  // Search policies for the manual link picker.
  useEffect(() => {
    if (!searchValue || searchValue.length < 2) { setOptions([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await api.get<PolicyLite[]>("/policies", { params: { search: searchValue } });
        if (!cancelled) setOptions(res.data.slice(0, 30));
      } catch { if (!cancelled) setOptions([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [searchValue]);

  if (!row) return null;

  const linkTo = (p: PolicyLite | null) => {
    onUpdate({
      ...row,
      rowType: p ? "Renewal" : row.rowType,
      linkedPolicyId: p?.id ?? null,
      linkedPolicyNumber: p?.policyNumber ?? null
    });
  };

  return (
    <Dialog open={!!row} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" fontWeight={800}>
            {t("carrierBridges.detailTitle", "Λεπτομέρειες γραμμής")} #{row.index}
          </Typography>
          <Chip size="small" color={STATUS_COLOR[row.status] ?? "default"}
            label={t(`carrierBridges.status.${row.status}`, row.status)} />
          <Chip size="small" color={ROWTYPE_COLOR[row.rowType] ?? "default"}
            label={ROWTYPE_LABEL[row.rowType] ?? row.rowType} />
          {row.linkedPolicyNumber && (
            <Chip size="small" color="info" icon={<LinkIcon />} label={row.linkedPolicyNumber} />
          )}
        </Stack>
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label={t("carrierBridges.tab.details", "Στοιχεία")} />
        <Tab label={t("carrierBridges.tab.raw", "Πηγαία xlsx")} />
        <Tab label={t("carrierBridges.tab.linked", "Συνδεδεμένο Ασφαλιστήριο")} />
      </Tabs>

      <DialogContent dividers>
        {tab === 0 && (
          <Stack spacing={2}>
            {row.rowType === "Renewal" && !row.linkedPolicyId && (
              <Alert severity="warning" icon={<LinkIcon />}>
                {t("carrierBridges.unlinkedRenewal",
                  "Ανανέωση χωρίς σύνδεση — δεν βρέθηκε προηγούμενο συμβόλαιο. Συνδέστε το χειροκίνητα από το tab «Συνδεδεμένο Ασφαλιστήριο» ή δημιουργήστε το προηγούμενο.")}
              </Alert>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
              <Field label={t("carrierBridges.col.policy")} value={row.policyNumber} />
              <Field label={t("carrierBridges.col.plate", "Πινακίδα")} value={row.plateNumber} />
              <Field label={t("carrierBridges.col.customer")} value={row.customerName} />
              <Field label="Πρόταση" value={row.proposalNumber} />
              <Field label={t("carrierBridges.col.start")} value={row.startDate} />
              <Field label={t("carrierBridges.col.end")} value={row.endDate} />
              <Field label={t("carrierBridges.col.gross")} value={row.grossPremium != null ? num(row.grossPremium) : null} />
              <Field label={t("carrierBridges.col.net")} value={row.netPremium != null ? num(row.netPremium) : null} />
              <Field label={t("carrierBridges.col.partnerComm")} value={row.partnerCommission != null ? num(row.partnerCommission) : null} />
              <Field label={t("carrierBridges.col.agencyComm")} value={row.agencyCommission != null ? num(row.agencyCommission) : null} />
              <Field label="Συνεργάτης" value={row.partnerCode} />
              <Field label="Εταιρία" value={row.carrierName} />
            </Box>

            {(() => {
              // Hide the "unlinked renewal" note once a manual link is in place.
              const visibleNotes = row.linkedPolicyId
                ? row.notes.filter(n => !(n.field === "Τύπος" && n.message.includes("χωρίς σύνδεση")))
                : row.notes;
              return visibleNotes.length > 0 ? (
                <>
                  <Divider />
                  <Typography fontWeight={700}>{t("carrierBridges.col.notes")}</Typography>
                  <Stack spacing={0.75}>
                    {visibleNotes.map((n, i) => (
                      <Stack key={i} direction="row" spacing={1} alignItems="center">
                        {SEV_ICON(n.severity)}
                        <Typography variant="body2"><strong>{n.field}:</strong> {n.message}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              ) : null;
            })()}
          </Stack>
        )}

        {tab === 1 && (
          <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 1, alignItems: "center" }}>
            {Object.entries(row.raw).map(([k, v]) => (
              <Box key={k} sx={{ display: "contents" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{k}</Typography>
                <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{v}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {tab === 2 && (
          <Stack spacing={2}>
            {linkedPolicy ? (
              <Card variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography fontWeight={800} fontSize={18}>
                    {linkedPolicy.policyNumber}
                  </Typography>
                  <Button size="small" color="error" startIcon={<CloseIcon />} onClick={() => linkTo(null)}>
                    {t("carrierBridges.unlink", "Αποσύνδεση")}
                  </Button>
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
                  <Field label="Πελάτης" value={linkedPolicy.customerDisplay} />
                  <Field label="Εταιρία" value={linkedPolicy.insuranceCompanyName} />
                  <Field label="Έναρξη" value={linkedPolicy.startDate} />
                  <Field label="Λήξη" value={linkedPolicy.endDate} />
                </Box>
              </Card>
            ) : (
              <Alert severity="info">
                {t("carrierBridges.noLink",
                  "Δεν υπάρχει συνδεδεμένο προγενέστερο ασφαλιστήριο. Αναζητήστε χειροκίνητα παρακάτω.")}
              </Alert>
            )}

            <Divider />

            <Typography fontWeight={700}>
              {t("carrierBridges.findOriginal", "Αναζήτηση πρωτότυπου ασφαλιστηρίου")}
            </Typography>
            <Autocomplete
              options={options}
              loading={searching}
              getOptionLabel={(o) => `${o.policyNumber} · ${o.customerDisplay}`}
              filterOptions={(x) => x}
              onInputChange={(_, v) => setSearchValue(v)}
              onChange={(_, v) => v && linkTo(v)}
              renderInput={(p) => <TextField {...p}
                placeholder={t("carrierBridges.searchPlaceholder", "Αριθμός, πελάτης, εταιρία…") ?? ""}
                size="small" />}
              renderOption={(props, o) => (
                <li {...props} key={o.id}>
                  <Stack>
                    <Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{o.policyNumber}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {o.customerDisplay} · {o.insuranceCompanyName} · {o.startDate} → {o.endDate}
                    </Typography>
                  </Stack>
                </li>
              )}
            />

            <Divider sx={{ my: 1 }}>
              <Chip label={t("carrierBridges.or", "ή")} size="small" />
            </Divider>

            <ManualCreateAndLink row={row} onLinked={(p) => linkTo(p)} />
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* Inline form: lets the user create the missing prior policy directly from the
   bridge dialog and link it in one step. Defaults are pre-filled from the row
   so the user only needs to confirm the prior-policy number + dates. */
function ManualCreateAndLink({ row, onLinked }: { row: ImportRow; onLinked: (p: PolicyLite) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [priorNumber, setPriorNumber] = useState("");
  const [priorStart, setPriorStart] = useState("");
  const [priorEnd, setPriorEnd] = useState("");
  const [priorPremium, setPriorPremium] = useState<string>(row.grossPremium?.toFixed(2) ?? "");
  const [paid, setPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default prior dates: one full year earlier than the new row's window.
  useEffect(() => {
    if (!open) return;
    if (row.startDate && row.endDate) {
      const sd = new Date(row.startDate); sd.setFullYear(sd.getFullYear() - 1);
      const ed = new Date(row.endDate);   ed.setFullYear(ed.getFullYear() - 1);
      setPriorStart(sd.toISOString().slice(0, 10));
      setPriorEnd(ed.toISOString().slice(0, 10));
    }
  }, [open, row.startDate, row.endDate]);

  async function submit() {
    setCreating(true); setError(null);
    try {
      // 1. Find or create the customer by name
      const candidates = await api.get<{ id: string; companyName?: string; firstName?: string; lastName?: string }[]>(
        "/customers", { params: { search: row.customerName } });
      const normalized = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/g, "");
      const target = (row.customerName ?? "").trim();
      let customerId = candidates.data.find(c => {
        const name = c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
        return normalized(name) === normalized(target);
      })?.id;
      if (!customerId) {
        const looksCompany = /Α\.?Ε|ΕΠΕ|ΟΕ|ΕΤΑΙΡ/i.test(target);
        const parts = target.split(" ").filter(Boolean);
        const created = await api.post<{ customer: { id: string } }>("/customers", {
          type: looksCompany ? "Company" : "Individual",
          companyName: looksCompany ? target : null,
          firstName:  !looksCompany && parts.length >= 1 ? parts[0] : null,
          lastName:   !looksCompany && parts.length >= 2 ? parts.slice(1).join(" ") : null,
          email: `${normalized(target).slice(0, 12).toLowerCase() || "import"}@placeholder.local`,
          createPortalAccount: false
        });
        customerId = created.data.customer.id;
      }

      // 2. Resolve the carrier ID via /insurance-companies search
      const companies = await api.get<{ id: string; name: string }[]>("/insurance-companies");
      const carrierId = companies.data.find(c => c.name === row.carrierName)?.id ?? companies.data[0]?.id;
      if (!carrierId) throw new Error("Δεν βρέθηκε η εταιρία στο σύστημα.");

      // 3. Create the prior policy
      const policyRes = await api.post<{ id: string; policyNumber: string; customerDisplay: string; insuranceCompanyName: string; startDate: string; endDate: string }>(
        "/policies", {
          customerId,
          insuranceCompanyId: carrierId,
          policyType: row.plateNumber ? "Auto" : "Other",
          startDate: priorStart,
          endDate: priorEnd,
          premium: Number(priorPremium) || 0,
          currency: "EUR",
          status: "Expired"
        });

      // 4. Persist payment & receipt metadata (and prior policy number / plate)
      //    on the new policy through the extended-update endpoint (SpecsJson).
      const specs = JSON.stringify({
        plate: row.plateNumber ?? undefined,
        proposal: row.proposalNumber ?? undefined,
        priorPolicyNumber: priorNumber || undefined,
        paid, paymentDate: paid ? paymentDate || undefined : undefined,
        receiptNumber: paid ? receiptNumber || undefined : undefined,
        importedFrom: "manual-bridge-link"
      });
      try {
        await api.put(`/policies/${policyRes.data.id}/extended`, {
          paymentFrequency: "Annual",
          premiumIncludesVat: true,
          specialCommissionPercent: null,
          specsJson: specs,
          nextRenewalDate: null,
          renewalTransferToProducerId: null, renewalTransferToCarrierId: null,
          retainCommissionsOnRenewal: false, retainDocumentNumberOnRenewal: false, retainSpecialCommissionsOnRenewal: false,
          renewalInstructions: null,
          deliveredAt: null, deliveredTo: null, deliveryMethod: null
        });
      } catch { /* non-fatal: the policy is already created and linked */ }

      onLinked({
        id: policyRes.data.id,
        policyNumber: policyRes.data.policyNumber,
        customerDisplay: policyRes.data.customerDisplay ?? row.customerName ?? "—",
        insuranceCompanyName: policyRes.data.insuranceCompanyName ?? row.carrierName ?? "—",
        startDate: policyRes.data.startDate,
        endDate: policyRes.data.endDate
      });
      setOpen(false);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
        {t("carrierBridges.manualCreate", "Δημιουργία ασφαλιστηρίου χειροκίνητα και σύνδεση")}
      </Button>
    );
  }

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={700} mb={1}>
        {t("carrierBridges.manualCreateTitle", "Δημιουργία προηγούμενου ασφαλιστηρίου")}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        {t("carrierBridges.manualCreateBody",
          "Συμπληρώστε τα στοιχεία του προγενέστερου συμβολαίου. Θα δημιουργηθεί ο πελάτης αν δεν υπάρχει, το συμβόλαιο θα οριστεί ως «Λήξαν» και η τρέχουσα γραμμή θα συνδεθεί ως ανανέωση.")}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Stack spacing={2}>
        <TextField label={t("carrierBridges.priorNumber", "Αρ. προηγούμενου ασφαλιστηρίου")}
          value={priorNumber} onChange={(e) => setPriorNumber(e.target.value)}
          fullWidth size="small" />
        <Stack direction="row" spacing={2}>
          <TextField label={t("carrierBridges.col.start")} type="date"
            value={priorStart} onChange={(e) => setPriorStart(e.target.value)}
            fullWidth size="small" InputLabelProps={{ shrink: true }} />
          <TextField label={t("carrierBridges.col.end")} type="date"
            value={priorEnd} onChange={(e) => setPriorEnd(e.target.value)}
            fullWidth size="small" InputLabelProps={{ shrink: true }} />
        </Stack>
        <TextField label={t("carrierBridges.priorPremium", "Ασφάλιστρο (€)")} type="number"
          value={priorPremium} onChange={(e) => setPriorPremium(e.target.value)}
          fullWidth size="small" />

        <Divider sx={{ my: 1 }}>
          <Chip size="small" label={t("carrierBridges.payment", "Πληρωμή")} />
        </Divider>
        <Stack direction="row" spacing={2} alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <input type="checkbox" id="paid-flag" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            <Box component="label" htmlFor="paid-flag" sx={{ fontSize: 14, cursor: "pointer" }}>
              {t("carrierBridges.paid", "Πληρωμένο")}
            </Box>
          </Stack>
          <TextField label={t("carrierBridges.paymentDate", "Ημ. πληρωμής")} type="date"
            value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
            fullWidth size="small" InputLabelProps={{ shrink: true }} disabled={!paid} />
          <TextField label={t("carrierBridges.receiptNumber", "Αρ. απόδειξης")}
            value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)}
            fullWidth size="small" disabled={!paid} />
        </Stack>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={() => setOpen(false)} disabled={creating}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={submit}
            disabled={creating || !priorStart || !priorEnd}>
            {creating ? <CircularProgress size={18} /> : t("carrierBridges.createAndLink", "Δημιουργία & Σύνδεση")}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={600}>{value ?? "—"}</Typography>
    </Box>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: "success" | "warning" | "error" | "info" }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={800} color={color ? `${color}.main` : "text.primary"}>{value}</Typography>
    </Box>
  );
}
