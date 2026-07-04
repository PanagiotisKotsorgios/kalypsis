import { useState } from "react";
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Switch, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface Profile { emailLoginCodeEnabled: boolean; email: string; }

/**
 * Per-user opt-in for email-code 2FA. When on, LoginCommand sends a 6-digit
 * code via Brevo to the user's email on every successful password check
 * before real session tokens are issued. Toggle is stored on
 * User.EmailLoginCodeEnabled and read via GET /api/me.
 */
export function EmailTwoFactorSection() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => (await api.get<Profile>("/me")).data
  });
  const enabled = q.data?.emailLoginCodeEnabled ?? false;

  const toggle = useMutation({
    mutationFn: async (next: boolean) => api.post("/me/email-2fa", { enabled: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-profile"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center",
            bgcolor: enabled ? "rgba(46,164,79,0.10)" : "rgba(11,37,69,0.06)",
            color: enabled ? "#1e7a32" : "primary.main"
          }}>
            <EmailIcon />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                Επαλήθευση μέσω email (2FA)
              </Typography>
              {enabled
                ? <Chip size="small" color="success" label="Ενεργή" sx={{ fontWeight: 800 }} />
                : <Chip size="small" label="Ανενεργή" sx={{ fontWeight: 800 }} />}
            </Stack>
            <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
              Σε κάθε είσοδο, θα σας στέλνουμε 6-ψήφιο κωδικό στο <b>{q.data?.email}</b> μέσω email
              (Brevo). Χωρίς αυτόν, ο κωδικός σας δεν αρκεί. Δεν χρειάζεται εφαρμογή authenticator.
            </Typography>
          </Box>
          {q.isLoading || toggle.isPending
            ? <CircularProgress size={20} />
            : <Switch checked={enabled} onChange={(e) => toggle.mutate(e.target.checked)} />}
        </Stack>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>{error}</Alert>}
      </CardContent>
    </Card>
  );
}
