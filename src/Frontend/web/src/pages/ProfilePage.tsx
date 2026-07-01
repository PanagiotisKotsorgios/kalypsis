import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider, FormControlLabel,
  MenuItem, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import LockResetIcon from "@mui/icons-material/LockReset";
import SchoolIcon from "@mui/icons-material/School";
import TuneIcon from "@mui/icons-material/Tune";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { PasswordField } from "../components/PasswordField";
import { resetTourForRole } from "../components/KalypsisOnboarding";
import { TwoFactorSection } from "../components/TwoFactorSection";

interface Profile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  preferredLanguage: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => (await api.get<Profile>("/me")).data
  });

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", preferredLanguage: "el" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profileQuery.data) {
      setForm({
        firstName: profileQuery.data.firstName,
        lastName: profileQuery.data.lastName,
        phone: profileQuery.data.phone ?? "",
        preferredLanguage: profileQuery.data.preferredLanguage
      });
    }
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: async () => (await api.put<Profile>("/me", form)).data,
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["me-profile"] });
      void i18n.changeLanguage(d.preferredLanguage);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const changePw = useMutation({
    mutationFn: async () => api.post("/me/password", { currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: () => {
      setPw({ current: "", next: "", confirm: "" });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    },
    onError: (err) => setPwError(extractErrorMessage(err))
  });

  if (profileQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("profile.title")}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t("profile.subtitle")}</Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("profile.section.basic")}</Typography>
            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
            {saved && <Alert severity="success" sx={{ mb: 2 }}>{t("profile.saved")}</Alert>}
            <Stack spacing={2.5}>
              <TextField value={profileQuery.data?.email ?? ""} label={t("profile.email")} disabled fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label={t("profile.firstName")} value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })} fullWidth required />
                <TextField label={t("profile.lastName")} value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })} fullWidth required />
              </Stack>
              <TextField label={t("profile.phone")} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
              <TextField select label={t("profile.language")} value={form.preferredLanguage}
                onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })} fullWidth sx={{ maxWidth: 280 }}>
                <MenuItem value="el">Ελληνικά</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </TextField>
              <Button variant="contained" startIcon={<SaveIcon />}
                onClick={() => save.mutate()} disabled={save.isPending}
                sx={{ alignSelf: "flex-start", fontWeight: 700, px: 3 }}>
                {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("profile.section.password")}</Typography>
            {pwError && <Alert severity="error" onClose={() => setPwError(null)} sx={{ mb: 2 }}>{pwError}</Alert>}
            {pwSaved && <Alert severity="success" sx={{ mb: 2 }}>{t("profile.passwordChanged")}</Alert>}
            <Stack spacing={2.5}>
              <PasswordField label={t("profile.currentPassword")} value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })} fullWidth />
              <Divider />
              <PasswordField label={t("profile.newPassword")} value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })} fullWidth
                helperText={t("reset.passwordHelp")} />
              <PasswordField label={t("profile.confirmPassword")} value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} fullWidth />
              <Button variant="outlined" startIcon={<LockResetIcon />}
                onClick={() => {
                  setPwError(null);
                  if (pw.next.length < 8) { setPwError(t("reset.errors.short")); return; }
                  if (pw.next !== pw.confirm) { setPwError(t("reset.errors.mismatch")); return; }
                  changePw.mutate();
                }}
                disabled={changePw.isPending}
                sx={{ alignSelf: "flex-start", fontWeight: 700, px: 3 }}>
                {changePw.isPending ? <CircularProgress size={18} /> : t("profile.changePassword")}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <SchoolIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>{t("profile.tutorial.title")}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("profile.tutorial.body")}
            </Typography>
            <Button variant="outlined" startIcon={<SchoolIcon />}
              onClick={() => {
                if (profileQuery.data?.role) {
                  resetTourForRole(profileQuery.data.role);
                  window.location.reload();
                }
              }}
              disabled={!profileQuery.data?.role}
            >
              {t("profile.tutorial.restart")}
            </Button>
          </CardContent>
        </Card>

        <UserPreferencesSection role={profileQuery.data?.role} />

        <TwoFactorSection />
      </Stack>
    </Box>
  );
}

