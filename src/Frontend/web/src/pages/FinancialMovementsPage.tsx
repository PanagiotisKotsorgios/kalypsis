import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { api } from "../api/client";

const KINDS = ["CustomerCharge","CustomerCredit","PartnerCharge","PartnerCredit","CompanyCharge","CompanyCredit","CommissionEarned","OverCommissionEarned","Adjustment"] as const;
type Kind = typeof KINDS[number];

interface MovementDto {
  id: string; movementDate: string; kind: Kind; amount: number; currency: string;
  description: string | null;
  policyId: string | null; policyNumber: string | null;
  customerId: string | null; customerName: string | null;
  producerId: string | null; producerName: string | null;
  insuranceCompanyId: string | null; insuranceCompanyName: string | null;
  receiptId: string | null; paymentId: string | null;
}

interface SummaryDto {
  year: number; totalReceipts: number; totalPayments: number; commissionsEarned: number;
  partnerCharges: number; companyCharges: number; monthly: { month: number; receipts: number; payments: number; }[];
}

export function FinancialMovementsPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(new Date().getFullYear());
  const [kind, setKind] = useState<Kind | "">("");

  const q = useQuery({
    queryKey: ["financial-movements", year, kind],
    queryFn: async () => (await api.get<MovementDto[]>("/financial-movements", {
      params: { from: `${year}-01-01`, to: `${year}-12-31`, kind: kind || undefined }
    })).data
  });

  const summary = useQuery({
    queryKey: ["financial-summary", year],
    queryFn: async () => (await api.get<SummaryDto>("/financial-movements/summary", { params: { year } })).data
  });

  const chart = useMemo(() => (summary.data?.monthly ?? []).map(m =>
    ({ name: ["Ι","Φ","Μ","Α","Μ","Ι","Ι","Α","Σ","Ο","Ν","Δ"][m.month - 1], receipts: m.receipts, payments: m.payments })),
    [summary.data]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("financials.title")}</Typography>
          <Typography color="text.secondary">{t("financials.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={2}>
          <TextField select size="small" label={t("financials.year")} value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={t("financials.kind")} value={kind} onChange={e => setKind(e.target.value as Kind | "")} sx={{ minWidth: 200 }}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {KINDS.map(k => <MenuItem key={k} value={k}>{t(`financials.kindLabel.${k}`)}</MenuItem>)}
          </TextField>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        <Card sx={{ flex: 1 }}><CardContent>
          <Typography variant="overline" color="text.secondary">{t("financials.kpis.receipts")}</Typography>
          <Typography variant="h4" fontWeight={800} color="success.main">{(summary.data?.totalReceipts ?? 0).toFixed(2)} €</Typography>
        </CardContent></Card>
        <Card sx={{ flex: 1 }}><CardContent>
          <Typography variant="overline" color="text.secondary">{t("financials.kpis.payments")}</Typography>
          <Typography variant="h4" fontWeight={800} color="error.main">{(summary.data?.totalPayments ?? 0).toFixed(2)} €</Typography>
        </CardContent></Card>
        <Card sx={{ flex: 1 }}><CardContent>
          <Typography variant="overline" color="text.secondary">{t("financials.kpis.commissions")}</Typography>
          <Typography variant="h4" fontWeight={800} color="primary.main">{(summary.data?.commissionsEarned ?? 0).toFixed(2)} €</Typography>
        </CardContent></Card>
      </Stack>

      <Card sx={{ mb: 3 }}><CardContent>
        <Typography variant="overline" color="text.secondary">{t("financials.monthlyChart")}</Typography>
        <Box sx={{ width: "100%", height: 280, mt: 1 }}>
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="receipts" fill="#2e7d32" name={t("financials.kpis.receipts")} />
              <Bar dataKey="payments" fill="#c62828" name={t("financials.kpis.payments")} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent></Card>

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("financials.date")}</TableCell>
              <TableCell>{t("financials.kind")}</TableCell>
              <TableCell>{t("financials.refs")}</TableCell>
              <TableCell>{t("common.description")}</TableCell>
              <TableCell align="right">{t("financials.amount")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("financials.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(m => (
                <TableRow key={m.id} hover>
                  <TableCell>{m.movementDate}</TableCell>
                  <TableCell><Chip label={t(`financials.kindLabel.${m.kind}`)} size="small" /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                      {m.customerName && <Chip label={m.customerName} size="small" variant="outlined" />}
                      {m.producerName && <Chip label={m.producerName} size="small" variant="outlined" />}
                      {m.insuranceCompanyName && <Chip label={m.insuranceCompanyName} size="small" variant="outlined" />}
                      {m.policyNumber && <Chip label={m.policyNumber} size="small" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{m.description ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{m.amount.toFixed(2)} {m.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
