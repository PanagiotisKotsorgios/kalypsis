import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography
} from "@mui/material";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import HomeIcon from "@mui/icons-material/Home";
import FavoriteIcon from "@mui/icons-material/Favorite";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";

interface AnswerSet {
  type: PolicyType | "";
  // shared
  startWish: string;
  notes: string;
  // auto
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  plateNumber: string;
  vehicleUsage: "personal" | "commercial" | "taxi" | "";
  annualKm: string;
  driverAge: string;
  licenseYear: string;
  accidents5y: "0" | "1" | "2+" | "";
  currentInsurer: string;
  autoCoverage: "thirdPartyOnly" | "thirdPartyPlus" | "comprehensive" | "";
  // home
  propertyType: "apartment" | "house" | "";
  propertyAddress: string;
  propertySqm: string;
  propertyYear: string;
  contentsValue: string;
  hasAlarm: "yes" | "no" | "";
  homeCoverage: "fire" | "firePlus" | "comprehensive" | "";
  // health
  healthFor: "myself" | "family" | "";
  membersCount: string;
  agesText: string;
  preExisting: string;
  healthTier: "basic" | "mid" | "premium" | "";
  // life
  lifeFor: "myself" | "spouse" | "child" | "";
  lifeAge: string;
  lifeOccupation: string;
  lifeSmoker: "yes" | "no" | "";
  lifeAmount: string;
  lifeTermYears: string;
  // business
  bizType: string;
  bizEmployees: string;
  bizTurnover: string;
  bizLocation: string;
  bizCover: string;
  // travel
  travelDestination: string;
  travelDays: string;
  travelers: string;
  travelAges: string;
  travelActivities: string;
  // other
  otherDetails: string;
}

const initial: AnswerSet = {
  type: "", startWish: "", notes: "",
  vehicleMake: "", vehicleModel: "", vehicleYear: "", plateNumber: "", vehicleUsage: "",
  annualKm: "", driverAge: "", licenseYear: "", accidents5y: "", currentInsurer: "", autoCoverage: "",
  propertyType: "", propertyAddress: "", propertySqm: "", propertyYear: "", contentsValue: "",
  hasAlarm: "", homeCoverage: "",
  healthFor: "", membersCount: "", agesText: "", preExisting: "", healthTier: "",
  lifeFor: "", lifeAge: "", lifeOccupation: "", lifeSmoker: "", lifeAmount: "", lifeTermYears: "",
  bizType: "", bizEmployees: "", bizTurnover: "", bizLocation: "", bizCover: "",
  travelDestination: "", travelDays: "", travelers: "", travelAges: "", travelActivities: "",
  otherDetails: ""
};

const TYPE_CARDS: { type: PolicyType; icon: React.ReactNode }[] = [
  { type: "Auto", icon: <DirectionsCarIcon sx={{ fontSize: 40 }} /> },
  { type: "Home", icon: <HomeIcon sx={{ fontSize: 40 }} /> },
  { type: "Health", icon: <MedicalServicesIcon sx={{ fontSize: 40 }} /> },
  { type: "Life", icon: <FavoriteIcon sx={{ fontSize: 40 }} /> },
  { type: "Business", icon: <BusinessCenterIcon sx={{ fontSize: 40 }} /> },
  { type: "Travel", icon: <FlightTakeoffIcon sx={{ fontSize: 40 }} /> },
  { type: "Other", icon: <MoreHorizIcon sx={{ fontSize: 40 }} /> }
];

