import {
  Alert, Box, Card, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography
} from "@mui/material";
import PhoneIcon from "@mui/icons-material/Phone";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface CallLog {
  id: string; receivedAt: string; callerNumber: string;
  matchedCustomerId: string | null; matchedCustomerName: string | null;
  direction: string | null; durationSeconds: number | null; answered: boolean; notes: string | null;
}

export function CallerIdPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["caller-id"], queryFn: async () => (await api.get<CallLog[]>("/caller-id")).data,
    refetchInterval: 30_000 });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <PhoneIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("callerId.title")}</Typography>
            <HelpHint id="page.callerId" />
          </Stack>
          <Typography color="text.secondary">{t("callerId.subtitle")}</Typography>
        </Box>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>{t("callerId.integrationNote")}</Alert>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("callerId.receivedAt")}</TableCell>
              <TableCell>{t("callerId.number")}</TableCell>
              <TableCell>{t("callerId.matched")}</TableCell>
              <TableCell>{t("callerId.direction")}</TableCell>
              <TableCell align="right">{t("callerId.duration")}</TableCell>
              <TableCell>{t("callerId.status")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("callerId.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(c => (
                <TableRow key={c.id} hover>
                  <TableCell>{new Date(c.receivedAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{c.callerNumber}</TableCell>
                  <TableCell>
                    {c.matchedCustomerId ? (
                      <a href={`/app/customers/${c.matchedCustomerId}`} style={{ color: "inherit" }}>{c.matchedCustomerName}</a>
                    ) : <Chip size="small" label={t("callerId.unknown")} color="default" />}
                  </TableCell>
                  <TableCell>{c.direction}</TableCell>
                  <TableCell align="right">{c.durationSeconds ? `${c.durationSeconds}s` : "—"}</TableCell>
                  <TableCell><Chip size="small" color={c.answered ? "success" : "warning"} label={c.answered ? t("callerId.answered") : t("callerId.missed")} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
