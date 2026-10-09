import { useMemo, useState } from "react";
import { Box, Button, Card, CardContent, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { api } from "../api/client";
import { money } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";
import { exportRowsCsv } from "../utils/exportCsv";

interface Stats {
  year: number; totalPremium: number; totalPolicies: number;
  monthly: { month: number; premium: number; count: number }[];
  byType: { type: string; premium: number; count: number }[];
  byProducer: { producerId: string | null; name: string; premium: number; count: number }[];
}

const COLORS = ["#0b2545","#13315c","#1976d2","#2e7d32","#f6a623","#c62828","#6a1b9a"];

export function ProductionStatsPage() {
  const { t } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const q = useQuery({ queryKey: ["production-stats", year], queryFn: async () => (await api.get<Stats>("/production-stats", { params: { year } })).data });

  const monthChart = useMemo(() => (q.data?.monthly ?? []).map(m => ({
    name: ["Ιαν","Φεβ","Μαρ","Απρ","Μαϊ","Ιουν","Ιουλ","Αυγ","Σεπ","Οκτ","Νοε","Δεκ"][m.month - 1], premium: m.premium, count: m.count
  })), [q.data]);
  const filteredByType = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return (q.data?.byType ?? []).filter(row =>
      (!typeFilter || row.type === typeFilter) &&
      (!term || row.type.toLocaleLowerCase("el-GR").includes(term))
    );
  }, [q.data, search, typeFilter]);
  const filteredByProducer = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return (q.data?.byProducer ?? []).filter(row => !term || row.name.toLocaleLowerCase("el-GR").includes(term));
  }, [q.data, search]);
  const exportStats = () => void exportRowsCsv({
    fileName: `στατιστικά-παραγωγής-${year}`,
    columns: [
      { key: "name", label: "Συνεργάτης" },
      { key: "count", label: "Συμβόλαια" },
      { key: "premium", label: "Ασφάλιστρο" },
      { key: "average", label: "Μέσο ασφάλιστρο" }
    ],
    rows: filteredByProducer.map(row => ({ ...row, average: row.count > 0 ? row.premium / row.count : 0 }))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("productionStats.title")}</Typography>
          <Typography color="text.secondary">{t("productionStats.subtitle")}</Typography></Box>
        <SearchableTextField size="small" select label={t("financials.year")} value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
          {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </SearchableTextField>
      </Stack>

      <Card variant="outlined" sx={{ mb: 3, borderColor: "primary.light" }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} flexWrap="wrap">
            <TextField size="small" label="Αναζήτηση συνεργάτη ή κλάδου" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: { xs: "100%", sm: 260 }, flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Κλάδος γραφήματος</InputLabel>
              <Select label="Κλάδος γραφήματος" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <MenuItem value="">Όλοι οι κλάδοι</MenuItem>
                {(q.data?.byType ?? []).map(row => <MenuItem key={row.type} value={row.type}>{row.type}</MenuItem>)}
              </Select>
            </FormControl>
            <Button color="error" variant="outlined" onClick={() => { setSearch(""); setTypeFilter(""); }}>Καθαρισμός</Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportStats} sx={{ whiteSpace: "nowrap" }}>Εξαγωγή CSV</Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: { md: "auto" } }}>{filteredByProducer.length} συνεργάτες · {filteredByType.length} κλάδοι</Typography>
          </Stack>
        </CardContent>
      </Card>

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
            <Card sx={{ flex: 1 }}><CardContent>
              <Typography variant="overline" color="text.secondary">{t("productionStats.totalPremium")}</Typography>
              <Typography variant="h4" fontWeight={800} color="primary.main">{money(q.data?.totalPremium ?? 0)}</Typography>
            </CardContent></Card>
            <Card sx={{ flex: 1 }}><CardContent>
              <Typography variant="overline" color="text.secondary">{t("productionStats.totalPolicies")}</Typography>
              <Typography variant="h4" fontWeight={800}>{q.data?.totalPolicies ?? 0}</Typography>
            </CardContent></Card>
            <Card sx={{ flex: 1 }}><CardContent>
              <Typography variant="overline" color="text.secondary">{t("productionStats.avgPremium")}</Typography>
              <Typography variant="h4" fontWeight={800}>
                {q.data && q.data.totalPolicies > 0 ? money(q.data.totalPremium / q.data.totalPolicies) : money(0)}
              </Typography>
            </CardContent></Card>
          </Stack>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} mb={3}>
            <Card sx={{ flex: 2 }}><CardContent>
              <Typography variant="overline" color="text.secondary">{t("productionStats.monthlyPremium")}</Typography>
              <Box sx={{ width: "100%", height: 280, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={monthChart}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip />
                    <Bar dataKey="premium" fill="#0b2545" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent></Card>
            <Card sx={{ flex: 1 }}><CardContent>
              <Typography variant="overline" color="text.secondary">{t("productionStats.byType")}</Typography>
              <Box sx={{ width: "100%", height: 280, mt: 1 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={filteredByType} dataKey="premium" nameKey="type" outerRadius={80}>
                      {filteredByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent></Card>
          </Stack>

          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">{t("productionStats.byProducer")}</Typography>
            </Box>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{t("productionStats.producer")}</TableCell>
                <TableCell align="right">{t("productionStats.policies")}</TableCell>
                <TableCell align="right">{t("productionStats.premium")}</TableCell>
                <TableCell align="right">{t("productionStats.avg")}</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {filteredByProducer.length === 0 && (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("productionStats.empty")}</TableCell></TableRow>
                )}
                {filteredByProducer.map(p => (
                  <TableRow key={p.producerId ?? "_none"} hover>
                    <TableCell><Typography fontWeight={700}>{p.name}</Typography></TableCell>
                    <TableCell align="right">{p.count}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{money(p.premium)}</TableCell>
                    <TableCell align="right">{p.count > 0 ? money(p.premium / p.count) : money(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </Box>
  );
}
