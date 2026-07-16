import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, IconButton, InputAdornment,
  Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography
} from "@mui/material";
import PaymentsIcon from "@mui/icons-material/Payments";
import EuroIcon from "@mui/icons-material/Euro";
import SaveIcon from "@mui/icons-material/Save";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import BlockIcon from "@mui/icons-material/Block";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { TenantChargeablesPanel } from "./PlatformAdminPages";

type PackageCode = "BackOffice" | "FrontOffice" | "Crm" | "Intelligence" | "Integrations";
const ALL_PACKAGES: PackageCode[] = ["BackOffice","FrontOffice","Crm","Intelligence","Integrations"];

interface PackagePrice {
  tenantId: string; tenantName: string; tenantCode: string;
  package: PackageCode;
  monthlyPrice: number | null;
  currency: string;
  enabledAt: string;
  notes: string | null;
  /** True when the tenant has this package granted (regardless of price). */
  granted: boolean;
}
interface TenantBillingRow {
  tenantId: string; tenantName: string; tenantCode: string;
  tenantActive: boolean;
  packages: PackagePrice[];
  monthlyTotal: number;
  pricedCount: number;
  unpricedCount: number;
  currency: string;
}
interface BillingSummary {
  monthlyTotal: number; annualTotal: number;
  tenantsTotal: number; tenantsWithRevenue: number;
  averageRevenuePerTenant: number; currency: string;
  byPackage: { package: PackageCode; tenantCount: number; monthlyTotal: number; }[];
}