export function NewContractWizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<AnswerSet>(initial);
  const [error, setError] = useState<string | null>(null);
  const [refNumber, setRefNumber] = useState<string | null>(null);

  const set = <K extends keyof AnswerSet>(k: K, v: AnswerSet[K]) =>
    setA((s) => ({ ...s, [k]: v }));

  const STEPS = ["wizard.step.type", "wizard.step.details", "wizard.step.review"];

  const submit = useMutation({
    mutationFn: async () => {
      const subject = `${t("wizard.subjectPrefix")} – ${t(`policies.types.${a.type}`)}`;
      const description = buildDescription(a, t);
      return (await api.post<{ requestNumber: string }>("/service-requests", {
        type: "NewPolicy",
        subject,
        description
      })).data;
    },
    onSuccess: (d) => setRefNumber(d.requestNumber),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const handleNext = (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (step === 0 && !a.type) {
      setError(t("wizard.errors.pickType"));
      return;
    }
    if (step === 1) {
      const err = validateDetails(a, t);
      if (err) {
        setError(err);
        return;
      }
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      submit.mutate();
    }
  };

  if (refNumber) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 6, md: 10 } }}>
        <Card sx={{ maxWidth: 560, width: "100%", borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: "center" }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: "success.main", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>{t("wizard.success.title")}</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>{t("wizard.success.body")}</Typography>
            <Box sx={{ p: 2, mb: 4, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
              <Typography variant="overline" color="text.secondary">{t("wizard.success.ref")}</Typography>
              <Typography sx={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800 }}>{refNumber}</Typography>
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button onClick={() => navigate("/app")}>{t("wizard.success.dashboard")}</Button>
              <Button variant="contained" onClick={() => navigate("/app/requests")}>{t("wizard.success.requests")}</Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>{t("nav.back")}</Button>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>{t("wizard.title")}</Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>{t("wizard.subtitle")}</Typography>

          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            {STEPS.map((s) => <Step key={s}><StepLabel>{t(s)}</StepLabel></Step>)}
          </Stepper>

          {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleNext}>
            {step === 0 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{t("wizard.step1.title")}</Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }
                  }}
                >
                  {TYPE_CARDS.map((c) => (
                    <Card
                      key={c.type}
                      sx={{
                        borderRadius: 3,
                        border: "2px solid",
                        borderColor: a.type === c.type ? "primary.main" : "divider",
                        bgcolor: a.type === c.type ? "rgba(11,37,69,0.05)" : "transparent",
                        transition: "transform 200ms, border-color 200ms",
                        "&:hover": { transform: "translateY(-2px)" }
                      }}
                    >
                      <CardActionArea onClick={() => set("type", c.type)} sx={{ p: 2, textAlign: "center" }}>
                        <Box sx={{ color: a.type === c.type ? "primary.main" : "text.secondary", mb: 1 }}>
                          {c.icon}
                        </Box>
                        <Typography sx={{ fontWeight: 700 }}>{t(`policies.types.${c.type}`)}</Typography>
                      </CardActionArea>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {step === 1 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  {t("wizard.step2.title", { type: t(`policies.types.${a.type}`) })}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>{t("wizard.step2.subtitle")}</Typography>
                <DetailsForm a={a} set={set} />
              </Box>
            )}

            {step === 2 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{t("wizard.step3.title")}</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>{t("wizard.step3.subtitle")}</Typography>
                <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
                  <Stack spacing={1.5}>
                    <Row label={t("wizard.review.type")} value={a.type ? t(`policies.types.${a.type}`) : "—"} />
                    <Divider />
                    {summariseAnswers(a, t).map((row) => (
                      <Row key={row.label} label={row.label} value={row.value} />
                    ))}
                  </Stack>
                </Card>
                <TextField
                  fullWidth multiline rows={3}
                  label={t("wizard.notes")}
                  helperText={t("wizard.notesHelp")}
                  value={a.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
                <Alert severity="info" sx={{ mt: 3 }}>{t("wizard.submitInfo")}</Alert>
              </Box>
            )}

            <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
              <Button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                startIcon={<ArrowBackIcon />}
              >
                {t("wizard.prev")}
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submit.isPending}
                endIcon={step === STEPS.length - 1 ? null : <ArrowForwardIcon />}
                sx={{ fontWeight: 700, px: 3 }}
              >
                {submit.isPending
                  ? <CircularProgress size={20} />
                  : step === STEPS.length - 1
                    ? t("wizard.submit")
                    : t("wizard.next")}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
      <Typography color="text.secondary" sx={{ fontSize: 14 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600, textAlign: "right", maxWidth: "65%" }}>{value || "—"}</Typography>
    </Stack>
  );
}

