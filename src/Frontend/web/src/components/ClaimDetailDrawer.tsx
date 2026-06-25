import {
  Box, Chip, CircularProgress, Divider, Drawer, IconButton, Stack, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface ClaimRow {
  id: string; claimNumber: string;
  policyId: string; policyNumber?: string; customerName?: string;
  incidentDate: string; reportedDate: string;
  status: string;
  claimedAmount: number | null; approvedAmount: number | null;
  description: string | null;
  affectsBonusMalus?: boolean;
  isFriendlySettlement?: boolean;
  usaeCode?: string | null; usaeStatus?: string;
  liabilityPercent?: number | null;
  isInternalDamage?: boolean;
  usaeSentAt?: string | null;
  usaeReceiptCode?: string | null;
}

const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  Reported: "info", Investigating: "warning", Approved: "success",
  Settled: "success", Rejected: "error", Closed: "default"
};

export function ClaimDetailDrawer({ claim, open, onClose }: {
  claim: ClaimRow | null; open: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["claim-extras", claim?.id],
    enabled: open && !!claim?.id,
    queryFn: async () => {
      const [provisions, indemnities, victims] = await Promise.all([
        api.get<any[]>("/claim-provisions", { params: { claimId: claim!.id } }).then(r => r.data).catch(() => []),
        api.get<any[]>("/indemnities", { params: { claimId: claim!.id } }).then(r => r.data).catch(() => []),
        api.get<any[]>("/claim-victims", { params: { claimId: claim!.id } }).then(r => r.data).catch(() => []),
      ]);
      return { provisions, indemnities, victims };
    }
  });

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", md: 640 } } }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>
              {t("claimDetail.header")}
            </Typography>
            <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
          {claim && (
            <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
              <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "monospace" }}>{claim.claimNumber}</Typography>
              <Chip size="small" color={STATUS_COLOR[claim.status] ?? "default"} label={claim.status} />
              {claim.isFriendlySettlement && <Chip size="small" variant="outlined" color="info" label="ΦΔ" />}
              {claim.affectsBonusMalus === false && <Chip size="small" variant="outlined" label="No B/M" />}
            </Stack>
          )}
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {!claim ? null : (
            <Stack spacing={2.5}>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr" }}>
                <KPI label={t("claimDetail.incidentDate")} value={claim.incidentDate} />
                <KPI label={t("claimDetail.reportedDate")} value={claim.reportedDate} />
                <KPI label={t("claimDetail.claimedAmount")} value={claim.claimedAmount?.toFixed(2) ?? "—"} suffix="€" />
                <KPI label={t("claimDetail.approvedAmount")} value={claim.approvedAmount?.toFixed(2) ?? "—"} suffix="€" />
              </Box>

              {claim.description && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    {t("claimDetail.description")}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{claim.description}</Typography>
                </Box>
              )}

              <Divider />

              <Box>
                <Typography fontWeight={700} mb={1}>{t("claimDetail.policy")}</Typography>
                <KV label={t("claimDetail.policyNumber")} value={
                  claim.policyNumber ? <a href={`/app/policies?search=${encodeURIComponent(claim.policyNumber)}`}>{claim.policyNumber}</a> : claim.policyId.slice(0, 8)
                } />
                {claim.customerName && <KV label={t("claimDetail.customer")} value={claim.customerName} />}
              </Box>

              {(claim.usaeCode || claim.usaeStatus) && (
                <>
                  <Divider />
                  <Box>
                    <Typography fontWeight={700} mb={1}>ΥΣΑΕ</Typography>
                    {claim.usaeCode && <KV label="Κωδικός" value={claim.usaeCode} />}
                    {claim.usaeStatus && <KV label="Κατάσταση" value={<Chip size="small" label={claim.usaeStatus} />} />}
                    {claim.liabilityPercent !== null && claim.liabilityPercent !== undefined &&
                      <KV label="Ευθύνη" value={`${claim.liabilityPercent}%`} />}
                    {claim.usaeSentAt && <KV label="Απεστάλη" value={new Date(claim.usaeSentAt).toLocaleString("el-GR")} />}
                  </Box>
                </>
              )}

              <Divider />

              {q.isLoading ? <CircularProgress size={20} /> : q.data && (
                <Stack spacing={2}>
                  <SummarySection label={t("claimDetail.provisions")}
                    count={q.data.provisions.length}
                    total={q.data.provisions.reduce((s: number, p: any) => s + (p.reserveAmount ?? 0), 0)} />
                  <SummarySection label={t("claimDetail.indemnities")}
                    count={q.data.indemnities.length}
                    total={q.data.indemnities.reduce((s: number, p: any) => s + (p.amount ?? 0), 0)} />
                  <SummarySection label={t("claimDetail.victims")}
                    count={q.data.victims.length}
                    total={q.data.victims.reduce((s: number, p: any) => s + (p.paidAmount ?? 0), 0)} />
                </Stack>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

function KPI({ label, value, suffix }: { label: string; value: React.ReactNode; suffix?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(11,37,69,0.04)" }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
      <Typography variant="h6" fontWeight={800}>{value}{suffix ? ` ${suffix}` : ""}</Typography>
    </Box>
  );
}
function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.3 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}
function SummarySection({ label, count, total }: { label: string; count: number; total: number }) {
  return (
    <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between">
        <Typography fontWeight={700}>{label}</Typography>
        <Chip size="small" label={count} />
      </Stack>
      {total > 0 && (
        <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800, color: "primary.main" }}>
          {total.toFixed(2)} €
        </Typography>
      )}
    </Box>
  );
}
