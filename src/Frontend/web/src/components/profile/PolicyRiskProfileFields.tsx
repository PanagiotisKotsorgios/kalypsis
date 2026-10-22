import { useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import { ProfileEditableField, profileFieldGridSx, type ProfileFieldSession } from "./ProfileFieldEditor";
import { extractErrorMessage } from "../../api/client";

export const POLICY_RISK_FIELDS = {
  Auto: [["vehicle:make", "Μάρκα"], ["vehicle:model", "Μοντέλο"], ["vehicle:year", "Έτος κατασκευής"],
    ["vehicle:vin", "VIN / αριθμός πλαισίου"], ["vehicle:engineCapacity", "Κυβισμός (cc)"], ["vehicle:taxableHorsepower", "Φορολογήσιμοι ίπποι"]],
  Home: [["property:address", "Διεύθυνση ακινήτου"], ["property:areaSqm", "Εμβαδόν (τ.μ.)"], ["property:constructionYear", "Έτος κατασκευής"],
    ["property:constructionType", "Είδος κατασκευής"], ["property:alarm", "Συναγερμός"], ["property:securityDoor", "Πόρτα ασφαλείας"]],
  Health: [["health:medicalHistory", "Ιατρικό ιστορικό"], ["health:heightCm", "Ύψος (cm)"], ["health:weightKg", "Βάρος (kg)"],
    ["health:smoker", "Καπνιστής"], ["health:occupationRisk", "Επάγγελμα / επικινδυνότητα"], ["health:exclusions", "Εξαιρέσεις κάλυψης"]],
} as const;

const booleanOptions = [{ value: "", label: "Δεν έχει οριστεί" }, { value: "true", label: "Ναι" }, { value: "false", label: "Όχι" }];
export function PolicyRiskFields({ policyType, values, session }: { policyType: string; values: Record<string, string>; session?: ProfileFieldSession }) {
  const fields = POLICY_RISK_FIELDS[policyType === "Business" ? "Home" : policyType === "Life" ? "Health" : policyType as keyof typeof POLICY_RISK_FIELDS];
  if (!fields) return null;
  return <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
    {[fields.slice(0, 3), fields.slice(3)].map((column, index) => <Stack key={index} spacing={.5} sx={{ minWidth: 0 }}>
      {column.map(([key, label]) => <ProfileEditableField key={key} field={session ? "risk:" + key : undefined} label={label} value={values["risk:" + key]} session={session}
        type={/year|capacity|horsepower|Sqm|Year|Cm|Kg/i.test(key) ? "number" : "text"}
        options={/smoker|alarm|securityDoor/.test(key) ? booleanOptions : key === "property:constructionType" ? [
          { value: "", label: "Δεν έχει οριστεί" }, { value: "Σκυρόδεμα", label: "Σκυρόδεμα / μπετόν" }, { value: "Λιθοδομή", label: "Λιθοδομή" },
          { value: "Ξύλο", label: "Ξύλινη κατασκευή" }, { value: "Μεταλλική", label: "Μεταλλική κατασκευή" }, { value: "Μικτή", label: "Μικτή κατασκευή" },
          ...(values["risk:" + key] && !["Σκυρόδεμα", "Λιθοδομή", "Ξύλο", "Μεταλλική", "Μικτή"].includes(values["risk:" + key]) ? [{ value: values["risk:" + key], label: values["risk:" + key] }] : []),
        ] : undefined} multiline={/medicalHistory|exclusions/.test(key)} />)}
    </Stack>)}
  </Box>;
}

export const POLICY_TAX_FIELDS = [["vatAmount", "ΦΠΑ (εφόσον υπάρχει)"], ["stampDutyAmount", "Χαρτόσημο"],
  ["insuranceContributionAmount", "Ασφαλιστικές εισφορές"], ["otherChargesAmount", "Λοιπές επιβαρύνσεις / δικαιώματα"]] as const;
export function PolicyTaxFields({ values, session }: { values: Record<string, string>; session?: ProfileFieldSession }) {
  return <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
    {[POLICY_TAX_FIELDS.slice(0, 2), POLICY_TAX_FIELDS.slice(2)].map((column, index) => <Stack key={index} spacing={.5} sx={{ minWidth: 0 }}>
      {column.map(([key, label]) => <ProfileEditableField key={key} label={label} field={session ? "risk:" + key : undefined} session={session} value={values["risk:" + key]} type="number" />)}
    </Stack>)}
  </Box>;
}

export function policyPaymentStatus(premium: number, received: number, direct: boolean) {
  if (premium <= 0) return "Μηδενικό ασφάλιστρο";
  if (received >= premium - .005) return "Εξοφλημένο";
  if (received > 0) return "Μερικώς εξοφλημένο";
  return direct ? "Πληρωμή στην ασφαλιστική — δεν έχει επιβεβαιωθεί" : "Ανεξόφλητο";
}

export interface PolicyBeneficiary { id: string; name: string; relationship: string; share: number | null }
export function readPolicyBeneficiaries(raw?: string): PolicyBeneficiary[] {
  try { const rows = JSON.parse(raw || "[]"); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
export function PolicyBeneficiaries({ values, session }: { values: Record<string, string>; session?: ProfileFieldSession }) {
  const rows = readPolicyBeneficiaries(values["risk:beneficiaries"]);
  const [draft, setDraft] = useState<{ id: string; name: string; relationship: string; share: string } | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const write = async (next: PolicyBeneficiary[]) => {
    if (!session) return;
    try { setError(""); await session.commit("risk:beneficiaries", JSON.stringify(next)); setDraft(null); setRemoveId(null); }
    catch (err) { setError(extractErrorMessage(err, "Δεν αποθηκεύτηκαν οι δικαιούχοι.")); }
  };
  const save = () => {
    if (!draft) return;
    const share = draft.share.trim() ? Number(draft.share) : null;
    if (!draft.name.trim() || share !== null && (!Number.isFinite(share) || share < 0 || share > 100)) { setError("Συμπληρώστε ονοματεπώνυμο και έγκυρο ποσοστό 0–100%."); return; }
    const row = { ...draft, name: draft.name.trim(), share };
    const next = rows.some(item => item.id === draft.id) ? rows.map(item => item.id === draft.id ? row : item) : [...rows, row];
    if (next.reduce((sum, item) => sum + (item.share ?? 0), 0) > 100) { setError("Το άθροισμα των ποσοστών δεν μπορεί να υπερβαίνει το 100%."); return; }
    void write(next);
  };
  return <Stack spacing={.75}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography fontWeight={800}>Δικαιούχοι αποζημίωσης</Typography>
      {session && <Button size="small" color="success" variant="contained" startIcon={<AddIcon />} disabled={session.busy} onClick={() => { setError(""); setDraft({ id: crypto.randomUUID(), name: "", relationship: "", share: "" }); }}>Προσθήκη δικαιούχου</Button>}
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Ονοματεπώνυμο</TableCell><TableCell>Σχέση / ιδιότητα</TableCell><TableCell>Ποσοστό</TableCell>{session && <TableCell>Ενέργειες</TableCell>}</TableRow></TableHead>
      <TableBody>{rows.map((row, index) => <TableRow key={row.id} sx={{ bgcolor: index % 2 ? "#f0f2f5" : "#f8fafc" }}><TableCell>{row.name}</TableCell><TableCell>{row.relationship || "—"}</TableCell><TableCell>{row.share == null ? "Δεν έχει οριστεί" : `${row.share}%`}</TableCell>
        {session && <TableCell sx={{ whiteSpace: "nowrap" }}><IconButton size="small" color="success" disabled={session.busy} aria-label={`Επεξεργασία ${row.name}`} onClick={() => { setError(""); setDraft({ ...row, share: row.share == null ? "" : String(row.share) }); }}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" disabled={session.busy} aria-label={`Αφαίρεση ${row.name}`} onClick={() => setRemoveId(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>}
      </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={session ? 4 : 3}>Δεν έχουν οριστεί δικαιούχοι.</TableCell></TableRow>}</TableBody></Table></Box>
    <Dialog open={!!draft} onClose={() => { if (!session?.busy) setDraft(null); }} fullWidth maxWidth="sm"><DialogTitle>Δικαιούχος αποζημίωσης</DialogTitle><DialogContent dividers><Stack spacing={2} sx={{ pt: .75 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField fullWidth size="small" required label="Ονοματεπώνυμο" value={draft?.name ?? ""} onChange={e => draft && setDraft({ ...draft, name: e.target.value })} inputProps={{ maxLength: 200 }} />
      <TextField fullWidth size="small" label="Σχέση / ιδιότητα" value={draft?.relationship ?? ""} onChange={e => draft && setDraft({ ...draft, relationship: e.target.value })} inputProps={{ maxLength: 200 }} />
      <TextField fullWidth size="small" type="number" label="Ποσοστό (%)" value={draft?.share ?? ""} onChange={e => draft && setDraft({ ...draft, share: e.target.value })} inputProps={{ min: 0, max: 100, step: .01 }} helperText="Προαιρετικό. Το σύνολο δεν πρέπει να ξεπερνά το 100%." />
    </Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} disabled={session?.busy} onClick={() => setDraft(null)}>Κλείσιμο</Button><Button color="success" variant="contained" startIcon={<SaveIcon />} disabled={session?.busy} onClick={save}>Αποθήκευση</Button></DialogActions></Dialog>
    <Dialog open={!!removeId} onClose={() => { if (!session?.busy) setRemoveId(null); }} maxWidth="xs" fullWidth><DialogTitle>Αφαίρεση δικαιούχου</DialogTitle><DialogContent>Να αφαιρεθεί ο επιλεγμένος δικαιούχος από το συμβόλαιο;</DialogContent><DialogActions><Button onClick={() => setRemoveId(null)} disabled={session?.busy}>Άκυρο</Button><Button color="error" variant="contained" startIcon={<DeleteIcon />} disabled={session?.busy} onClick={() => void write(rows.filter(row => row.id !== removeId))}>Αφαίρεση</Button></DialogActions></Dialog>
  </Stack>;
}
