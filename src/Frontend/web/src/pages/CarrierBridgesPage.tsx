import { useEffect, useMemo, useRef, useState } from "react";
import { FilterHelp } from "../components/FilterHelp";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
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
import FolderZipIcon from "@mui/icons-material/FolderZip";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import AddIcon from "@mui/icons-material/Add";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { NumberedPager } from "../components/TableToolbar";
import { num } from "../utils/format";
import { InlineCreateInsuranceCompanyDialog } from "../components/InlineCreateInsuranceCompanyDialog";
import { SearchableSelect } from "../components/SearchableSelect";

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
  unmappedCodes: UnmappedCode[];
}
type MappingKind = "Company" | "Branch" | "Coverage" | "Use" | "Package" | "Producer";
interface UnmappedCode {
  kind: MappingKind;
  sourceCarrier: string | null;
  rawCode: string;
  rawLabel: string | null;
  occurrences: number;
  rows: number[];
}
/** Operator's resolution for a single unmapped code in the preview UI. */
interface MappingResolution {
  targetParameterItemId?: string;
  targetInsuranceCompanyId?: string;
  targetProducerId?: string;
  createParametricCode?: string;
  createParametricName?: string;
  createProducerCode?: string;
  createProducerName?: string;
}
/** Company-parametric row as returned by /api/company-parameters. */
interface CompanyParameterItemLite {
  id: string;
  kind: string;
  code: string;
  name: string;
  insuranceCompanyName: string;
}
const KIND_LABEL: Record<MappingKind, string> = {
  Company: "Εταιρεία", Branch: "Κλάδος", Coverage: "Κάλυψη", Use: "Χρήση", Package: "Πακέτο",
  Producer: "Συνεργάτης",
};

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
  // Όνομα της εταιρείας που ζητά ο χρήστης αλλά ΔΕΝ έχει έτοιμο parser —
  // ανοίγει «Χρειάζεται παραμετροποίηση» dialog μέχρι να γραφτεί ο adapter.
  const [underDevCarrier, setUnderDevCarrier] = useState<string | null>(null);

  const carriers = useQuery({
    queryKey: ["available-bridges"],
    queryFn: async () => (await api.get<AvailableCarrier[]>("/carrier-bridges/available")).data
  });

  // Standard-bridge → tenant carrier link check. When the operator clicks a
  // Kalypsis-provided carrier (ERGO, INTERLIFE, GRAND_COVER, ATLANTIC) we
  // demand a BridgeCodeMapping (Kind=Company) that routes it to one of the
  // office's own carriers. Uploads use that mapped tenant carrier as the
  // insuranceCompanyId, so imported policies live under the office's own
  // catalogue instead of the shared global.
  const companyMappings = useQuery({
    queryKey: ["bridge-code-mappings", "company", selected?.name],
    enabled: !!selected,
    queryFn: async () => (await api.get<Array<{
      id: string; kind: string; sourceCarrier: string | null;
      targetInsuranceCompanyId: string | null; targetInsuranceCompanyName: string | null;
    }>>("/bridge-code-mappings", {
      params: { kind: "Company", sourceCarrier: selected!.name }
    })).data
  });
  const companyLink = (companyMappings.data ?? []).find(m => !!m.targetInsuranceCompanyId);
  const [linkCarrierOpen, setLinkCarrierOpen] = useState(false);
  // Force-open the link dialog when the operator selected a carrier but no
  // mapping resolves to a tenant carrier yet. If the operator picked one of
  // their own carriers (not a global), the mapping check may still be empty —
  // in that case we auto-materialise a self-link so the upload proceeds.
  useEffect(() => {
    if (!selected) return;
    if (companyMappings.isLoading) return;
    if (companyLink) return;
    setLinkCarrierOpen(true);
  }, [selected, companyMappings.isLoading, companyLink]);

  const uploadAndPreview = useMutation({
    mutationFn: async ({ file, lob }: { file: File; lob: string }) => {
      setErr(null); setPreview(null); setRevealedIndex(0); setCommitted(null);
      const fd = new FormData();
      // Prefer the mapped tenant carrier when the bridge has been linked —
      // the imported policies will land under the agency's own catalog. Fall
      // back to selected.insuranceCompanyId for legacy single-tenant cases.
      const effectiveCarrierId = companyLink?.targetInsuranceCompanyId ?? selected!.insuranceCompanyId;
      fd.append("insuranceCompanyId", effectiveCarrierId);
      fd.append("lob", lob);
      fd.append("file", file);
      return (await api.post<PreviewResult>("/carrier-bridges/preview", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: r => {
      // Reset resolutions ONLY on a fresh upload — otherwise every row-detail
      // "Δημιουργία και σύνδεση" (which re-`setPreview`s with the updated
      // rows array) would wipe every mapping the operator has entered so far.
      setResolutions({});
      setBulkPanelOpen(false);
      setPreview(r);
      setFileName(fileRef.current?.files?.[0]?.name ?? null);
    },
    onError: e => setErr(extractErrorMessage(e))
  });
  const [pendingLob, setPendingLob] = useState<string>("auto");
  const [filter, setFilter] = useState<"all" | "unlinked" | "renewal" | "new" | "cancellation" | "greencard" | "duplicate">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Operator's per-code decisions in the "Απαιτούμενες αντιστοιχίσεις" panel.
  // Keyed by `${kind}|${rawCode}` so a code that appears with multiple kinds
  // (e.g. "01" as both a Branch and a Coverage) gets one row per kind.
  const [resolutions, setResolutions] = useState<Record<string, MappingResolution>>({});
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  // Resolutions used to reset every time `preview` changed — but preview
  // changes on every row-detail edit too (manual-link create, prior-policy
  // create, etc.), so the operator would lose every mapping they'd entered
  // whenever they touched a row. The reset now happens ONLY when a fresh
  // upload starts (see uploadAndPreview.onSuccess above) and when the
  // operator explicitly cancels the whole preview (Cancel button in the
  // header). Manual page reload still clears them — that's expected.
  const unmapKey = (u: UnmappedCode) => `${u.kind}|${u.rawCode}`;
  const isResolved = (u: UnmappedCode) => {
    const r = resolutions[unmapKey(u)] ?? {};
    if (u.kind === "Company") return !!r.targetInsuranceCompanyId;
    if (u.kind === "Producer")
      return !!r.targetProducerId
        || (!!r.createProducerCode?.trim() && !!r.createProducerName?.trim());
    return !!r.targetParameterItemId
      || (!!r.createParametricCode?.trim() && !!r.createParametricName?.trim());
  };
  const allResolved = !preview
    || (preview.unmappedCodes ?? []).length === 0
    || (preview.unmappedCodes ?? []).every(isResolved);

  // Load agency's own parametrics and carrier list once the preview is up, so
  // the picker under each unmapped row has options to link against.
  const parametrics = useQuery({
    queryKey: ["company-parameters", "for-bridge-mapping"],
    enabled: !!preview,
    queryFn: async () => (await api.get<CompanyParameterItemLite[]>("/company-parameters")).data
  });
  const insuranceCompanies = useQuery({
    queryKey: ["insurance-companies-lite"],
    enabled: !!preview,
    queryFn: async () => (await api.get<{ id: string; name: string; code: string; }[]>("/insurance-companies")).data
  });
  // Producers list — feeds the Kind=Producer picker in the mapping panel.
  const producers = useQuery({
    queryKey: ["producers-for-bridge-mapping"],
    enabled: !!preview,
    queryFn: async () => (await api.get<{ id: string; code: string; name: string; }[]>("/producers")).data
  });

  const commit = useMutation({
    mutationFn: async () => {
      const pendingMappings = (preview?.unmappedCodes ?? []).map(u => {
        const r = resolutions[unmapKey(u)] ?? {};
        return {
          kind: u.kind,
          sourceCarrier: u.sourceCarrier,
          rawCode: u.rawCode,
          rawLabel: u.rawLabel,
          targetInsuranceCompanyId: r.targetInsuranceCompanyId ?? null,
          targetParameterItemId: r.targetParameterItemId ?? null,
          targetProducerId: r.targetProducerId ?? null,
          createParametricCode: r.createParametricCode?.trim() || null,
          createParametricName: r.createParametricName?.trim() || null,
          createProducerCode: r.createProducerCode?.trim() || null,
          createProducerName: r.createProducerName?.trim() || null,
        };
      });
      const effectiveCarrierId = companyLink?.targetInsuranceCompanyId ?? selected!.insuranceCompanyId;
      return (await api.post<{
        rowsCreated: number; rowsSkipped: number; rowsFailed: number;
        lifecycleRowsApplied: number; financialMovementsCreated: number; documentWarnings: number;
      }>("/carrier-bridges/commit", {
        insuranceCompanyId: effectiveCarrierId,
        sourceFile: fileName ?? "import.xlsx",
        rows: preview!.rows,
        pendingMappings: pendingMappings.length ? pendingMappings : null,
      })).data;
    },
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
                  p: 2, cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: 2,
                    transform: "translateY(-1px)"
                  }
                }} onClick={() => {
                  if (c.bridgeAvailable) setSelected(c);
                  else setUnderDevCarrier(c.name);
                }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography fontWeight={700}>{c.name}</Typography>
                    {c.bridgeAvailable
                      ? <Chip size="small" color="success" icon={<CheckCircleIcon />} label={c.bridgeFormat} />
                      : <Chip size="small" icon={<HelpOutlineIcon />} label={t("carrierBridges.unavailable")} variant="outlined" />}
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

      {/* «Χρειάζεται παραμετροποίηση» modal για κάθε unavailable carrier —
          όλες οι εταιρείες του ALIS καταλόγου είναι ορατές αλλά μόνο οι
          4 πρώτες (ERGO/ATLANTIC/INTERLIFE/GRAND_COVER) έχουν έτοιμο parser. */}
      <Dialog open={!!underDevCarrier} onClose={() => setUnderDevCarrier(null)}
        maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <HelpOutlineIcon color="warning" />
            <span>{t("carrierBridges.underDevTitle", "Χρειάζεται επιπλέον παραμετροποίηση")}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t("carrierBridges.underDevBody",
              "Η γέφυρα για την εταιρεία «{{carrier}}» χρειάζεται επιπλέον παραμετροποίηση ανάλογα με τον τύπο του γραφείου σας. Επικοινωνήστε μαζί μας για να την ενεργοποιήσουμε.", {
              carrier: underDevCarrier ?? ""
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setUnderDevCarrier(null)}>
            {t("common.close", "Κλείσιμο")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link-carrier gate — dispatched from Step 2 the moment the operator
          selects a carrier that isn't yet linked to one of their own. */}
      {selected && (
        <LinkCarrierDialog
          open={linkCarrierOpen}
          sourceCarrierName={selected.name}
          sourceCarrierCode={selected.code}
          onClose={() => { setLinkCarrierOpen(false); setSelected(null); }}
          onLinked={() => {
            setLinkCarrierOpen(false);
            void qc.invalidateQueries({ queryKey: ["bridge-code-mappings"] });
          }}
        />
      )}

      {/* Step 2 — upload file. Blocked behind the link gate above. */}
      {selected && companyLink && !preview && !uploadAndPreview.isPending && (
        <Card sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography fontWeight={700}>{t("carrierBridges.uploadFor")} <strong>{selected.name}</strong></Typography>
              <Typography variant="caption" color="text.secondary">
                Οι εγγραφές θα δημιουργηθούν στο δικό σας γραφείο: <strong>{companyLink.targetInsuranceCompanyName}</strong>
              </Typography>
            </Box>
            <Button onClick={() => setSelected(null)}>{t("carrierBridges.changeCarrier")}</Button>
          </Stack>
          <Alert severity="info" sx={{ mb: 2 }}>
            {(() => {
              const fmt = (selected.bridgeFormat ?? "ERGO").toUpperCase();
              // Real accepted formats per carrier. Keep in sync with the
              // backend sniffer (SniffFormat) and the parser dispatch.
              const accepted = fmt.includes("GRAND")
                ? ".zip (Policies + Customers + Objects + Covers + FBC*.csv)"
                : fmt.includes("ATLANTIC")
                  ? ".zip (Producer_ .zip με Filpolhd.txt / Filpoldt.txt / …)"
                  : fmt.includes("INTERLIFE")
                    ? ".xlsx (MOTOR_… ή LOIPOI_…)"
                    : ".txt HEADER + DETAIL ή .zip που τα περιέχει";
              return `Αναλυτής για format: ${fmt}. Δεκτό αρχείο: ${accepted}`;
            })()}
            <br />
            {(() => {
              const fmt = (selected.bridgeFormat ?? "").toUpperCase();
              if (fmt.includes("GRAND"))
                return "Το Grand Cover εξάγει ένα ενιαίο .zip με όλα τα συμβόλαια. Ανεβάστε το αυτούσιο.";
              if (fmt.includes("ATLANTIC"))
                return "Η Ατλαντική Ένωση εξάγει τον φάκελο Producer_ .zip. Ανεβάστε τον αυτούσιο.";
              if (fmt.includes("INTERLIFE"))
                return "Η Interlife εξάγει δύο ξεχωριστά αρχεία .xlsx: MOTOR_ και LOIPOI_. Ανεβάστε ένα κάθε φορά.";
              // Default = ERGO: HEADER + DETAIL .txt (ή zip που τα περιέχει)
              return "Το ERGO εξάγει δύο αρχεία .txt ανά κλάδο ( (HEADER) και (DETAIL) ). Ανεβάστε το .zip που τα περιέχει, ή τα δύο .txt μαζί ως .zip.";
            })()}
          </Alert>
          <input ref={fileRef} type="file"
            accept=".xlsx,.zip,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed,text/plain" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAndPreview.mutate({ file: f, lob: pendingLob }); }} />
          {(() => {
            // Each carrier's export shape drives which tiles we show.
            // Grand Cover ships a single mixed ZIP → one tile.
            // ERGO ships one HEADER + DETAIL .txt pair per LOB (usually
            // bundled in a .zip). Four tiles below cover AUTO / FIRE /
            // LIABILITY / PROS.
            const fmt = (selected.bridgeFormat ?? "").toUpperCase();
            if (fmt.includes("GRAND")) {
              return (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Card variant="outlined" sx={{
                    p: 2.5, flex: 1, cursor: "pointer",
                    borderStyle: "dashed",
                    "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" }
                  }}
                    onClick={() => { setPendingLob("auto"); fileRef.current?.click(); }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <FolderZipIcon color="primary" sx={{ fontSize: 44 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={800}>
                          Πλήρες πακέτο Grand Cover (.zip)
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Ένα .zip με Policies, Customers, Objects, Covers, FBC*.
                          Καλύπτει ταυτόχρονα οχήματα, περιουσία και υγεία.
                        </Typography>
                      </Box>
                      <CloudUploadIcon color="action" />
                    </Stack>
                  </Card>
                </Stack>
              );
            }
            if (fmt.includes("ATLANTIC")) {
              return (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Card variant="outlined" sx={{
                    p: 2.5, flex: 1, cursor: "pointer",
                    borderStyle: "dashed",
                    "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" }
                  }}
                    onClick={() => { setPendingLob("auto"); fileRef.current?.click(); }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <FolderZipIcon color="primary" sx={{ fontSize: 44 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={800}>
                          Producer_ .zip Ατλαντικής Ένωσης
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Φάκελος Producer_YYYYMMDDhhmmss.zip με Filpolhd, Filpoldt,
                          Filcusdt, Filvhinf, Filvehcl, Filrechd/dt, Filcomis.
                        </Typography>
                      </Box>
                      <CloudUploadIcon color="action" />
                    </Stack>
                  </Card>
                </Stack>
              );
            }
            if (fmt.includes("ERGO")) {
              // ERGO ships one zip per LOB (or the .txt HEADER+DETAIL pair
              // outside a zip). All four LOBs use the same parser — the
              // backend derives which LOB by sniffing the filename inside
              // the .zip, so the LOB the operator picked here is just a
              // hint that helps the legacy xlsx path when it can't tell.
              const tiles: { lob: string; label: string; help: string; Icon: typeof DirectionsCarIcon; color: "primary" | "error" | "info" | "success" }[] = [
                { lob: "auto", label: "Αυτοκίνητο",
                  help: "AUTO zip ή txt (HEADER + DETAIL). Συμβόλαια οχημάτων με πινακίδα.",
                  Icon: DirectionsCarIcon, color: "primary" },
                { lob: "fire", label: "Πυρός / Περιουσίας",
                  help: "FIRE zip ή txt. Κατοικίες, επιχειρήσεις, ζημιές περιουσίας.",
                  Icon: LocalFireDepartmentIcon, color: "error" },
                { lob: "liability", label: "Ευθύνη",
                  help: "LIABILITY zip ή txt. Επαγγελματικές και γενικές ευθύνες.",
                  Icon: ShieldOutlinedIcon, color: "info" },
                { lob: "pros", label: "Προσωπικό ατύχημα",
                  help: "PROS zip ή txt. Ασφαλιστήρια προσώπων και ταξιδιωτικά.",
                  Icon: HelpOutlineIcon, color: "success" },
              ];
              return (
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    {tiles.slice(0, 2).map(({ lob, label, help, Icon, color }) => (
                      <Card key={lob} variant="outlined" sx={{
                        p: 2.5, flex: 1, cursor: "pointer",
                        "&:hover": { borderColor: `${color}.main`, bgcolor: "action.hover" }
                      }} onClick={() => { setPendingLob(lob); fileRef.current?.click(); }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Icon color={color} sx={{ fontSize: 36 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={700}>{label}</Typography>
                            <Typography variant="caption" color="text.secondary">{help}</Typography>
                          </Box>
                          <CloudUploadIcon color="action" />
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    {tiles.slice(2).map(({ lob, label, help, Icon, color }) => (
                      <Card key={lob} variant="outlined" sx={{
                        p: 2.5, flex: 1, cursor: "pointer",
                        "&:hover": { borderColor: `${color}.main`, bgcolor: "action.hover" }
                      }} onClick={() => { setPendingLob(lob); fileRef.current?.click(); }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Icon color={color} sx={{ fontSize: 36 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={700}>{label}</Typography>
                            <Typography variant="caption" color="text.secondary">{help}</Typography>
                          </Box>
                          <CloudUploadIcon color="action" />
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </Stack>
              );
            }
            // Generic fallback for any future carrier — single upload tile.
            return (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Card variant="outlined" sx={{
                  p: 2.5, flex: 1, cursor: "pointer",
                  borderStyle: "dashed",
                  "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" }
                }}
                  onClick={() => { setPendingLob("auto"); fileRef.current?.click(); }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <ShieldOutlinedIcon color="primary" sx={{ fontSize: 40 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={700}>Ανέβασμα αρχείου εταιρίας</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Επιλέξτε το αρχείο εξαγωγής που στέλνει η ασφαλιστική.
                      </Typography>
                    </Box>
                    <CloudUploadIcon color="action" />
                  </Stack>
                </Card>
              </Stack>
            );
          })()}
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
                <Button onClick={() => { setPreview(null); setSelected(null); setCommitted(null); setResolutions({}); setBulkPanelOpen(false); }}>{t("common.cancel")}</Button>
                <Tooltip title={allResolved ? "" : "Αντιστοιχίστε πρώτα όλους τους κωδικούς πιο κάτω"}>
                  <span>
                <Button variant="contained" disabled={!allResolved || commit.isPending || revealedIndex < preview.rows.length || !!committed}
                  onClick={() => commit.mutate()}>
                  {commit.isPending
                    ? <CircularProgress size={18} />
                    : committed
                      ? t("carrierBridges.imported")
                      : t("carrierBridges.confirmImport", { count: preview.rows.filter(isImportable).length })}
                </Button>
                  </span>
                </Tooltip>
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

          {(preview.unmappedCodes ?? []).length > 0 && (() => {
            const total = preview.unmappedCodes.length;
            const open = preview.unmappedCodes.filter(u => !isResolved(u)).length;
            return (
              <Card sx={{
                p: 2, mb: 2, borderLeft: 4,
                borderLeftColor: open > 0 ? "warning.main" : "success.main"
              }}>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <LinkIcon color={open > 0 ? "warning" : "success"} />
                  <Typography fontWeight={800}>
                    {open > 0
                      ? `Απαιτούμενες αντιστοιχίσεις — ${open} / ${total}`
                      : `Όλες οι αντιστοιχίσεις έτοιμες — ${total}`}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    size="small" variant="outlined"
                    onClick={() => setBulkPanelOpen(v => !v)}
                  >
                    {bulkPanelOpen ? "Κλείσιμο μαζικού πίνακα" : "Άνοιγμα μαζικού πίνακα"}
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Ανοίξτε κάθε συμβόλαιο (κλικ στη γραμμή του παρακάτω) και αντιστοιχίστε
                  μόνο τους κωδικούς που φέρνει το ίδιο. Οι αντιστοιχίσεις εφαρμόζονται
                  αυτόματα σε κάθε άλλο συμβόλαιο της γέφυρας με τους ίδιους κωδικούς.
                </Typography>
                {bulkPanelOpen && (
                  <Box sx={{ mt: 2 }}>
                    <UnmappedCodesPanel
                      unmapped={preview.unmappedCodes}
                      resolutions={resolutions}
                      onChange={setResolutions}
                      parametrics={parametrics.data ?? []}
                      parametricsLoading={parametrics.isLoading}
                      insuranceCompanies={insuranceCompanies.data ?? []}
                      producers={producers.data ?? []}
                      unmapKey={unmapKey}
                      isResolved={isResolved}
                    />
                  </Box>
                )}
              </Card>
            );
          })()}

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
              <TextField size="small" placeholder="Αναζήτηση…"
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} sx={{ minWidth: 220 }}
                InputProps={{
                  endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό συμβολαίου, όνομα πελάτη ή πινακίδα οχήματος στη γέφυρα." />
                }} />
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
                        // Per-contract unmapped-code hint. Counts how many
                        // codes THIS row carries that are still open, so the
                        // operator sees at a glance which contracts need
                        // attention before commit.
                        const rowUnmapped = (preview?.unmappedCodes ?? []).filter(u => u.rows.includes(row.index));
                        const openHere = rowUnmapped.filter(u => !isResolved(u)).length;
                        return (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip size="small" color={tag.color} label={tag.label} sx={{ fontWeight: 700 }} />
                            {rowUnmapped.length > 0 && (
                              <Tooltip title={openHere > 0
                                ? `${openHere} από ${rowUnmapped.length} raw κωδικοί χωρίς αντιστοίχιση — κλικ για link`
                                : `${rowUnmapped.length} raw κωδικοί, όλοι αντιστοιχισμένοι`}>
                                <Chip size="small"
                                  color={openHere > 0 ? "warning" : "success"}
                                  variant={openHere > 0 ? "filled" : "outlined"}
                                  icon={<LinkIcon />}
                                  label={openHere > 0 ? `${openHere}` : "✓"} />
                              </Tooltip>
                            )}
                          </Stack>
                        );
                      })()}
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
        unmapped={preview?.unmappedCodes ?? []}
        resolutions={resolutions}
        onChangeResolutions={setResolutions}
        parametrics={parametrics.data ?? []}
        parametricsLoading={parametrics.isLoading}
        insuranceCompanies={insuranceCompanies.data ?? []}
        producers={producers.data ?? []}
        unmapKey={unmapKey}
        isResolved={isResolved}
      />
    </Box>
  );
}

interface PolicyLite { id: string; policyNumber: string; customerDisplay: string; insuranceCompanyName: string; startDate: string; endDate: string; }

function RowDetailDialog({ row, onClose, onUpdate,
  unmapped, resolutions, onChangeResolutions,
  parametrics, parametricsLoading, insuranceCompanies, producers,
  unmapKey, isResolved,
}: {
  row: ImportRow | null; onClose: () => void; onUpdate: (r: ImportRow) => void;
  unmapped: UnmappedCode[];
  resolutions: Record<string, MappingResolution>;
  onChangeResolutions: (r: Record<string, MappingResolution>) => void;
  parametrics: CompanyParameterItemLite[];
  parametricsLoading: boolean;
  insuranceCompanies: { id: string; name: string; code: string; }[];
  producers: { id: string; code: string; name: string; }[];
  unmapKey: (u: UnmappedCode) => string;
  isResolved: (u: UnmappedCode) => boolean;
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

      {(() => { void 0; return null; })()}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label={t("carrierBridges.tab.details", "Στοιχεία")} />
        <Tab label={t("carrierBridges.tab.raw", "Πηγαία xlsx")} />
        <Tab label={t("carrierBridges.tab.linked", "Συνδεδεμένο Ασφαλιστήριο")} />
        <Tab label={(() => {
          const rowUnmapped = unmapped.filter(u => u.rows.includes(row.index));
          const openCount = rowUnmapped.filter(u => !isResolved(u)).length;
          const total = rowUnmapped.length;
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <span>Αντιστοιχίσεις</span>
              {total > 0 && (
                <Chip size="small"
                  color={openCount === 0 ? "success" : "warning"}
                  label={openCount === 0 ? `✓ ${total}` : `${openCount}/${total}`} />
              )}
            </Stack>
          );
        })()} />
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

        {tab === 3 && (() => {
          const rowUnmapped = unmapped.filter(u => u.rows.includes(row.index));
          if (rowUnmapped.length === 0) {
            return (
              <Alert severity="success">
                Δεν χρειάζεται καμία αντιστοίχιση για αυτό το συμβόλαιο — όλοι οι raw κωδικοί του
                αντιστοιχούν ήδη σε δικά σας παραμετρικά ή σε προηγούμενες γέφυρες.
              </Alert>
            );
          }
          return (
            <Stack spacing={2}>
              <Alert severity="info">
                Οι κωδικοί που έφερε αυτό το συμβόλαιο. Μόλις τους αντιστοιχίσετε εδώ, το ίδιο ισχύει
                αυτόματα για κάθε άλλο συμβόλαιο της ίδιας γέφυρας που τους περιέχει — και για κάθε
                μελλοντική εισαγωγή, εκτός αν αλλάξετε τον στόχο.
              </Alert>
              <UnmappedCodesPanel
                unmapped={rowUnmapped}
                resolutions={resolutions}
                onChange={onChangeResolutions}
                parametrics={parametrics}
                parametricsLoading={parametricsLoading}
                insuranceCompanies={insuranceCompanies}
                producers={producers}
                unmapKey={unmapKey}
                isResolved={isResolved}
              />
            </Stack>
          );
        })()}
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
  // Cancellation rows carry a NEGATIVE premium in the bridge feed. The
  // /policies POST validator requires Premium >= 0, so seed the prior-
  // policy premium with the absolute value the operator can then adjust.
  const [priorPremium, setPriorPremium] = useState<string>(row.grossPremium != null ? Math.abs(row.grossPremium).toFixed(2) : "");
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
        // No placeholder email — the customer validator's EmailAddress()
        // rule rejects Greek local parts (SMTPUTF8), so previously any
        // Greek-named customer created here bounced with "μη έγκυρη
        // διεύθυνση". Leave it null; the operator can add contact
        // details from the customer card afterwards.
        // Companies additionally need a VatNumber the bridge doesn't
        // carry, so we insert a placeholder ("BRIDGE-<name-slug>") that
        // clears the required-length check but is trivially edited later.
        const nameSlug = normalized(target).slice(0, 20) || "IMPORT";
        const created = await api.post<{ customer: { id: string } }>("/customers", {
          type: looksCompany ? "Company" : "Individual",
          companyName: looksCompany ? target : null,
          vatNumber: looksCompany ? `BRIDGE-${nameSlug}` : null,
          firstName:  !looksCompany && parts.length >= 1 ? parts[0] : null,
          lastName:   !looksCompany && parts.length >= 2 ? parts.slice(1).join(" ") : null,
          createPortalAccount: false
        });
        customerId = created.data.customer.id;
      }

      // 2. Resolve the carrier ID via /insurance-companies search
      const companies = await api.get<{ id: string; name: string }[]>("/insurance-companies");
      const carrierId = companies.data.find(c => c.name === row.carrierName)?.id ?? companies.data[0]?.id;
      if (!carrierId) throw new Error("Δεν βρέθηκε η εταιρία στο σύστημα.");

      // 3. Create the prior policy. Premium coerced non-negative so the
      // /policies validator (Premium >= 0) never blocks a cancellation
      // row where the bridge amount is negative by design.
      const policyRes = await api.post<{ id: string; policyNumber: string; customerDisplay: string; insuranceCompanyName: string; startDate: string; endDate: string }>(
        "/policies", {
          customerId,
          insuranceCompanyId: carrierId,
          policyType: row.plateNumber ? "Auto" : "Other",
          startDate: priorStart,
          endDate: priorEnd,
          premium: Math.abs(Number(priorPremium) || 0),
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

/**
 * Renders the "Απαιτούμενες αντιστοιχίσεις" checklist. Each unmapped raw code
 * gets a row with either (a) a searchable dropdown of the agency's own
 * parametrics (for Branch / Coverage / Use / Package) or a carrier picker (for
 * Company), plus a compact "+ νέο" affordance that captures a code + name and
 * defers actual creation to the commit endpoint. Once every entry is
 * resolved, the "Εισαγωγή" button in the KPI card above unblocks.
 */
function UnmappedCodesPanel({ unmapped, resolutions, onChange, parametrics, parametricsLoading, insuranceCompanies, producers, unmapKey, isResolved }: {
  unmapped: UnmappedCode[];
  resolutions: Record<string, MappingResolution>;
  onChange: (r: Record<string, MappingResolution>) => void;
  parametrics: CompanyParameterItemLite[];
  parametricsLoading: boolean;
  insuranceCompanies: { id: string; name: string; code: string; }[];
  producers: { id: string; code: string; name: string; }[];
  unmapKey: (u: UnmappedCode) => string;
  isResolved: (u: UnmappedCode) => boolean;
}) {
  const paramsByKind: Record<MappingKind, CompanyParameterItemLite[]> = {
    Company: [], Branch: [], Coverage: [], Use: [], Package: [], Producer: []
  };
  for (const p of parametrics) {
    const k = p.kind as MappingKind;
    if (k in paramsByKind) paramsByKind[k].push(p);
  }
  const patch = (key: string, next: MappingResolution) =>
    onChange({ ...resolutions, [key]: next });

  const unresolvedCount = unmapped.filter(u => !isResolved(u)).length;
  return (
    <Card sx={{ p: 2.5, mb: 2, borderLeft: 4, borderLeftColor: unresolvedCount > 0 ? "warning.main" : "success.main" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
        <LinkIcon color={unresolvedCount > 0 ? "warning" : "success"} />
        <Typography fontWeight={800}>
          {unresolvedCount > 0
            ? `Απαιτούμενες αντιστοιχίσεις — ${unresolvedCount} / ${unmapped.length}`
            : `Όλες οι αντιστοιχίσεις έτοιμες — ${unmapped.length}`}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Η γέφυρα έφερε κωδικούς που το γραφείο δεν έχει ξανασυναντήσει.
        Αντιστοιχίστε καθέναν με ένα δικό σας παραμετρικό, ή δημιουργήστε
        νέο επί τόπου (θα σωθεί στην εισαγωγή και οι επόμενες γέφυρες θα
        χτυπάνε αυτόματα εκεί).
      </Typography>
      <Stack spacing={1.25}>
        {unmapped.map(u => {
          const key = unmapKey(u);
          const r = resolutions[key] ?? {};
          const options = paramsByKind[u.kind] ?? [];
          const done = isResolved(u);
          return (
            <Box key={key} sx={{
              p: 1.25, borderRadius: 1,
              border: 1, borderColor: done ? "success.light" : "divider",
              bgcolor: done ? "success.lighter" : "background.paper"
            }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
                <Chip size="small" label={KIND_LABEL[u.kind]} color={done ? "success" : "default"} />
                <Box sx={{ minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">Raw κωδικός</Typography>
                  <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{u.rawCode}</Typography>
                  {u.rawLabel && <Typography variant="caption" color="text.secondary">{u.rawLabel}</Typography>}
                </Box>
                <Chip size="small" variant="outlined" label={`${u.occurrences}×`} />
                <Box sx={{ flex: 1 }}>
                  {u.kind === "Company" ? (
                    <Autocomplete
                      size="small"
                      options={insuranceCompanies}
                      getOptionLabel={o => `${o.name} · ${o.code}`}
                      value={insuranceCompanies.find(c => c.id === r.targetInsuranceCompanyId) ?? null}
                      onChange={(_, v) => patch(key, { ...r, targetInsuranceCompanyId: v?.id ?? undefined, targetParameterItemId: undefined })}
                      renderInput={params => <TextField {...params} label="Αντιστοίχιση σε ασφαλιστική" />}
                    />
                  ) : u.kind === "Producer" ? (
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <Autocomplete
                        sx={{ flex: 1 }}
                        size="small"
                        options={producers}
                        getOptionLabel={o => `${o.code} · ${o.name}`}
                        value={producers.find(o => o.id === r.targetProducerId) ?? null}
                        onChange={(_, v) => patch(key, {
                          ...r,
                          targetProducerId: v?.id ?? undefined,
                          createProducerCode: v ? undefined : r.createProducerCode,
                          createProducerName: v ? undefined : r.createProducerName,
                        })}
                        renderInput={params => <TextField {...params} label="Αντιστοίχιση σε συνεργάτη" />}
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">ή νέος →</Typography>
                        <TextField
                          size="small" label="Κωδικός" sx={{ width: 110 }}
                          value={r.createProducerCode ?? ""}
                          onChange={e => patch(key, { ...r, createProducerCode: e.target.value.toUpperCase(), targetProducerId: undefined })}
                        />
                        <TextField
                          size="small" label="Όνομα" sx={{ minWidth: 180 }}
                          value={r.createProducerName ?? ""}
                          onChange={e => patch(key, { ...r, createProducerName: e.target.value, targetProducerId: undefined })}
                        />
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <Autocomplete
                        sx={{ flex: 1 }}
                        size="small"
                        options={options}
                        loading={parametricsLoading}
                        getOptionLabel={o => `${o.code} · ${o.name}`}
                        value={options.find(o => o.id === r.targetParameterItemId) ?? null}
                        onChange={(_, v) => patch(key, {
                          ...r,
                          targetParameterItemId: v?.id ?? undefined,
                          createParametricCode: v ? undefined : r.createParametricCode,
                          createParametricName: v ? undefined : r.createParametricName,
                        })}
                        renderInput={params => <TextField {...params} label={`Αντιστοίχιση σε ${KIND_LABEL[u.kind]}`} />}
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">ή νέο →</Typography>
                        <TextField
                          size="small" label="Κωδικός" sx={{ width: 110 }}
                          value={r.createParametricCode ?? ""}
                          onChange={e => patch(key, { ...r, createParametricCode: e.target.value.toUpperCase(), targetParameterItemId: undefined })}
                        />
                        <TextField
                          size="small" label="Όνομα" sx={{ minWidth: 180 }}
                          value={r.createParametricName ?? ""}
                          onChange={e => patch(key, { ...r, createParametricName: e.target.value, targetParameterItemId: undefined })}
                        />
                      </Stack>
                    </Stack>
                  )}
                </Box>
                {done && <CheckCircleIcon color="success" />}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}

/**
 * "Link the bridge to one of your carriers" gate — shows up the moment the
 * operator picks a Kalypsis-provided carrier (ERGO / INTERLIFE / …) that has
 * no BridgeCodeMapping (Kind=Company) pointing at one of their own carriers
 * yet. The link is a hard prerequisite: imported policies always land under
 * the office's own carrier, never under a shared global. The dialog also
 * offers an inline "+ Νέα ασφαλιστική" so an office setting up its first
 * bridge doesn't have to leave the flow.
 */
function LinkCarrierDialog({ open, sourceCarrierName, sourceCarrierCode, onClose, onLinked }: {
  open: boolean;
  sourceCarrierName: string;
  sourceCarrierCode: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [targetId, setTargetId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [inlineCreate, setInlineCreate] = useState<string | null>(null);

  const carriers = useQuery({
    queryKey: ["insurance-companies", "for-bridge-link"],
    enabled: open,
    queryFn: async () => (await api.get<Array<{
      id: string; name: string; code: string; isGlobal: boolean; isUsedByTenant?: boolean;
    }>>("/insurance-companies")).data
  });
  const tenantCarriers = useMemo(() => {
    // Only show the office's own carriers as valid link targets — a global
    // is never a valid "own catalogue" target (we'd loop right back to the
    // gate). Legacy globals the tenant opted into are kept, so historical
    // carriers keep working.
    return (carriers.data ?? []).filter(c => !c.isGlobal || c.isUsedByTenant);
  }, [carriers.data]);

  const link = useMutation({
    mutationFn: async () => {
      return (await api.post("/bridge-code-mappings", {
        kind: "Company",
        sourceCarrier: sourceCarrierName,
        rawCode: sourceCarrierCode || sourceCarrierName,
        rawLabel: sourceCarrierName,
        targetInsuranceCompanyId: targetId,
        targetParameterItemId: null,
        notes: null,
      })).data;
    },
    onSuccess: onLinked,
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Σύνδεση γέφυρας με το γραφείο σας</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Πριν εισάγετε δεδομένα από τη γέφυρα <strong>{sourceCarrierName}</strong>, συνδέστε τη
          με μία δική σας ασφαλιστική. Τα εισαγόμενα συμβόλαια θα καταχωρηθούν εκεί, με τη δική σας κωδικοποίηση.
        </Alert>
        <Stack spacing={2}>
          <SearchableSelect
            label="Δική σας ασφαλιστική εταιρεία"
            value={targetId}
            onChange={(v: string | "") => setTargetId(v as string)}
            options={tenantCarriers.map(c => ({ value: c.id, label: c.name, hint: c.code }))}
            createNewLabel="+ Νέα ασφαλιστική"
            onCreateNew={(input: string) => setInlineCreate(input || sourceCarrierName)}
          />
          <InlineCreateInsuranceCompanyDialog
            open={inlineCreate !== null}
            prefillText={inlineCreate ?? ""}
            onClose={() => setInlineCreate(null)}
            onCreated={c => { setTargetId(c.id); setInlineCreate(null); void carriers.refetch(); }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={!targetId || link.isPending} onClick={() => link.mutate()}>
          {link.isPending ? <CircularProgress size={18} /> : "Σύνδεση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
