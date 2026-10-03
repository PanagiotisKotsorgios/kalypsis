import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BusinessIcon from "@mui/icons-material/Business";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import FolderIcon from "@mui/icons-material/Folder";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import StarIcon from "@mui/icons-material/Star";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { CompanyDialog, type CarrierProfile, type CompanyDto } from "./InsuranceCompaniesPage";
import { OfficeDialog, type OfficeDto } from "./AgencyOfficesPage";

interface OfficeUserDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "AgencyAdmin" | "AgencyOfficeAdmin" | "AgencyUser";
  isAssigned: boolean;
  isPrimary: boolean;
}

/**
 * Production directory. This deliberately has its own presentation instead
 * of reusing the configuration directory: cards answer "what is happening"
 * for each carrier/office, while the parameterisation page answers "how is
 * it configured".
 */
export default function ProductionCompaniesAgenciesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyDto | null>(null);
  const [officeProfile, setOfficeProfile] = useState<OfficeDto | null>(null);
  const [companyEditor, setCompanyEditor] = useState<CompanyDto | null | undefined>(undefined);
  const [officeEditor, setOfficeEditor] = useState<OfficeDto | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const companiesQ = useQuery({
    queryKey: ["production-companies-directory"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies")).data,
  });
  const officesQ = useQuery({
    queryKey: ["production-agency-offices-directory"],
    queryFn: async () => (await api.get<OfficeDto[]>("/agency-offices")).data,
  });

  const needle = search.trim().toLocaleLowerCase("el");
  const companies = useMemo(() => (companiesQ.data ?? [])
    .filter(c => !c.isGlobal || c.isUsedByTenant)
    .filter(c => !needle || [c.name, c.code, c.agentCode, c.contactName, c.contactEmail, c.afmVat]
      .some(value => value?.toLocaleLowerCase("el").includes(needle))), [companiesQ.data, needle]);
  const offices = useMemo(() => (officesQ.data ?? [])
    .filter(o => !needle || [o.name, o.code, o.city, o.phone, o.email]
      .some(value => value?.toLocaleLowerCase("el").includes(needle))), [officesQ.data, needle]);

  const deleteOffice = useMutation({
    mutationFn: async (id: string) => api.delete(`/agency-offices/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] }),
    onError: e => setError(extractErrorMessage(e)),
  });

  const loading = companiesQ.isLoading || officesQ.isLoading;
  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 2, p: { xs: 1.25, md: 2 }, bgcolor: "rgba(25,118,210,0.035)" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            {tab === 0 ? <BusinessIcon color="primary" sx={{ fontSize: 34 }} /> : <HomeWorkIcon color="primary" sx={{ fontSize: 34 }} />}
            <Box>
              <Typography variant="h4" fontWeight={850}>Εταιρείες &amp; Πρακτορεία Παραγωγής</Typography>
              <Typography variant="body2" color="text.secondary">
                Λειτουργική εικόνα συνεργαζόμενων εταιρειών και γραφείων: παραγωγή, συμβόλαια, ζημιές, επαφές και υπεύθυνοι.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => tab === 0 ? setCompanyEditor(null) : setOfficeEditor(null)}>
              {tab === 0 ? "Νέα ασφαλιστική" : "Νέο πρακτορείο"}
            </Button>
            <TextField size="small" label="Αναζήτηση" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          </Stack>
        </Stack>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} sx={{ mt: 1 }}>
          <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label={`Ασφαλιστικές (${companies.length})`} />
          <Tab icon={<HomeWorkIcon fontSize="small" />} iconPosition="start" label={`Πρακτορεία (${offices.length})`} />
        </Tabs>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box> : tab === 0 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" }, gap: 1.5 }}>
          {companies.map(company => <CompanyProductionCard key={company.id} company={company}
            onOpen={() => setCompanyProfile(company)} onEdit={() => setCompanyEditor(company)} />)}
          {companies.length === 0 && <EmptyDirectory text="Δεν βρέθηκαν ασφαλιστικές εταιρείες." />}
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" }, gap: 1.5 }}>
          {offices.map(office => <OfficeProductionCard key={office.id} office={office}
            onOpen={() => setOfficeProfile(office)} onEdit={() => setOfficeEditor(office)}
            onDelete={() => office.isHeadquarters ? undefined : deleteOffice.mutate(office.id)} />)}
          {offices.length === 0 && <EmptyDirectory text="Δεν βρέθηκαν πρακτορεία ή υποκαταστήματα." />}
        </Box>
      )}

      <CompanyDialog open={companyEditor !== undefined} item={companyEditor ?? null}
        onClose={() => setCompanyEditor(undefined)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["production-companies-directory"] }); void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); setCompanyEditor(undefined); }} />
      <OfficeDialog open={officeEditor !== undefined} item={officeEditor ?? null}
        onClose={() => setOfficeEditor(undefined)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] }); void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setOfficeEditor(undefined); }} />
      <ProductionCompanyProfileDialog open={!!companyProfile} company={companyProfile} onClose={() => setCompanyProfile(null)} onEdit={company => { setCompanyProfile(null); setCompanyEditor(company); }} />
      <ProductionOfficeProfileDialog open={!!officeProfile} office={officeProfile} onClose={() => setOfficeProfile(null)} onEdit={office => { setOfficeProfile(null); setOfficeEditor(office); }} />
    </Box>
  );
}

function CompanyProductionCard({ company, onOpen, onEdit }: { company: CompanyDto; onOpen: () => void; onEdit: () => void }) {
  return <Card variant="outlined" onClick={onOpen} sx={{ p: 1.5, cursor: "pointer", transition: "box-shadow .2s, transform .2s", "&:hover": { boxShadow: 4, transform: "translateY(-1px)" } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
      <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
        <BusinessIcon color="primary" />
        <Box minWidth={0}><Typography fontWeight={800} noWrap>{company.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{company.code}</Typography></Box>
      </Stack>
      <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(); }}><EditIcon fontSize="small" /></IconButton>
    </Stack>
    <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" useFlexGap>
      <Chip size="small" color={company.isActive ? "success" : "default"} label={company.isActive ? "Ενεργή" : "Ανενεργή"} />
      <Chip size="small" variant="outlined" label={company.country ?? "Χώρα —"} />
      {company.bridgeLinked && <Chip size="small" color="info" variant="outlined" label="Γέφυρα συνδεδεμένη" />}
    </Stack>
    <Divider sx={{ my: 1 }} />
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 0.75 }}>
      <ProductionCardField label="Επαφή" value={company.contactName} />
      <ProductionCardField label="Κωδικός συνεργασίας" value={company.agentCode} mono />
      <ProductionCardField label="Email" value={company.contactEmail} />
      <ProductionCardField label="Τηλέφωνο" value={company.contactPhone} />
      <ProductionCardField label="Παραμετρικά" value={String(company.parameterItemCount)} />
      <ProductionCardField label="Κανόνες προμήθειας" value={String(company.commissionDefaultCount)} />
    </Box>
  </Card>;
}

function OfficeProductionCard({ office, onOpen, onEdit, onDelete }: { office: OfficeDto; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return <Card variant="outlined" onClick={onOpen} sx={{ p: 1.5, cursor: "pointer", transition: "box-shadow .2s, transform .2s", "&:hover": { boxShadow: 4, transform: "translateY(-1px)" } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
      <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
        <HomeWorkIcon color="primary" />
        <Box minWidth={0}><Typography fontWeight={800} noWrap>{office.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{office.code}</Typography></Box>
      </Stack>
      <Stack direction="row" spacing={0.25}>
        <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(); }}><EditIcon fontSize="small" /></IconButton>
        {!office.isHeadquarters && <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); if (confirm(`Διαγραφή πρακτορείου «${office.name}»;`)) onDelete(); }}><span aria-hidden>×</span></IconButton>}
      </Stack>
    </Stack>
    <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" useFlexGap>
      <Chip size="small" color={office.isActive ? "success" : "default"} label={office.isActive ? "Ενεργό" : "Ανενεργό"} />
      {office.isHeadquarters && <Chip size="small" icon={<StarIcon />} color="warning" label="Κεντρικό" />}
      <Chip size="small" variant="outlined" label={`${office.userCount} χρήστες`} />
    </Stack>
    <Divider sx={{ my: 1 }} />
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 0.75 }}>
      <ProductionCardField label="Πόλη / ΤΚ" value={[office.city, office.postalCode].filter(Boolean).join(" · ")} />
      <ProductionCardField label="Διεύθυνση" value={office.address} />
      <ProductionCardField label="Email" value={office.email} />
      <ProductionCardField label="Τηλέφωνο" value={office.phone} />
    </Box>
  </Card>;
}

function ProductionCardField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return <Box sx={{ minWidth: 0, p: 0.65, borderRadius: 0.8, bgcolor: value?.trim() ? "rgba(46,125,50,0.06)" : "rgba(211,47,47,0.055)", border: "1px solid", borderColor: value?.trim() ? "rgba(46,125,50,0.18)" : "rgba(211,47,47,0.18)" }}>
    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
    <Typography variant="body2" fontWeight={650} sx={{ fontFamily: mono ? "monospace" : undefined, wordBreak: "break-word" }}>{value?.trim() || "Δεν έχει καταχωρηθεί"}</Typography>
  </Box>;
}

function EmptyDirectory({ text }: { text: string }) {
  return <Card variant="outlined" sx={{ p: 4, textAlign: "center", gridColumn: "1 / -1" }}><Typography color="text.secondary">{text}</Typography></Card>;
}

function ProductionCompanyProfileDialog({ open, company, onClose, onEdit }: { open: boolean; company: CompanyDto | null; onClose: () => void; onEdit: (company: CompanyDto) => void }) {
  const [tab, setTab] = useState(0);
  const q = useQuery({ queryKey: ["production-company-profile", company?.id], enabled: open && !!company, queryFn: async () => (await api.get<CarrierProfile>(`/insurance-companies/${company!.id}/profile`)).data });
  const p = q.data;
  const eur = (value: number) => value.toLocaleString("el-GR", { style: "currency", currency: "EUR" });
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString("el-GR") : "—";
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
    <DialogTitle sx={{ pr: 6 }}><Stack direction="row" alignItems="center" spacing={1.25}><BusinessIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{company?.name ?? "—"}</Typography><Typography variant="caption" sx={{ fontFamily: "monospace" }}>{company?.code}</Typography></Box>{company && <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(company)}>Επεξεργασία</Button>}</Stack></DialogTitle>
    <DialogContent dividers>
      {q.isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {q.error && <Alert severity="error">Δεν φορτώθηκαν τα στοιχεία της εταιρείας.</Alert>}
      {p && <>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} sx={{ mb: 2 }}>
          <Tab label="Σύνοψη" /><Tab label="Παραγωγή & συμβόλαια" /><Tab label="Σύνδεση & παραμετρικά" /><Tab label="Επικοινωνία" /><Tab icon={<FolderIcon fontSize="small" />} iconPosition="start" label="Έγγραφα & πεδία" />
        </Tabs>
        {tab === 0 && <Stack spacing={1.5}>
          <ProfileMetricGrid items={[
            ["Ενεργά συμβόλαια", `${p.activePolicies} / ${p.totalPolicies}`, "success"],
            ["Μικτά ασφάλιστρα", eur(p.activePremiumTotal), "info"],
            ["Καθαρά ασφάλιστρα", eur(p.activeNetPremiumTotal), "info"],
            ["Ζημιές", `${p.totalClaims} (${p.openClaims} ανοιχτές)`, p.openClaims ? "warning" : "success"],
            ["Κανόνες προμήθειας", String(p.commissionRuleCount), "info"],
            ["Παραμετρικά", `${p.branchCount} κλάδοι · ${p.packageCount} πακέτα`, "info"],
          ]} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}><ProfileSection title="Ταυτότητα εταιρείας"><ProfileLine label="ΑΦΜ / VAT" value={p.afmVat} /><ProfileLine label="Χώρα" value={p.country} /><ProfileLine label="Κωδικός συνεργασίας" value={p.agentCode} mono /><ProfileLine label="Website" value={p.website} link={p.website ?? undefined} /></ProfileSection><ProfileSection title="Επαφή & υπεύθυνοι"><ProfileLine label="Υπεύθυνος" value={p.contactName} /><ProfileLine label="Email" value={p.contactEmail} link={p.contactEmail ? `mailto:${p.contactEmail}` : undefined} /><ProfileLine label="Τηλέφωνο" value={p.contactPhone} link={p.contactPhone ? `tel:${p.contactPhone}` : undefined} /></ProfileSection></Box>
          <ProfileSection title="Σημειώσεις"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{p.notes || "Δεν έχουν καταχωρηθεί σημειώσεις."}</Typography></ProfileSection>
        </Stack>}
        {tab === 1 && <Stack spacing={1.5}><ProfileMetricGrid items={[["Ενεργά", String(p.activePolicies), "success"], ["Μικτά", eur(p.activePremiumTotal), "info"], ["Καθαρά", eur(p.activeNetPremiumTotal), "info"], ["Σύνολο ζημιών", String(p.totalClaims), p.openClaims ? "warning" : "success"]]} /><ProfileSection title="Πρόσφατα συμβόλαια"><Table size="small"><TableHead><TableRow><TableCell>Αριθμός</TableCell><TableCell>Πελάτης</TableCell><TableCell>Κλάδος</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell></TableRow></TableHead><TableBody>{p.recentPolicies.map(row => <TableRow key={row.id} hover><TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{row.policyNumber}</TableCell><TableCell>{row.customerName || "—"}</TableCell><TableCell>{row.policyType}</TableCell><TableCell>{date(row.startDate)}</TableCell><TableCell>{date(row.endDate)}</TableCell><TableCell align="right">{eur(row.premium)}</TableCell><TableCell><Chip size="small" label={row.status} /></TableCell></TableRow>)}</TableBody></Table>{p.recentPolicies.length === 0 && <Typography color="text.secondary">Δεν υπάρχουν πρόσφατα συμβόλαια.</Typography>}</ProfileSection></Stack>}
        {tab === 2 && <Stack spacing={1.5}><ProfileMetricGrid items={[["Κλάδοι", String(p.branchCount), "info"], ["Πακέτα", String(p.packageCount), "info"], ["Χρήσεις", String(p.useCount), "info"], ["Καλύψεις", String(p.coverageCount), "info"], ["Γέφυρα", p.bridgeLinked ? "Συνδεδεμένη" : "Χωρίς σύνδεση", p.bridgeLinked ? "success" : "warning"]]} /><ProfileSection title="Σύνδεση εταιρείας"><ProfileLine label="Πηγή γέφυρας" value={p.bridgeLinkedSourceCarrier} /><ProfileLine label="Κατάσταση" value={p.isActive ? "Ενεργή" : "Ανενεργή"} /><ProfileLine label="Δημιουργήθηκε" value={date(p.createdAt)} /></ProfileSection></Stack>}
        {tab === 3 && <Stack spacing={1.5}><ProfileSection title="Στοιχεία επικοινωνίας"><ProfileLine label="Όνομα επαφής" value={p.contactName} /><ProfileLine label="Email" value={p.contactEmail} link={p.contactEmail ? `mailto:${p.contactEmail}` : undefined} /><ProfileLine label="Τηλέφωνο" value={p.contactPhone} link={p.contactPhone ? `tel:${p.contactPhone}` : undefined} /></ProfileSection><ProfileSection title="Σημειώσεις"><Typography sx={{ whiteSpace: "pre-wrap" }}>{p.notes || "Δεν υπάρχουν σημειώσεις."}</Typography></ProfileSection></Stack>}
        {tab === 4 && company && <CompanyDocumentsWorkspace companyId={company.id} />}
      </>}
    </DialogContent><DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions>
  </Dialog>;
}

interface CompanyWorkspaceFolder { id: string; name: string; description: string | null; parentFolderId: string | null; color: string; documentCount: number; createdAt: string; }
interface CompanyWorkspaceDocument { id: string; folderId: string | null; fileName: string; mimeType: string; sizeBytes: number; category: string; description: string | null; tags: string[]; documentDate: string | null; expiresOn: string | null; isConfidential: boolean; uploadedByUserId: string | null; createdAt: string; }
interface CompanyWorkspaceField { id: string; key: string; label: string; fieldType: string; options: string[]; isRequired: boolean; isActive: boolean; sortOrder: number; value: string | null; }
interface CompanyWorkspaceCategory { id: string; name: string; color: string; isActive: boolean; sortOrder: number; documentCount: number; }
interface CompanyWorkspaceContact { id: string; name: string; role: string | null; department: string | null; email: string | null; phone: string | null; mobile: string | null; notes: string | null; preferredChannel: string; isPrimary: boolean; isActive: boolean; }
interface CompanyWorkspace { folders: CompanyWorkspaceFolder[]; documents: CompanyWorkspaceDocument[]; fields: CompanyWorkspaceField[]; categories: CompanyWorkspaceCategory[]; contacts: CompanyWorkspaceContact[]; }

function CompanyDocumentsWorkspace({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState(false);
  const [fieldDialog, setFieldDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Γενικά");
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [contactDialog, setContactDialog] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactDepartment, setContactDepartment] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [contactPrimary, setContactPrimary] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const workspaceQ = useQuery({
    queryKey: ["production-company-workspace", companyId],
    queryFn: async () => (await api.get<CompanyWorkspace>(`/insurance-companies/${companyId}/workspace`)).data,
  });
  const workspace = workspaceQ.data;
  useEffect(() => {
    if (!workspace) return;
    setFieldDrafts(Object.fromEntries(workspace.fields.map(field => [field.id, field.value ?? ""])));
    if (selectedFolderId && !workspace.folders.some(folder => folder.id === selectedFolderId)) setSelectedFolderId(null);
  }, [workspace, selectedFolderId]);
  const selectedDocuments = (workspace?.documents ?? []).filter(document => !selectedFolderId || document.folderId === selectedFolderId);
  const endpoint = `/insurance-companies/${companyId}/workspace`;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["production-company-workspace", companyId] });
  const createFolder = async () => {
    try {
      await api.post(`${endpoint}/folders`, { name: folderName, description: folderDescription || null, parentFolderId: selectedFolderId, color: "#0b2545", sortOrder: 0 });
      setFolderDialog(false); setFolderName(""); setFolderDescription(""); refresh();
    } catch (e) { setError(extractErrorMessage(e)); }
  };
  const createCategory = async () => {
    try { await api.post(`${endpoint}/categories`, { name: categoryName, color: "#1976d2", sortOrder: workspace?.categories.length ?? 0 }); setCategoryDialog(false); setCategoryName(""); refresh(); }
    catch (e) { setError(extractErrorMessage(e)); }
  };
  const createContact = async () => {
    try {
      await api.post(`${endpoint}/contacts`, { name: contactName, role: contactRole || null, department: contactDepartment || null, email: contactEmail || null, phone: contactPhone || null, mobile: contactMobile || null, notes: contactNotes || null, preferredChannel: "Email", isPrimary: contactPrimary });
      setContactDialog(false); setContactName(""); setContactRole(""); setContactDepartment(""); setContactEmail(""); setContactPhone(""); setContactMobile(""); setContactNotes(""); setContactPrimary(false); refresh();
    } catch (e) { setError(extractErrorMessage(e)); }
  };
  const deleteContact = async (contact: CompanyWorkspaceContact) => {
    if (!window.confirm(`Διαγραφή επαφής «${contact.name}»;`)) return;
    try { await api.delete(`${endpoint}/contacts/${contact.id}`); refresh(); } catch (e) { setError(extractErrorMessage(e)); }
  };
  const createField = async () => {
    try {
      await api.post(`${endpoint}/fields`, { label: fieldLabel, key: fieldKey, fieldType, options: [], isRequired: fieldRequired, sortOrder: (workspace?.fields.length ?? 0) });
      setFieldDialog(false); setFieldLabel(""); setFieldKey(""); setFieldType("text"); setFieldRequired(false); refresh();
    } catch (e) { setError(extractErrorMessage(e)); }
  };
  const saveField = async (fieldId: string) => {
    try { await api.put(`${endpoint}/fields/${fieldId}/value`, { value: fieldDrafts[fieldId] ?? "" }); refresh(); }
    catch (e) { setError(extractErrorMessage(e)); }
  };
  const uploadFile = async (file: File) => {
    const fd = new FormData();
    if (selectedFolderId) fd.append("folderId", selectedFolderId);
    fd.append("category", selectedCategory);
    fd.append("tags", JSON.stringify([]));
    fd.append("isConfidential", "false");
    fd.append("file", file);
    try { setUploading(true); await api.post(`${endpoint}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } }); refresh(); }
    catch (e) { setError(extractErrorMessage(e)); }
    finally { setUploading(false); }
  };
  const onFiles = (files: FileList | File[]) => { void (async () => { for (const file of Array.from(files)) await uploadFile(file); })(); };
  const downloadDocument = async (document: CompanyWorkspaceDocument) => {
    try {
      const response = await api.get(`${endpoint}/documents/${document.id}/download`, { responseType: "blob" });
      const href = URL.createObjectURL(response.data);
      const link = window.document.createElement("a"); link.href = href; link.download = document.fileName; link.click(); URL.revokeObjectURL(href);
    } catch (e) { setError(extractErrorMessage(e)); }
  };
  const deleteDocument = async (document: CompanyWorkspaceDocument) => {
    if (!window.confirm(`Διαγραφή του αρχείου «${document.fileName}»;`)) return;
    try { await api.delete(`${endpoint}/documents/${document.id}`); refresh(); } catch (e) { setError(extractErrorMessage(e)); }
  };
  const deleteFolder = async (folder: CompanyWorkspaceFolder) => {
    if (!window.confirm(`Διαγραφή φακέλου «${folder.name}»; Τα αρχεία θα μετακινηθούν στον γονικό φάκελο.`)) return;
    try { await api.delete(`${endpoint}/folders/${folder.id}`); setSelectedFolderId(folder.parentFolderId); refresh(); } catch (e) { setError(extractErrorMessage(e)); }
  };
  if (workspaceQ.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress /></Box>;
  return <Stack spacing={1.5}>
    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
      <Typography variant="body2" color="text.secondary">Οργανώστε συμβάσεις, αλληλογραφία, τιμοκαταλόγους και κάθε αρχείο της εταιρείας σε δικούς σας φακέλους.</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={() => setFolderDialog(true)}>Νέος φάκελος</Button>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setFieldDialog(true)}>Νέο πεδίο</Button>
      </Stack>
    </Stack>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px 1fr" }, gap: 1.25 }}>
      <Card variant="outlined" sx={{ p: 1 }}>
        <Button fullWidth size="small" variant={selectedFolderId === null ? "contained" : "text"} onClick={() => setSelectedFolderId(null)} startIcon={<FolderIcon />}>Όλα τα αρχεία</Button>
        <Stack spacing={0.35} sx={{ mt: 0.75 }}>
          {(workspace?.folders ?? []).map(folder => <Stack key={folder.id} direction="row" alignItems="center" spacing={0.3}>
            <Button fullWidth size="small" sx={{ justifyContent: "flex-start", color: selectedFolderId === folder.id ? "primary.main" : "text.primary", pl: folder.parentFolderId ? 2.5 : 1 }} onClick={() => setSelectedFolderId(folder.id)} startIcon={<FolderIcon sx={{ color: folder.color }} />}>{folder.name} ({folder.documentCount})</Button>
            <IconButton size="small" color="error" onClick={() => void deleteFolder(folder)}><DeleteOutlineIcon fontSize="inherit" /></IconButton>
          </Stack>)}
        </Stack>
      </Card>
      <Stack spacing={1}>
        <Card variant="outlined" sx={{ p: 1.25, mb: 1 }}><Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={1}><Typography variant="subtitle2" fontWeight={800}>Κατηγορία νέων αρχείων</Typography><Stack direction="row" spacing={1} alignItems="center"><TextField select SelectProps={{ native: true }} size="small" label="Κατηγορία" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}><option value="Γενικά">Γενικά</option>{workspace?.categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</TextField><Button size="small" variant="outlined" onClick={() => setCategoryDialog(true)}>Νέα κατηγορία</Button></Stack></Stack></Card>
        <Card variant="outlined" onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }} sx={{ p: 1.5, border: "2px dashed", borderColor: dragging ? "primary.main" : "divider", bgcolor: dragging ? "rgba(25,118,210,.06)" : "transparent", textAlign: "center" }}>
          <CloudUploadIcon color={dragging ? "primary" : "disabled"} sx={{ fontSize: 34 }} /><Typography fontWeight={750}>Σύρετε αρχεία εδώ ή επιλέξτε από τον υπολογιστή</Typography><Typography variant="caption" color="text.secondary">PDF, Word, Excel, εικόνες και άλλα ασφαλή έγγραφα έως 50 MB ανά αρχείο.</Typography><Button component="label" size="small" sx={{ mt: 0.75 }} disabled={uploading}>Επιλογή αρχείων<input hidden type="file" multiple onChange={e => { if (e.target.files) onFiles(e.target.files); e.currentTarget.value = ""; }} /></Button>{uploading && <CircularProgress size={18} sx={{ ml: 1 }} />}
        </Card>
        <Card variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Αρχείο</TableCell><TableCell>Κατηγορία</TableCell><TableCell>Μέγεθος</TableCell><TableCell>Ημερομηνία</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead><TableBody>{selectedDocuments.map(document => <TableRow key={document.id} hover><TableCell><Typography fontWeight={700}>{document.fileName}</Typography>{document.description && <Typography variant="caption" color="text.secondary">{document.description}</Typography>}{document.isConfidential && <Chip size="small" color="warning" label="Εμπιστευτικό" sx={{ ml: 0.75 }} />}</TableCell><TableCell>{document.category}</TableCell><TableCell>{(document.sizeBytes / 1024).toFixed(0)} KB</TableCell><TableCell>{new Date(document.createdAt).toLocaleDateString("el-GR")}</TableCell><TableCell align="right"><IconButton size="small" onClick={() => void downloadDocument(document)} title="Λήψη"><DownloadIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => void deleteDocument(document)} title="Διαγραφή"><DeleteOutlineIcon fontSize="small" /></IconButton></TableCell></TableRow>)}{selectedDocuments.length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>Δεν υπάρχουν αρχεία σε αυτή την προβολή.</Typography></TableCell></TableRow>}</TableBody></Table></Card>
      </Stack>
    </Box>
    <ProfileSection title="Επαφές εταιρείας"><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="caption" color="text.secondary">Υπεύθυνοι, τμήματα, τηλέφωνα, email και κανάλι επικοινωνίας.</Typography><Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setContactDialog(true)}>Νέα επαφή</Button></Stack>{(workspace?.contacts ?? []).length === 0 ? <Typography color="text.secondary">Δεν έχουν καταχωρηθεί επαφές.</Typography> : <Stack spacing={0.75}>{workspace?.contacts.map(contact => <Box key={contact.id} sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: contact.isPrimary ? "rgba(25,118,210,.06)" : "transparent" }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={0.75}><Box><Typography fontWeight={800}>{contact.name}{contact.isPrimary && <Chip size="small" color="primary" label="Κύρια" sx={{ ml: 0.75 }} />}</Typography><Typography variant="caption" color="text.secondary">{[contact.role, contact.department].filter(Boolean).join(" · ") || "Χωρίς ρόλο"}</Typography></Box><IconButton size="small" color="error" onClick={() => void deleteContact(contact)}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack><Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}><Typography variant="body2">{contact.email || "—"}</Typography><Typography variant="body2">{contact.phone || contact.mobile || "—"}</Typography></Stack>{contact.notes && <Typography variant="caption" color="text.secondary">{contact.notes}</Typography>}</Box>)}</Stack>}</ProfileSection>
    <ProfileSection title="Πεδία που ορίζει το γραφείο για αυτή την εταιρεία"><Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Κρατήστε στοιχεία όπως υπεύθυνος λογαριασμού, προθεσμία εκκαθάρισης, κωδικός συνεργασίας ή εσωτερική κατηγορία.</Typography>{(workspace?.fields ?? []).length === 0 ? <Typography color="text.secondary">Δεν έχουν οριστεί προσαρμόσιμα πεδία.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 1 }}>{workspace?.fields.map(field => <Stack key={field.id} direction="row" spacing={0.75} alignItems="flex-start"><TextField fullWidth size="small" label={`${field.label}${field.isRequired ? " *" : ""}`} value={fieldDrafts[field.id] ?? ""} onChange={e => setFieldDrafts(current => ({ ...current, [field.id]: e.target.value }))} /><Button size="small" variant="outlined" onClick={() => void saveField(field.id)}>Αποθήκευση</Button></Stack>)}</Box>}</ProfileSection>
    <Dialog open={folderDialog} onClose={() => setFolderDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέος φάκελος εταιρείας</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><TextField label="Όνομα φακέλου" value={folderName} onChange={e => setFolderName(e.target.value)} autoFocus /><TextField label="Περιγραφή" value={folderDescription} onChange={e => setFolderDescription(e.target.value)} multiline minRows={2} /></Stack></DialogContent><DialogActions><Button onClick={() => setFolderDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createFolder()} disabled={!folderName.trim()}>Δημιουργία</Button></DialogActions></Dialog>
    <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέα κατηγορία εγγράφων</DialogTitle><DialogContent><TextField fullWidth sx={{ mt: 1 }} label="Όνομα κατηγορίας" value={categoryName} onChange={e => setCategoryName(e.target.value)} autoFocus /></DialogContent><DialogActions><Button onClick={() => setCategoryDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createCategory()} disabled={!categoryName.trim()}>Δημιουργία</Button></DialogActions></Dialog>
    <Dialog open={contactDialog} onClose={() => setContactDialog(false)} fullWidth maxWidth="sm"><DialogTitle>Νέα επαφή ασφαλιστικής</DialogTitle><DialogContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, pt: 1 }}><TextField label="Ονοματεπώνυμο" value={contactName} onChange={e => setContactName(e.target.value)} autoFocus /><TextField label="Ρόλος" value={contactRole} onChange={e => setContactRole(e.target.value)} /><TextField label="Τμήμα" value={contactDepartment} onChange={e => setContactDepartment(e.target.value)} /><TextField label="Email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} /><TextField label="Τηλέφωνο" value={contactPhone} onChange={e => setContactPhone(e.target.value)} /><TextField label="Κινητό" value={contactMobile} onChange={e => setContactMobile(e.target.value)} /><TextField label="Σημειώσεις" value={contactNotes} onChange={e => setContactNotes(e.target.value)} multiline minRows={2} sx={{ gridColumn: { sm: "1 / -1" } }} /><Button size="small" variant={contactPrimary ? "contained" : "outlined"} onClick={() => setContactPrimary(value => !value)} sx={{ justifySelf: "start" }}>{contactPrimary ? "Κύρια επαφή" : "Ορισμός ως κύρια"}</Button></Box></DialogContent><DialogActions><Button onClick={() => setContactDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createContact()} disabled={!contactName.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
    <Dialog open={fieldDialog} onClose={() => setFieldDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέο προσαρμόσιμο πεδίο</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><TextField label="Ετικέτα" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} autoFocus /><TextField label="Κλειδί (π.χ. υπεύθυνος-λογαριασμού)" value={fieldKey} onChange={e => setFieldKey(e.target.value)} /><TextField select SelectProps={{ native: true }} label="Τύπος" value={fieldType} onChange={e => setFieldType(e.target.value)}><option value="text">Κείμενο</option><option value="number">Αριθμός</option><option value="date">Ημερομηνία</option><option value="url">Σύνδεσμος</option></TextField><Button size="small" variant={fieldRequired ? "contained" : "outlined"} onClick={() => setFieldRequired(value => !value)}>{fieldRequired ? "Υποχρεωτικό" : "Προαιρετικό"}</Button></Stack></DialogContent><DialogActions><Button onClick={() => setFieldDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createField()} disabled={!fieldLabel.trim() || !fieldKey.trim()}>Προσθήκη</Button></DialogActions></Dialog>
  </Stack>;
}

