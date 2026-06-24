import {
  Alert, Box, Button, Card, Chip, CircularProgress, IconButton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import InstallDesktopIcon from "@mui/icons-material/InstallDesktop";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InventoryIcon from "@mui/icons-material/Inventory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { ErrorPopup, useDescriptiveError } from "../components/ErrorPopup";

interface CatalogEntry {
  broadcastId: string;
  insuranceCompanyCode: string;
  insuranceCompanyName: string;
  kind: string;
  version: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  changelogNotes: string | null;
  isInstalled: boolean;
  installedAt: string | null;
  installedVersion: string | null;
  isOutdated: boolean;
}

export function ParametricFilesPage() {
  const qc = useQueryClient();
  const { error, setError, clear, handleError } = useDescriptiveError();

  const q = useQuery({
    queryKey: ["parametric-files-catalog"],
    queryFn: async () => (await api.get<CatalogEntry[]>("/parametric-files/catalog")).data
  });

  const install = useMutation({
    mutationFn: async (broadcastId: string) =>
      api.post(`/parametric-files/install/${broadcastId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["parametric-files-catalog"] });
      setError({ severity: "info", title: "Επιτυχής εγκατάσταση",
        message: "Η τελευταία έκδοση εγκαταστάθηκε επιτυχώς για το γραφείο σας." });
    },
    onError: handleError
  });

  // Group by carrier
  const byCarrier = (q.data ?? []).reduce<Record<string, CatalogEntry[]>>((acc, e) => {
    (acc[e.insuranceCompanyName] ??= []).push(e);
    return acc;
  }, {});

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <InventoryIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Παραμετρικά Αρχεία Ασφαλιστικών</Typography>
              <HelpHint title="Παραμετρικά αρχεία"
                body="Αρχεία ρυθμίσεων που σας στέλνουν οι ασφαλιστικές εταιρείες — τιμολόγια, καλύψεις, πακέτα, κωδικοί προμηθειών. Ο διαχειριστής της πλατφόρμας ανεβάζει τις τελευταίες εκδόσεις, εσείς τις εγκαθιστάτε με ένα κλικ." />
            </Stack>
            <Typography color="text.secondary">
              Εγκαταστήστε τις τελευταίες παραμέτρους που έχει ανεβάσει η Kalypsis για κάθε ασφαλιστική εταιρεία.
            </Typography>
          </Box>
        </Stack>
        <Button startIcon={<RefreshIcon />} onClick={() => q.refetch()}>Ανανέωση</Button>
      </Stack>

      <ErrorPopup error={error} onClose={clear} />

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : Object.keys(byCarrier).length === 0 ? (
        <Alert severity="info">
          <strong>Δεν υπάρχουν διαθέσιμα παραμετρικά αρχεία ακόμα.</strong> Όταν η Kalypsis ανεβάσει αρχεία για κάποια ασφαλιστική εταιρεία, θα εμφανιστούν εδώ προς εγκατάσταση.
        </Alert>
      ) : (
        <Stack spacing={3}>
          {Object.entries(byCarrier).map(([carrier, entries]) => (
            <Card key={carrier} variant="outlined">
              <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{carrier}</Typography>
                <Chip size="small" label={entries[0].insuranceCompanyCode} sx={{ fontFamily: "monospace" }} />
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Τύπος</TableCell>
                    <TableCell>Έκδοση</TableCell>
                    <TableCell>Ισχύς</TableCell>
                    <TableCell>Αρχείο</TableCell>
                    <TableCell>Κατάσταση</TableCell>
                    <TableCell align="right">Ενέργειες</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.broadcastId} hover>
                      <TableCell>{e.kind}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{e.version}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {e.effectiveFrom ? new Date(e.effectiveFrom).toLocaleDateString("el-GR") : "—"}
                        {e.effectiveTo ? ` → ${new Date(e.effectiveTo).toLocaleDateString("el-GR")}` : ""}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {e.originalFileName ?? "—"}
                        {e.fileSizeBytes && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {(e.fileSizeBytes / 1024).toFixed(0)} KB
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.isInstalled && !e.isOutdated ? (
                          <Chip size="small" color="success" icon={<CheckCircleIcon />} label="Εγκατεστημένο" />
                        ) : e.isOutdated ? (
                          <Chip size="small" color="warning" icon={<WarningAmberIcon />} label="Διαθέσιμη νέα έκδοση" />
                        ) : (
                          <Chip size="small" variant="outlined" label="Διαθέσιμο" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small"
                            component="a" href={`/api/platform/parametric-files/${e.broadcastId}/download`}
                            target="_blank" title="Λήψη αρχείου">
                            <CloudDownloadIcon fontSize="small" />
                          </IconButton>
                          <Button size="small"
                            variant={e.isInstalled && !e.isOutdated ? "outlined" : "contained"}
                            startIcon={<InstallDesktopIcon />}
                            disabled={install.isPending || (e.isInstalled && !e.isOutdated)}
                            onClick={() => install.mutate(e.broadcastId)}>
                            {e.isInstalled && !e.isOutdated ? "Εγκατεστημένο" :
                             e.isOutdated ? "Ενημέρωση" : "Εγκατάσταση"}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