/* ============================================================================
   UserPreferencesSection
   ----------------------------------------------------------------------------
   Per-user configuration options stored client-side (localStorage) under
   the key `kalypsis:userPreferences:v1`. Doesn't require a backend round
   trip for these UI-only knobs; a future migration can sync them up if
   we ever want to persist across devices.
   ========================================================================= */
type ThemeMode = "light" | "dark" | "auto";
type Density   = "comfortable" | "compact";
type LandingPageKey =
  | "dashboard" | "policies" | "customers" | "renewals" | "financials" | "tasks";
interface UserPreferences {
  themeMode: ThemeMode;
  density: Density;
  digestFrequency: "daily" | "weekly" | "never";
  playSounds: boolean;
  emailAlerts: boolean;
  landingPage: LandingPageKey;
  autoLockMinutes: number;   // 0 = never
  showQuickActions: boolean;
  showKpisOnTop: boolean;
}
// Local aliases of the shared preferences shape + IO helpers from the
// KalypsisThemeProvider. The theme provider is the source of truth so we
// share exactly the same DEFAULTS, read/write functions and per-user
// keying — no risk of drift.
import {
  DEFAULT_PREFS as SHARED_DEFAULT_PREFS,
  readPrefsFor,
  writePrefsFor,
} from "../theme/KalypsisThemeProvider";
import { useAuth } from "../auth/AuthContext";

const DEFAULT_PREFS: UserPreferences = SHARED_DEFAULT_PREFS as UserPreferences;