/* ====================== Details form switch ====================== */

interface DetailsFormProps {
  a: AnswerSet;
  set: <K extends keyof AnswerSet>(k: K, v: AnswerSet[K]) => void;
}

function DetailsForm({ a, set }: DetailsFormProps) {
  const { t } = useTranslation();
  if (a.type === "Auto") {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth label={t("wizard.auto.make")} value={a.vehicleMake} onChange={(e) => set("vehicleMake", e.target.value)} required />
          <TextField fullWidth label={t("wizard.auto.model")} value={a.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} required />
          <TextField fullWidth label={t("wizard.auto.year")} type="number" value={a.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} required />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth label={t("wizard.auto.plate")} value={a.plateNumber} onChange={(e) => set("plateNumber", e.target.value.toUpperCase())} required />
          <TextField select fullWidth label={t("wizard.auto.usage")} value={a.vehicleUsage} onChange={(e) => set("vehicleUsage", e.target.value as AnswerSet["vehicleUsage"])} required>
            <MenuItem value="personal">{t("wizard.auto.usagePersonal")}</MenuItem>
            <MenuItem value="commercial">{t("wizard.auto.usageCommercial")}</MenuItem>
            <MenuItem value="taxi">{t("wizard.auto.usageTaxi")}</MenuItem>
          </TextField>
          <TextField fullWidth label={t("wizard.auto.annualKm")} type="number" value={a.annualKm} onChange={(e) => set("annualKm", e.target.value)} />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth label={t("wizard.auto.driverAge")} type="number" value={a.driverAge} onChange={(e) => set("driverAge", e.target.value)} />
          <TextField fullWidth label={t("wizard.auto.licenseYear")} type="number" value={a.licenseYear} onChange={(e) => set("licenseYear", e.target.value)} />
          <TextField select fullWidth label={t("wizard.auto.accidents")} value={a.accidents5y} onChange={(e) => set("accidents5y", e.target.value as AnswerSet["accidents5y"])} required>
            <MenuItem value="0">0</MenuItem>
            <MenuItem value="1">1</MenuItem>
            <MenuItem value="2+">2+</MenuItem>
          </TextField>
        </Stack>
        <TextField fullWidth label={t("wizard.auto.currentInsurer")} value={a.currentInsurer} onChange={(e) => set("currentInsurer", e.target.value)} />
        <TextField select fullWidth label={t("wizard.auto.coverage")} value={a.autoCoverage} onChange={(e) => set("autoCoverage", e.target.value as AnswerSet["autoCoverage"])} required>
          <MenuItem value="thirdPartyOnly">{t("wizard.auto.coverageThird")}</MenuItem>
          <MenuItem value="thirdPartyPlus">{t("wizard.auto.coveragePlus")}</MenuItem>
          <MenuItem value="comprehensive">{t("wizard.auto.coverageComprehensive")}</MenuItem>
        </TextField>
        <TextField fullWidth type="date" InputLabelProps={{ shrink: true }} label={t("wizard.startWish")} value={a.startWish} onChange={(e) => set("startWish", e.target.value)} />
      </Stack>
    );
  }
  if (a.type === "Home") {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField select fullWidth label={t("wizard.home.type")} value={a.propertyType} onChange={(e) => set("propertyType", e.target.value as AnswerSet["propertyType"])} required>
            <MenuItem value="apartment">{t("wizard.home.apartment")}</MenuItem>
            <MenuItem value="house">{t("wizard.home.house")}</MenuItem>
          </TextField>
          <TextField fullWidth label={t("wizard.home.sqm")} type="number" value={a.propertySqm} onChange={(e) => set("propertySqm", e.target.value)} required />
          <TextField fullWidth label={t("wizard.home.year")} type="number" value={a.propertyYear} onChange={(e) => set("propertyYear", e.target.value)} />
        </Stack>
        <TextField fullWidth label={t("wizard.home.address")} value={a.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} required />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth label={t("wizard.home.contents")} type="number" value={a.contentsValue} onChange={(e) => set("contentsValue", e.target.value)} />
          <TextField select fullWidth label={t("wizard.home.alarm")} value={a.hasAlarm} onChange={(e) => set("hasAlarm", e.target.value as AnswerSet["hasAlarm"])}>
            <MenuItem value="yes">{t("common.yes")}</MenuItem>
            <MenuItem value="no">{t("common.no")}</MenuItem>
          </TextField>
        </Stack>
        <TextField select fullWidth label={t("wizard.home.coverage")} value={a.homeCoverage} onChange={(e) => set("homeCoverage", e.target.value as AnswerSet["homeCoverage"])} required>
          <MenuItem value="fire">{t("wizard.home.coverageFire")}</MenuItem>
          <MenuItem value="firePlus">{t("wizard.home.coverageFirePlus")}</MenuItem>
          <MenuItem value="comprehensive">{t("wizard.home.coverageComprehensive")}</MenuItem>
        </TextField>
        <TextField fullWidth type="date" InputLabelProps={{ shrink: true }} label={t("wizard.startWish")} value={a.startWish} onChange={(e) => set("startWish", e.target.value)} />
      </Stack>
    );
  }
  if (a.type === "Health") {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField select fullWidth label={t("wizard.health.for")} value={a.healthFor} onChange={(e) => set("healthFor", e.target.value as AnswerSet["healthFor"])} required>
            <MenuItem value="myself">{t("wizard.health.myself")}</MenuItem>
            <MenuItem value="family">{t("wizard.health.family")}</MenuItem>
          </TextField>
          <TextField fullWidth label={t("wizard.health.members")} type="number" value={a.membersCount} onChange={(e) => set("membersCount", e.target.value)} />
          <TextField fullWidth label={t("wizard.health.ages")} value={a.agesText} onChange={(e) => set("agesText", e.target.value)} helperText={t("wizard.health.agesHelp")} />
        </Stack>
        <TextField fullWidth multiline rows={3} label={t("wizard.health.preExisting")} value={a.preExisting} onChange={(e) => set("preExisting", e.target.value)} />
        <TextField select fullWidth label={t("wizard.health.tier")} value={a.healthTier} onChange={(e) => set("healthTier", e.target.value as AnswerSet["healthTier"])} required>
          <MenuItem value="basic">{t("wizard.health.basic")}</MenuItem>
          <MenuItem value="mid">{t("wizard.health.mid")}</MenuItem>
          <MenuItem value="premium">{t("wizard.health.premium")}</MenuItem>
        </TextField>
      </Stack>
    );
  }
  if (a.type === "Life") {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField select fullWidth label={t("wizard.life.for")} value={a.lifeFor} onChange={(e) => set("lifeFor", e.target.value as AnswerSet["lifeFor"])} required>
            <MenuItem value="myself">{t("wizard.life.myself")}</MenuItem>
            <MenuItem value="spouse">{t("wizard.life.spouse")}</MenuItem>
            <MenuItem value="child">{t("wizard.life.child")}</MenuItem>
          </TextField>
          <TextField fullWidth type="number" label={t("wizard.life.age")} value={a.lifeAge} onChange={(e) => set("lifeAge", e.target.value)} />
          <TextField select fullWidth label={t("wizard.life.smoker")} value={a.lifeSmoker} onChange={(e) => set("lifeSmoker", e.target.value as AnswerSet["lifeSmoker"])}>
            <MenuItem value="yes">{t("common.yes")}</MenuItem>
            <MenuItem value="no">{t("common.no")}</MenuItem>
          </TextField>
        </Stack>
        <TextField fullWidth label={t("wizard.life.occupation")} value={a.lifeOccupation} onChange={(e) => set("lifeOccupation", e.target.value)} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth type="number" label={t("wizard.life.amount")} value={a.lifeAmount} onChange={(e) => set("lifeAmount", e.target.value)} />
          <TextField fullWidth type="number" label={t("wizard.life.term")} value={a.lifeTermYears} onChange={(e) => set("lifeTermYears", e.target.value)} />
        </Stack>
      </Stack>
    );
  }
  if (a.type === "Business") {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth label={t("wizard.business.type")} value={a.bizType} onChange={(e) => set("bizType", e.target.value)} required />
          <TextField fullWidth type="number" label={t("wizard.business.employees")} value={a.bizEmployees} onChange={(e) => set("bizEmployees", e.target.value)} />
          <TextField fullWidth type="number" label={t("wizard.business.turnover")} value={a.bizTurnover} onChange={(e) => set("bizTurnover", e.target.value)} />
        </Stack>
        <TextField fullWidth label={t("wizard.business.location")} value={a.bizLocation} onChange={(e) => set("bizLocation", e.target.value)} />
        <TextField fullWidth multiline rows={3} label={t("wizard.business.cover")} value={a.bizCover} onChange={(e) => set("bizCover", e.target.value)} />
      </Stack>
    );
  }
  if (a.type === "Travel") {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth label={t("wizard.travel.destination")} value={a.travelDestination} onChange={(e) => set("travelDestination", e.target.value)} required />
          <TextField fullWidth type="number" label={t("wizard.travel.days")} value={a.travelDays} onChange={(e) => set("travelDays", e.target.value)} required />
          <TextField fullWidth type="number" label={t("wizard.travel.travelers")} value={a.travelers} onChange={(e) => set("travelers", e.target.value)} />
        </Stack>
        <TextField fullWidth label={t("wizard.travel.ages")} value={a.travelAges} onChange={(e) => set("travelAges", e.target.value)} helperText={t("wizard.health.agesHelp")} />
        <TextField fullWidth multiline rows={2} label={t("wizard.travel.activities")} value={a.travelActivities} onChange={(e) => set("travelActivities", e.target.value)} />
      </Stack>
    );
  }
  // Other
  return (
    <TextField fullWidth multiline rows={6} label={t("wizard.other.details")} value={a.otherDetails}
      onChange={(e) => set("otherDetails", e.target.value)} required helperText={t("wizard.other.help")} />
  );
}

