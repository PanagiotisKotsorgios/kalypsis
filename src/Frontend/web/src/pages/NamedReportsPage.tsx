import { useState } from "react";
import {
  Box, Card, CircularProgress, MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, num } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

const MONTHS = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];

export function NamedReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <AssessmentIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("namedReports.title")}</Typography>
            <HelpHint id="page.namedReports" />
          </Stack>
          <Typography color="text.secondary">{t("namedReports.subtitle")}</Typography>
        </Box>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={"4500 · " + t("namedReports.customers")} />
        <Tab label={"507 · " + t("namedReports.unpaid")} />
        <Tab label={"506 · " + t("namedReports.aging")} />
        <Tab label={"610 · " + t("namedReports.carrierLedger")} />
      </Tabs>
      {tab === 0 && <Report4500 />}
      {tab === 1 && <Report507 />}
      {tab === 2 && <Report506 />}
      {tab === 3 && <Report610 />}
    </Box>
  );
}

function Report4500() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(0);
  const [day, setDay] = useState(0);
  const [name, setName] = useState("");
  const q = useQuery({ queryKey: ["report-4500", month, day, name],
    queryFn: async () => (await api.get("/reports/4500", { params: {
      month: month || undefined, day: day || undefined, name: name || undefined
    } })).data });
  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2}>
        <SearchableTextField label={t("namedReports.month")} value={month} onChange={e => setMonth(Number(e.target.value))} sx={{ width: 160 }}>
          <MenuItem value={0}>{t("common.all")}</MenuItem>
          {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
        </SearchableTextField>
        <TextField type="number" label={t("namedReports.day")} value={day} onChange={e => setDay(Number(e.target.value))} sx={{ width: 100 }} />
        <TextField label={t("namedReports.firstName")} value={name} onChange={e => setName(e.target.value)} sx={{ width: 200 }} placeholder="π.χ. Γιώργος" />
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("namedReports.customerNumber")}</TableCell>
              <TableCell>{t("namedReports.fullName")}</TableCell>
              <TableCell>{t("namedReports.birthDate")}</TableCell>
              <TableCell>{t("namedReports.firstName")}</TableCell>
              <TableCell>{t("namedReports.email")}</TableCell>
              <TableCell>{t("namedReports.phone")}</TableCell>
              <TableCell align="right">{t("namedReports.policies")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((r: any) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{r.customerNumber}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{r.fullName}</TableCell>
                  <TableCell>{r.birthDate ?? "—"}</TableCell>
                  <TableCell>{r.firstName ?? "—"}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell>{r.mobilePhone ?? "—"}</TableCell>
                  <TableCell align="right">{r.policyCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}

function Report507() {
  const { t } = useTranslation();
  const [maxDays, setMaxDays] = useState<string>("");
  const q = useQuery({ queryKey: ["report-507", maxDays],
    queryFn: async () => (await api.get("/reports/507", { params: maxDays ? { maxDaysOverdue: Number(maxDays) } : {} })).data });
  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2}>
        <TextField type="number" label={t("namedReports.maxOverdue")} value={maxDays} onChange={e => setMaxDays(e.target.value)} sx={{ width: 180 }} />
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("namedReports.policyNumber")}</TableCell>
              <TableCell>{t("namedReports.customer")}</TableCell>
              <TableCell>{t("namedReports.startDate")}</TableCell>
              <TableCell>{t("namedReports.endDate")}</TableCell>
              <TableCell align="right">{t("namedReports.premium")}</TableCell>
              <TableCell align="right">{t("namedReports.allocated")}</TableCell>
              <TableCell align="right">{t("namedReports.outstanding")}</TableCell>
              <TableCell align="right">{t("namedReports.daysOverdue")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((r: any) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell>{r.startDate}</TableCell>
                  <TableCell>{r.endDate}</TableCell>
                  <TableCell align="right">{money(r.premium, r.currency)}</TableCell>
                  <TableCell align="right">{num(r.allocated)}</TableCell>
                  <TableCell align="right" sx={{ color: "error.main", fontWeight: 700 }}>{num(r.outstanding)}</TableCell>
                  <TableCell align="right" sx={{ color: r.daysOverdue > 60 ? "error.main" : r.daysOverdue > 30 ? "warning.main" : "text.primary" }}>{r.daysOverdue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}

function Report506() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["report-506"], queryFn: async () => (await api.get("/reports/506")).data });
  return q.isLoading ? <CircularProgress /> : (
    <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>{t("namedReports.customer")}</TableCell>
          <TableCell align="right">{t("namedReports.current")}</TableCell>
          <TableCell align="right">1–30</TableCell>
          <TableCell align="right">31–60</TableCell>
          <TableCell align="right">61–90</TableCell>
          <TableCell align="right">90+</TableCell>
          <TableCell align="right">{t("namedReports.total")}</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {(q.data ?? []).map((r: any, i: number) => (
            <TableRow key={i} hover>
              <TableCell sx={{ fontWeight: 600 }}>{r.customerName}</TableCell>
              <TableCell align="right">{num(r.current)}</TableCell>
              <TableCell align="right">{num(r.days30)}</TableCell>
              <TableCell align="right">{num(r.days60)}</TableCell>
              <TableCell align="right">{num(r.days90)}</TableCell>
              <TableCell align="right" sx={{ color: "error.main" }}>{num(r.over90)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{num(r.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function Report610() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["report-610"], queryFn: async () => (await api.get("/reports/610")).data });
  return q.isLoading ? <CircularProgress /> : (
    <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>{t("namedReports.carrier")}</TableCell>
          <TableCell align="right">{t("namedReports.openClaims")}</TableCell>
          <TableCell align="right">{t("namedReports.totalPremium")}</TableCell>
          <TableCell align="right">{t("namedReports.commissionDue")}</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {(q.data ?? []).map((r: any) => (
            <TableRow key={r.carrierId} hover>
              <TableCell sx={{ fontWeight: 600 }}>{r.carrierName}</TableCell>
              <TableCell align="right">{r.openClaimCount}</TableCell>
              <TableCell align="right">{num(r.totalPremium)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>{num(r.totalCommissionDue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
