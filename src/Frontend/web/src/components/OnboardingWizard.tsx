import { useEffect, useRef, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, MenuItem, Stack, Step, StepLabel, Stepper, TextField, Typography
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BusinessIcon from "@mui/icons-material/Business";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface OnboardingState {
  completed: boolean;
  completedAt: string | null;
  hasLogo: boolean;
  hasBrandColor: boolean;
  hasContact: boolean;
  insuranceCompanyCount: number;
  commissionRuleCount: number;
}

interface AgencyProfile {
  tenantId: string; name: string;
  logoUrl: string | null; brandColorHex: string | null;
  contactEmail: string | null; contactPhone: string | null;
  addressLine: string | null; vatNumber: string | null;
  defaultCurrency: string; defaultPolicyDurationMonths: number;
}

const TYPES = ["Auto","Home","Health","Life","Business","Travel","Other"] as const;

/**
 * Four-step wizard shown automatically to a newly-created agency the first time
 * its admin lands in the app. Steps: branding, contact, commission rule defaults,
 * confirmation. Marks tenant.OnboardingCompletedAt when done so it never reappears.
 */
export function OnboardingWizard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const stateQ = useQuery({
    queryKey: ["onboarding"],
    enabled: user?.role === "AgencyAdmin",
    queryFn: async () => (await api.get<OnboardingState>("/agency-profile/onboarding")).data
  });

  useEffect(() => {
    if (stateQ.data && !stateQ.data.completed && user?.role === "AgencyAdmin") {
      setOpen(true);
    }
  }, [stateQ.data, user?.role]);

  const complete = useMutation({
    mutationFn: async () => (await api.post<OnboardingState>("/agency-profile/onboarding/complete")).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["onboarding"] }); setOpen(false); },
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={() => { /* mandatory until Skip or Complete */ }} maxWidth="md" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <CheckCircleIcon sx={{ color: "primary.main", fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={800}>{t("onboarding.title")}</Typography>
            <Typography variant="caption" color="text.secondary">{t("onboarding.subtitle")}</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {["branding","contact","rule","done"].map((k) => (
            <Step key={k}><StepLabel>{t(`onboarding.step.${k}`)}</StepLabel></Step>
          ))}
        </Stepper>

        {step === 0 && <StepBranding onErr={setErr} />}
        {step === 1 && <StepContact onErr={setErr} />}
        {step === 2 && <StepCommissionRule onErr={setErr} />}
        {step === 3 && <StepDone />}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => complete.mutate()} color="inherit" disabled={complete.isPending}>
          {t("onboarding.skip")}
        </Button>
        <Box sx={{ flex: 1 }} />
        {step > 0 && <Button onClick={() => setStep(step - 1)}>{t("common.cancel")}</Button>}
        {step < 3 && <Button variant="contained" onClick={() => setStep(step + 1)}>{t("onboarding.next")}</Button>}
        {step === 3 && (
          <Button variant="contained" color="success" onClick={() => complete.mutate()} disabled={complete.isPending}>
            {complete.isPending ? <CircularProgress size={18} /> : t("onboarding.finish")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function StepBranding({ onErr }: { onErr: (e: string | null) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = useQuery({ queryKey: ["agency-profile"], queryFn: async () => (await api.get<AgencyProfile>("/agency-profile")).data });
  const [logoVer, setLogoVer] = useState(0);
  const [color, setColor] = useState("#0b2545");
  useEffect(() => { if (profile.data?.brandColorHex) setColor(profile.data.brandColorHex); }, [profile.data]);

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post("/agency-profile/logo", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => { setLogoVer(v => v + 1); void qc.invalidateQueries({ queryKey: ["agency-profile"] }); void qc.invalidateQueries({ queryKey: ["tenant-logo"] }); },
    onError: e => onErr(extractErrorMessage(e))
  });
  const saveColor = useMutation({
    mutationFn: async () => {
      const p = profile.data!;
      return (await api.put("/agency-profile", { ...p, brandColorHex: color })).data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agency-profile"] }),
    onError: e => onErr(extractErrorMessage(e))
  });

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">{t("onboarding.brandingIntro")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <Avatar src={profile.data?.logoUrl ? `/api/agency-profile/logo?v=${logoVer}` : undefined}
          variant="rounded" sx={{ width: 96, height: 96, bgcolor: "rgba(11,37,69,0.06)", "& img": { objectFit: "contain", p: 1 } }}>
          <BusinessIcon sx={{ color: "text.disabled", fontSize: 36 }} />
        </Avatar>
        <Box>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo.mutate(f); }} />
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
            {t("onboarding.uploadLogo")}
          </Button>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t("agencySettings.logoHelp")}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField type="color" label={t("onboarding.brandColor")} value={color} onChange={e => setColor(e.target.value)} sx={{ width: 200 }} />
        <Button onClick={() => saveColor.mutate()} disabled={saveColor.isPending || !profile.data}>
          {t("common.save")}
        </Button>
      </Stack>
    </Stack>
  );
}

function StepContact({ onErr }: { onErr: (e: string | null) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["agency-profile"], queryFn: async () => (await api.get<AgencyProfile>("/agency-profile")).data });
  const [form, setForm] = useState({ contactEmail: "", contactPhone: "", addressLine: "", vatNumber: "" });
  useEffect(() => {
    if (profile.data) setForm({
      contactEmail: profile.data.contactEmail ?? "",
      contactPhone: profile.data.contactPhone ?? "",
      addressLine: profile.data.addressLine ?? "",
      vatNumber: profile.data.vatNumber ?? ""
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const p = profile.data!;
      return (await api.put("/agency-profile", { ...p, ...form })).data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agency-profile"] }),
    onError: e => onErr(extractErrorMessage(e))
  });

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">{t("onboarding.contactIntro")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField type="email" label={t("agencySettings.contactEmail")} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} fullWidth />
        <TextField label={t("agencySettings.contactPhone")} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} fullWidth />
      </Stack>
      <TextField label={t("agencySettings.addressLine")} value={form.addressLine} onChange={e => setForm({ ...form, addressLine: e.target.value })} fullWidth />
      <TextField label={t("agencySettings.vat")} value={form.vatNumber} onChange={e => setForm({ ...form, vatNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} fullWidth />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !profile.data} sx={{ alignSelf: "flex-start" }}>
        {t("common.save")}
      </Button>
    </Stack>
  );
}

function StepCommissionRule({ onErr }: { onErr: (e: string | null) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const companies = useQuery({ queryKey: ["insurance-companies-lite"], queryFn: async () => (await api.get<{ id: string; name: string }[]>("/insurance-companies")).data });
  const [form, setForm] = useState({
    policyType: "Auto" as typeof TYPES[number],
    insuranceCompanyId: "",
    value: 10,
    effectiveFrom: new Date().toISOString().slice(0, 10)
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/commission-rules", {
      producerId: null,
      insuranceCompanyId: form.insuranceCompanyId || null,
      policyType: form.policyType,
      commissionType: "Percentage",
      value: Number(form.value),
      effectiveFrom: form.effectiveFrom
    })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["commission-rules"] }),
    onError: e => onErr(extractErrorMessage(e))
  });

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">{t("onboarding.ruleIntro")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label={t("commissionRuns.filterBranch")} value={form.policyType} onChange={e => setForm({ ...form, policyType: e.target.value as typeof TYPES[number] })} fullWidth>
          {TYPES.map(p => <MenuItem key={p} value={p}>{t(`policyType.${p}`)}</MenuItem>)}
        </TextField>
        <TextField select label={t("commissionRuns.filterCompany")} value={form.insuranceCompanyId} onChange={e => setForm({ ...form, insuranceCompanyId: e.target.value })} fullWidth>
          <MenuItem value="">{t("common.all")}</MenuItem>
          {(companies.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField type="number" label={t("onboarding.percent")} value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} fullWidth inputProps={{ step: 0.5, min: 0, max: 100 }} />
      </Stack>
      <TextField type="date" label={t("tariffs.effectiveFrom")} InputLabelProps={{ shrink: true }} value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} sx={{ width: 200 }} />
      <Button variant="contained" onClick={() => create.mutate()} disabled={create.isPending} sx={{ alignSelf: "flex-start" }}>
        {create.isPending ? <CircularProgress size={18} /> : t("onboarding.createRule")}
      </Button>
    </Stack>
  );
}

function StepDone() {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ borderColor: "success.main", bgcolor: "rgba(46,125,50,0.05)" }}>
      <CardContent sx={{ textAlign: "center", py: 4 }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
        <Typography variant="h5" fontWeight={800} mb={1}>{t("onboarding.doneTitle")}</Typography>
        <Typography color="text.secondary">{t("onboarding.doneBody")}</Typography>
      </CardContent>
    </Card>
  );
}
