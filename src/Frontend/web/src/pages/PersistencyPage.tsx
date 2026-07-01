import { useState } from "react";
import {
  Box, Card, CircularProgress, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money } from "../utils/format";

interface PersistencyRow { dimension: string; issued: number; renewed: number; persistencyPercent: number; premiumRetained: number; }
interface PersistencyDto {
  from: string; to: string;
  totalIssued: number; totalRenewed: number; overallPersistency: number;
  byCarrier: PersistencyRow[]; byProducer: PersistencyRow[]; byPolicyType: PersistencyRow[];
}

export function PersistencyPage() {
  const { t } = useTranslation();
  const now = new Date();
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const [from, setFrom] = useState(yearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ["persistency", from, to],
    queryFn: async () => (await api.get<PersistencyDto>("/persistency", { params: { from, to } })).data
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <TrendingUpIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("persistency.title")}</Typography>
              <HelpHint id="page.persistency" />
            </Stack>
            <Typography color="text.secondary">{t("persistency.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField type="date" label={t("persistency.from")} InputLabelProps={{ shrink: true }} value={from} onChange={e => setFrom(e.target.value)} />
          <TextField type="date" label={t("persistency.to")} InputLabelProps={{ shrink: true }} value={to} onChange={e => setTo(e.target.value)} />
        </Stack>
      </Stack>
      {q.isLoading ? <CircularProgress /> : !q.data ? null : (
        <>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
            <Card sx={{ p: 2, flex: 1 }}>
              <Typography variant="caption" color="text.secondary">{t("persistency.totalIssued")}</Typography>
              <Typography variant="h5" fontWeight={800}>{q.data.totalIssued}</Typography>
            </Card>
            <Card sx={{ p: 2, flex: 1 }}>
              <Typography variant="caption" color="text.secondary">{t("persistency.totalRenewed")}</Typography>
              <Typography variant="h5" fontWeight={800} color="success.main">{q.data.totalRenewed}</Typography>
            </Card>
            <Card sx={{ p: 2, flex: 1 }}>
              <Typography variant="caption" color="text.secondary">{t("persistency.overall")}</Typography>
              <Typography variant="h3" fontWeight={800} color={q.data.overallPersistency >= 70 ? "success.main" : q.data.overallPersistency >= 50 ? "warning.main" : "error.main"}>
                {q.data.overallPersistency.toFixed(1)}%
              </Typography>
              <LinearProgress variant="determinate" value={Math.min(q.data.overallPersistency, 100)} sx={{ mt: 1, height: 8, borderRadius: 1 }} />
            </Card>
          </Stack>

          <Stack spacing={3}>
            <Section title={t("persistency.byCarrier")} rows={q.data.byCarrier} />
            <Section title={t("persistency.byProducer")} rows={q.data.byProducer} />
            <Section title={t("persistency.byType")} rows={q.data.byPolicyType} />
          </Stack>
        </>
      )}
    </Box>
  );
}

function Section({ title, rows }: { title: string; rows: PersistencyRow[] }) {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <Typography sx={{ p: 2, fontWeight: 700 }}>{title}</Typography>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>{t("persistency.dimension")}</TableCell>
          <TableCell align="right">{t("persistency.issued")}</TableCell>
          <TableCell align="right">{t("persistency.renewed")}</TableCell>
          <TableCell align="right">{t("persistency.percent")}</TableCell>
          <TableCell sx={{ width: "30%" }} />
          <TableCell align="right">{t("persistency.premium")}</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 3 }}>{t("persistency.noData")}</TableCell></TableRow>}
          {rows.map(r => (
            <TableRow key={r.dimension}>
              <TableCell sx={{ fontWeight: 600 }}>{r.dimension}</TableCell>
              <TableCell align="right">{r.issued}</TableCell>
              <TableCell align="right" sx={{ color: "success.main" }}>{r.renewed}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{r.persistencyPercent.toFixed(1)}%</TableCell>
              <TableCell>
                <LinearProgress variant="determinate" value={Math.min(r.persistencyPercent, 100)}
                  sx={{ height: 6, borderRadius: 1 }}
                  color={r.persistencyPercent >= 70 ? "success" : r.persistencyPercent >= 50 ? "warning" : "error"} />
              </TableCell>
              <TableCell align="right">{money(r.premiumRetained)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