function UserPreferencesSection({ role }: { role?: string }) {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const [prefs, setPrefs] = useState<UserPreferences>(() => readPrefsFor(userId) as UserPreferences);
  const [saved, setSaved] = useState(false);

  // Re-load whenever the effective user id changes (e.g. an admin
  // impersonates someone else while the profile page is mounted).
  useEffect(() => { setPrefs(readPrefsFor(userId) as UserPreferences); }, [userId]);

  const update = <K extends keyof UserPreferences>(k: K, v: UserPreferences[K]) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    writePrefsFor(userId, next);   // per-user bucket + broadcast for the theme provider
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };
  const landingOptions: Array<{ key: LandingPageKey; label: string }> = [
    { key: "dashboard",  label: "Πίνακας" },
    { key: "policies",   label: "Συμβόλαια" },
    { key: "customers",  label: "Πελάτες" },
    { key: "renewals",   label: "Ανανεώσεις" },
    { key: "financials", label: "Οικονομικά" },
    { key: "tasks",      label: "Εργασίες" },
  ];
  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <TuneIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Προτιμήσεις πλατφόρμας</Typography>
          {saved && <Alert severity="success" sx={{ py: 0.25, ml: "auto" }}>Αποθηκεύτηκε</Alert>}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Εξατομικευμένες ρυθμίσεις εμφάνισης και ειδοποιήσεων για τον λογαριασμό σας.
          Αποθηκεύονται τοπικά στον περιηγητή και ισχύουν αμέσως.
        </Typography>

        <Stack spacing={3}>
          {/* Theme mode */}
          <Box>
            <Typography variant="body2" fontWeight={700} mb={1}>Θέμα εμφάνισης</Typography>
            <ToggleButtonGroup exclusive size="small" value={prefs.themeMode}
              onChange={(_, v) => v && update("themeMode", v as ThemeMode)}>
              <ToggleButton value="light"><LightModeIcon fontSize="small" sx={{ mr: 0.5 }} />Ανοιχτό</ToggleButton>
              <ToggleButton value="dark"><DarkModeIcon fontSize="small" sx={{ mr: 0.5 }} />Σκούρο</ToggleButton>
              <ToggleButton value="auto"><BrightnessAutoIcon fontSize="small" sx={{ mr: 0.5 }} />Αυτόματο</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Density */}
          <Box>
            <Typography variant="body2" fontWeight={700} mb={1}>Πυκνότητα διεπαφής</Typography>
            <ToggleButtonGroup exclusive size="small" value={prefs.density}
              onChange={(_, v) => v && update("density", v as Density)}>
              <ToggleButton value="comfortable">Άνετη</ToggleButton>
              <ToggleButton value="compact">Συμπαγής</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Landing */}
          <Box>
            <Typography variant="body2" fontWeight={700} mb={1}>
              <DashboardIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
              Αρχική οθόνη μετά τη σύνδεση
            </Typography>
            <TextField select value={prefs.landingPage}
              onChange={(e) => update("landingPage", e.target.value as LandingPageKey)}
              size="small" sx={{ minWidth: 240 }}>
              {landingOptions.map(o => (
                <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Divider />

          {/* Notifications */}
          <Box>
            <Typography variant="body2" fontWeight={700} mb={1}>
              <NotificationsIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
              Ειδοποιήσεις
            </Typography>
            <Stack spacing={1.5}>
              <TextField select label="Συχνότητα e-mail digest" value={prefs.digestFrequency}
                onChange={(e) => update("digestFrequency", e.target.value as UserPreferences["digestFrequency"])}
                size="small" sx={{ maxWidth: 320 }}>
                <MenuItem value="daily">Καθημερινά</MenuItem>
                <MenuItem value="weekly">Εβδομαδιαία</MenuItem>
                <MenuItem value="never">Ποτέ</MenuItem>
              </TextField>
              <FormControlLabel
                control={<Switch checked={prefs.emailAlerts}
                  onChange={(e) => update("emailAlerts", e.target.checked)} />}
                label="Ειδοποιήσεις e-mail για κρίσιμα γεγονότα"
              />
              <FormControlLabel
                control={<Switch checked={prefs.playSounds}
                  onChange={(e) => update("playSounds", e.target.checked)} />}
                label="Ήχος για νέες ειδοποιήσεις στην πλατφόρμα"
              />
            </Stack>
          </Box>

          <Divider />

          {/* Dashboard layout */}
          <Box>
            <Typography variant="body2" fontWeight={700} mb={1}>Πίνακας ελέγχου</Typography>
            <Stack spacing={0.75}>
              <FormControlLabel
                control={<Switch checked={prefs.showKpisOnTop}
                  onChange={(e) => update("showKpisOnTop", e.target.checked)} />}
                label="Εμφάνιση KPIs στην κορυφή"
              />
              <FormControlLabel
                control={<Switch checked={prefs.showQuickActions}
                  onChange={(e) => update("showQuickActions", e.target.checked)} />}
                label="Γρήγορες ενέργειες πάνω δεξιά"
              />
            </Stack>
          </Box>

          <Divider />

          {/* Session */}
          <Box>
            <Typography variant="body2" fontWeight={700} mb={1}>Ασφάλεια συνεδρίας</Typography>
            <TextField select size="small" label="Αυτόματο κλείδωμα μετά από"
              value={String(prefs.autoLockMinutes)}
              onChange={(e) => update("autoLockMinutes", Number(e.target.value))}
              sx={{ maxWidth: 320 }}>
              <MenuItem value="0">Ποτέ</MenuItem>
              <MenuItem value="5">5 λεπτά</MenuItem>
              <MenuItem value="15">15 λεπτά</MenuItem>
              <MenuItem value="30">30 λεπτά</MenuItem>
              <MenuItem value="60">1 ώρα</MenuItem>
            </TextField>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              Ρόλος λογαριασμού: {role ?? "—"}
            </Typography>
          </Box>

          <Button variant="text" size="small" color="inherit"
            onClick={() => { setPrefs(DEFAULT_PREFS); writePrefsFor(userId, DEFAULT_PREFS); }}
            sx={{ alignSelf: "flex-start", color: "text.secondary" }}>
            Επαναφορά προεπιλογών
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
