import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Divider,
  FormControlLabel, InputAdornment, MenuItem, Paper, Stack, Switch, Tab,
  Tabs, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import PreviewIcon from "@mui/icons-material/Preview";
import SaveIcon from "@mui/icons-material/Save";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

interface Feature { key: string; label: string; description: string; sortOrder: number; isActive: boolean; iconKey?: string | null }
interface Plan { code: string; name: string; tagline: string; description: string; pricePerYear: number; includedOffices: number; includedUsers: number; extraOfficePerYear: number; extraUserPerYear: number; includedPackages: number; packages: string[]; featureKeys?: string[]; isFeatured: boolean; isActive: boolean; sortOrder: number; buttonText: string; buttonUrl: string; badge?: string | null; iconKey?: string | null; isComingSoon?: boolean }
interface Addon { code: string; name: string; description: string; pricePerYear: number; isActive: boolean; sortOrder: number; iconKey?: string | null }
interface Service { code: string; name: string; description: string; unitLabel: string; unitPrice: number | null; pricingType: string; isActive: boolean; sortOrder: number; iconKey?: string | null }
interface Settings { pricesIncludeVat: boolean; vatRate: number; currency: string; publicTitle: string; publicSubtitle: string; vatLabel: string }
interface Catalog { version: number; plans: Plan[]; addons: Addon[]; services: Service[]; features: Feature[]; settings: Settings }

const emptyPlan = (order: number): Plan => ({ code: `plan-${Date.now()}`, name: "Νέο πακέτο", tagline: "", description: "", pricePerYear: 0, includedOffices: 1, includedUsers: 1, extraOfficePerYear: 0, extraUserPerYear: 0, includedPackages: 0, packages: [], featureKeys: [], isFeatured: false, isActive: true, isComingSoon: false, sortOrder: order, buttonText: "Επιλογή Πακέτου →", buttonUrl: "/register" });
const emptyFeature = (order: number): Feature => ({ key: `feature-${Date.now()}`, label: "Νέα δυνατότητα", description: "", sortOrder: order, isActive: true });
const emptyAddon = (order: number): Addon => ({ code: `addon-${Date.now()}`, name: "Νέο πρόσθετο", description: "", pricePerYear: 0, isActive: true, sortOrder: order });
const emptyService = (order: number): Service => ({ code: `service-${Date.now()}`, name: "Νέα υπηρεσία", description: "", unitLabel: "κατά περίπτωση", unitPrice: null, pricingType: "custom_quote", isActive: true, sortOrder: order });

export function PricingManagementPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("plans");
  const [draft, setDraft] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const q = useQuery({ queryKey: ["platform-pricing"], queryFn: async () => (await api.get<Catalog>("/platform/pricing")).data });
  useEffect(() => { if (q.data && !draft) setDraft(q.data); }, [q.data, draft]);
  const save = useMutation({
    mutationFn: async () => { if (!draft) throw new Error("Δεν υπάρχουν αλλαγές."); return (await api.put<Catalog>("/platform/pricing", draft)).data; },
    onSuccess: data => { setDraft(data); qc.setQueryData(["platform-pricing"], data); setSaved(true); setError(null); setTimeout(() => setSaved(false), 3500); },
    onError: e => setError(e instanceof Error ? e.message : "Αποτυχία αποθήκευσης τιμολόγησης.")
  });
  if (q.isLoading || !draft) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>;
  const update = (fn: (c: Catalog) => Catalog) => setDraft(c => c ? fn(c) : c);
  const move = <T extends { sortOrder: number }>(items: T[], index: number, direction: -1 | 1) => {
    const copy = [...items]; const next = index + direction; if (next < 0 || next >= copy.length) return copy;
    const tmp = copy[index].sortOrder; copy[index] = { ...copy[index], sortOrder: copy[next].sortOrder }; copy[next] = { ...copy[next], sortOrder: tmp }; return copy.sort((a, b) => a.sortOrder - b.sortOrder);
  };
  const confirmDelete = (label: string) => window.confirm(`Διαγραφή ${label}; Η ενέργεια θα αποθηκευτεί όταν πατήσετε «Αποθήκευση».`);
  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5} mb={2}>
        <Box><Typography variant="h5" fontWeight={900}>Τιμολόγηση & Πακέτα</Typography><Typography color="text.secondary">Μία κεντρική, δυναμική πηγή τιμών για public σελίδα, συνδρομές και υπηρεσίες.</Typography></Box>
        <Stack direction="row" gap={1}><Button component="a" href="/pricing" target="_blank" startIcon={<PreviewIcon />} variant="outlined">Προεπισκόπηση public σελίδας</Button><Button onClick={() => save.mutate()} disabled={save.isPending} startIcon={save.isPending ? <CircularProgress size={16} /> : <SaveIcon />} variant="contained">Αποθήκευση</Button></Stack>
      </Stack>
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Η τιμολόγηση αποθηκεύτηκε και η public σελίδα ενημερώθηκε.</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ border: "1px solid #dbe7f2", borderRadius: 2, overflow: "hidden" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable"><Tab value="plans" label={`Πακέτα (${draft.plans.length})`} /><Tab value="features" label={`Δυνατότητες (${draft.features.length})`} /><Tab value="addons" label={`Πρόσθετα (${draft.addons.length})`} /><Tab value="services" label={`Υπηρεσίες (${draft.services.length})`} /><Tab value="settings" label="Ρυθμίσεις Τιμολόγησης" /></Tabs>
      </Paper>
      {tab === "plans" && <PlansEditor catalog={draft} update={update} move={move} confirmDelete={confirmDelete} />}
      {tab === "features" && <FeaturesEditor catalog={draft} update={update} move={move} confirmDelete={confirmDelete} />}
      {tab === "addons" && <AddonsEditor catalog={draft} update={update} move={move} confirmDelete={confirmDelete} />}
      {tab === "services" && <ServicesEditor catalog={draft} update={update} move={move} confirmDelete={confirmDelete} />}
      {tab === "settings" && <SettingsEditor settings={draft.settings} update={settings => update(c => ({ ...c, settings }))} />}
    </Box>
  );
}

