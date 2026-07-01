import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, MenuItem,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import StackedBarChartIcon from "@mui/icons-material/StackedBarChart";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import CalculateIcon from "@mui/icons-material/Calculate";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, date } from "../utils/format";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { SearchableSelect } from "../components/SearchableSelect";

interface Carrier { id: string; name: string; isBroker?: boolean; parentCompanyId?: string | null; }
interface Producer { id: string; name: string; }
interface Row {
  policyId: string; policyNumber: string;
  startDate: string; endDate: string;
  customerName: string; insuranceCompany: string; producer: string | null;
  policyType: string; vehicleUseCategory: string | null; coverCode: string | null; status: string;
  gross: number; net: number; vat: number;
  partnerCommissionPercent: number; partnerCommission: number;
  agencyCommissionPercent: number; agencyCommission: number;
  incomingAgencyCommissionPercent: number; incomingAgencyCommission: number;
  commissionWarning: string | null;
}
interface GroupTotal { key: string; count: number; gross: number; net: number; vat: number; partnerCommission: number; agencyCommission: number; }
interface Result {
  count: number;
  rows: Row[];
  groups: GroupTotal[];
  grand: GroupTotal;
}

const STATUSES = ["Draft", "Active", "Expired", "Cancelled", "Renewed", "PendingRenewal"];

interface ParamItem {
  id: string;
  kind: "Branch" | "Coverage" | "Use" | "Package" | "BridgeCode" | "Field" | "Other";
  code: string;
  name: string;
  policyType: string | null;
  vehicleUseCategory: string | null;
  parentCode: string | null;
}

