import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import KeyIcon from "@mui/icons-material/Key";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface SettingDto { id: string; service: string; keyName: string; value: string | null; isSecret: boolean; notes: string | null; }

const SERVICES: { code: string; label: string; keys: string[]; hint: string; keyHints?: Record<string, string> }[] = [
  { code: "Aade",       label: "ΑΑΔΕ (myDATA + ΑΦΜ lookup)", keys: ["Username", "Password", "AfmCalled", "Endpoint"],
    hint: "Σύνδεση με myDATA για υποβολή παραστατικών και επαλήθευση ΑΦΜ πελατών. Χρειάζεται λογαριασμός στο taxisnet του γραφείου.",
    keyHints: { Username: "Το Username myDATA του γραφείου (όχι το προσωπικό taxisnet).", Password: "Ο κωδικός Subscription Key από τη σελίδα myDATA.", AfmCalled: "Ο ΑΦΜ του γραφείου (καλών) όπως εμφανίζεται στο myDATA.", Endpoint: "Το URL του myDATA (production ή sandbox)." } },
  { code: "Gemi",       label: "ΓΕΜΗ",                       keys: ["ApiKey", "Endpoint"],
    hint: "Αναζήτηση εταιρικών στοιχείων από το ΓΕΜΗ — χρειάζεται εγγεγραμμένο API key.",
    keyHints: { ApiKey: "Το API key που έχετε λάβει από τη διεύθυνση businessregistry.gr.", Endpoint: "Το URL του REST API του ΓΕΜΗ." } },
  { code: "Usae",       label: "ΥΣΑΕ",                       keys: ["MemberCode", "ApiKey", "Endpoint"],
    hint: "Ενιαία Ψηφιακή Πύλη Ασφαλιστικών Επιχειρήσεων — υποβολή ανάγκης αναγγελίας/ασφαλιστηρίων.",
    keyHints: { MemberCode: "Ο κωδικός μέλους του γραφείου στο ΥΣΑΕ.", ApiKey: "Το API key που εκδόθηκε στο portal του ΥΣΑΕ.", Endpoint: "Το endpoint υποβολής (production ή sandbox)." } },
  { code: "Dias",       label: "ΔΙΑΣ Debit",                 keys: ["MerchantId", "MerchantSecret", "Endpoint"],
    hint: "Πάγιες εντολές SEPA Direct Debit μέσω ΔΙΑΣ.",
    keyHints: { MerchantId: "Ο κωδικός συνεργαζόμενης επιχείρησης στη ΔΙΑΣ.", MerchantSecret: "Το shared secret για την υπογραφή αιτημάτων.", Endpoint: "Το endpoint της ΔΙΑΣ (production ή sandbox)." } },
  { code: "Tachypay",   label: "Ταχυπληρωμές (ΕΛ.ΤΑ.)",       keys: ["AgreementNumber", "PostOfficeCode"],
    hint: "Είσπραξη ασφαλίστρων μέσω των ΕΛ.ΤΑ. Ταχυπληρωμές — αριθμός σύμβασης και κωδικός καταστήματος.",
    keyHints: { AgreementNumber: "Ο αριθμός σύμβασης Ταχυπληρωμών του γραφείου.", PostOfficeCode: "Ο κωδικός καταστήματος ΕΛ.ΤΑ. για κατάθεση." } },
  { code: "InfoCenter", label: "Greek Info Center",           keys: ["MemberId", "ApiKey", "Endpoint"],
    hint: "Ενημερώσεις κλάδου και κοινοποιήσεις από την Ένωση Ασφαλιστικών Εταιρειών.",
    keyHints: { MemberId: "Ο κωδικός μέλους στο Info Center.", ApiKey: "Το API key που δόθηκε στο γραφείο.", Endpoint: "Το endpoint του Info Center." } },
  { code: "Brevo",      label: "Brevo (Email)",              keys: ["ApiKey", "FromAddress", "FromName"],
    hint: "Αποστολή email (ενημερώσεις, ανανεώσεις, campaigns) μέσω Brevo (πρώην Sendinblue).",
    keyHints: { ApiKey: "Το API key από το dashboard του Brevo (Account → SMTP & API).", FromAddress: "Η διεύθυνση αποστολέα (πρέπει να έχει επαληθευτεί στο Brevo).", FromName: "Το εμφανιζόμενο όνομα του γραφείου στα εξερχόμενα mail." } }
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
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        {SERVICES.map(s => (
          <Tab key={s.code} label={
            <Tooltip title={s.hint} arrow placement="top">
              <span>{s.label}</span>
            </Tooltip>
          } />
        ))}
      </Tabs>
      <Alert severity="info" icon={<HelpOutlineIcon />} sx={{ mb: 2, bgcolor: "background.default" }}>
        {service.hint}
      </Alert>
      <ServicePanel service={service.code} keys={service.keys} keyHints={service.keyHints} />
    </Box>
  );
}

function ServicePanel({ service, keys, keyHints }: { service: string; keys: string[]; keyHints?: Record<string, string> }) {
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
              const hint = keyHints?.[k];
              return (
                <TableRow key={k}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                    {hint ? (
                      <Tooltip title={hint} arrow placement="right">
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ display: "inline-flex", cursor: "help" }}>
                          <span>{k}</span>
                          <HelpOutlineIcon fontSize="inherit" sx={{ color: "text.disabled", fontSize: 14 }} />
                        </Stack>
                      </Tooltip>
                    ) : k}
                  </TableCell>
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