/* ====================== Helpers ====================== */

function validateDetails(a: AnswerSet, t: ReturnType<typeof useTranslation>["t"]): string | null {
  if (a.type === "Auto") {
    if (!a.vehicleMake || !a.vehicleModel || !a.vehicleYear || !a.plateNumber || !a.vehicleUsage || !a.accidents5y || !a.autoCoverage)
      return t("wizard.errors.fillRequired");
  }
  if (a.type === "Home") {
    if (!a.propertyType || !a.propertyAddress || !a.propertySqm || !a.homeCoverage)
      return t("wizard.errors.fillRequired");
  }
  if (a.type === "Health" && (!a.healthFor || !a.healthTier)) return t("wizard.errors.fillRequired");
  if (a.type === "Life" && !a.lifeFor) return t("wizard.errors.fillRequired");
  if (a.type === "Business" && !a.bizType) return t("wizard.errors.fillRequired");
  if (a.type === "Travel" && (!a.travelDestination || !a.travelDays)) return t("wizard.errors.fillRequired");
  if (a.type === "Other" && !a.otherDetails) return t("wizard.errors.fillRequired");
  return null;
}

type TranslateFn = ReturnType<typeof useTranslation>["t"];

function summariseAnswers(a: AnswerSet, t: TranslateFn): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (a.type === "Auto") {
    rows.push({ label: t("wizard.auto.make"), value: a.vehicleMake });
    rows.push({ label: t("wizard.auto.model"), value: a.vehicleModel });
    rows.push({ label: t("wizard.auto.year"), value: a.vehicleYear });
    rows.push({ label: t("wizard.auto.plate"), value: a.plateNumber });
    rows.push({ label: t("wizard.auto.usage"), value: a.vehicleUsage ? t(`wizard.auto.usage${cap(a.vehicleUsage)}`) : "—" });
    rows.push({ label: t("wizard.auto.annualKm"), value: a.annualKm });
    rows.push({ label: t("wizard.auto.driverAge"), value: a.driverAge });
    rows.push({ label: t("wizard.auto.licenseYear"), value: a.licenseYear });
    rows.push({ label: t("wizard.auto.accidents"), value: a.accidents5y });
    rows.push({ label: t("wizard.auto.currentInsurer"), value: a.currentInsurer });
    rows.push({ label: t("wizard.auto.coverage"), value: a.autoCoverage ? t(`wizard.auto.coverage${cap(a.autoCoverage)}`) : "—" });
  } else if (a.type === "Home") {
    rows.push({ label: t("wizard.home.type"), value: a.propertyType ? t(`wizard.home.${a.propertyType}`) : "—" });
    rows.push({ label: t("wizard.home.address"), value: a.propertyAddress });
    rows.push({ label: t("wizard.home.sqm"), value: a.propertySqm });
    rows.push({ label: t("wizard.home.year"), value: a.propertyYear });
    rows.push({ label: t("wizard.home.contents"), value: a.contentsValue });
    rows.push({ label: t("wizard.home.alarm"), value: a.hasAlarm ? t(`common.${a.hasAlarm}`) : "—" });
    rows.push({ label: t("wizard.home.coverage"), value: a.homeCoverage ? t(`wizard.home.coverage${cap(a.homeCoverage)}`) : "—" });
  } else if (a.type === "Health") {
    rows.push({ label: t("wizard.health.for"), value: a.healthFor ? t(`wizard.health.${a.healthFor}`) : "—" });
    rows.push({ label: t("wizard.health.members"), value: a.membersCount });
    rows.push({ label: t("wizard.health.ages"), value: a.agesText });
    rows.push({ label: t("wizard.health.preExisting"), value: a.preExisting });
    rows.push({ label: t("wizard.health.tier"), value: a.healthTier ? t(`wizard.health.${a.healthTier}`) : "—" });
  } else if (a.type === "Life") {
    rows.push({ label: t("wizard.life.for"), value: a.lifeFor ? t(`wizard.life.${a.lifeFor}`) : "—" });
    rows.push({ label: t("wizard.life.age"), value: a.lifeAge });
    rows.push({ label: t("wizard.life.occupation"), value: a.lifeOccupation });
    rows.push({ label: t("wizard.life.smoker"), value: a.lifeSmoker ? t(`common.${a.lifeSmoker}`) : "—" });
    rows.push({ label: t("wizard.life.amount"), value: a.lifeAmount });
    rows.push({ label: t("wizard.life.term"), value: a.lifeTermYears });
  } else if (a.type === "Business") {
    rows.push({ label: t("wizard.business.type"), value: a.bizType });
    rows.push({ label: t("wizard.business.employees"), value: a.bizEmployees });
    rows.push({ label: t("wizard.business.turnover"), value: a.bizTurnover });
    rows.push({ label: t("wizard.business.location"), value: a.bizLocation });
    rows.push({ label: t("wizard.business.cover"), value: a.bizCover });
  } else if (a.type === "Travel") {
    rows.push({ label: t("wizard.travel.destination"), value: a.travelDestination });
    rows.push({ label: t("wizard.travel.days"), value: a.travelDays });
    rows.push({ label: t("wizard.travel.travelers"), value: a.travelers });
    rows.push({ label: t("wizard.travel.ages"), value: a.travelAges });
    rows.push({ label: t("wizard.travel.activities"), value: a.travelActivities });
  } else if (a.type === "Other") {
    rows.push({ label: t("wizard.other.details"), value: a.otherDetails });
  }
  if (a.startWish) rows.push({ label: t("wizard.startWish"), value: a.startWish });
  return rows;
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildDescription(a: AnswerSet, t: TranslateFn): string {
  const lines: string[] = [];
  lines.push(`${t("wizard.subjectPrefix")}: ${t(`policies.types.${a.type}`)}`);
  lines.push("");
  for (const row of summariseAnswers(a, t)) {
    if (row.value && row.value !== "—") lines.push(`${row.label}: ${row.value}`);
  }
  if (a.notes) {
    lines.push("");
    lines.push(`${t("wizard.notes")}: ${a.notes}`);
  }
  return lines.join("\n");
}
