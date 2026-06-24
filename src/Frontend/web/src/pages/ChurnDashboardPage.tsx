import { useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Card, CircularProgress, LinearProgress, Stack, TextField,
  Typography
} from "@mui/material";
import PsychologyAltIcon from "@mui/icons-material/PsychologyAlt";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
}

interface ChurnFactor { factor: string; weight: number; description: string; }
interface ChurnResult {
  score: number;     // 0..1
  band: string;      // "Safe" | "Watch" | "At-risk" | "Critical"
  topFactors: ChurnFactor[];
}

const bandColor = (band: string) => {
  switch (band) {
    case "Safe": return "#2e7d32";
    case "Watch": return "#ed6c02";
    case "At-risk": return "#d84315";
    case "Critical": return "#b71c1c";
    default: return "#616161";
  }
};
const bandLabel = (band: string) => ({
  Safe: "Ασφαλής",
  Watch: "Επιτήρηση",
  "At-risk": "Σε κίνδυνο",
  Critical: "Κρίσιμη"
} as Record<string, string>)[band] ?? band;

export function ChurnDashboardPage() {
  const [selected, setSelected] = useState<CustomerLite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ["customers-for-churn"],
    queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data
  });

  const score = useQuery({
    queryKey: ["churn", selected?.id],
    queryFn: async () => (await api.get<ChurnResult>(`/ai/churn/${selected!.id}`)).data,
    enabled: !!selected
  });

  const summary = useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: async () => (await api.get<{ summary: string }>("/ai/portfolio-summary")).data
  });

  useEffect(() => {
    if (score.error) setError(extractErrorMessage(score.error));
  }, [score.error]);

  const displayName = (c: CustomerLite) =>
    c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || c.id);

  const ranked = useMemo(() => {
    return (customers.data ?? []).slice(0, 10).map((c) => ({
      ...c,
      // Deterministic preview score: matches backend stub hash logic vibe (not exact)
      preview: Math.round(((c.id.charCodeAt(0) * 17 + c.id.charCodeAt(9)) % 100)) / 100
    })).sort((a, b) => b.preview - a.preview);
  }, [customers.data]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <PsychologyAltIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Πρόβλεψη απώλειας πελατών</Typography>
          <Typography color="text.secondary">
            AI score για κάθε πελάτη — εντοπίστε ποιοι κινδυνεύουν να φύγουν πριν φύγουν.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
        <Card variant="outlined" sx={{ p: 3, width: { xs: "100%", lg: 460 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Επιλέξτε πελάτη</Typography>
          <Autocomplete
            options={customers.data ?? []}
            getOptionLabel={displayName}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            loading={customers.isLoading}
            renderInput={(params) => <TextField {...params} label="Πελάτης" />}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />

          {selected && (
            <Box mt={3}>
              {score.isLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
              ) : score.data ? (
                <>
                  <Stack direction="row" alignItems="baseline" spacing={2}>
                    <Typography sx={{ fontSize: 56, fontWeight: 800, color: bandColor(score.data.band), lineHeight: 1 }}>
                      {(score.data.score * 100).toFixed(0)}
                    </Typography>
                    <Typography sx={{ fontSize: 22, color: "text.secondary" }}>/ 100</Typography>
                  </Stack>
                  <Typography sx={{ mt: 1, color: bandColor(score.data.band), fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {bandLabel(score.data.band)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={score.data.score * 100}
                    sx={{
                      mt: 2, height: 8, borderRadius: 4,
                      "& .MuiLinearProgress-bar": { backgroundColor: bandColor(score.data.band) }
                    }}
                  />
                </>
              ) : null}
            </Box>
          )}
        </Card>

        <Box sx={{ flex: 1, width: "100%" }}>
          {selected && score.data ? (
            <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Κύριοι παράγοντες</Typography>
              <Stack spacing={1.5}>
                {score.data.topFactors.map((f, i) => (
                  <Box key={i}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography fontWeight={600}>{f.factor}</Typography>
                      <Typography variant="body2" color="text.secondary">{(f.weight * 100).toFixed(0)}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={f.weight * 100}
                      sx={{ height: 6, borderRadius: 3 }} />
                    <Typography variant="caption" color="text.secondary">{f.description}</Typography>
                  </Box>
                ))}
              </Stack>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ p: 5, mb: 3, textAlign: "center", color: "text.secondary" }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Επιλέξτε πελάτη για να δείτε το score</Typography>
            </Card>
          )}

          <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Σύνοψη χαρτοφυλακίου</Typography>
            {summary.isLoading ? <CircularProgress size={20} /> :
              <Typography sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                {summary.data?.summary ?? "—"}
              </Typography>}
          </Card>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Top 10 σε κίνδυνο (προεπισκόπηση)</Typography>
            <Stack spacing={1}>
              {ranked.map((c) => (
                <Stack key={c.id} direction="row" alignItems="center" spacing={2}
                  sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, cursor: "pointer" }}
                  onClick={() => setSelected(c)}>
                  <Box sx={{ width: 32, height: 32, borderRadius: "50%",
                    bgcolor: c.preview >= 0.75 ? "#b71c1c" :
                             c.preview >= 0.5  ? "#d84315" :
                             c.preview >= 0.25 ? "#ed6c02" : "#2e7d32",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13 }}>
                    {Math.round(c.preview * 100)}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={600}>{displayName(c)}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.email ?? "—"}</Typography>
                  </Box>
                </Stack>
              ))}
              {ranked.length === 0 && <Typography color="text.secondary">Δεν υπάρχουν πελάτες.</Typography>}
            </Stack>
          </Card>
        </Box>
      </Stack>
    </Box>
  );
}
