import {
  Alert, Box, Card, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography
} from "@mui/material";
import RuleIcon from "@mui/icons-material/Rule";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface UsaeDto {
  id: string; claimId: string; claimNumber: string;
  submissionNumber: string; submittedAt: string;
  status: string; acknowledgementCode: string | null; errorMessage: string | null;
}

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  Pending: "warning", Accepted: "success", Rejected: "error"
};

export function UsaeSubmissionsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["usae"], queryFn: async () => (await api.get<UsaeDto[]>("/usae-submissions")).data });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <RuleIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("usae.title")}</Typography>
            <HelpHint id="page.usae" />
          </Stack>
          <Typography color="text.secondary">{t("usae.subtitle")}</Typography>
        </Box>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>{t("usae.integrationNote")}</Alert>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("usae.number")}</TableCell>
              <TableCell>{t("usae.claim")}</TableCell>
              <TableCell>{t("usae.submittedAt")}</TableCell>
              <TableCell>{t("usae.ack")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("usae.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{s.submissionNumber}</TableCell>
                  <TableCell>{s.claimNumber}</TableCell>
                  <TableCell>{new Date(s.submittedAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{s.acknowledgementCode ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[s.status] ?? "default"} label={s.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
