import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, FormControlLabel, Stack, Switch,
  TextField, Typography
} from "@mui/material";
import EngineeringIcon from "@mui/icons-material/Engineering";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { UnderMaintenancePage } from "./UnderMaintenancePage";
import { SiteMaintenancePage } from "./SiteMaintenancePage";

interface MaintenanceDto {
  launchGateEnabled: boolean;
  launchGateTitle: string | null;
  launchGateMessage: string | null;
  maintenanceModeEnabled: boolean;
  maintenanceTitle: string | null;
  maintenanceMessage: string | null;
}

export function PlatformMaintenancePage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewLaunch, setPreviewLaunch] = useState(false);
  const [previewSite, setPreviewSite] = useState(false);

  const q = useQuery({
    queryKey: ["platform-maintenance"],
    queryFn: async () => (await api.get<MaintenanceDto>("/platform/maintenance")).data
  });

  const [form, setForm] = useState<MaintenanceDto | null>(null);

  useEffect(() => { if (q.data && !form) setForm(q.data); }, [q.data, form]);

  const save = useMutation({
    mutationFn: async (next: MaintenanceDto) =>
      (await api.put<MaintenanceDto>("/platform/maintenance", next)).data,
    onSuccess: (r) => {
      qc.setQueryData(["platform-maintenance"], r);
      setForm(r);
      setSuccess("Οι ρυθμίσεις αποθηκεύτηκαν.");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  if (q.isLoading || !form) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(q.data);

  if (previewLaunch) {
    return (
      <Box sx={{ position: "fixed", inset: 0, zIndex: 9999, bgcolor: "background.default", overflow: "auto" }}>
        <Box sx={{ position: "fixed", top: 12, right: 12, zIndex: 10000 }}>
          <Button variant="contained" color="error" onClick={() => setPreviewLaunch(false)}>
            ← Έξοδος προεπισκόπησης
          </Button>
        </Box>
        <UnderMaintenancePage title={form.launchGateTitle} message={form.launchGateMessage} />
      </Box>
    );
  }
  if (previewSite) {
    return (
      <Box sx={{ position: "fixed", inset: 0, zIndex: 9999, bgcolor: "background.default", overflow: "auto" }}>
        <Box sx={{ position: "fixed", top: 12, right: 12, zIndex: 10000 }}>
          <Button variant="contained" color="error" onClick={() => setPreviewSite(false)}>
            ← Έξοδος προεπισκόπησης
          </Button>
        </Box>
        <SiteMaintenancePage title={form.maintenanceTitle} message={form.maintenanceMessage} />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <EngineeringIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Συντήρηση & Launch Gate</Typography>
          <Typography color="text.secondary">
            Δύο ξεχωριστοί διακόπτες με προσαρμόσιμα κείμενα. Οι αλλαγές εφαρμόζονται μέσα σε δευτερόλεπτα σε όλους τους χρήστες.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Stack spacing={3}>
        {/* LAUNCH GATE — agency-side only */}
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} mb={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Launch Gate</Typography>
                <Typography variant="body2" color="text.secondary">
                  Όταν είναι ενεργό, οι χρήστες των γραφείων (AgencyAdmin / AgencyUser / Producer) βλέπουν τη σελίδα κατασκευής αντί για το dashboard. Οι πελάτες και το superadmin συνεχίζουν κανονικά.
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.launchGateEnabled}
                    onChange={(e) => setForm({ ...form, launchGateEnabled: e.target.checked })}
                  />
                }
                label={form.launchGateEnabled ? "Ενεργό" : "Ανενεργό"}
                labelPlacement="start"
              />
            </Stack>

            <Stack spacing={2}>
              <TextField
                label="Τίτλος (προαιρετικός)"
                placeholder="Καλώς ήρθατε {{name}}! Φέρνουμε την πλατφόρμα σε λειτουργία."
                value={form.launchGateTitle ?? ""}
                onChange={(e) => setForm({ ...form, launchGateTitle: e.target.value })}
                fullWidth
                helperText="Άδειο = προεπιλεγμένο κείμενο. Το {{name}} αντικαθίσταται με το όνομα του χρήστη."
              />
              <TextField
                label="Μήνυμα (προαιρετικό)"
                placeholder="Η Kalypsis βρίσκεται σε προετοιμασία launch..."
                value={form.launchGateMessage ?? ""}
                onChange={(e) => setForm({ ...form, launchGateMessage: e.target.value })}
                multiline minRows={3}
                fullWidth
              />
              <Box>
                <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={() => setPreviewLaunch(true)}>
                  Προεπισκόπηση
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* SITE-WIDE MAINTENANCE — everyone */}
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} mb={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Συντήρηση Συστήματος</Typography>
                <Typography variant="body2" color="text.secondary">
                  Όταν είναι ενεργό, <strong>όλοι</strong> οι χρήστες (γραφεία, πελάτες, επισκέπτες) βλέπουν τη σελίδα συντήρησης. Μόνο PlatformAdmin / PlatformEmployee διατηρούν πρόσβαση για να διαχειριστούν την κατάσταση.
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.maintenanceModeEnabled}
                    onChange={(e) => setForm({ ...form, maintenanceModeEnabled: e.target.checked })}
                    color="error"
                  />
                }
                label={form.maintenanceModeEnabled ? "Ενεργό" : "Ανενεργό"}
                labelPlacement="start"
              />
            </Stack>

            <Stack spacing={2}>
              <TextField
                label="Τίτλος (προαιρετικός)"
                placeholder="Εργασίες συντήρησης σε εξέλιξη"
                value={form.maintenanceTitle ?? ""}
                onChange={(e) => setForm({ ...form, maintenanceTitle: e.target.value })}
                fullWidth
              />
              <TextField
                label="Μήνυμα (προαιρετικό)"
                placeholder="Επιστρέφουμε σε λίγα λεπτά..."
                value={form.maintenanceMessage ?? ""}
                onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
                multiline minRows={3}
                fullWidth
              />
              <Box>
                <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={() => setPreviewSite(true)}>
                  Προεπισκόπηση
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Save bar */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {dirty && (
            <Button onClick={() => setForm(q.data!)} disabled={save.isPending}>
              Ακύρωση αλλαγών
            </Button>
          )}
          <Button
            variant="contained"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(form)}
          >
            {save.isPending ? <CircularProgress size={18} color="inherit" /> : "Αποθήκευση"}
          </Button>
        </Stack>

        <Alert severity="info">
          <strong>Override για επείγουσες περιπτώσεις:</strong> προσθέστε <code>?staff=1</code> στο URL για να παρακάμψετε
          και τους δύο διακόπτες στον τρέχοντα browser (αποθηκεύεται στο localStorage). Αφαιρείται με <code>?staff=0</code>.
        </Alert>
      </Stack>
    </Box>
  );
}
