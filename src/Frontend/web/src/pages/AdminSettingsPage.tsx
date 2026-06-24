import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import KeyIcon from "@mui/icons-material/Key";
import LinkIcon from "@mui/icons-material/Link";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { PasswordField } from "../components/PasswordField";

interface PlatformSettingsDto {
  brevoApiKeyMasked: string | null;
  hasBrevoApiKey: boolean;
  brevoSenderEmail: string | null;
  brevoSenderName: string | null;
  supportEmail: string | null;
  appBaseUrl: string | null;
  updatedAt: string | null;
}

interface UpdateBody {
  brevoApiKey: string | null;
  brevoSenderEmail: string | null;
  brevoSenderName: string | null;
  supportEmail: string | null;
  appBaseUrl: string | null;
}

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => (await api.get<PlatformSettingsDto>("/settings")).data
  });

  const [form, setForm] = useState<UpdateBody>({
    brevoApiKey: null,
    brevoSenderEmail: "",
    brevoSenderName: "",
    supportEmail: "",
    appBaseUrl: ""
  });
  const [newKey, setNewKey] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        brevoApiKey: null, // never prefill; user types only when they want to change
        brevoSenderEmail: settingsQuery.data.brevoSenderEmail ?? "",
        brevoSenderName: settingsQuery.data.brevoSenderName ?? "",
        supportEmail: settingsQuery.data.supportEmail ?? "",
        appBaseUrl: settingsQuery.data.appBaseUrl ?? ""
      });
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (body: UpdateBody) => (await api.put<PlatformSettingsDto>("/settings", body)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform-settings"] });
      setNewKey("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err) => setSaveError(extractErrorMessage(err))
  });

  const testMutation = useMutation({
    mutationFn: async (toEmail: string) =>
      (await api.post<{ success: boolean; errorMessage: string | null }>("/settings/test-email", { toEmail })).data,
    onSuccess: (data) => {
      setTestResult({
        ok: data.success,
        msg: data.success ? t("settings.testSuccess") : data.errorMessage ?? t("settings.testFailGeneric")
      });
    },
    onError: (err) => setTestResult({ ok: false, msg: extractErrorMessage(err) })
  });

  const handleSave = () => {
    setSaveError(null);
    setSaveSuccess(false);
    saveMutation.mutate({
      ...form,
      brevoApiKey: newKey.trim() === "" ? null : newKey.trim()
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {t("settings.title")}
        </Typography>
        <HelpHint id="page.settings" />
      </Stack>
      <Typography color="text.secondary" mb={4}>
        {t("settings.subtitle")}
      </Typography>

      {settingsQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* Brevo */}
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={2} alignItems="center" mb={3}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    bgcolor: "primary.main",
                    color: "common.white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <EmailIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t("settings.brevo.title")}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                    {t("settings.brevo.subtitle")}
                  </Typography>
                </Box>
                {settingsQuery.data?.hasBrevoApiKey ? (
                  <Chip label={t("settings.brevo.configured")} color="success" size="small" />
                ) : (
                  <Chip label={t("settings.brevo.notConfigured")} size="small" />
                )}
              </Stack>

              {saveError && (
                <Alert severity="error" onClose={() => setSaveError(null)} sx={{ mb: 2 }}>
                  {saveError}
                </Alert>
              )}
              {saveSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t("settings.saved")}
                </Alert>
              )}

              <Stack spacing={2.5}>
                <Box>
                  <PasswordField
                    label={t("settings.brevo.apiKey")}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder={
                      settingsQuery.data?.brevoApiKeyMasked
                        ? `${t("settings.brevo.currentlySet")}: ${settingsQuery.data.brevoApiKeyMasked}`
                        : t("settings.brevo.apiKeyPlaceholder")
                    }
                    helperText={t("settings.brevo.apiKeyHelp")}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ display: "flex", color: "text.secondary", mr: 1 }}>
                          <KeyIcon fontSize="small" />
                        </Box>
                      )
                    }}
                  />
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label={t("settings.brevo.senderEmail")}
                    type="email"
                    value={form.brevoSenderEmail ?? ""}
                    onChange={(e) => setForm({ ...form, brevoSenderEmail: e.target.value })}
                    fullWidth
                    helperText={t("settings.brevo.senderEmailHelp")}
                  />
                  <TextField
                    label={t("settings.brevo.senderName")}
                    value={form.brevoSenderName ?? ""}
                    onChange={(e) => setForm({ ...form, brevoSenderName: e.target.value })}
                    fullWidth
                  />
                </Stack>

                <Divider />

                <TextField
                  label={t("settings.supportEmail")}
                  type="email"
                  value={form.supportEmail ?? ""}
                  onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                  fullWidth
                  helperText={t("settings.supportEmailHelp")}
                />

                <TextField
                  label={t("settings.appBaseUrl")}
                  value={form.appBaseUrl ?? ""}
                  onChange={(e) => setForm({ ...form, appBaseUrl: e.target.value })}
                  fullWidth
                  placeholder="https://kalypsis.gr"
                  helperText={t("settings.appBaseUrlHelp")}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ display: "flex", color: "text.secondary", mr: 1 }}>
                        <LinkIcon fontSize="small" />
                      </Box>
                    )
                  }}
                />

                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  startIcon={saveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                  sx={{ alignSelf: "flex-start", fontWeight: 700, px: 3 }}
                >
                  {t("settings.save")}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Test email */}
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {t("settings.test.title")}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 14, mb: 3 }}>
                {t("settings.test.subtitle")}
              </Typography>
              {testResult && (
                <Alert severity={testResult.ok ? "success" : "error"} onClose={() => setTestResult(null)} sx={{ mb: 2 }}>
                  {testResult.msg}
                </Alert>
              )}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={t("settings.test.toEmail")}
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={() => testEmail && testMutation.mutate(testEmail)}
                  disabled={testMutation.isPending || !testEmail}
                  startIcon={testMutation.isPending ? <CircularProgress size={18} /> : <SendIcon />}
                  sx={{ fontWeight: 700, px: 3 }}
                >
                  {t("settings.test.send")}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
