import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Drawer,
  FormControlLabel, IconButton, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import SettingsIcon from "@mui/icons-material/Settings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface CarrierEnableRow {
  carrierId: string; carrierName: string; carrierCode: string;
  enabled: boolean; enabledAt: string | null; notes: string | null;
  mappingConfigured: boolean; mappingReady: boolean;
}
interface TenantOcMatrixRow {
  tenantId: string; tenantName: string; tenantCode: string;
  carriers: CarrierEnableRow[];
}

/**
 * PlatformAdmin matrix: rows = tenants, columns = supported OC-bridge
 * carriers (ERGO, Grand Cover, Interlife, Ατλαντική). Clicking a
 * Switch enables or disables the OC bridge for that (tenant, carrier)
 * pair. Backend writes to `tenant_over_commission_bridge_enables`,
 * and the tenant's /app/over-commission-bridges page flips
 * «Μη διαθέσιμο» → «Διαθέσιμο» for that carrier accordingly.
 *
 * Kept intentionally minimal — no bulk toggles, no per-tenant detail
 * page, no notes UI. All you need is «is this pair on». Bulk +
 * notes can grow here later without a schema change.
 */
export function PlatformOverCommissionBridgesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["platform-oc-bridges-matrix"],
    queryFn: async () => (await api.get<TenantOcMatrixRow[]>(
      "/platform/over-commission-bridges/matrix")).data,
  });

  // Mapping editor state — populated when the operator clicks the
  // «⚙» icon on any cell. Drawer opens on the right with a JSON
  // editor + IsReady toggle. GET/PUT hit
  // /platform/over-commission-bridges/tenants/{t}/carriers/{c}/mapping.
  const [mappingCtx, setMappingCtx] = useState<{
    tenantId: string; tenantName: string;
    carrierId: string; carrierName: string;
  } | null>(null);

  const toggle = useMutation({
    // Optimistic — flip the switch immediately, roll back on error.
    mutationFn: async (p: { tenantId: string; carrierId: string; enable: boolean }) => {
      const url = `/platform/over-commission-bridges/tenants/${p.tenantId}/carriers/${p.carrierId}`;
      if (p.enable) await api.post(url, {});
      else await api.delete(url);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-oc-bridges-matrix"] }),
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const rows = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.trim().toLowerCase();
    return list.filter(t =>
      t.tenantName.toLowerCase().includes(s) ||
      t.tenantCode.toLowerCase().includes(s));
  }, [q.data, search]);

  // Column header = the same list of carriers for every row (backend
  // guarantees they're all identical). Pull from the first row.
  const carrierCols = q.data?.[0]?.carriers ?? [];

  const totalEnabled = useMemo(() =>
    (q.data ?? []).reduce((sum, t) => sum + t.carriers.filter(c => c.enabled).length, 0),
    [q.data]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <LinkIcon color="primary" sx={{ fontSize: 32 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={800}>Γέφυρες Υπερπρομηθειών (per-tenant)</Typography>
          <Typography variant="body2" color="text.secondary">
            Ενεργοποιήστε ή απενεργοποιήστε OC bridge ανά γραφείο. Μόνο
            οι πάροχοι με διαθέσιμο parser εμφανίζονται στις στήλες.
          </Typography>
        </Box>
        <Chip icon={<CheckCircleIcon />} label={`${totalEnabled} ενεργοποιήσεις`}
          color="success" variant="outlined" />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card variant="outlined">
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}
          sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}
          alignItems={{ md: "center" }}>
          <TextField size="small" placeholder="Αναζήτηση γραφείου (όνομα / κωδικός)"
            value={search} onChange={e => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }} />
          <Chip size="small" variant="outlined"
            label={`${rows.length} / ${q.data?.length ?? 0} γραφεία`} />
          {search && (
            <IconButton size="small" onClick={() => setSearch("")}>×</IconButton>
          )}
        </Stack>

        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>Γραφείο</TableCell>
                  {carrierCols.map(c => (
                    <TableCell key={c.carrierId} align="center"
                      sx={{ fontWeight: 700, minWidth: 130 }}>
                      {c.carrierName}
                      <Typography variant="caption" component="div" color="text.secondary"
                        sx={{ fontFamily: "monospace" }}>
                        {c.carrierCode}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(t => (
                  <TableRow key={t.tenantId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{t.tenantName}</Typography>
                      <Typography variant="caption" color="text.secondary"
                        sx={{ fontFamily: "monospace" }}>{t.tenantCode}</Typography>
                    </TableCell>
                    {t.carriers.map(c => (
                      <TableCell key={c.carrierId} align="center">
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                          <Tooltip title={c.enabled
                            ? `Ενεργό από ${c.enabledAt ? new Date(c.enabledAt).toLocaleDateString("el-GR") : "—"}`
                            : "Ανενεργό — το γραφείο βλέπει «Μη διαθέσιμο»"}>
                            <span>
                              <Switch size="small" checked={c.enabled}
                                disabled={toggle.isPending}
                                onChange={e => toggle.mutate({
                                  tenantId: t.tenantId,
                                  carrierId: c.carrierId,
                                  enable: e.target.checked,
                                })} />
                            </span>
                          </Tooltip>
                          <Tooltip title={
                            c.mappingReady ? "Mapping OK — «Διαθέσιμο» στο γραφείο"
                            : c.mappingConfigured ? "Mapping υπάρχει αλλά δεν είναι marked-ready"
                            : "Χωρίς mapping — άνοιξε ρυθμίσεις"
                          }>
                            <IconButton size="small"
                              onClick={() => setMappingCtx({
                                tenantId: t.tenantId, tenantName: t.tenantName,
                                carrierId: c.carrierId, carrierName: c.carrierName,
                              })}
                              sx={{
                                color: c.mappingReady ? "success.main"
                                  : c.mappingConfigured ? "warning.main"
                                  : "text.disabled",
                              }}>
                              <SettingsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={carrierCols.length + 1}
                      sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                      <BlockIcon sx={{ fontSize: 32, mb: 1, color: "text.disabled" }} />
                      <Typography variant="body2">
                        {search
                          ? `Δεν βρέθηκε γραφείο για «${search}».`
                          : "Δεν υπάρχουν γραφεία."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {mappingCtx && (
        <MappingEditorDrawer ctx={mappingCtx}
          onClose={() => setMappingCtx(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["platform-oc-bridges-matrix"] })} />
      )}
    </Box>
  );
}

interface MappingDto {
  tenantId: string; carrierId: string; carrierName: string; carrierCode: string;
  configJson: string; isReady: boolean;
  lastTestedAt: string | null; lastTestResult: string | null;
  updatedAt: string | null;
}

function MappingEditorDrawer({ ctx, onClose, onSaved }: {
  ctx: { tenantId: string; tenantName: string; carrierId: string; carrierName: string };
  onClose: () => void; onSaved: () => void;
}) {
  const [config, setConfig] = useState("");
  const [ready, setReady] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const url = `/platform/over-commission-bridges/tenants/${ctx.tenantId}/carriers/${ctx.carrierId}/mapping`;

  const q = useQuery({
    queryKey: ["oc-mapping", ctx.tenantId, ctx.carrierId],
    queryFn: async () => (await api.get<MappingDto>(url)).data,
  });

  useEffect(() => {
    if (!q.data) return;
    try {
      const parsed = JSON.parse(q.data.configJson || "{}");
      setConfig(JSON.stringify(parsed, null, 2));
    } catch { setConfig(q.data.configJson || "{}"); }
    setReady(q.data.isReady);
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      try { JSON.parse(config); setJsonError(null); }
      catch (e: any) { setJsonError(`Άκυρο JSON: ${e.message}`); throw e; }
      await api.put(url, { configJson: config, isReady: ready });
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setSaveError(extractErrorMessage(e)),
  });

  return (
    <Drawer anchor="right" open onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 560 } } }}>
      <Box sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}>
        <Typography variant="h6" fontWeight={700}>Mapping αρχείου</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {ctx.tenantName} · <b>{ctx.carrierName}</b>
        </Typography>

        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
              Παραμετροποίηση parser (JSON) — headers, delimiter, column indexes κ.λπ.
            </Typography>
            <TextField multiline minRows={16} maxRows={24} fullWidth
              value={config} onChange={e => { setConfig(e.target.value); setJsonError(null); }}
              error={!!jsonError} helperText={jsonError ?? " "}
              InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }} />

            <FormControlLabel sx={{ mt: 1 }}
              control={<Switch checked={ready} onChange={e => setReady(e.target.checked)} />}
              label="Mapping έτοιμο — το γραφείο μπορεί να δει «Διαθέσιμο»" />

            {q.data?.lastTestedAt && (
              <Typography variant="caption" color="text.secondary">
                Τελευταίο τεστ: {new Date(q.data.lastTestedAt).toLocaleString("el-GR")}
                {q.data.lastTestResult ? ` — ${q.data.lastTestResult}` : ""}
              </Typography>
            )}

            {saveError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setSaveError(null)}>{saveError}</Alert>}

            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button onClick={onClose}>Ακύρωση</Button>
              <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
                Αποθήκευση
              </Button>
            </Stack>
          </>
        )}
      </Box>
    </Drawer>
  );
}