function PlansEditor({ catalog, update, move, confirmDelete }: { catalog: Catalog; update: (fn: (c: Catalog) => Catalog) => void; move: <T extends { sortOrder: number }>(items: T[], index: number, direction: -1 | 1) => T[]; confirmDelete: (s: string) => boolean }) {
  const plans = [...catalog.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const setPlan = (code: string, patch: Partial<Plan>) => update(c => ({ ...c, plans: c.plans.map(p => p.code === code ? { ...p, ...patch } : p) }));
  return <Stack spacing={2} sx={{ mt: 2 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={900}>Βασικά πακέτα</Typography><Button startIcon={<AddIcon />} variant="contained" onClick={() => update(c => ({ ...c, plans: [...c.plans, emptyPlan((c.plans.length + 1) * 10)] }))}>Νέο πακέτο</Button></Stack>
    {plans.map((p, i) => <Card key={p.code} sx={{ p: 2, border: p.isFeatured ? "2px solid #1976d2" : "1px solid #dbe7f2" }}>
      <Stack direction={{ xs: "column", lg: "row" }} gap={1.5}>
        <Stack direction="row" alignItems="center" gap={.5} sx={{ minWidth: 115 }}><DragHandleIcon color="disabled" /><Typography fontWeight={900}>{p.name || p.code}</Typography><Chip size="small" label={p.isActive ? "Ενεργό" : "Ανενεργό"} color={p.isActive ? "success" : "default"} /></Stack>
        <Box sx={{ flex: 1, display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", xl: "repeat(4,1fr)" } }}>
          <TextField size="small" label="Εσωτερικός κωδικός" value={p.code} onChange={e => setPlan(p.code, { code: e.target.value })} />
          <TextField size="small" label="Δημόσιο όνομα" value={p.name} onChange={e => setPlan(p.code, { name: e.target.value })} />
          <TextField size="small" label="Σύντομη περιγραφή" value={p.description || p.tagline} onChange={e => setPlan(p.code, { description: e.target.value, tagline: e.target.value })} />
          <TextField size="small" label="Τιμή / έτος" type="number" value={p.pricePerYear} onChange={e => setPlan(p.code, { pricePerYear: Number(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }} />
          <TextField size="small" label="Γραφεία" type="number" value={p.includedOffices} onChange={e => setPlan(p.code, { includedOffices: Number(e.target.value) })} />
          <TextField size="small" label="Χρήστες" type="number" value={p.includedUsers} onChange={e => setPlan(p.code, { includedUsers: Number(e.target.value) })} />
          <TextField size="small" label="Συμπ. πακέτα / ενότητες" type="number" value={p.includedPackages} onChange={e => setPlan(p.code, { includedPackages: Math.max(0, Number(e.target.value)) })} />
          <TextField size="small" label="Επιπλέον γραφείο / έτος" type="number" value={p.extraOfficePerYear} onChange={e => setPlan(p.code, { extraOfficePerYear: Number(e.target.value) })} />
          <TextField size="small" label="Επιπλέον χρήστης / έτος" type="number" value={p.extraUserPerYear} onChange={e => setPlan(p.code, { extraUserPerYear: Number(e.target.value) })} />
          <TextField size="small" label="Κείμενο κουμπιού" value={p.buttonText} onChange={e => setPlan(p.code, { buttonText: e.target.value })} />
          <TextField size="small" label="URL κουμπιού" value={p.buttonUrl} onChange={e => setPlan(p.code, { buttonUrl: e.target.value })} />
          <TextField size="small" label="Badge" value={p.badge ?? ""} onChange={e => setPlan(p.code, { badge: e.target.value || null })} />
          <TextField size="small" label="Icon key" value={p.iconKey ?? ""} onChange={e => setPlan(p.code, { iconKey: e.target.value || null })} />
        </Box>
        <Stack sx={{ minWidth: 160 }}><FormControlLabel control={<Switch checked={p.isActive} onChange={e => setPlan(p.code, { isActive: e.target.checked })} />} label="Ενεργό" /><FormControlLabel control={<Switch checked={p.isFeatured} onChange={e => setPlan(p.code, { isFeatured: e.target.checked })} />} label="Προτεινόμενο" /><FormControlLabel control={<Switch checked={Boolean(p.isComingSoon)} onChange={e => setPlan(p.code, { isComingSoon: e.target.checked })} />} label="Σύντομα διαθέσιμο" /><Stack direction="row" gap={.5}><Button size="small" onClick={() => update(c => ({ ...c, plans: move(plans, i, -1) }))} startIcon={<ArrowUpwardIcon />} /><Button size="small" onClick={() => update(c => ({ ...c, plans: move(plans, i, 1) }))} startIcon={<ArrowDownwardIcon />} /><Button size="small" color="error" onClick={() => confirmDelete(`το πακέτο «${p.name}»`) && update(c => ({ ...c, plans: c.plans.filter(x => x.code !== p.code) }))} startIcon={<DeleteIcon />} /></Stack></Stack>
      </Stack>
      <Divider sx={{ my: 1.5 }} /><Typography variant="subtitle2" fontWeight={900}>Περιλαμβάνει δυνατότητες</Typography>
      <Stack direction="row" gap={.5} flexWrap="wrap">{catalog.features.filter(f => f.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(f => { const keys = p.featureKeys ?? p.packages; const checked = keys.includes(f.key); return <FormControlLabel key={f.key} control={<Checkbox size="small" checked={checked} onChange={e => { const next = e.target.checked ? [...keys, f.key] : keys.filter(k => k !== f.key); setPlan(p.code, { featureKeys: next, packages: next, includedPackages: next.length }); }} />} label={<Typography variant="caption">{f.label}</Typography>} />; })}</Stack>
    </Card>)}
  </Stack>;
}

function FeaturesEditor({ catalog, update, move, confirmDelete }: { catalog: Catalog; update: (fn: (c: Catalog) => Catalog) => void; move: <T extends { sortOrder: number }>(items: T[], index: number, direction: -1 | 1) => T[]; confirmDelete: (s: string) => boolean }) {
  const list = [...catalog.features].sort((a, b) => a.sortOrder - b.sortOrder);
  return <Stack spacing={1.5} sx={{ mt: 2 }}><Stack direction="row" justifyContent="space-between"><Typography variant="h6" fontWeight={900}>Δυναμικές δυνατότητες / modules</Typography><Button startIcon={<AddIcon />} variant="contained" onClick={() => update(c => ({ ...c, features: [...c.features, emptyFeature((c.features.length + 1) * 10)] }))}>Νέα δυνατότητα</Button></Stack>{list.map((f, i) => <Card key={f.key} sx={{ p: 1.5 }}><Stack direction={{ xs: "column", md: "row" }} gap={1} alignItems={{ md: "center" }}><TextField size="small" label="Σταθερό key" value={f.key} onChange={e => update(c => ({ ...c, features: c.features.map(x => x.key === f.key ? { ...x, key: e.target.value } : x) }))} sx={{ minWidth: 180 }} /><TextField size="small" label="Ετικέτα" value={f.label} onChange={e => update(c => ({ ...c, features: c.features.map(x => x.key === f.key ? { ...x, label: e.target.value } : x) }))} sx={{ minWidth: 220 }} /><TextField size="small" label="Περιγραφή" value={f.description} onChange={e => update(c => ({ ...c, features: c.features.map(x => x.key === f.key ? { ...x, description: e.target.value } : x) }))} fullWidth /><Switch checked={f.isActive} onChange={e => update(c => ({ ...c, features: c.features.map(x => x.key === f.key ? { ...x, isActive: e.target.checked } : x) }))} /><Button size="small" onClick={() => update(c => ({ ...c, features: move(list, i, -1) }))} startIcon={<ArrowUpwardIcon />} /><Button size="small" onClick={() => update(c => ({ ...c, features: move(list, i, 1) }))} startIcon={<ArrowDownwardIcon />} /><Button size="small" color="error" onClick={() => confirmDelete(`τη δυνατότητα «${f.label}»`) && update(c => ({ ...c, features: c.features.filter(x => x.key !== f.key) }))} startIcon={<DeleteIcon />} /></Stack></Card>)}</Stack>;
}

function AddonsEditor({ catalog, update, move, confirmDelete }: { catalog: Catalog; update: (fn: (c: Catalog) => Catalog) => void; move: <T extends { sortOrder: number }>(items: T[], index: number, direction: -1 | 1) => T[]; confirmDelete: (s: string) => boolean }) {
  const list = [...catalog.addons].sort((a, b) => a.sortOrder - b.sortOrder);
  const set = (code: string, patch: Partial<Addon>) => update(c => ({ ...c, addons: c.addons.map(a => a.code === code ? { ...a, ...patch } : a) }));
  return <Stack spacing={1.5} sx={{ mt: 2 }}><Stack direction="row" justifyContent="space-between"><Typography variant="h6" fontWeight={900}>Πρόσθετα Πακέτα</Typography><Button startIcon={<AddIcon />} variant="contained" onClick={() => update(c => ({ ...c, addons: [...c.addons, emptyAddon((c.addons.length + 1) * 10)] }))}>Νέο πρόσθετο</Button></Stack>{list.map((a, i) => <Card key={a.code} sx={{ p: 1.5 }}><Stack direction={{ xs: "column", md: "row" }} gap={1} alignItems={{ md: "center" }}><TextField size="small" label="Key" value={a.code} onChange={e => set(a.code, { code: e.target.value })} sx={{ minWidth: 160 }} /><TextField size="small" label="Όνομα" value={a.name} onChange={e => set(a.code, { name: e.target.value })} sx={{ minWidth: 210 }} /><TextField size="small" label="Περιγραφή" value={a.description} onChange={e => set(a.code, { description: e.target.value })} fullWidth /><TextField size="small" label="Τιμή / έτος" type="number" value={a.pricePerYear} onChange={e => set(a.code, { pricePerYear: Number(e.target.value) })} sx={{ minWidth: 150 }} /><Switch checked={a.isActive} onChange={e => set(a.code, { isActive: e.target.checked })} /><Button size="small" onClick={() => update(c => ({ ...c, addons: move(list, i, -1) }))} startIcon={<ArrowUpwardIcon />} /><Button size="small" onClick={() => update(c => ({ ...c, addons: move(list, i, 1) }))} startIcon={<ArrowDownwardIcon />} /><Button size="small" color="error" onClick={() => confirmDelete(`το πρόσθετο «${a.name}»`) && update(c => ({ ...c, addons: c.addons.filter(x => x.code !== a.code) }))} startIcon={<DeleteIcon />} /></Stack></Card>)}</Stack>;
}

function ServicesEditor({ catalog, update, move, confirmDelete }: { catalog: Catalog; update: (fn: (c: Catalog) => Catalog) => void; move: <T extends { sortOrder: number }>(items: T[], index: number, direction: -1 | 1) => T[]; confirmDelete: (s: string) => boolean }) {
  const list = [...catalog.services].sort((a, b) => a.sortOrder - b.sortOrder);
  const set = (code: string, patch: Partial<Service>) => update(c => ({ ...c, services: c.services.map(s => s.code === code ? { ...s, ...patch } : s) }));
  return <Stack spacing={1.5} sx={{ mt: 2 }}><Stack direction="row" justifyContent="space-between"><Typography variant="h6" fontWeight={900}>Υπηρεσίες με Χρέωση</Typography><Button startIcon={<AddIcon />} variant="contained" onClick={() => update(c => ({ ...c, services: [...c.services, emptyService((c.services.length + 1) * 10)] }))}>Νέα υπηρεσία</Button></Stack>{list.map((s, i) => <Card key={s.code} sx={{ p: 1.5 }}><Stack direction={{ xs: "column", md: "row" }} gap={1} alignItems={{ md: "center" }}><TextField size="small" label="Key" value={s.code} onChange={e => set(s.code, { code: e.target.value })} sx={{ minWidth: 150 }} /><TextField size="small" label="Όνομα" value={s.name} onChange={e => set(s.code, { name: e.target.value })} sx={{ minWidth: 210 }} /><TextField size="small" label="Περιγραφή" value={s.description} onChange={e => set(s.code, { description: e.target.value })} fullWidth /><TextField size="small" label="Μονάδα" value={s.unitLabel} onChange={e => set(s.code, { unitLabel: e.target.value })} sx={{ minWidth: 130 }} /><TextField select size="small" label="Τύπος τιμής" value={s.pricingType} onChange={e => set(s.code, { pricingType: e.target.value, unitPrice: e.target.value === "custom_quote" ? null : (s.unitPrice ?? 0) })} sx={{ minWidth: 160 }}><MenuItem value="fixed">Σταθερή</MenuItem><MenuItem value="hourly">Ανά ώρα</MenuItem><MenuItem value="yearly">Ανά έτος</MenuItem><MenuItem value="custom_quote">Κατά περίπτωση</MenuItem></TextField><TextField size="small" label="Τιμή" type="number" disabled={s.pricingType === "custom_quote"} value={s.unitPrice ?? ""} onChange={e => set(s.code, { unitPrice: e.target.value === "" ? null : Number(e.target.value) })} sx={{ minWidth: 115 }} /><Switch checked={s.isActive} onChange={e => set(s.code, { isActive: e.target.checked })} /><Button size="small" onClick={() => update(c => ({ ...c, services: move(list, i, -1) }))} startIcon={<ArrowUpwardIcon />} /><Button size="small" onClick={() => update(c => ({ ...c, services: move(list, i, 1) }))} startIcon={<ArrowDownwardIcon />} /><Button size="small" color="error" onClick={() => confirmDelete(`την υπηρεσία «${s.name}»`) && update(c => ({ ...c, services: c.services.filter(x => x.code !== s.code) }))} startIcon={<DeleteIcon />} /></Stack></Card>)}</Stack>;
}

function SettingsEditor({ settings, update }: { settings: Settings; update: (settings: Settings) => void }) {
  const set = (patch: Partial<Settings>) => update({ ...settings, ...patch });
  return <Card sx={{ mt: 2, p: 2.5 }}><Typography variant="h6" fontWeight={900} mb={2}>Ρυθμίσεις public τιμολόγησης</Typography><Stack spacing={2} sx={{ maxWidth: 900 }}><FormControlLabel control={<Switch checked={settings.pricesIncludeVat} onChange={e => set({ pricesIncludeVat: e.target.checked })} />} label="Οι δημόσιες τιμές περιλαμβάνουν ΦΠΑ" /><Stack direction={{ xs: "column", sm: "row" }} gap={1.5}><TextField label="Ποσοστό ΦΠΑ" type="number" value={settings.vatRate} onChange={e => set({ vatRate: Number(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} /><TextField label="Νόμισμα" value={settings.currency} onChange={e => set({ currency: e.target.value })} /></Stack><TextField label="Τίτλος public σελίδας" value={settings.publicTitle} onChange={e => set({ publicTitle: e.target.value })} fullWidth /><TextField label="Υπότιτλος public σελίδας" value={settings.publicSubtitle} onChange={e => set({ publicSubtitle: e.target.value })} fullWidth multiline minRows={2} /><TextField label="Κείμενο ένδειξης ΦΠΑ" value={settings.vatLabel} onChange={e => set({ vatLabel: e.target.value })} fullWidth /></Stack></Card>;
}
