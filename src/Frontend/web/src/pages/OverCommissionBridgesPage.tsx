import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Stack, Tooltip, Typography
} from "@mui/material";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface AvailableCarrier {
  insuranceCompanyId: string;
  name: string;
  code: string;
  bridgeAvailable: boolean;
  bridgeFormat: string | null;
  unavailableReason: string | null;
}

export function OverCommissionBridgesPage() {
  const { t } = useTranslation();
  const [pickedName, setPickedName] = useState<string | null>(null);

  const carriers = useQuery({
    queryKey: ["available-bridges"],
    queryFn: async () => (await api.get<AvailableCarrier[]>("/carrier-bridges/available")).data
  });

  const items = carriers.data ?? [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <StackedLineChartIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("overCommissionBridges.title")}
          </Typography>
          <Typography color="text.secondary">
            {t("overCommissionBridges.subtitle")}
          </Typography>
        </Box>
      </Stack>

      {carriers.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Alert severity="info">{t("overCommissionBridges.noCompanies")}</Alert>
      ) : (
        <Card sx={{ p: 3 }}>
          <Typography fontWeight={700} mb={2}>{t("overCommissionBridges.pickCarrier")}</Typography>
          <Box sx={{
            display: "grid", gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(3,1fr)" }
          }}>
            {items.map(c => (
              <Card key={c.insuranceCompanyId} variant="outlined" sx={{
                p: 2, cursor: "pointer",
                transition: "all 0.15s",
                "&:hover": { borderColor: "primary.main", boxShadow: 2, transform: "translateY(-1px)" }
              }} onClick={() => setPickedName(c.name)}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography fontWeight={700}>{c.name}</Typography>
                  {c.bridgeAvailable
                    ? <Chip size="small" color="success" icon={<CheckCircleIcon />} label={c.bridgeFormat ?? "OK"} />
                    : <Tooltip title={c.unavailableReason ?? t("carrierBridges.unavailableReason")}>
                        <Chip size="small" icon={<HelpOutlineIcon />} label={t("carrierBridges.unavailable")} />
                      </Tooltip>}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                  {c.code}
                </Typography>
              </Card>
            ))}
          </Box>
        </Card>
      )}

      <Dialog open={!!pickedName} onClose={() => setPickedName(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <BuildIcon color="warning" />
            <span>{t("overCommissionBridges.underDevTitle")}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t("overCommissionBridges.underDevBody", { carrier: pickedName ?? "" })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setPickedName(null)}>
            {t("common.close", "Κλείσιμο")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
