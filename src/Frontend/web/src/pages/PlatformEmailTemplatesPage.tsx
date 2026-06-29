import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface TemplateDto {
  id: string; code: string; name: string; subject: string; bodyHtml: string;
  bodyPlain: string | null; language: string; triggerEvent: string | null;
  sampleVariablesJson: string | null; brevoTemplateId: number | null;
  isActive: boolean; isSystem: boolean;
  lastSentAt: string | null; timesSent: number;
}

const TRIGGER_EVENTS = [
  { value: "tenant.created",          label: "Νέο γραφείο εγγράφηκε" },
  { value: "tenant.contract.signed",  label: "Συμβόλαιο υπεγράφη" },
  { value: "tenant.package.enabled",  label: "Νέο πακέτο ενεργοποιήθηκε" },
  { value: "tenant.invoice.generated",label: "Νέο τιμολόγιο" },
  { value: "platform.announcement.sent", label: "Ανακοίνωση πλατφόρμας" },
  { value: "",                        label: "Χειροκίνητη αποστολή μόνο" }
];

export function PlatformEmailTemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TemplateDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["platform-email-templates"],
    queryFn: async () => (await api.get<TemplateDto[]>("/platform/email-templates")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/email-templates/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-email-templates"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <EmailIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Πρότυπα Email (Brevo)</Typography>
            <Typography color="text.secondary">
              Πλατφορμικά email που στέλνει το Kalypsis σε όλα τα γραφεία — με ζωντανή προεπισκόπηση και δοκιμαστική αποστολή μέσω Brevo API.
            </Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          Νέο πρότυπο
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }
        }}>
          {(q.data ?? []).map((t) => (
            <Card key={t.id} variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{t.name}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                      {t.code}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    {t.isSystem && <Chip size="small" label="ΣΥΣΤΗΜΑΤΟΣ" color="warning" />}
                    <Chip size="small" color={t.isActive ? "success" : "default"} label={t.isActive ? "Ενεργό" : "Ανενεργό"} />
                  </Stack>
                </Stack>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Θέμα:</strong> {t.subject}
                </Typography>
                {t.triggerEvent && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Trigger: <code>{t.triggerEvent}</code>
                  </Typography>
                )}
                {t.lastSentAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Στάλθηκε {t.timesSent}× · τελευταία {new Date(t.lastSentAt).toLocaleString("el-GR")}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(t)}>Επεξεργασία</Button>
                  {!t.isSystem && (
                    <IconButton size="small" color="error"
                      onClick={() => { if (confirm(`Διαγραφή προτύπου "${t.name}";`)) del.mutate(t.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <TemplateDialog
        open={!!editing || creating}
        item={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["platform-email-templates"] });
          setEditing(null); setCreating(false);
        }}
      />
    </Box>
  );
}

function TemplateDialog({ open, item, onClose, onSaved }: {
  open: boolean; item: TemplateDto | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: "", name: "", subject: "", bodyHtml: "", bodyPlain: "", language: "el",
    triggerEvent: "", sampleVariablesJson: "{}", brevoTemplateId: "", isActive: true
  });
  const [tab, setTab] = useState<"editor" | "preview" | "test">("editor");
  const [testEmail, setTestEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        code: item.code, name: item.name, subject: item.subject, bodyHtml: item.bodyHtml,
        bodyPlain: item.bodyPlain ?? "", language: item.language,
        triggerEvent: item.triggerEvent ?? "",
        sampleVariablesJson: item.sampleVariablesJson ?? "{}",
        brevoTemplateId: item.brevoTemplateId?.toString() ?? "",
        isActive: item.isActive
      });
    } else if (open) {
      setForm({
        code: `platform.custom.${Math.floor(Math.random() * 9000 + 1000)}`,
        name: "", subject: "", bodyHtml: STARTER_HTML, bodyPlain: "", language: "el",
        triggerEvent: "", sampleVariablesJson: "{}", brevoTemplateId: "", isActive: true
      });
    }
    setTab("editor"); setErr(null); setSuccess(null);
  }, [item, open]);

  // Live preview render
  const preview = useMemo(() => {
    let subject = form.subject;
    let html = form.bodyHtml;
    try {
      const vars = JSON.parse(form.sampleVariablesJson || "{}") as Record<string, string>;
      for (const [k, v] of Object.entries(vars)) {
        const token = new RegExp(`\\{\\{${k}\\}\\}`, "g");
        subject = subject.replace(token, v);
        html = html.replace(token, v);
      }
    } catch { /* JSON malformed — just show raw */ }
    return { subject, html };
  }, [form.subject, form.bodyHtml, form.sampleVariablesJson]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(), name: form.name.trim(), subject: form.subject,
        bodyHtml: form.bodyHtml, bodyPlain: form.bodyPlain || null,
        language: form.language, triggerEvent: form.triggerEvent || null,
        sampleVariablesJson: form.sampleVariablesJson || null,
        brevoTemplateId: form.brevoTemplateId ? Number(form.brevoTemplateId) : null,
        isActive: form.isActive
      };
      if (item) return (await api.put(`/platform/email-templates/${item.id}`, body)).data;
      return (await api.post(`/platform/email-templates`, body)).data;
    },
    onSuccess: () => { setSuccess("Αποθηκεύτηκε."); onSaved(); },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("Αποθηκεύστε πρώτα.");
      return api.post(`/platform/email-templates/send-test`, { templateId: item.id, toEmail: testEmail });
    },
    onSuccess: () => setSuccess(`Δοκιμαστικό απεστάλη σε ${testEmail}.`),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {item ? `Επεξεργασία — ${item.name}` : "Νέο πρότυπο email"}
      </DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        <Stack spacing={2} mt={1}>
          {/* Top fields */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="Κωδικός" value={form.code} required fullWidth
              onChange={(e) => setForm({ ...form, code: e.target.value })} sx={{ flex: 1 }}
              disabled={!!item?.isSystem} />
            <TextField label="Όνομα" value={form.name} required fullWidth
              onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ flex: 2 }} />
            <TextField select label="Γλώσσα" value={form.language} sx={{ width: 130 }}
              onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <MenuItem value="el">Ελληνικά</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </TextField>
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Ενεργό" />
          </Stack>

          <TextField label="Θέμα (subject)" value={form.subject} required fullWidth
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Π.χ. Καλώς ήρθατε, {{agencyName}}" />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField select label="Trigger event" value={form.triggerEvent} fullWidth
              onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}>
              {TRIGGER_EVENTS.map((e) => <MenuItem key={e.value || "manual"} value={e.value}>{e.label}</MenuItem>)}
            </TextField>
            <TextField label="Brevo Template ID (προαιρετικό)" value={form.brevoTemplateId} sx={{ width: 260 }}
              onChange={(e) => setForm({ ...form, brevoTemplateId: e.target.value })}
              placeholder="π.χ. 42" />
          </Stack>

          {/* Tabs: editor / preview / test */}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
            <Tab label="Επεξεργασία" value="editor" icon={<EditIcon />} iconPosition="start" />
            <Tab label="Προεπισκόπηση" value="preview" icon={<VisibilityIcon />} iconPosition="start" />
            <Tab label="Δοκιμαστική αποστολή" value="test" icon={<SendIcon />} iconPosition="start" disabled={!item} />
          </Tabs>

          {tab === "editor" && (
            <Stack spacing={2}>
              <TextField label="Σώμα HTML" multiline minRows={16} maxRows={28} fullWidth
                value={form.bodyHtml}
                onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }} />
              <TextField label="Σώμα plain text (προαιρετικό)" multiline minRows={3} fullWidth
                value={form.bodyPlain}
                onChange={(e) => setForm({ ...form, bodyPlain: e.target.value })}
                InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }} />
              <TextField label="Δείγμα μεταβλητών (JSON)" multiline minRows={3} fullWidth
                value={form.sampleVariablesJson}
                onChange={(e) => setForm({ ...form, sampleVariablesJson: e.target.value })}
                InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
                helperText="Χρησιμοποιήστε {{όνομα}} στο body για να αντικατασταθεί από τις παραπάνω μεταβλητές στην προεπισκόπηση." />
            </Stack>
          )}

          {tab === "preview" && (
            <Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Θέμα:</Typography>
                <Typography sx={{ fontWeight: 700 }}>{preview.subject}</Typography>
              </Box>
              <Box sx={{
                border: "1px solid", borderColor: "divider",
                bgcolor: "#fff", height: 580, overflow: "auto"
              }}>
                <iframe srcDoc={preview.html} title="preview"
                  style={{ width: "100%", height: "100%", border: 0 }} />
              </Box>
            </Box>
          )}

          {tab === "test" && (
            <Stack spacing={2}>
              <Alert severity="info">
                Η δοκιμαστική αποστολή χρησιμοποιεί τις τρέχουσες αποθηκευμένες ρυθμίσεις Brevo από
                <strong> Ρυθμίσεις Πλατφόρμας</strong>. Αν δεν είναι ρυθμισμένο, η αποστολή θα αποτύχει.
              </Alert>
              <TextField label="Email παραλήπτη" value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)} fullWidth
                placeholder="test@kalypsis.gr" />
              <Box>
                <Button variant="contained" startIcon={<SendIcon />} disabled={!testEmail || sendTest.isPending}
                  onClick={() => sendTest.mutate()}>
                  {sendTest.isPending ? <CircularProgress size={18} color="inherit" /> : "Αποστολή δοκιμής"}
                </Button>
              </Box>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Κλείσιμο</Button>
        <Button variant="contained" disabled={save.isPending || !form.code.trim() || !form.name.trim() || !form.subject.trim()}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const STARTER_HTML = `<!doctype html>
<html lang="el"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b2545;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b2545">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="padding:32px 32px 16px"><div style="font-family:Georgia,serif;font-size:32px;color:#f5ede1;letter-spacing:-0.02em;font-weight:600">Kalypsis</div></td></tr>
        <tr><td style="background:#f5ede1;padding:40px 32px 32px">
          <h1 style="font-family:Georgia,serif;font-size:24px;color:#0b2545;margin:0 0 8px">Τίτλος εδώ</h1>
          <p style="font-size:16px;line-height:1.65;color:#3a5170;margin:0 0 16px">Το κύριο σώμα του μηνύματος. Χρησιμοποιήστε {{μεταβλητές}} για δυναμικά πεδία.</p>
          <p style="margin:0 0 24px"><a href="{{appUrl}}" style="background:#0b2545;color:#f5ede1;padding:14px 26px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em">CALL TO ACTION</a></p>
        </td></tr>
        <tr><td style="padding:24px 32px;color:rgba(245,237,225,0.62);font-size:12px;line-height:1.5">Kalypsis Platform · info@mykalypsis.gr</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