export function PlatformBillingConfigPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  // Tab persisted in the query string so external links / redirects from the
  // old /platform/chargeables route can deep-link straight to the chargeables
  // tab (?tab=chargeables). Defaults to the subscription pricing grid.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "chargeables" ? "chargeables" : "subscriptions";

  const tenants = useQuery({
    queryKey: ["platform-billing", "tenants"],
    queryFn: async () => (await api.get<TenantBillingRow[]>("/platform/billing/tenants")).data,
    enabled: tab === "subscriptions"
  });
  const summary = useQuery({
    queryKey: ["platform-billing", "summary"],
    queryFn: async () => (await api.get<BillingSummary>("/platform/billing/summary")).data,
    enabled: tab === "subscriptions"
  });

  const fmt = useMemo(
    () => new Intl.NumberFormat(i18n.language || "el-GR", { style: "currency", currency: "EUR" }),
    [i18n.language]
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
        <PaymentsIcon sx={{ fontSize: 36 }} color="primary" />
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("billing.title")}</Typography>
          <Typography color="text.secondary">{t("billing.subtitle")}</Typography>
        </Box>
        <Button component={RouterLink} to="/app/platform/invoices"
          variant="contained" startIcon={<ReceiptLongIcon />}>
          {t("billing.openInvoices")}
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "subscriptions") next.delete("tab"); else next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="subscriptions" label={t("billing.tabs.subscriptions", "Πακέτα & Τιμές συνδρομής")} />
        <Tab value="chargeables"   label={t("billing.tabs.chargeables",   "Έκτακτες Χρεώσεις")} />
      </Tabs>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {tab === "chargeables" && <TenantChargeablesPanel />}

      {tab === "subscriptions" && <>


      {/* Summary strip */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }
      }}>
        <Kpi label={t("billing.kpi.mrr")} value={summary.data ? fmt.format(summary.data.monthlyTotal) : "—"} highlight />
        <Kpi label={t("billing.kpi.arr")} value={summary.data ? fmt.format(summary.data.annualTotal) : "—"} />
        <Kpi label={t("billing.kpi.tenants")} value={summary.data ? `${summary.data.tenantsWithRevenue} / ${summary.data.tenantsTotal}` : "—"} />
        <Kpi label={t("billing.kpi.arpa")} value={summary.data ? fmt.format(summary.data.averageRevenuePerTenant) : "—"} />
      </Box>

      {/* Per-package breakdown */}
      {summary.data && summary.data.byPackage.length > 0 && (
        <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography fontSize={12} sx={{ letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", mb: 1.5 }}>
            {t("billing.byPackage")}
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {summary.data.byPackage.map(p => (
              <Box key={p.package} sx={{
                border: "1px solid", borderColor: "divider", borderRadius: 2,
                px: 2, py: 1.25, minWidth: 180
              }}>
                <Typography fontSize={13} fontWeight={700}>{p.package}</Typography>
                <Typography fontSize={20} fontWeight={800}>{fmt.format(p.monthlyTotal)}</Typography>
                <Typography fontSize={12} color="text.secondary">{p.tenantCount} {t("billing.tenants")}</Typography>
              </Box>
            ))}
          </Stack>
        </Card>
      )}

      {tenants.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("billing.col.tenant")}</TableCell>
                {ALL_PACKAGES.map(p => (
                  <TableCell key={p} align="right" sx={{ minWidth: 140 }}>{p}</TableCell>
                ))}
                <TableCell align="right" sx={{ minWidth: 140 }}>{t("billing.col.total")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(tenants.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={ALL_PACKAGES.length + 2} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  {t("billing.empty")}
                </TableCell></TableRow>
              )}
              {(tenants.data ?? []).map(row => (
                <TableRow key={row.tenantId} hover>
                  <TableCell>
                    <Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={700}>{row.tenantName}</Typography>
                        {!row.tenantActive && <Chip size="small" color="default" label={t("common.inactive")} />}
                      </Stack>
                      <Typography fontSize={12} color="text.secondary" sx={{ fontFamily: "monospace" }}>{row.tenantCode}</Typography>
                    </Stack>
                  </TableCell>
                  {ALL_PACKAGES.map(p => {
                    const existing = row.packages.find(x => x.package === p);
                    return (
                      <TableCell key={p} align="right">
                        <PriceCell
                          tenantId={row.tenantId}
                          packageCode={p}
                          value={existing?.monthlyPrice ?? null}
                          granted={!!existing?.granted}
                          currency={existing?.currency ?? "EUR"}
                          onSaved={() => {
                            void qc.invalidateQueries({ queryKey: ["platform-billing"] });
                          }}
                          onError={(e) => setErr(e)}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell align="right">
                    <Typography fontWeight={800}>{fmt.format(row.monthlyTotal)}</Typography>
                    <Typography fontSize={11} color="text.secondary">
                      {row.pricedCount} / {row.pricedCount + row.unpricedCount} {t("billing.priced")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      </>}
    </Box>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card variant="outlined" sx={{
      p: 2, ...(highlight ? { borderColor: "primary.main", borderWidth: 2 } : {})
    }}>
      <Typography fontSize={12} color="text.secondary" sx={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 800, mt: 0.5 }}>{value}</Typography>
    </Card>
  );
}

function PriceCell({ tenantId, packageCode, value, granted, currency, onSaved, onError }: {
  tenantId: string; packageCode: PackageCode;
  value: number | null;
  /** True when a TenantPackageGrant exists (even if its price is null).
   *  Drives the "Ανάκληση" revoke button — otherwise the admin has no way
   *  to tell a "price cleared but package still enabled" row apart from a
   *  clean "package not granted" row. */
  granted: boolean;
  currency: string;
  onSaved: () => void; onError: (e: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => { setDraft(value?.toString() ?? ""); }, [value]);
  const dirty = draft !== (value?.toString() ?? "");

  const save = useMutation({
    mutationFn: async (monthlyPrice: number | null) => {
      return (await api.put(
        `/platform/billing/tenants/${tenantId}/package-price`,
        { package: packageCode, monthlyPrice, currency }
      )).data;
    },
    onSuccess: onSaved,
    onError: (e) => onError(extractErrorMessage(e))
  });

  const submitDraft = () => {
    const trimmed = draft.trim();
    const monthlyPrice = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (monthlyPrice !== null && (Number.isNaN(monthlyPrice) || monthlyPrice < 0)) {
      onError(t("billing.errors.invalidPrice"));
      return;
    }
    save.mutate(monthlyPrice);
  };

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
      <TextField
        size="small"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="—"
        sx={{ width: 130, "& input": { textAlign: "right", fontFamily: "monospace" } }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {dirty ? (
                <Tooltip title={t("common.save")}>
                  <IconButton size="small" onClick={submitDraft} disabled={save.isPending}>
                    {save.isPending ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" color="primary" />}
                  </IconButton>
                </Tooltip>
              ) : (
                <EuroIcon fontSize="small" sx={{ color: "text.disabled" }} />
              )}
            </InputAdornment>
          )
        }}
      />
      {/* Revoke button — visible whenever the tenant has this package
          granted (with or without a price). Sends monthlyPrice=null which
          the backend interprets as "soft-delete the grant". Guarded by a
          native confirm because it removes access. */}
      {granted && (
        <Tooltip title={t("billing.revokePackage", "Ανάκληση πακέτου")}>
          <IconButton
            size="small"
            color="error"
            disabled={save.isPending}
            onClick={() => {
              if (confirm(t("billing.revokeConfirm",
                "Το γραφείο θα χάσει άμεσα πρόσβαση σε αυτό το πακέτο. Συνέχεια;"))) {
                save.mutate(null);
              }
            }}
          >
            <BlockIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
