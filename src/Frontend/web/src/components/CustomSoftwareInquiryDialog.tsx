import { useId, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

type InquiryForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  projectType: string;
  budget: string;
  timeline: string;
  details: string;
  consent: boolean;
  website: string;
};

const emptyForm = (): InquiryForm => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  projectType: "",
  budget: "",
  timeline: "",
  details: "",
  consent: false,
  website: "",
});

export function CustomSoftwareInquiryDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { i18n } = useTranslation();
  const isEnglish = i18n.resolvedLanguage?.startsWith("en") ?? false;
  const [form, setForm] = useState<InquiryForm>(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string } | null>(null);
  const id = useId();
  const labels = isEnglish
    ? {
        title: "Request a custom software proposal",
        intro:
          "Share a few details about your project. Our team will review your request and contact you.",
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        phone: "Phone (optional)",
        company: "Company (optional)",
        projectType: "Type of software",
        chooseType: "Choose a type",
        projectTypes: [
          "Web application",
          "Desktop software",
          "CRM / ERP",
          "Automation",
          "E-commerce",
          "Other",
        ],
        budget: "Indicative budget (optional)",
        chooseBudget: "Not decided",
        budgets: ["Under €5,000", "€5,000–€15,000", "€15,000–€50,000", "Over €50,000"],
        timeline: "Desired timeline (optional)",
        chooseTimeline: "Not decided",
        timelines: ["Within 1 month", "1–3 months", "3–6 months", "Over 6 months"],
        details: "What would you like the software to do?",
        consent:
          "I agree to be contacted by KALYPSIS about this project request.",
        send: "Send request",
        sending: "Sending…",
        sentTitle: "Your request has been sent.",
        sentBody:
          "The KALYPSIS team has received your project inquiry and will contact you.",
        reference: "Reference",
        failedDelivery:
          "The email could not be confirmed as delivered. Please try again or email info@mykalypsis.gr.",
        close: "Close",
        required: "Please complete all required fields and provide a valid email.",
        detailsRequired: "Please describe your project (at least 10 characters).",
        consentRequired: "Please agree to be contacted about your request.",
        network: "The request could not be sent. Please try again.",
      }
    : {
        title: "Ζητήστε προσφορά για custom λογισμικό",
        intro:
          "Πείτε μας λίγα λόγια για το έργο σας. Η ομάδα μας θα αξιολογήσει το αίτημα και θα επικοινωνήσει μαζί σας.",
        firstName: "Όνομα",
        lastName: "Επώνυμο",
        email: "Email",
        phone: "Τηλέφωνο (προαιρετικό)",
        company: "Επιχείρηση (προαιρετικό)",
        projectType: "Τύπος λογισμικού",
        chooseType: "Επιλέξτε τύπο",
        projectTypes: [
          "Web εφαρμογή",
          "Desktop λογισμικό",
          "CRM / ERP",
          "Αυτοματισμός",
          "E-commerce",
          "Άλλο",
        ],
        budget: "Ενδεικτικός προϋπολογισμός (προαιρετικό)",
        chooseBudget: "Δεν έχει αποφασιστεί",
        budgets: ["Έως 5.000 €", "5.000–15.000 €", "15.000–50.000 €", "Πάνω από 50.000 €"],
        timeline: "Επιθυμητό χρονοδιάγραμμα (προαιρετικό)",
        chooseTimeline: "Δεν έχει αποφασιστεί",
        timelines: ["Έως 1 μήνα", "1–3 μήνες", "3–6 μήνες", "Πάνω από 6 μήνες"],
        details: "Τι θα θέλατε να κάνει το λογισμικό;",
        consent:
          "Συμφωνώ να επικοινωνήσει μαζί μου η KALYPSIS σχετικά με το αίτημά μου.",
        send: "Αποστολή αιτήματος",
        sending: "Αποστολή…",
        sentTitle: "Το αίτημά σας στάλθηκε.",
        sentBody:
          "Η ομάδα KALYPSIS έλαβε το αίτημα για το έργο σας και θα επικοινωνήσει μαζί σας.",
        reference: "Κωδικός αναφοράς",
        failedDelivery:
          "Δεν επιβεβαιώθηκε η παράδοση του email. Δοκιμάστε ξανά ή στείλτε email στο info@mykalypsis.gr.",
        close: "Κλείσιμο",
        required: "Συμπληρώστε τα υποχρεωτικά πεδία και ένα έγκυρο email.",
        detailsRequired: "Περιγράψτε το έργο σας (τουλάχιστον 10 χαρακτήρες).",
        consentRequired: "Απαιτείται συγκατάθεση επικοινωνίας για το αίτημα.",
        network: "Δεν ήταν δυνατή η αποστολή. Δοκιμάστε ξανά.",
      };

  const update = (key: keyof InquiryForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const close = () => {
    if (submitting) return;
    onClose();
    setForm(emptyForm());
    setResult(null);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !/^\S+@\S+\.\S+$/.test(form.email.trim())
    ) {
      setError(labels.required);
      return;
    }
    if (form.details.trim().length < 10) {
      setError(labels.detailsRequired);
      return;
    }
    if (!form.consent) {
      setError(labels.consentRequired);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const response = await api.post<{ reference: string; delivered: boolean }>(
        "/public/contact",
        {
          inquiryType: "custom-software",
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          companyName: form.company.trim() || null,
          agencyOrCity: null,
          subject: `Αίτημα προσφοράς custom λογισμικού: ${form.projectType || "Γενικό"}`,
          message: [
            `Τύπος λογισμικού: ${form.projectType || "Δεν επιλέχθηκε"}`,
            `Ενδεικτικός προϋπολογισμός: ${form.budget || "Δεν ορίστηκε"}`,
            `Επιθυμητό χρονοδιάγραμμα: ${form.timeline || "Δεν ορίστηκε"}`,
            "",
            "Περιγραφή έργου:",
            form.details.trim(),
          ].join("\n"),
          consent: form.consent,
          website: form.website,
        },
      );
      if (!response.data.delivered) {
        setError(labels.failedDelivery);
        return;
      }
      setResult({ reference: response.data.reference });
    } catch (failure) {
      setError(extractErrorMessage(failure, labels.network));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      bgcolor: "#fff",
      color: "#102d55",
      borderRadius: 1.5,
      "& fieldset": { borderColor: "#b7c8dc" },
      "&:hover fieldset": { borderColor: "#52769d" },
      "&.Mui-focused fieldset": { borderColor: "#1262bc" },
    },
    "& .MuiInputLabel-root": { color: "#405773" },
  };

  const requiredTextField = (
    key: "firstName" | "lastName" | "email",
    label: string,
    type = "text",
  ) => (
    <TextField
      required
      fullWidth
      id={`${id}-${key}`}
      label={label}
      type={type}
      autoComplete={
        key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : "email"
      }
      value={form[key]}
      onChange={(event) => update(key, event.target.value)}
      inputProps={{ maxLength: key === "email" ? 160 : 120 }}
      disabled={submitting}
      sx={fieldSx}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-labelledby={`${id}-title`}
      PaperProps={{
        sx: {
          width: "calc(100% - 32px)",
          maxHeight: "calc(100dvh - 32px)",
          m: 2,
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "#f8fbfe",
        },
      }}
    >
      <DialogTitle
        id={`${id}-title`}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          color: "#fff",
          background: "linear-gradient(110deg,#0b305c,#155784)",
          p: { xs: 2, sm: 2.5 },
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography component="span" sx={{ display: "block", fontSize: 22, fontWeight: 850 }}>
            {labels.title}
          </Typography>
          <Typography sx={{ mt: 0.5, color: "#d4e6f5", fontSize: 14, fontWeight: 400 }}>
            {labels.intro}
          </Typography>
        </Box>
        <IconButton
          onClick={close}
          disabled={submitting}
          aria-label={labels.close}
          sx={{ color: "#fff" }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 2, sm: 2.5 }, "&.MuiDialogContent-root": { pt: 2.5 } }}>
        {result ? (
          <Stack alignItems="center" textAlign="center" gap={1.5} role="status" sx={{ py: 3 }}>
            <CheckCircleRoundedIcon sx={{ color: "#168552", fontSize: 58 }} />
            <Typography sx={{ color: "#102d55", fontSize: 21, fontWeight: 850 }}>
              {labels.sentTitle}
            </Typography>
            <Typography color="text.secondary">{labels.sentBody}</Typography>
            <Typography variant="caption">
              {labels.reference}: {result.reference}
            </Typography>
            <Button onClick={close} variant="contained" sx={{ mt: 1 }}>
              {labels.close}
            </Button>
          </Stack>
        ) : (
          <Box
            component="form"
            onSubmit={submit}
            noValidate
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
              gap: 1.75,
            }}
          >
            {error && (
              <Alert severity="error" role="alert" sx={{ gridColumn: "1 / -1" }}>
                {error}
              </Alert>
            )}
            {requiredTextField("firstName", labels.firstName)}
            {requiredTextField("lastName", labels.lastName)}
            {requiredTextField("email", labels.email, "email")}
            <TextField
              fullWidth
              id={`${id}-phone`}
              label={labels.phone}
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              inputProps={{ maxLength: 40 }}
              disabled={submitting}
              sx={fieldSx}
            />
            <TextField
              fullWidth
              id={`${id}-company`}
              label={labels.company}
              value={form.company}
              onChange={(event) => update("company", event.target.value)}
              inputProps={{ maxLength: 200 }}
              disabled={submitting}
              sx={fieldSx}
            />
            <TextField
              select
              fullWidth
              id={`${id}-project-type`}
              label={labels.projectType}
              value={form.projectType}
              onChange={(event) => update("projectType", event.target.value)}
              disabled={submitting}
              sx={fieldSx}
            >
              <MenuItem value="">{labels.chooseType}</MenuItem>
              {labels.projectTypes.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              id={`${id}-budget`}
              label={labels.budget}
              value={form.budget}
              onChange={(event) => update("budget", event.target.value)}
              disabled={submitting}
              sx={fieldSx}
            >
              <MenuItem value="">{labels.chooseBudget}</MenuItem>
              {labels.budgets.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              id={`${id}-timeline`}
              label={labels.timeline}
              value={form.timeline}
              onChange={(event) => update("timeline", event.target.value)}
              disabled={submitting}
              sx={fieldSx}
            >
              <MenuItem value="">{labels.chooseTimeline}</MenuItem>
              {labels.timelines.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              fullWidth
              multiline
              minRows={4}
              id={`${id}-details`}
              label={labels.details}
              value={form.details}
              onChange={(event) => update("details", event.target.value)}
              inputProps={{ maxLength: 4000 }}
              disabled={submitting}
              sx={{ ...fieldSx, gridColumn: "1 / -1" }}
            />
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clipPath: "inset(50%)",
                pointerEvents: "none",
              }}
            >
              <input
                name="website"
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </Box>
            <FormControlLabel
              sx={{
                gridColumn: "1 / -1",
                alignItems: "flex-start",
                m: 0,
                "& .MuiFormControlLabel-label": { color: "#405773", fontSize: 13, pt: 0.5 },
              }}
              control={
                <Checkbox
                  checked={form.consent}
                  onChange={(event) => update("consent", event.target.checked)}
                  disabled={submitting}
                  sx={{ pt: 0 }}
                />
              }
              label={labels.consent}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              endIcon={
                submitting ? <CircularProgress size={18} color="inherit" /> : undefined
              }
              sx={{
                gridColumn: "1 / -1",
                justifySelf: { xs: "stretch", sm: "end" },
                minHeight: 48,
                px: 3,
                bgcolor: "#0b356c",
                fontWeight: 850,
                textTransform: "none",
                "&:hover": { bgcolor: "#124c91" },
              }}
            >
              {submitting ? labels.sending : labels.send}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
