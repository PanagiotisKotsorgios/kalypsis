import {
  Box, Chip, CircularProgress, Divider, Drawer, IconButton,
  LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface ProducerDetail {
  id: string; code: string; name: string; email: string | null; phone: string | null; status: string;
  totalPolicies: number; activePolicies: number; renewedPolicies: number; cancelledPolicies: number;
  newPoliciesThisYear: number; renewalsDueNext60Days: number;
  totalPremiumYtd: number; totalPremiumLastYear: number; premiumGrowthPercent: number;
  totalCommissionsEarned: number; commissionsThisYear: number;
  claimCount: number; claimRatio: number;
  renewalRate: number; customerCount: number;
  byCarrier: { carrierName: string; policyCount: number; totalPremium: number; }[];
  byPolicyType: { policyType: string; policyCount: number; totalPremium: number; }[];
  performanceGrade: string;
}

const GRADE_COLOR: Record<string, string> = {
  A: "#1b873f", B: "#3aa56b", C: "#c98a1d", D: "#d65f2d", F: "#c43838"
};
const GRADE_LABEL: Record<string, string> = {
  A: "Άριστος", B: "Πολύ καλός", C: "Μέτριος", D: "Φτωχός", F: "Προβληματικός"
};

export function ProducerDetailDrawer({ producerId, open, onClose }: {
  producerId: string | null; open: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["producer-detail", producerId],
    enabled: open && !!producerId,
    queryFn: async () => (await api.get<ProducerDetail>(`/producers/${producerId}/detail`)).data
  });

  const p = q.data;

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", md: 680 } } }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>
              {t("producerDetail.header")}
            </Typography>
            <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
          {q.isLoading ? <CircularProgress size={20} /> : p ? (
            <>
              <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                <Box sx={{
                  width: 64, height: 64, borderRadius: 2, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  bgcolor: GRADE_COLOR[p.performanceGrade] ?? "grey.400", color: "white"
                }}>
                  <Typography fontWeight={900} sx={{ fontSize: 32 }}>{p.performanceGrade}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h5" fontWeight={800} noWrap>{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{p.code}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.3 }}>
                    {t("producerDetail.gradeLabel")}: <strong>{GRADE_LABEL[p.performanceGrade] ?? p.performanceGrade}</strong>
                  </Typography>
                </Box>
                <Chip size="small" color={p.status === "Active" ? "success" : "default"} label={p.status} />
              </Stack>
              <Stack direction="row" spacing={2} mt={2} flexWrap="wrap">
                {p.email && <Chip size="small" icon={<EmailIcon fontSize="small" />} component="a" href={`mailto:${p.email}`} clickable label={p.email} />}
                {p.phone && <Chip size="small" icon={<PhoneIcon fontSize="small" />} component="a" href={`tel:${p.phone}`} clickable label={p.phone} />}
              </Stack>
            </>
          ) : null}
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {!p ? <CircularProgress /> : (
            <Stack spacing={3}>
              {/* KPI cards */}
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" } }}>
                <KPI label={t("producerDetail.totalPolicies")} value={p.totalPolicies} hint={`${p.activePolicies} ${t("producerDetail.active").toLowerCase()}`} />
                <KPI label={t("producerDetail.customers")} value={p.customerCount} />
                <KPI label={t("producerDetail.newThisYear")} value={p.newPoliciesThisYear} />
                <KPI label={t("producerDetail.renewalsDue")} value={p.renewalsDueNext60Days} hint="next 60d" />
              </Box>

              <Divider />

              {/* Performance bars */}
              <Box>
                <Typography fontWeight={700} mb={1.5}>{t("producerDetail.performance")}</Typography>
                <PerfBar label={t("producerDetail.renewalRate")} value={p.renewalRate} target={70} unit="%" />
                <PerfBar label={t("producerDetail.premiumGrowth")} value={p.premiumGrowthPercent} target={10} unit="%" allowNegative />
                <PerfBar label={t("producerDetail.claimRatio")} value={p.claimRatio} target={25} unit="%" inverted />
              </Box>

              <Divider />

              {/* Financials */}
              <Box>
                <Typography fontWeight={700} mb={1.5}>{t("producerDetail.financials")}</Typography>
                <Stack spacing={1}>
                  <KV label={t("producerDetail.premiumYtd")} value={`${p.totalPremiumYtd.toFixed(2)} €`} />
                  <KV label={t("producerDetail.premiumLastYear")} value={`${p.totalPremiumLastYear.toFixed(2)} €`} />
                  <KV label={t("producerDetail.commissionsAll")} value={`${p.totalCommissionsEarned.toFixed(2)} €`} />
                  <KV label={t("producerDetail.commissionsYtd")} value={`${p.commissionsThisYear.toFixed(2)} €`} />
                </Stack>
              </Box>

              <Divider />

              {/* By carrier */}
              {p.byCarrier.length > 0 && (
                <Box>
                  <Typography fontWeight={700} mb={1.5}>{t("producerDetail.byCarrier")}</Typography>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell>{t("producerDetail.carrier")}</TableCell>
                      <TableCell align="right">{t("producerDetail.policies")}</TableCell>
                      <TableCell align="right">{t("producerDetail.premium")}</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {p.byCarrier.map(c => (
                        <TableRow key={c.carrierName}>
                          <TableCell>{c.carrierName}</TableCell>
                          <TableCell align="right">{c.policyCount}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{c.totalPremium.toFixed(2)} €</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* By type */}
              {p.byPolicyType.length > 0 && (
                <Box>
                  <Typography fontWeight={700} mb={1.5}>{t("producerDetail.byType")}</Typography>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell>{t("producerDetail.type")}</TableCell>
                      <TableCell align="right">{t("producerDetail.policies")}</TableCell>
                      <TableCell align="right">{t("producerDetail.premium")}</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {p.byPolicyType.map(t1 => (
                        <TableRow key={t1.policyType}>
                          <TableCell>{t1.policyType}</TableCell>
                          <TableCell align="right">{t1.policyCount}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{t1.totalPremium.toFixed(2)} €</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

function KPI({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(11,37,69,0.04)", border: "1px solid", borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
      <Typography variant="h5" fontWeight={800}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  );
}

function PerfBar({ label, value, target, unit, inverted, allowNegative }: {
  label: string; value: number; target: number; unit: string; inverted?: boolean; allowNegative?: boolean;
}) {
  const display = value.toFixed(1);
  // If inverted (lower is better), success when value <= target.
  const ok = inverted ? value <= target : value >= target;
  const color: "success" | "warning" | "error" = ok ? "success" : (inverted ? (value <= target * 1.5 ? "warning" : "error") : (value >= target * 0.5 ? "warning" : "error"));
  const percent = allowNegative
    ? Math.max(0, Math.min(100, value + 50))
    : Math.max(0, Math.min(100, value));
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={700} color={`${color}.main`}>{display}{unit}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} color={color} sx={{ height: 8, borderRadius: 1 }} />
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