export function ProductionListsPage() {
  const { t } = useTranslation();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [f, setF] = useState({
    from: monthStart, to: todayStr,
    insuranceCompanyId: "", producerId: "",
    policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "",
    status: "", groupBy: "carrier"
  });

  const carriers = useQuery({
    queryKey: ["carriers-prod-list"],
    queryFn: async () => (await api.get<Carrier[]>("/insurance-companies")).data
  });
  const producers = useQuery({
    queryKey: ["producers-prod-list"],
    queryFn: async () => (await api.get<Producer[]>("/producers")).data
  });
  const carrierParams = useQuery({
    queryKey: ["company-parameters-prod-list", f.insuranceCompanyId],
    queryFn: async () => (await api.get<ParamItem[]>("/company-parameters", {
      params: { insuranceCompanyId: f.insuranceCompanyId }
    })).data,
    enabled: !!f.insuranceCompanyId,
  });

  // Strict: only show real παραμετρικά. No enum fallback.
  const branchOptions = useMemo(() => {
    if (!f.insuranceCompanyId) return [];
    return (carrierParams.data ?? [])
      .filter(p => p.kind === "Branch" && p.policyType)
      .map(p => ({ key: `param:${p.id}`, value: p.policyType!, label: p.name }));
  }, [carrierParams.data, f.insuranceCompanyId]);

  const useOptions = useMemo(() => {
    if (!f.insuranceCompanyId) return [];
    return (carrierParams.data ?? [])
      .filter(p => p.kind === "Use" && p.vehicleUseCategory && p.vehicleUseCategory !== "None")
      .map(p => ({ key: `param:${p.id}`, value: p.vehicleUseCategory!, label: p.name }));
  }, [carrierParams.data, f.insuranceCompanyId]);

  // Carrier-driven coverages and packages, identical scoping rules to the
  // Κλάδος / Χρήση dropdowns. The /company-parameters endpoint already
  // cascades broker → all subs' packages when the user picks a broker, and
  // returns just the sub's packages when they drill into one.
  const coverageOptions = useMemo(() => {
    if (!f.insuranceCompanyId) return [];
    return (carrierParams.data ?? [])
      .filter(p => p.kind === "Coverage" && p.code)
      .map(p => ({ key: `cov:${p.id}`, value: p.code, label: `${p.name} (${p.code})` }));
  }, [carrierParams.data, f.insuranceCompanyId]);

  const packageOptions = useMemo(() => {
    if (!f.insuranceCompanyId) return [];
    return (carrierParams.data ?? [])
      .filter(p => p.kind === "Package" && p.code)
      .map(p => ({ key: `pkg:${p.id}`, value: p.code, label: `${p.name} (${p.code})` }));
  }, [carrierParams.data, f.insuranceCompanyId]);

  const params = {
    from: f.from || undefined,
    to: f.to || undefined,
    insuranceCompanyId: f.insuranceCompanyId || undefined,
    producerId: f.producerId || undefined,
    policyType: f.policyType || undefined,
    vehicleUseCategory: f.vehicleUseCategory || undefined,
    coverCode: f.coverCode.trim() || undefined,
    packageCode: f.packageCode || undefined,
    status: f.status || undefined,
    groupBy: f.groupBy || undefined
  };

  const q = useQuery({
    queryKey: ["production-list", params],
    queryFn: async () => (await api.get<Result>("/production-lists", { params })).data
  });

  async function downloadExport(fmt: "csv" | "xlsx" | "pdf") {
    const res = await api.get("/production-lists/export", {
      params: { ...params, format: fmt },
      responseType: "blob"
    });
    const mime = fmt === "csv"  ? "text/csv"
              : fmt === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf";
    const blob = new Blob([res.data], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const ts   = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `production-${ts}.${fmt}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <StackedBarChartIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("productionList.title")}</Typography>
              <HelpHint id="page.productionList" />
            </Stack>
            <Typography color="text.secondary">{t("productionList.subtitle")}</Typography>
          </Box>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1}>
          <SavedReportsButton entity="production-lists" currentFilters={f} onLoad={(next) => setF({ ...f, ...next })} />
          <Button component={RouterLink} to="/app/commission-runs" variant="outlined" color="secondary" startIcon={<CalculateIcon />}>
            Εκκαθαρίσεις προμηθειών
          </Button>
          <Button variant="outlined" startIcon={<TableChartIcon />} onClick={() => downloadExport("csv")}>CSV</Button>
          <Button variant="outlined" startIcon={<GridOnIcon />} onClick={() => downloadExport("xlsx")}>Excel</Button>
          <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={() => downloadExport("pdf")}>PDF</Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Οι λίστες παραγωγής είναι αναφορά και εξαγωγή του χαρτοφυλακίου. Από το «Εκκαθαρίσεις προμηθειών» δημιουργείτε, ελέγχετε και οριστικοποιείτε τις μηνιαίες εκκαθαρίσεις συνεργατών.
      </Alert>

      <Card sx={{ p: 2.5, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <FilterAltIcon color="primary" />
          <Typography fontWeight={700}>{t("productionList.filters")}</Typography>
        </Stack>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
          <TextField type="date" size="small" InputLabelProps={{ shrink: true }} label={t("productionList.from")}
            value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />
          <TextField type="date" size="small" InputLabelProps={{ shrink: true }} label={t("productionList.to")}
            value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
          <SearchableSelect
            label={t("productionList.carrier")}
            value={f.insuranceCompanyId}
            onChange={(v) => setF({ ...f, insuranceCompanyId: v, policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "" })}
            emptyLabel={t("common.all")}
            options={(carriers.data ?? []).filter(c => !c.parentCompanyId).map(c => ({
              value: c.id, label: c.name, hint: c.isBroker ? "πρακτορείο" : undefined,
            }))}
          />
          {(() => {
            const carrierData = carriers.data ?? [];
            const selected = carrierData.find(c => c.id === f.insuranceCompanyId);
            // Show the sub-picker when EITHER the broker is selected OR a
            // sub of the broker is selected — so the user can switch
            // between subs without going back to the broker first.
            const broker = selected?.isBroker
              ? selected
              : selected?.parentCompanyId
                ? carrierData.find(c => c.id === selected.parentCompanyId)
                : null;
            if (!broker?.isBroker) return null;
            const subs = carrierData.filter(c => c.parentCompanyId === broker.id);
            const subValue = selected?.id !== broker.id ? selected?.id ?? "" : "";
            return (
              <SearchableSelect
                label="Υποασφαλιστική"
                value={subValue}
                onChange={(v) => setF({ ...f, insuranceCompanyId: v || broker.id })}
                emptyLabel="— όλες οι υποασφαλιστικές —"
                options={subs.map(s => ({ value: s.id, label: s.name }))}
              />
            );
          })()}
          <SearchableSelect
            label={t("productionList.producer")}
            value={f.producerId} onChange={(v) => setF({ ...f, producerId: v })}
            emptyLabel={t("common.all")}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />
          <SearchableSelect
            label={t("productionList.type")}
            value={f.policyType} onChange={(v) => setF({ ...f, policyType: v })}
            disabled={!f.insuranceCompanyId}
            helperText={!f.insuranceCompanyId
              ? "Επιλέξτε εταιρία"
              : branchOptions.length === 0 ? "Δεν υπάρχουν παραμετρικά" : "Από παραμετρικά"}
            emptyLabel={t("common.all")}
            options={branchOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableSelect
            label="Χρήση οχήματος"
            value={f.vehicleUseCategory} onChange={(v) => setF({ ...f, vehicleUseCategory: v })}
            disabled={!f.insuranceCompanyId}
            helperText={!f.insuranceCompanyId
              ? "Επιλέξτε εταιρία"
              : useOptions.length === 0 ? "Δεν υπάρχουν παραμετρικά" : "Από παραμετρικά"}
            emptyLabel={t("common.all")}
            options={useOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableSelect
            label="Κάλυψη"
            value={f.coverCode} onChange={(v) => setF({ ...f, coverCode: v })}
            disabled={!f.insuranceCompanyId}
            helperText={!f.insuranceCompanyId
              ? "Επιλέξτε εταιρία"
              : coverageOptions.length === 0 ? "Δεν υπάρχουν παραμετρικά" : "Από παραμετρικά"}
            emptyLabel={t("common.all")}
            options={coverageOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableSelect
            label="Πακέτο"
            value={f.packageCode} onChange={(v) => setF({ ...f, packageCode: v })}
            disabled={!f.insuranceCompanyId}
            helperText={!f.insuranceCompanyId
              ? "Επιλέξτε εταιρία"
              : packageOptions.length === 0 ? "Δεν υπάρχουν πακέτα" : "Από παραμετρικά"}
            emptyLabel={t("common.all")}
            options={packageOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <TextField select size="small" label={t("productionList.status")} value={f.status}
            onChange={e => setF({ ...f, status: e.target.value })}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={t("productionList.groupBy")} value={f.groupBy}
            onChange={e => setF({ ...f, groupBy: e.target.value })}>
            <MenuItem value="">{t("productionList.noGrouping")}</MenuItem>
            <MenuItem value="carrier">{t("productionList.byCarrier")}</MenuItem>
            <MenuItem value="producer">{t("productionList.byProducer")}</MenuItem>
            <MenuItem value="type">{t("productionList.byType")}</MenuItem>
            <MenuItem value="month">{t("productionList.byMonth")}</MenuItem>
          </TextField>
        </Box>
        <Stack direction="row" justifyContent="flex-end" mt={1.5}>
          <Button size="small" variant="text" color="inherit"
            onClick={() => setF({
              from: monthStart, to: todayStr,
              insuranceCompanyId: "", producerId: "",
              policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "",
              status: "", groupBy: "carrier"
            })}>
            Καθαρισμός φίλτρων
          </Button>
        </Stack>
      </Card>

      {q.isLoading ? <CircularProgress /> : !q.data ? null : (
        <>
          {/* Grand totals strip */}
          <Card sx={{ p: 2.5, mb: 2, bgcolor: "rgba(11,37,69,0.04)" }}>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Kpi label={t("productionList.kpi.policies")} value={q.data.grand.count} />
              <Kpi label={t("productionList.kpi.gross")} value={money(q.data.grand.gross)} />
              <Kpi label={t("productionList.kpi.net")} value={money(q.data.grand.net)} />
              <Kpi label={t("productionList.kpi.vat")} value={money(q.data.grand.vat)} />
              <Kpi label={t("productionList.kpi.partnerComm")} value={money(q.data.grand.partnerCommission)} color="warning.main" />
              <Kpi label={t("productionList.kpi.agencyComm")} value={money(q.data.grand.agencyCommission)} color="success.main" />
            </Stack>
          </Card>

          {/* Group totals (if grouping enabled) */}
          {q.data.groups.length > 0 && (
            <Card sx={{ p: 2, mb: 2 }} variant="outlined">
              <Typography fontWeight={700} mb={1}>{t("productionList.groupTotals")}</Typography>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>{t("productionList.group")}</TableCell>
                  <TableCell align="right">{t("productionList.count")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.gross")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.net")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.partnerComm")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.agencyComm")}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {q.data.groups.map(g => (
                    <TableRow key={g.key} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{g.key}</TableCell>
                      <TableCell align="right">{g.count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{money(g.gross)}</TableCell>
                      <TableCell align="right">{money(g.net)}</TableCell>
                      <TableCell align="right" sx={{ color: "warning.main" }}>{money(g.partnerCommission)}</TableCell>
                      <TableCell align="right" sx={{ color: "success.main", fontWeight: 700 }}>{money(g.agencyCommission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Detailed rows */}
          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{t("productionList.col.policy")}</TableCell>
                <TableCell>{t("productionList.col.start")}</TableCell>
                <TableCell>{t("productionList.col.customer")}</TableCell>
                <TableCell>{t("productionList.col.carrier")}</TableCell>
                <TableCell>{t("productionList.col.producer")}</TableCell>
                <TableCell>{t("productionList.col.type")}</TableCell>
                <TableCell>Χρήση</TableCell>
                <TableCell>Κάλυψη</TableCell>
                <TableCell align="right">{t("productionList.col.gross")}</TableCell>
                <TableCell align="right">{t("productionList.col.net")}</TableCell>
                <TableCell align="right">Προμ. γέφυρας/έδρας</TableCell>
                <TableCell align="right">{t("productionList.col.partnerPct")}</TableCell>
                <TableCell align="right">{t("productionList.col.partner")}</TableCell>
                <TableCell align="right">{t("productionList.col.agency")}</TableCell>
                <TableCell>Έλεγχος</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {q.data.rows.length === 0 && (
                  <TableRow><TableCell colSpan={15} align="center" sx={{ py: 4, color: "text.secondary" }}>{t("productionList.empty")}</TableCell></TableRow>
                )}
                {q.data.rows.map(r => (
                  <TableRow key={r.policyId} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{date(r.startDate)}</TableCell>
                    <TableCell>{r.customerName}</TableCell>
                    <TableCell>{r.insuranceCompany}</TableCell>
                    <TableCell>{r.producer ?? "—"}</TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={r.policyType} /></TableCell>
                    <TableCell>{r.vehicleUseCategory ? <Chip size="small" label={r.vehicleUseCategory} /> : "—"}</TableCell>
                    <TableCell>{r.coverCode ? <Chip size="small" variant="outlined" label={r.coverCode} /> : "—"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{money(r.gross)}</TableCell>
                    <TableCell align="right">{money(r.net)}</TableCell>
                    <TableCell align="right" sx={{ color: "info.main" }}>
                      {money(r.incomingAgencyCommission)} ({r.incomingAgencyCommissionPercent.toFixed(1)}%)
                    </TableCell>
                    <TableCell align="right" sx={{ color: "text.secondary" }}>{r.partnerCommissionPercent.toFixed(1)}%</TableCell>
                    <TableCell align="right" sx={{ color: "warning.main" }}>{money(r.partnerCommission)}</TableCell>
                    <TableCell align="right" sx={{ color: "success.main", fontWeight: 700 }}>{money(r.agencyCommission)}</TableCell>
                    <TableCell>
                      {r.commissionWarning
                        ? <Chip size="small" color="warning" label="Έλεγχος σύμβασης" title={r.commissionWarning} />
                        : <Chip size="small" color="success" variant="outlined" label="OK" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Alert severity="info" icon={<DownloadIcon />} sx={{ mt: 2 }}>
            {t("productionList.note")}
          </Alert>
        </>
      )}
    </Box>
  );
}

function Kpi({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color: color ?? "text.primary" }}>{value}</Typography>
    </Box>
  );
}