function ProfileMetricGrid({ items }: { items: Array<[string, string, "success" | "warning" | "error" | "info"]> }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: `repeat(${Math.min(items.length, 6)},minmax(0,1fr))` }, gap: 1 }}>{items.map(([label, value, color]) => <Box key={label} sx={{ p: 1, borderRadius: 1, bgcolor: `rgba(${color === "success" ? "46,125,50" : color === "warning" ? "237,108,2" : color === "error" ? "211,47,47" : "25,118,210"},0.07)`, border: "1px solid", borderColor: `rgba(${color === "success" ? "46,125,50" : color === "warning" ? "237,108,2" : color === "error" ? "211,47,47" : "25,118,210"},0.2)` }}><Typography variant="caption" color="text.secondary" display="block">{label}</Typography><Typography fontWeight={800}>{value}</Typography></Box>)}</Box>;
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card variant="outlined" sx={{ p: 1.5, bgcolor: "rgba(248,250,252,0.85)" }}><Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, color: "primary.dark" }}>{title}</Typography>{children}</Card>;
}

function ProfileLine({ label, value, mono, link }: { label: string; value?: string | null; mono?: boolean; link?: string }) {
  const shown = value?.trim() || "Δεν έχει καταχωρηθεί";
  return <Box sx={{ display: "grid", gridTemplateColumns: "minmax(130px, 0.45fr) 1fr", gap: 1, py: 0.45, borderBottom: "1px solid", borderColor: "divider" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={650} sx={{ fontFamily: mono ? "monospace" : undefined, wordBreak: "break-word", color: value?.trim() ? "success.dark" : "error.dark" }}>{link && value ? <a href={link} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{shown}</a> : shown}</Typography></Box>;
}

function ProductionOfficeProfileDialog({ open, office, onClose, onEdit }: { open: boolean; office: OfficeDto | null; onClose: () => void; onEdit: (office: OfficeDto) => void }) {
  const usersQ = useQuery({ queryKey: ["production-office-users", office?.id], enabled: open && !!office, queryFn: async () => (await api.get<OfficeUserDto[]>(`/agency-offices/${office!.id}/users`)).data });
  const users = (usersQ.data ?? []).filter(user => user.isAssigned);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle><Stack direction="row" alignItems="center" spacing={1.25}><HomeWorkIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{office?.name}</Typography><Typography variant="caption" sx={{ fontFamily: "monospace" }}>{office?.code}</Typography></Box>{office && <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(office)}>Επεξεργασία</Button>}</Stack></DialogTitle><DialogContent dividers><Stack spacing={1.5}><ProfileMetricGrid items={[["Κατάσταση", office?.isActive ? "Ενεργό" : "Ανενεργό", office?.isActive ? "success" : "warning"], ["Ρόλος", office?.isHeadquarters ? "Κεντρικό" : "Υποκατάστημα", office?.isHeadquarters ? "info" : "info"], ["Χρήστες", String(office?.userCount ?? 0), "info"]]} /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}><ProfileSection title="Ταυτότητα & διεύθυνση"><ProfileLine label="Κωδικός" value={office?.code} mono /><ProfileLine label="Όνομα" value={office?.name} /><ProfileLine label="Πόλη / ΤΚ" value={[office?.city, office?.postalCode].filter(Boolean).join(" · ")} /><ProfileLine label="Διεύθυνση" value={office?.address} /></ProfileSection><ProfileSection title="Επικοινωνία"><ProfileLine label="Email" value={office?.email} link={office?.email ? `mailto:${office.email}` : undefined} /><ProfileLine label="Τηλέφωνο" value={office?.phone} link={office?.phone ? `tel:${office.phone}` : undefined} /></ProfileSection></Box><ProfileSection title="Πρόσωπα & ρόλοι">{usersQ.isLoading ? <CircularProgress size={20} /> : users.length === 0 ? <Typography color="text.secondary">Δεν έχουν ανατεθεί χρήστες.</Typography> : users.map(user => <Box key={user.userId} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5, py: 0.65, borderBottom: "1px solid", borderColor: "divider" }}><Typography fontWeight={700}>{`${user.firstName} ${user.lastName}`.trim() || user.email}</Typography><Typography variant="body2" color="text.secondary">{user.role} · {user.email}{user.isPrimary ? " · κύριο γραφείο" : ""}</Typography></Box>)}</ProfileSection><ProfileSection title="Σημειώσεις & εσωτερική πληροφόρηση"><Typography sx={{ whiteSpace: "pre-wrap" }}>{office?.notes || "Δεν έχουν καταχωρηθεί σημειώσεις."}</Typography></ProfileSection></Stack></DialogContent><DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions></Dialog>;
}
