import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, CircularProgress, Stack, Switch, FormControlLabel, Typography } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface SettingDto { keyName: string; value: string | null; }

/** Per-office defaults for the two operational checkboxes used during policy entry. */
export function OfficeWorkflowSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["office-workflow-settings"],
    queryFn: async () => (await api.get<SettingDto[]>("/integration-settings", { params: { service: "OfficeWorkflow" } })).data,
  });
  const [autoDelivered, setAutoDelivered] = useState(true);
  const [autoReceipt, setAutoReceipt] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const values = useMemo(() => new Map((q.data ?? []).map(x => [x.keyName, x.value])), [q.data]);

  useEffect(() => {
    if (q.data) {
      setAutoDelivered(values.get("AutoMarkPolicyDelivered") !== "false");
      setAutoReceipt(values.get("AutoCreateReceiptOnPolicy") === "true");
    }
  }, [q.data, values]);

  const save = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.post("/integration-settings", { service: "OfficeWorkflow", keyName: "AutoMarkPolicyDelivered", value: String(autoDelivered), isSecret: false, notes: "Προεπιλογή παράδοσης κατά τη δημιουργία συμβολαίου" }),
        api.post("/integration-settings", { service: "OfficeWorkflow", keyName: "AutoCreateReceiptOnPolicy", value: String(autoReceipt), isSecret: false, notes: "Προεπιλογή δημιουργίας είσπραξης κατά τη δημιουργία συμβολαίου" }),
      ]);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["office-workflow-settings"] }); setSaved(true); setTimeout(() => setSaved(false), 2500); },
    onError: e => setError(extractErrorMessage(e)),
  });

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: .75 }}>Προεπιλογές δημιουργίας συμβολαίων</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Οι επιλογές εφαρμόζονται ως αρχικές τιμές στη φόρμα. Ο χρήστης μπορεί να τις αλλάξει πριν από την αποθήκευση.
        </Typography>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {saved && <Alert severity="success" sx={{ mb: 2 }}>Οι προεπιλογές αποθηκεύτηκαν.</Alert>}
        {q.isLoading ? <CircularProgress size={22} /> : <Stack spacing={1}>
          <FormControlLabel
            control={<Switch checked={autoDelivered} onChange={e => setAutoDelivered(e.target.checked)} color="success" />}
            label="Να σημειώνεται αυτόματα ως «Παραδόθηκε»"
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -1 }}>
            Η παράδοση παίρνει την ημερομηνία δημιουργίας και τρόπο «Ηλεκτρονικό ταχυδρομείο». Η επιλογή μπορεί να αποεπιλεγεί ανά συμβόλαιο.
          </Typography>
          <FormControlLabel
            control={<Switch checked={autoReceipt} onChange={e => setAutoReceipt(e.target.checked)} color="success" />}
            label="Να δημιουργείται αυτόματα είσπραξη κατά τη δημιουργία συμβολαίου"
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 6, mt: -1 }}>
            Δημιουργεί απόδειξη για ολόκληρο το ασφάλιστρο. Δεν εφαρμόζεται όταν ο πελάτης πληρώνει απευθείας στην ασφαλιστική.
          </Typography>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={() => save.mutate()} disabled={save.isPending} sx={{ alignSelf: "flex-start", mt: 1, fontWeight: 700 }}>
            {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση προεπιλογών"}
          </Button>
        </Stack>}
      </CardContent>
    </Card>
  );
}
