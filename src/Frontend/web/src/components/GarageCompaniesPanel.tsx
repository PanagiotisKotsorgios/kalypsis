import { useState } from "react";
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { claimSupportUpdate } from "./profile/claimSupportProfile";

export interface GarageCompany { id: string; name: string }
export function GarageCompaniesPanel({ record, canEdit, onSaved }: { record: Record<string, unknown>; canEdit: boolean; onSaved: (record: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<GarageCompany[]>([]);
  const current = (record.insuranceCompanies ?? []) as GarageCompany[];
  const q = useQuery({ queryKey: ["garage-carrier-options"], enabled: open, queryFn: async () => (await api.get<GarageCompany[]>("/insurance-companies")).data });
  const options = [...current, ...(q.data ?? []).filter(company => !current.some(item => item.id === company.id))];
  const save = useMutation({ mutationFn: async () => (await api.put<Record<string, unknown>>(`/garages/${record.id}`, claimSupportUpdate("garages", { ...record, insuranceCompanyIds: selected.map(company => company.id) }, {}))).data,
    onSuccess: updated => { onSaved(updated); setOpen(false); } });
  return <Stack gap={1}>
    {canEdit && <Button variant="contained" color="success" sx={{ color: "#fff", alignSelf: "flex-start" }} startIcon={<BusinessOutlinedIcon />} onClick={() => { setSelected(current); save.reset(); setOpen(true); }}>Επιλογή εταιρειών</Button>}
    {current.length ? current.map(company => <Typography key={company.id} sx={{ p: .8, bgcolor: "#f0f2f5", borderBottom: "1px solid #c5d1df", fontWeight: 700 }}>{company.name}</Typography>) : <Typography color="text.secondary">Δεν έχουν καταχωρηθεί συνεργαζόμενες ασφαλιστικές.</Typography>}
    <Dialog open={open} onClose={save.isPending ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" sx={{ zIndex: 1900 }}>
      <DialogTitle>Συνεργαζόμενες ασφαλιστικές εταιρείες</DialogTitle><DialogContent dividers>
        {q.isError && <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>Δεν φορτώθηκε ο κατάλογος εταιρειών.</Alert>}
        {save.isError && <Alert severity="error">{extractErrorMessage(save.error)}</Alert>}
        <Autocomplete multiple disableCloseOnSelect loading={q.isLoading} options={options} value={selected} onChange={(_, next) => setSelected(next)} getOptionLabel={company => company.name} isOptionEqualToValue={(a, b) => a.id === b.id}
          renderOption={(props, company, state) => <li {...props} key={company.id}><Checkbox checked={state.selected} sx={{ mr: 1 }} />{company.name}</li>}
          renderInput={params => <TextField {...params} label="Αναζήτηση και επιλογή εταιρειών" sx={{ mt: 1 }} />} />
      </DialogContent><DialogActions><Button variant="contained" color="error" startIcon={<CloseIcon />} disabled={save.isPending} onClick={() => setOpen(false)}>Κλείσιμο</Button><Button variant="contained" color="success" disabled={save.isPending || q.isLoading || q.isError} onClick={() => save.mutate()}>Αποθήκευση</Button></DialogActions>
    </Dialog>
  </Stack>;
}
