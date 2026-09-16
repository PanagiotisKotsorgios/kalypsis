import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  FormControlLabel, Stack, Switch, Typography
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import {
  SIDEBAR_GROUP_CONTAINERS,
  SIDEBAR_VISIBILITY_SECTIONS,
  sidebarGroupKey,
  sidebarItemKey,
  type SidebarVisibilityItem
} from "../config/sidebarVisibility";

interface SidebarVisibilityResponse {
  hiddenItems: string[];
}

function VisibilitySwitch({
  item, hidden, onChange, disabled = false
}: {
  item: SidebarVisibilityItem;
  hidden: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <FormControlLabel
      sx={{ m: 0, py: 0.5, alignItems: "flex-start", width: "100%" }}
      labelPlacement="start"
      control={<Switch checked={!hidden} onChange={(_, checked) => onChange(!checked)} disabled={disabled} />}
      label={
        <Box sx={{ pr: 2 }}>
          <Typography fontWeight={600}>{item.label}</Typography>
          {item.detail && <Typography variant="body2" color="text.secondary">{item.detail}</Typography>}
        </Box>
      }
      componentsProps={{ typography: { sx: { flex: 1 } } }}
    />
  );
}

export function TenantSidebarVisibilityTab({ tenantId, onError }: {
  tenantId: string;
  onError: (message: string | null) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const query = useQuery({
    queryKey: ["tenant-sidebar-visibility", tenantId],
    queryFn: async () => (await api.get<SidebarVisibilityResponse>(
      `/platform/tenants/${tenantId}/sidebar-visibility`
    )).data
  });

  const saved = useMemo(() => new Set(query.data?.hiddenItems ?? []), [query.data]);
  const current = draft ?? saved;
  const changed = draft !== null;

  const update = (key: string, hidden: boolean) => {
    setDraft(previous => {
      const next = new Set(previous ?? saved);
      if (hidden) next.add(key); else next.delete(key);
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => (await api.put<SidebarVisibilityResponse>(
      `/platform/tenants/${tenantId}/sidebar-visibility`,
      { hiddenItems: [...current] }
    )).data,
    onSuccess: (data) => {
      qc.setQueryData(["tenant-sidebar-visibility", tenantId], data);
      setDraft(null);
      onError(null);
    },
    onError: (error) => onError(extractErrorMessage(error))
  });

  if (query.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (query.error) {
    return <Alert severity="error">Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων sidebar.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Οι ρυθμίσεις αυτές αφορούν μόνο την εμφάνιση του sidebar για αυτό το γραφείο. Δεν αφαιρούν δικαιώματα,
        πακέτα ή πρόσβαση με απευθείας σύνδεσμο.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} mb={1}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Πλαίσια sidebar</Typography>
              <Typography variant="body2" color="text.secondary">
                Απενεργοποιήστε ένα πλαίσιο για να κρύψετε ολόκληρη την ομαδοποιημένη ενότητα και όλα τα στοιχεία της.
              </Typography>
            </Box>
            <Chip label={`${current.size} κρυφές επιλογές`} size="small" />
          </Stack>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, columnGap: 4 }}>
            {SIDEBAR_GROUP_CONTAINERS.map((group) => (
              <VisibilitySwitch
                key={group.path}
                item={group}
                hidden={current.has(sidebarGroupKey(group.path))}
                onChange={(hidden) => update(sidebarGroupKey(group.path), hidden)}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {SIDEBAR_VISIBILITY_SECTIONS.map((section) => (
        <Card key={section.title} variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={700}>{section.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{section.description}</Typography>
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, columnGap: 4 }}>
              {section.items.map((item) => (
                <VisibilitySwitch
                  key={item.path}
                  item={item}
                  hidden={current.has(sidebarItemKey(item.path))}
                  onChange={(hidden) => update(sidebarItemKey(item.path), hidden)}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      ))}

      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        {changed && <Button onClick={() => setDraft(null)}>Ακύρωση</Button>}
        <Button variant="outlined" disabled={save.isPending || current.size === 0}
          onClick={() => setDraft(new Set())}>
          Επαναφορά όλων
        </Button>
        <Button variant="contained" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Αποθήκευση…" : "Αποθήκευση"}
        </Button>
      </Stack>
    </Stack>
  );
}
