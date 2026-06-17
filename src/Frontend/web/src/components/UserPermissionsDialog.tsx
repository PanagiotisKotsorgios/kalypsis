import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Stack, Typography
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface UserPermissionsDto {
  userId: string; email: string; name: string; role: string;
  effective: string[]; custom: string[] | null;
}

const GROUPS: { key: string; codes: string[] }[] = [
  { key: "customers", codes: ["customers.read","customers.write","customers.delete"] },
  { key: "policies", codes: ["policies.read","policies.write","policies.delete"] },
  { key: "documents", codes: ["documents.read","documents.write"] },
  { key: "claims", codes: ["claims.read","claims.write"] },
  { key: "appointments", codes: ["appointments.read","appointments.write"] },
  { key: "tariffs", codes: ["tariffs.read","tariffs.write"] },
  { key: "covernotes", codes: ["covernotes.read","covernotes.write"] },
  { key: "financials", codes: ["financials.read","receipts.read","receipts.write","payments.read","payments.write","securities.read","securities.write"] },
  { key: "commissions", codes: ["commissions.read","commissions.run","overcommissions.read","overcommissions.write"] },
  { key: "marketing", codes: ["marketing.read","marketing.send","delivery.read","delivery.write"] },
  { key: "production", codes: ["production.read","goals.read","goals.write"] },
  { key: "bridges", codes: ["bridges.read","bridges.sync","exports.run"] }
];

export function UserPermissionsDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["user-permissions", userId],
    enabled: !!userId,
    queryFn: async () => (await api.get<UserPermissionsDto>(`/permissions/user/${userId}`)).data
  });

  useEffect(() => {
    if (q.data) setSelected(new Set(q.data.custom ?? q.data.effective));
  }, [q.data]);

  const save = useMutation({
    mutationFn: async (permissions: string[] | null) =>
      (await api.put<UserPermissionsDto>(`/permissions/user/${userId}`, { permissions })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["user-permissions"] }); onClose(); },
    onError: e => setErr(extractErrorMessage(e))
  });

  const toggle = (code: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const toggleGroup = (codes: string[]) => {
    const allOn = codes.every(c => selected.has(c));
    setSelected(prev => {
      const next = new Set(prev);
      if (allOn) codes.forEach(c => next.delete(c));
      else codes.forEach(c => next.add(c));
      return next;
    });
  };

  return (
    <Dialog open={!!userId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={800}>{t("permissions.title")}</Typography>
            {q.data && (
              <Typography variant="caption" color="text.secondary">
                {q.data.name} · {q.data.email} · <Chip size="small" label={t(`roles.${q.data.role}`)} sx={{ ml: 0.5, height: 18 }} />
                {q.data.custom === null && (
                  <Chip size="small" label={t("permissions.usingDefaults")} color="info" sx={{ ml: 0.5, height: 18 }} />
                )}
              </Typography>
            )}
          </Box>
          <Button startIcon={<RestoreIcon />} size="small" onClick={() => save.mutate(null)} disabled={save.isPending}>
            {t("permissions.resetDefaults")}
          </Button>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
          <Stack spacing={2.5}>
            {GROUPS.map(g => {
              const allOn = g.codes.every(c => selected.has(c));
              const someOn = !allOn && g.codes.some(c => selected.has(c));
              return (
                <Box key={g.key}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 1 }}>
                    <Typography variant="overline" fontWeight={700}>{t(`permissions.group.${g.key}`)}</Typography>
                    <FormControlLabel control={
                      <Checkbox size="small" checked={allOn} indeterminate={someOn} onChange={() => toggleGroup(g.codes)} />
                    } label={t("permissions.toggleAll")} />
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 0.5 }}>
                    {g.codes.map(c => (
                      <FormControlLabel key={c} control={
                        <Checkbox size="small" checked={selected.has(c)} onChange={() => toggle(c)} />
                      } label={<Typography variant="body2" sx={{ fontFamily: "monospace" }}>{c}</Typography>} />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate(Array.from(selected))} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
