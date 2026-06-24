import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import KeyIcon from "@mui/icons-material/Key";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface SettingDto { id: string; service: string; keyName: string; value: string | null; isSecret: boolean; notes: string | null; }

const SERVICES = [
  { code: "Aade", label: "ΑΑΔΕ (myDATA + ΑΦΜ lookup)", keys: ["Username", "Password", "AfmCalled", "Endpoint"] },
  { code: "Gemi", label: "ΓΕΜΗ", keys: ["ApiKey", "Endpoint"] },
  { code: "Usae", label: "ΥΣΑΕ", keys: ["MemberCode", "ApiKey", "Endpoint"] },
  { code: "Dias", label: "ΔΙΑΣ Debit", keys: ["MerchantId", "MerchantSecret", "Endpoint"] },
  { code: "Tachypay", label: "Ταχυπληρωμές (ΕΛ.ΤΑ.)", keys: ["AgreementNumber", "PostOfficeCode"] },
  { code: "Sap", label: "SAP Bridge", keys: ["Server", "Username", "Password", "Company"] },
  { code: "InfoCenter", label: "Greek Info Center", keys: ["MemberId", "ApiKey", "Endpoint"] },
  { code: "Brevo", label: "Brevo (Email)", keys: ["ApiKey", "FromAddress", "FromName"] }
];

export function IntegrationSettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const service = SERVICES[tab];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <KeyIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("integrations.title")}</Typography>
            <HelpHint id="page.integrations" />
          </Stack>
          <Typography color="text.secondary">{t("integrations.subtitle")}</Typography>
        </Box>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>{t("integrations.note")}</Alert>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 3 }}>
        {SERVICES.map(s => <Tab key={s.code} label={s.label} />)}
      </Tabs>
      <ServicePanel service={service.code} keys={service.keys} />
    </Box>
  );
}

function ServicePanel({ service, keys }: { service: string; keys: string[] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ keyName: string; existing: SettingDto | null } | null>(null);

  const q = useQuery({ queryKey: ["int", service], queryFn: async () =>
    (await api.get<SettingDto[]>("/integration-settings", { params: { service } })).data });

  const map = new Map((q.data ?? []).map(s => [s.keyName, s]));

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("integrations.key")}</TableCell>
            <TableCell>{t("integrations.value")}</TableCell>
            <TableCell>{t("integrations.secret")}</TableCell>
            <TableCell>{t("integrations.notes")}</TableCell>
            <TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {keys.map(k => {
              const ex = map.get(k);
              return (
                <TableRow key={k}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{k}</TableCell>
                  <TableCell>
                    {ex ? (
                      <span style={{ fontFamily: "monospace", fontSize: 13 }}>{ex.value || <em>{t("integrations.empty")}</em>}</span>
                    ) : <Chip size="small" label={t("integrations.notConfigured")} color="warning" />}
                  </TableCell>
                  <TableCell>{ex?.isSecret && <Chip size="small" label="secret" color="error" />}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{ex?.notes ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={ex ? <EditIcon /> : <AddIcon />}
                      onClick={() => setEditing({ keyName: k, existing: ex ?? null })}>
                      {ex ? t("common.edit") : t("integrations.setKey")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <KeyDialog open={!!editing} onClose={() => setEditing(null)}
        service={service} keyName={editing?.keyName ?? ""} existing={editing?.existing ?? null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["int", service] }); setEditing(null); }}
        onError={setErr} />
    </Box>
  );
}

function KeyDialog({ open, onClose, service, keyName, existing, onSaved, onError }: {
  open: boolean; onClose: () => void; service: string; keyName: string; existing: SettingDto | null;
  onSaved: () => void; onError: (m: string) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ value: "", isSecret: true, notes: "" });
  useEffect(() => {
    if (existing) setForm({ value: existing.value ?? "", isSecret: existing.isSecret, notes: existing.notes ?? "" });
    else setForm({ value: "", isSecret: keyName.toLowerCase().includes("password") || keyName.toLowerCase().includes("secret") || keyName.toLowerCase().includes("key"), notes: "" });
  }, [existing, keyName, open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/integration-settings", {
      service, keyName, value: form.value, isSecret: form.isSecret, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => onError(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{service} · {keyName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label={t("integrations.value")} value={form.value}
            onChange={e => setForm({ ...form, value: e.target.value })}
            type={form.isSecret ? "password" : "text"} fullWidth autoFocus />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isSecret} onChange={e => setForm({ ...form, isSecret: e.target.checked })} />
            <Typography>{t("integrations.secretField")}</Typography>
          </Stack>
          <TextField label={t("integrations.notes")} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
