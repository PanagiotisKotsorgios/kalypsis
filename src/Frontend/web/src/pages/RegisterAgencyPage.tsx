import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Divider,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";

type AgencyApplication = {
  // Company
  legalName: string;
  brandName: string;
  vatNumber: string;
  doy: string;
  gemiNumber: string;
  insuranceLicenseNumber: string;
  // Address
  address: string;
  city: string;
  postalCode: string;
  // Operations
  employeesCount: string;
  yearsInBusiness: string;
  insurancePartners: string;
  // Contact
  contactFirstName: string;
  contactLastName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  // Misc
  notes: string;
  agreedTerms: boolean;
};

const initial: AgencyApplication = {
  legalName: "",
  brandName: "",
  vatNumber: "",
  doy: "",
  gemiNumber: "",
  insuranceLicenseNumber: "",
  address: "",
  city: "",
  postalCode: "",
  employeesCount: "1-5",
  yearsInBusiness: "0-2",
  insurancePartners: "",
  contactFirstName: "",
  contactLastName: "",
  contactRole: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
  agreedTerms: false
};

const STEPS = ["agency.step.company", "agency.step.location", "agency.step.contact", "agency.step.review"];

export function RegisterAgencyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AgencyApplication>(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");

  const set = <K extends keyof AgencyApplication>(k: K, v: AgencyApplication[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.legalName.trim()) return t("register.errors.legalName");
      if (!/^\d{9}$/.test(form.vatNumber.trim())) return t("register.errors.vat");
      if (!form.doy.trim()) return t("register.errors.doy");
    }
    if (step === 1) {
      if (!form.address.trim() || !form.city.trim() || !form.postalCode.trim())
        return t("register.errors.address");
    }
    if (step === 2) {
      if (!form.contactFirstName.trim() || !form.contactLastName.trim())
        return t("register.errors.contactName");
      if (!/^\S+@\S+\.\S+$/.test(form.contactEmail)) return t("register.errors.email");
      if (!form.contactPhone.trim()) return t("register.errors.phone");
    }
    if (step === 3) {
      if (!form.agreedTerms) return t("register.errors.terms");
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
    else submit();
  };

  const submit = () => {
    // Client-side only for now; produces a reference code that looks like a ticket id.
    const ref = `KLP-AG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setReferenceCode(ref);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <PublicShell>
        <Container maxWidth="sm" sx={{ py: { xs: 10, md: 16 } }}>
          <Card sx={{ p: { xs: 4, md: 6 }, textAlign: "center", borderRadius: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: "success.main", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
              {t("register.success.title")}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {t("register.success.body")}
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: "background.default",
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 2,
                mb: 4
              }}
            >
              <Typography variant="overline" color="text.secondary">
                {t("register.success.refCode")}
              </Typography>
              <Typography sx={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700 }}>
                {referenceCode}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" onClick={() => navigate("/")}>
                {t("register.success.backHome")}
              </Button>
              <Button variant="contained" onClick={() => navigate("/login")}>
                {t("auth.signIn")}
              </Button>
            </Stack>
          </Card>
        </Container>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        <Button
          component={RouterLink}
          to="/register"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 3 }}
        >
          {t("register.backToChoice")}
        </Button>

        <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2, fontWeight: 700 }}>
          {t("register.agency.eyebrow")}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          {t("register.agency.title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
          {t("register.agency.lead")}
        </Typography>

        <Card sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 5 }}>
            {STEPS.map((s) => (
              <Step key={s}>
                <StepLabel>{t(`register.${s}`)}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              next();
            }}
          >
            {step === 0 && (
              <Stack spacing={2.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t("register.agency.companyTitle")}
                </Typography>
                <TextField
                  label={t("register.agency.legalName")}
                  value={form.legalName}
                  onChange={(e) => set("legalName", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agency.brandName")}
                  helperText={t("register.agency.brandHelp")}
                  value={form.brandName}
                  onChange={(e) => set("brandName", e.target.value)}
                  fullWidth
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label={t("register.agency.vat")}
                    helperText={t("register.agency.vatHelp")}
                    value={form.vatNumber}
                    onChange={(e) => set("vatNumber", e.target.value.replace(/\D/g, "").slice(0, 9))}
                    fullWidth
                    required
                  />
                  <TextField
                    label={t("register.agency.doy")}
                    value={form.doy}
                    onChange={(e) => set("doy", e.target.value)}
                    fullWidth
                    required
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label={t("register.agency.gemi")}
                    helperText={t("register.agency.gemiHelp")}
                    value={form.gemiNumber}
                    onChange={(e) => set("gemiNumber", e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label={t("register.agency.license")}
                    helperText={t("register.agency.licenseHelp")}
                    value={form.insuranceLicenseNumber}
                    onChange={(e) => set("insuranceLicenseNumber", e.target.value)}
                    fullWidth
                  />
                </Stack>
              </Stack>
            )}

            {step === 1 && (
              <Stack spacing={2.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t("register.agency.locationTitle")}
                </Typography>
                <TextField
                  label={t("register.agency.address")}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  fullWidth
                  required
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label={t("register.agency.city")}
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    fullWidth
                    required
                  />
                  <TextField
                    label={t("register.agency.postalCode")}
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                    sx={{ maxWidth: { sm: 180 } }}
                    fullWidth
                    required
                  />
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    select
                    label={t("register.agency.employees")}
                    value={form.employeesCount}
                    onChange={(e) => set("employeesCount", e.target.value)}
                    fullWidth
                  >
                    {["1-5", "6-15", "16-30", "31-50", "50+"].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label={t("register.agency.years")}
                    value={form.yearsInBusiness}
                    onChange={(e) => set("yearsInBusiness", e.target.value)}
                    fullWidth
                  >
                    {["0-2", "3-5", "6-10", "11-20", "20+"].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <TextField
                  label={t("register.agency.partners")}
                  helperText={t("register.agency.partnersHelp")}
                  value={form.insurancePartners}
                  onChange={(e) => set("insurancePartners", e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Stack>
            )}

            {step === 2 && (
              <Stack spacing={2.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t("register.agency.contactTitle")}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label={t("register.agency.firstName")}
                    value={form.contactFirstName}
                    onChange={(e) => set("contactFirstName", e.target.value)}
                    fullWidth
                    required
                  />
                  <TextField
                    label={t("register.agency.lastName")}
                    value={form.contactLastName}
                    onChange={(e) => set("contactLastName", e.target.value)}
                    fullWidth
                    required
                  />
                </Stack>
                <TextField
                  label={t("register.agency.role")}
                  helperText={t("register.agency.roleHelp")}
                  value={form.contactRole}
                  onChange={(e) => set("contactRole", e.target.value)}
                  fullWidth
                />
                <TextField
                  label={t("register.agency.email")}
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agency.phone")}
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label={t("register.agency.notes")}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                />
              </Stack>
            )}

            {step === 3 && (
              <Stack spacing={3}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t("register.agency.reviewTitle")}
                </Typography>
                <Card variant="outlined" sx={{ p: 2.5 }}>
                  <ReviewRow label={t("register.agency.legalName")} value={form.legalName} />
                  <ReviewRow label={t("register.agency.brandName")} value={form.brandName || "—"} />
                  <ReviewRow label={t("register.agency.vat")} value={form.vatNumber} />
                  <ReviewRow label={t("register.agency.doy")} value={form.doy} />
                  <ReviewRow label={t("register.agency.gemi")} value={form.gemiNumber || "—"} />
                  <ReviewRow
                    label={t("register.agency.license")}
                    value={form.insuranceLicenseNumber || "—"}
                  />
                  <Divider sx={{ my: 1.5 }} />
                  <ReviewRow
                    label={t("register.agency.address")}
                    value={`${form.address}, ${form.postalCode} ${form.city}`}
                  />
                  <ReviewRow label={t("register.agency.employees")} value={form.employeesCount} />
                  <ReviewRow label={t("register.agency.years")} value={form.yearsInBusiness} />
                  <Divider sx={{ my: 1.5 }} />
                  <ReviewRow
                    label={t("register.agency.contactName2")}
                    value={`${form.contactFirstName} ${form.contactLastName}`}
                  />
                  <ReviewRow label={t("register.agency.email")} value={form.contactEmail} />
                  <ReviewRow label={t("register.agency.phone")} value={form.contactPhone} />
                </Card>

                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <input
                    type="checkbox"
                    checked={form.agreedTerms}
                    onChange={(e) => set("agreedTerms", e.target.checked)}
                    style={{ marginTop: 5 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {t("register.terms")}
                  </Typography>
                </Stack>
              </Stack>
            )}

            <Stack direction="row" justifyContent="space-between" sx={{ mt: 5 }}>
              <Button
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
                startIcon={<ArrowBackIcon />}
              >
                {t("register.prev")}
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                endIcon={step === STEPS.length - 1 ? null : <ArrowForwardIcon />}
                sx={{ fontWeight: 700, px: 3 }}
              >
                {step === STEPS.length - 1 ? t("register.submit") : t("register.next")}
              </Button>
            </Stack>
          </form>
        </Card>
      </Container>
    </PublicShell>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: "60%", textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}
