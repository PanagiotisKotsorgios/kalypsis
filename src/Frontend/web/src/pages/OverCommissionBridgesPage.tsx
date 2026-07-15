import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LaunchIcon from "@mui/icons-material/Launch";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import BusinessIcon from "@mui/icons-material/Business";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface CompanyDto {
  id: string; name: string; code: string; isActive: boolean; isGlobal: boolean;
}
interface RuleDto {
  id: string; managerName: string; subordinateName: string;
  level: number; percentage: number; policyType: string | null; isActive: boolean;
}

export function OverCommissionBridgesPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [selected, setSelected] = useState<CompanyDto | null>(null);

  const companies = useQuery({
    queryKey: ["insurance-companies-list"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies")).data
  });

  const rules = useQuery({
    queryKey: ["over-commission-rules"],
    queryFn: async () => (await api.get<RuleDto[]>("/over-commission-rules")).data,
    enabled: !!selected
  });

  const items = (companies.data ?? []).filter(c => c.isActive);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <StackedLineChartIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("overCommissionBridges.title")}
          </Typography>
          <Typography color="text.secondary">
            {t("overCommissionBridges.subtitle")}
          </Typography>
        </Box>
      </Stack>

      {!selected ? (
        companies.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : items.length === 0 ? (
          <Alert severity="info">{t("overCommissionBridges.noCompanies")}</Alert>
        ) : (
          <Card sx={{ p: 3 }}>
            <Typography fontWeight={700} mb={2}>{t("overCommissionBridges.pickCarrier")}</Typography>
            <Box sx={{
              display: "grid", gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(3,1fr)" }
            }}>
              {items.map(c => (
                <Card key={c.id} variant="outlined" sx={{
                  p: 2, cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": { borderColor: "primary.main", boxShadow: 2, transform: "translateY(-1px)" }
                }} onClick={() => setSelected(c)}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <BusinessIcon fontSize="small" color="primary" />
                      <Typography fontWeight={700}>{c.name}</Typography>
                    </Stack>
                    {c.isGlobal && <Chip size="small" label={t("overCommissionBridges.global")} variant="outlined" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                    {c.code}
                  </Typography>
                </Card>
              ))}
            </Box>
          </Card>
        )
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => setSelected(null)}>
              {t("overCommissionBridges.backToList")}
            </Button>
          </Stack>
          <Card sx={{ p: 3, mb: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} mb={1}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <BusinessIcon color="primary" />
                <Typography variant="h5" fontWeight={800}>{selected.name}</Typography>
                <Chip size="small" label={selected.code} variant="outlined" />
              </Stack>
              <Button variant="contained" endIcon={<LaunchIcon />}
                onClick={() => nav("/over-commissions")}>
                {t("overCommissionBridges.openPyramid")}
              </Button>
            </Stack>
            <Typography color="text.secondary" mb={2}>
              {t("overCommissionBridges.carrierDetailIntro")}
            </Typography>

            {rules.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
            ) : (rules.data ?? []).length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                {t("overCommissionBridges.noRules")}
              </Alert>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("overCommissions.level")}</TableCell>
                      <TableCell>{t("overCommissions.manager")}</TableCell>
                      <TableCell>{t("overCommissions.subordinate")}</TableCell>
                      <TableCell>{t("overCommissions.branchType")}</TableCell>
                      <TableCell align="right">{t("overCommissions.percentage")}</TableCell>
                      <TableCell>{t("common.status")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(rules.data ?? []).map(r => (
                      <TableRow key={r.id} hover>
                        <TableCell><Chip size="small" label={`L${r.level}`} color="primary" /></TableCell>
                        <TableCell>{r.managerName}</TableCell>
                        <TableCell>{r.subordinateName}</TableCell>
                        <TableCell>{r.policyType ? t(`policyType.${r.policyType}`) : t("common.all")}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{r.percentage.toFixed(2)}%</TableCell>
                        <TableCell>
                          <Chip size="small" color={r.isActive ? "success" : "default"}
                            label={r.isActive ? t("common.active") : t("common.inactive")} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Card>
        </>
      )}
    </Box>
  );
}
