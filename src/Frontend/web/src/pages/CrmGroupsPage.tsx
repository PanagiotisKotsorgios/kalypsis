import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, List, ListItem, ListItemText,
  Stack, Tab, Tabs, TextField, Tooltip, Typography
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type EntityType = "Customer" | "Producer";
interface GroupDto { id: string; name: string; entityType: EntityType; description: string | null; isDynamic: boolean; isActive: boolean; memberCount: number; createdAt: string; }

export function CrmGroupsPage() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState<EntityType>("Customer");
  const [editing, setEditing] = useState<GroupDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useQuery({
    queryKey: ["crm-groups", entityType],
    queryFn: async () => (await api.get<GroupDto[]>("/crm/groups", { params: { entityType } })).data,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/crm/groups/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["crm-groups"] }),
    onError: e => setError(extractErrorMessage(e)),
  });

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2} mb={2}>
        <GroupsIcon sx={{ fontSize: 40, color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={800}>Ομάδες CRM</Typography>
          <Typography color="text.secondary">Δημιουργήστε στοχευμένα κοινά πελατών και συνεργατών για καμπάνιες, follow-ups και αναφορές.</Typography>
        </Box>
        <Button component={RouterLink} to="/app/crm-settings" startIcon={<SettingsIcon />} variant="outlined">
          Ρυθμίσεις αποστολών
        </Button>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>Νέα ομάδα</Button>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>
        Τα email και SMS των ομάδων χρησιμοποιούν τα credentials Brevo και Bulker του συγκεκριμένου γραφείου από τις ρυθμίσεις CRM. Δεν χρησιμοποιείται το γενικό κλειδί της πλατφόρμας.
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Tabs value={entityType} onChange={(_, value) => setEntityType(value)} sx={{ mb: 2 }}>
        <Tab value="Customer" label="Πελάτες" />
        <Tab value="Producer" label="Συνεργάτες" />
      </Tabs>
      {groups.isLoading ? <CircularProgress /> : (
        <Card variant="outlined">
          <List disablePadding>
            {(groups.data ?? []).length === 0 && <ListItem><ListItemText primary="Δεν υπάρχουν ομάδες ακόμη." secondary="Πατήστε «Νέα ομάδα» για να ξεκινήσετε." /></ListItem>}
            {(groups.data ?? []).map(group => (
              <ListItem key={group.id} divider secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Επεξεργασία"><IconButton onClick={() => setEditing(group)}><EditIcon /></IconButton></Tooltip>
                  <Tooltip title="Διαγραφή"><IconButton color="error" onClick={() => { if (confirm(`Διαγραφή της ομάδας «${group.name}»;`)) remove.mutate(group.id); }}><DeleteIcon /></IconButton></Tooltip>
                </Stack>
              }>
                <ListItemText primary={<Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={750}>{group.name}</Typography><Chip size="small" label={`${group.memberCount} μέλη`} /></Stack>} secondary={group.description || "Χωρίς περιγραφή"} />
              </ListItem>
            ))}
          </List>
        </Card>
      )}
      <GroupDialog open={createOpen || !!editing} entityType={entityType} group={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => { setCreateOpen(false); setEditing(null); void qc.invalidateQueries({ queryKey: ["crm-groups"] }); }}
        onError={setError} />
    </Box>
  );
}

function GroupDialog({ open, entityType, group, onClose, onSaved, onError }: {
  open: boolean; entityType: EntityType; group: GroupDto | null; onClose: () => void; onSaved: () => void; onError: (message: string) => void;
}) {
  const editing = !!group;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const options = useQuery({
    queryKey: ["crm-group-options", entityType],
    enabled: open,
    queryFn: async () => {
      if (entityType === "Producer") {
        const rows = (await api.get<Array<{ id: string; name: string; email?: string | null; phone?: string | null }>>("/producers", { params: { pageSize: 1000 } })).data;
        return rows.map(x => ({ id: x.id, label: x.name, email: x.email, phone: x.phone }));
      }
      const rows = (await api.get<Array<{ id: string; firstName?: string; lastName?: string; companyName?: string; email?: string; phone?: string }>>("/customers", { params: { pageSize: 1000 } })).data;
      return rows.map(x => ({ id: x.id, label: x.companyName || `${x.firstName ?? ""} ${x.lastName ?? ""}`.trim() || x.id, email: x.email, phone: x.phone }));
    },
  });
  const existingMembers = useQuery({
    queryKey: ["crm-group-members", group?.id], enabled: open && !!group,
    queryFn: async () => (await api.get<Array<{ entityId: string }>>(`/crm/groups/${group!.id}/members`)).data,
  });

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? ""); setDescription(group?.description ?? ""); setSearch("");
    setMemberIds(existingMembers.data?.map(x => x.entityId) ?? []);
  }, [open, group?.id, group?.name, group?.description, existingMembers.data]);

  const filtered = (options.data ?? []).filter(x => `${x.label} ${x.email ?? ""} ${x.phone ?? ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 250);
  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), entityType: group?.entityType ?? entityType, description: description.trim() || null, isDynamic: false, filterJson: null, memberIds };
      return editing ? api.put(`/crm/groups/${group!.id}`, body) : api.post("/crm/groups", body);
    },
    onSuccess: onSaved, onError: e => onError(extractErrorMessage(e)),
  });

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>{editing ? "Επεξεργασία ομάδας" : "Νέα ομάδα CRM"}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} mt={1}>
        <TextField label="Όνομα ομάδας" value={name} onChange={e => setName(e.target.value)} required fullWidth />
        <TextField label="Περιγραφή" value={description} onChange={e => setDescription(e.target.value)} multiline minRows={2} fullWidth />
        <TextField label="Αναζήτηση μελών" value={search} onChange={e => setSearch(e.target.value)} fullWidth />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2">Επιλογή {entityType === "Customer" ? "πελατών" : "συνεργατών"}</Typography>
          <Chip size="small" color="primary" label={`${memberIds.length} επιλεγμένοι`} />
        </Stack>
        <Card variant="outlined" sx={{ maxHeight: 330, overflow: "auto" }}>
          <List dense>
            {options.isLoading && <ListItem><CircularProgress size={20} /></ListItem>}
            {filtered.map(option => <ListItem key={option.id} disablePadding>
              <FormControlLabel sx={{ width: "100%", px: 1 }} control={<Checkbox checked={memberIds.includes(option.id)} onChange={e => setMemberIds(prev => e.target.checked ? [...prev, option.id] : prev.filter(x => x !== option.id))} />} label={<Box><Typography variant="body2">{option.label}</Typography><Typography variant="caption" color="text.secondary">{option.email || option.phone || ""}</Typography></Box>} />
            </ListItem>)}
            {!options.isLoading && filtered.length === 0 && <ListItem><ListItemText primary="Δεν βρέθηκαν εγγραφές." /></ListItem>}
          </List>
        </Card>
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Ακύρωση</Button><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button></DialogActions>
  </Dialog>;
}

export default CrmGroupsPage;
