import { useMemo, useState, type FormEvent } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  IconButton, Stack, TextField, Tooltip, Typography
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import BugReportIcon from "@mui/icons-material/BugReport";
import SendIcon from "@mui/icons-material/Send";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePackages } from "../auth/PackagesContext";
import { useImpersonation } from "../impersonation/ImpersonationContext";

/**
 * Αίτημα Υποστήριξης — sits under Ρυθμίσεις Γραφείου.
 *
 * Two blocks:
 *  1. Auto-displayed diagnostics — role, tenantId, packages set,
 *     impersonation state, browser UA, current URL. Copy-to-clipboard for
 *     pasting into an email if the API side of the request fails.
 *  2. Free-text message form that POSTs to /public/contact so the same
 *     inbox that receives new-tenant enquiries also receives support
 *     requests from existing tenants; diagnostics are appended to the
 *     message body automatically.
 */
export function SupportRequestPage() {
  const { user } = useAuth();
  const { packages, isPlatformBypass } = usePackages();
  const { tenantId: impersonatedTenantId, tenantName: impersonatedTenantName } = useImpersonation();

  const diagnostics = useMemo(() => ({
    role: user?.role ?? "—",
    tenantId: user?.tenantId ?? "—",
    tenantName: user?.tenantName ?? "—",
    userId: user?.userId ?? "—",
    email: user?.email ?? "—",
    packages: Array.from(packages),
    isPlatformBypass,
    impersonating: !!impersonatedTenantId,
    impersonatedTenantId: impersonatedTenantId ?? null,
    impersonatedTenantName: impersonatedTenantName ?? null,
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "—",
    language: typeof navigator !== "undefined" ? navigator.language : "—",
    viewport: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "—",
    url: typeof window !== "undefined" ? window.location.href : "—",
    bundle: (globalThis as { __KALYPSIS_BUILD__?: string }).__KALYPSIS_BUILD__ ?? "(dev)",
    timestamp: new Date().toISOString()
  }), [user, packages, isPlatformBypass, impersonatedTenantId, impersonatedTenantName]);

  const diagnosticsText = useMemo(() => JSON.stringify(diagnostics, null, 2), [diagnostics]);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied — user can select the text manually */ }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!message.trim()) { setError("Γράψτε μια περιγραφή του προβλήματος."); return; }
    setSubmitting(true);
    try {
      // Reuses the public contact endpoint that already goes to the
      // Kalypsis mailbox. Payload must match PublicContactBody exactly
      // — inquiryType, firstName, lastName, consent are all mandatory,
      // and the backend rejects a combined `name` field with 400.
      const body = {
        inquiryType: "support",
        firstName: user?.firstName || (user?.email ?? "—"),
        lastName: user?.lastName || " ",
        email: user?.email ?? "info@mykalypsis.gr",
        phone: "",
        agencyOrCity: user?.tenantName ?? null,
        subject: subject.trim() || "Αίτημα υποστήριξης — από την πλατφόρμα",
        message:
`${message.trim()}

──────────────── Διαγνωστικά (αυτόματα) ────────────────
${diagnosticsText}`,
        consent: true
      };
      const res = await api.post<{ reference: string; delivered: boolean }>("/public/contact", body);
      if (res.data?.delivered === false) {
        // Backend accepted the submission but Brevo either rejected it or
        // isn't configured — surface that plainly instead of pretending
        // the email went through.
        setSuccess(`Το αίτημα καταγράφηκε (αρ. ${res.data.reference}) αλλά ο πάροχος email δεν το παρέδωσε. Στείλτε το επίσης στο info@mykalypsis.gr.`);
      } else {
        setSuccess(`Το αίτημά σας εστάλη (αρ. ${res.data?.reference ?? ""}). Θα σας απαντήσουμε στο email σας το συντομότερο δυνατόν.`);
      }
      setMessage("");
      setSubject("");
    } catch (err) {
      setError(extractErrorMessage(err, "Απέτυχε η αποστολή. Δοκιμάστε ξανά ή στείλτε email στο info@mykalypsis.gr."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <BugReportIcon color="primary" sx={{ fontSize: 34 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Αίτημα Υποστήριξης</Typography>
          <Typography color="text.secondary">
            Στείλτε αίτημα στην ομάδα Kalypsis. Τα τεχνικά διαγνωστικά επισυνάπτονται αυτόματα.
          </Typography>
        </Box>
      </Stack>

      {/* Diagnostics — always visible, auto-populated */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Διαγνωστικά</Typography>
            <Chip size="small" label="Αυτόματο" />
            <Box sx={{ flex: 1 }} />
            <Tooltip title={copied ? "Αντιγράφηκε" : "Αντιγραφή στο πρόχειρο"}>
              <IconButton size="small" onClick={copyDiagnostics}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{
            fontFamily: "monospace", fontSize: 12.5,
            lineHeight: 1.7, color: "text.primary",
            bgcolor: "rgba(11,37,69,0.03)",
            border: "1px solid rgba(11,37,69,0.08)",
            borderRadius: 1, p: 2,
            whiteSpace: "pre-wrap", wordBreak: "break-all"
          }}>
            {diagnosticsText}
          </Box>
        </CardContent>
      </Card>

      {/* Message form */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Περιγραφή προβλήματος</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2 }}>
            Πείτε μας τι δεν λειτουργεί όπως περιμένατε. Όσο περισσότερες λεπτομέρειες, τόσο πιο γρήγορα σας απαντάμε.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

          <form onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Θέμα (προαιρετικό)" fullWidth
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="π.χ. Δεν βλέπω τη Γέφυρα ERGO" />
              <TextField label="Μήνυμα" fullWidth required multiline minRows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Τι προσπαθούσατε να κάνετε; Τι εμφανίστηκε; Πότε ξεκίνησε;" />
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ flex: 1 }} />
                <Button type="submit" variant="contained" size="large"
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  disabled={submitting}>
                  {submitting ? "Αποστολή..." : "Αποστολή"}
                </Button>
              </Stack>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
