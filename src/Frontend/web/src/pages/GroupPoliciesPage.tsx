import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupsIcon from "@mui/icons-material/Groups";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money } from "../utils/format";

interface GroupPolicyDto {
  id: string; groupNumber: string; name: string;
  policyHolderCustomerId: string; policyHolderName: string;
  insuranceCompanyId: string; insuranceCompanyName: string;
  startDate: string; endDate: string | null;
  premium: number; currency: string; status: string;
  memberCount: number; notes: string | null;
}
interface GroupMemberDto {
  id: string; groupPolicyId: string; fullName: string;
  afm: string | null; amka: string | null; birthDate: string | null;
  relationship: string | null; enrolledFrom: string; enrolledTo: string | null;
  individualPremium: number | null;
}
interface CustomerLite { id: string; firstName: string | null; lastName: string | null; companyName: string | null; }
interface CompanyLite { id: string; name: string; }

const STATUSES = ["Active", "Suspended", "Expired"];

interface GroupPoliciesPageProps {
  embedded?: boolean;
}

export function GroupPoliciesPage({ embedded = false }: GroupPoliciesPageProps = {}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [membersOf, setMembersOf] = useState<GroupPolicyDto | null>(null);

  const q = useQuery({ queryKey: ["group-policies"], queryFn: async () => (await api.get<GroupPolicyDto[]>("/group-policies")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/group-policies/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["group-policies"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const createButton = (
    <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
      {t("groupPolicies.create")}
    </Button>
  );

  return (
    <Box>
      {embedded ? (
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} mb={2} gap={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("groupPolicies.title")}</Typography>
              <HelpHint id="page.groupPolicies" />
            </Stack>
            <Typography variant="body2" color="text.secondary">{t("groupPolicies.subtitle")}</Typography>
          </Box>
          {createButton}
        </Stack>
      ) : (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <GroupsIcon sx={{ fontSize: 36 }} color="primary" />
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("groupPolicies.title")}</Typography>
                <HelpHint id="page.groupPolicies" />
              </Stack>
              <Typography color="text.secondary">{t("groupPolicies.subtitle")}</Typography>
            </Box>
          </Stack>
          {createButton}
        </Stack>
      )}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("groupPolicies.number")}</TableCell>
              <TableCell>{t("groupPolicies.name")}</TableCell>
              <TableCell>{t("groupPolicies.holder")}</TableCell>
              <TableCell>{t("groupPolicies.carrier")}</TableCell>
              <TableCell>{t("groupPolicies.startDate")}</TableCell>
              <TableCell align="right">{t("groupPolicies.premium")}</TableCell>
              <TableCell align="center">{t("groupPolicies.members")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("groupPolicies.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(g => (
                <TableRow key={g.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{g.groupNumber}</TableCell>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>{g.policyHolderName}</TableCell>
                  <TableCell>{g.insuranceCompanyName}</TableCell>
                  <TableCell>{g.startDate}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(g.premium, g.currency)}</TableCell>
                  <TableCell align="center">{g.memberCount}</TableCell>
                  <TableCell><Chip size="small" color={g.status === "Active" ? "success" : "default"} label={g.status} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => setMembersOf(g)}><PeopleAltIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(g.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["group-policies"] }); setCreateOpen(false); }} />
      <MembersDialog group={membersOf} onClose={() => setMembersOf(null)} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    groupNumber: "", name: "", policyHolderCustomerId: "", insuranceCompanyId: "",
    startDate: today, endDate: "", premium: 0, currency: "EUR", status: "Active", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  const customers = useQuery({ queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data });
  const companies = useQuery({ queryKey: ["insurance-companies-lite"], enabled: open,
    queryFn: async () => (await api.get<CompanyLite[]>("/insurance-companies")).data });

  useEffect(() => {
    if (open) setForm({
      groupNumber: `GRP-${Date.now().toString().slice(-6)}`, name: "",
      policyHolderCustomerId: "", insuranceCompanyId: "",
      startDate: today, endDate: "", premium: 0, currency: "EUR", status: "Active", notes: ""
    });
    // eslint-disable-next-line
  }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/group-policies", {
      groupNumber: form.groupNumber.trim(), name: form.name.trim(),
      policyHolderCustomerId: form.policyHolderCustomerId,
      insuranceCompanyId: form.insuranceCompanyId,
      startDate: form.startDate, endDate: form.endDate || null,
      premium: Number(form.premium), currency: form.currency.toUpperCase(),
      status: form.status, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  const customerLabel = (c: CustomerLite) => c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("groupPolicies.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("groupPolicies.number")} value={form.groupNumber} onChange={e => setForm({ ...form, groupNumber: e.target.value })} fullWidth />
            <TextField required label={t("groupPolicies.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <TextField select required label={t("groupPolicies.holder")} value={form.policyHolderCustomerId}
            onChange={e => setForm({ ...form, policyHolderCustomerId: e.target.value })} fullWidth>
            {(customers.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{customerLabel(c)}</MenuItem>)}
          </TextField>
          <TextField select required label={t("groupPolicies.carrier")} value={form.insuranceCompanyId}
            onChange={e => setForm({ ...form, insuranceCompanyId: e.target.value })} fullWidth>
            {(companies.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("groupPolicies.startDate")} InputLabelProps={{ shrink: true }}
              value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} fullWidth />
            <TextField type="date" label={t("groupPolicies.endDate")} InputLabelProps={{ shrink: true }}
              value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("groupPolicies.premium")} value={form.premium}
              onChange={e => setForm({ ...form, premium: Number(e.target.value) })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
            <TextField select label={t("common.status")} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })} sx={{ width: 160 }}>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.groupNumber.trim() || !form.name.trim() || !form.policyHolderCustomerId || !form.insuranceCompanyId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MembersDialog({ group, onClose }: { group: GroupPolicyDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    fullName: "", afm: "", amka: "", birthDate: "", relationship: "self",
    enrolledFrom: new Date().toISOString().slice(0, 10), enrolledTo: "", individualPremium: ""
  });
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["group-members", group?.id], enabled: !!group,
    queryFn: async () => (await api.get<GroupMemberDto[]>(`/group-policies/${group!.id}/members`)).data
  });

  const add = useMutation({
    mutationFn: async () => (await api.post("/group-policies/members", {
      groupPolicyId: group!.id, fullName: form.fullName.trim(),
      afm: form.afm || null, amka: form.amka || null,
      birthDate: form.birthDate || null, relationship: form.relationship || null,
      enrolledFrom: form.enrolledFrom, enrolledTo: form.enrolledTo || null,
      individualPremium: form.individualPremium ? Number(form.individualPremium) : null
    })).data,
    onSuccess: () => { setAdding(false); void qc.invalidateQueries({ queryKey: ["group-members", group?.id] }); void qc.invalidateQueries({ queryKey: ["group-policies"] }); },
    onError: e => setErr(extractErrorMessage(e))
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/group-policies/members/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["group-members", group?.id] }); void qc.invalidateQueries({ queryKey: ["group-policies"] }); }
  });

  return (
    <Dialog open={!!group} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("groupPolicies.membersOf")} {group?.name}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {!adding ? (
          <Box>
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setAdding(true)} sx={{ mb: 2 }}>
              {t("groupPolicies.addMember")}
            </Button>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{t("groupPolicies.memberName")}</TableCell>
                <TableCell>{t("groupPolicies.afm")}</TableCell>
                <TableCell>{t("groupPolicies.amka")}</TableCell>
                <TableCell>{t("groupPolicies.relationship")}</TableCell>
                <TableCell>{t("groupPolicies.enrolledFrom")}</TableCell>
                <TableCell align="right" />
              </TableRow></TableHead>
              <TableBody>
                {(q.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 3 }}>{t("groupPolicies.noMembers")}</TableCell></TableRow>
                )}
                {(q.data ?? []).map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.fullName}</TableCell>
                    <TableCell>{m.afm ?? "—"}</TableCell>
                    <TableCell>{m.amka ?? "—"}</TableCell>
                    <TableCell>{m.relationship ?? "—"}</TableCell>
                    <TableCell>{m.enrolledFrom}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(m.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Stack spacing={2} mt={1}>
            <TextField required label={t("groupPolicies.memberName")} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} fullWidth />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label={t("groupPolicies.afm")} value={form.afm} onChange={e => setForm({ ...form, afm: e.target.value })} fullWidth />
              <TextField label={t("groupPolicies.amka")} value={form.amka} onChange={e => setForm({ ...form, amka: e.target.value })} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField type="date" label={t("groupPolicies.birthDate")} InputLabelProps={{ shrink: true }}
                value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} fullWidth />
              <TextField select label={t("groupPolicies.relationship")} value={form.relationship}
                onChange={e => setForm({ ...form, relationship: e.target.value })} fullWidth>
                {["self", "spouse", "child", "parent", "other"].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField type="date" label={t("groupPolicies.enrolledFrom")} InputLabelProps={{ shrink: true }}
                value={form.enrolledFrom} onChange={e => setForm({ ...form, enrolledFrom: e.target.value })} fullWidth />
              <TextField type="date" label={t("groupPolicies.enrolledTo")} InputLabelProps={{ shrink: true }}
                value={form.enrolledTo} onChange={e => setForm({ ...form, enrolledTo: e.target.value })} fullWidth />
              <TextField type="number" label={t("groupPolicies.individualPremium")} value={form.individualPremium}
                onChange={e => setForm({ ...form, individualPremium: e.target.value })} fullWidth />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {adding ? (
          <>
            <Button onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
            <Button variant="contained" onClick={() => add.mutate()} disabled={add.isPending || !form.fullName.trim()}>
              {add.isPending ? <CircularProgress size={18} /> : t("common.save")}
            </Button>
          </>
        ) : <Button onClick={onClose}>{t("common.close")}</Button>}
      </DialogActions>
    </Dialog>
  );
}
