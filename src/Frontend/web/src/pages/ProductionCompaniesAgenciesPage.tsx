import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Popover, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BusinessIcon from "@mui/icons-material/Business";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import FilterListIcon from "@mui/icons-material/FilterList";
import FolderIcon from "@mui/icons-material/Folder";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { PolicyDetailDrawer } from "../components/PolicyDetailDrawer";
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

interface CompanyPolicyRow {
  id: string;
  policyNumber: string;
  customerId: string;
  customerDisplay: string;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  producerId: string | null;
  producerName: string | null;
  policyType: string;
  status: string;
  paidDirectlyToCarrier: boolean;
  startDate: string;
  endDate: string;
  premium: number;
  netPremium: string | number;
  specialCommissionPercent: string | number;
  currency: string;
  createdAt: string;
}

type CompanyParameterKind = "Branch" | "Coverage" | "Use" | "Package";

interface CompanyParameterRow {
  id: string;
  insuranceCompanyId: string;
  insuranceCompanyCode: string;
  insuranceCompanyName: string;
  kind: CompanyParameterKind;
  code: string;
  name: string;
  policyType: string | null;
  vehicleUseCategory: string | null;
  parentCode: string | null;
  bridgeSystem: string | null;
  bridgeCode: string | null;
  bridgeField: string | null;
  defaultValuesJson: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  displayOrder: number;
  source: string;
  notes: string | null;
}

interface CompanyCommunicationRow {
  id: string;
  kind: string;
  direction: string;
  subject: string | null;
  body: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  occurredAt: string;
  userId: string | null;
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
  const [companyDeleteTarget, setCompanyDeleteTarget] = useState<CompanyDto | null>(null);
  const [officeDeleteTarget, setOfficeDeleteTarget] = useState<OfficeDto | null>(null);
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
  const deleteCompany = useMutation({
    mutationFn: async (id: string) => api.delete(`/insurance-companies/${id}`),
    onSuccess: () => { setCompanyDeleteTarget(null); void qc.invalidateQueries({ queryKey: ["production-companies-directory"] }); void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); },
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
        <CompanyDirectoryTable companies={companies} onOpen={setCompanyProfile} onEdit={setCompanyEditor} onDelete={setCompanyDeleteTarget} />
      ) : (
        <OfficeDirectoryTable offices={offices} onOpen={setOfficeProfile} onEdit={setOfficeEditor}
          onDelete={setOfficeDeleteTarget} />
      )}

      <CompanyDialog open={companyEditor !== undefined} item={companyEditor ?? null}
        onClose={() => setCompanyEditor(undefined)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["production-companies-directory"] }); void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); setCompanyEditor(undefined); }} />
      <OfficeDialog open={officeEditor !== undefined} item={officeEditor ?? null}
        onClose={() => setOfficeEditor(undefined)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] }); void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setOfficeEditor(undefined); }} />
      <ProductionCompanyProfileDialog open={!!companyProfile} company={companyProfile} onClose={() => setCompanyProfile(null)} onEdit={company => { setCompanyProfile(null); setCompanyEditor(company); }} />
      <ProductionOfficeProfileDialog open={!!officeProfile} office={officeProfile} onClose={() => setOfficeProfile(null)} onEdit={office => { setOfficeProfile(null); setOfficeEditor(office); }} />
      <Dialog open={!!companyDeleteTarget} onClose={() => setCompanyDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Διαγραφή ασφαλιστικής εταιρείας</DialogTitle>
        <DialogContent><Typography>Είστε σίγουρος ότι θέλετε να διαγράψετε την εταιρεία «{companyDeleteTarget?.name}»; Η ενέργεια θα την αποσύρει από το γραφείο.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setCompanyDeleteTarget(null)}>Ακύρωση</Button><Button color="error" variant="contained" onClick={() => companyDeleteTarget && deleteCompany.mutate(companyDeleteTarget.id)} disabled={deleteCompany.isPending}>Διαγραφή</Button></DialogActions>
      </Dialog>
      <Dialog open={!!officeDeleteTarget} onClose={() => setOfficeDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Διαγραφή πρακτορείου</DialogTitle>
        <DialogContent><Typography>Είστε σίγουρος ότι θέλετε να διαγράψετε το πρακτορείο «{officeDeleteTarget?.name}»;</Typography></DialogContent>
        <DialogActions><Button onClick={() => setOfficeDeleteTarget(null)}>Ακύρωση</Button><Button color="error" variant="contained" onClick={() => officeDeleteTarget && deleteOffice.mutate(officeDeleteTarget.id)} disabled={deleteOffice.isPending}>Διαγραφή</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

function CompanyDirectoryTable({ companies, onOpen, onEdit, onDelete }: { companies: CompanyDto[]; onOpen: (company: CompanyDto) => void; onEdit: (company: CompanyDto) => void; onDelete: (company: CompanyDto) => void }) {
  return <Card variant="outlined" sx={{ overflow: "hidden" }}>
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 860 }}>
        <TableHead><TableRow sx={{ bgcolor: "rgba(25,118,210,.07)" }}>
          <TableCell sx={{ fontWeight: 800 }}>Εταιρεία</TableCell><TableCell sx={{ fontWeight: 800 }}>Κωδικός</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Κατάσταση</TableCell><TableCell sx={{ fontWeight: 800 }}>Χώρα</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Επικοινωνία</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>Παραμετρικά</TableCell>
          <TableCell align="right" sx={{ fontWeight: 800 }}>Ενέργειες</TableCell>
        </TableRow></TableHead>
        <TableBody>{companies.map(company => <TableRow key={company.id} hover onClick={() => onOpen(company)} sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}>
          <TableCell><Stack direction="row" spacing={1} alignItems="center"><BusinessIcon color="primary" fontSize="small" /><Box><Typography fontWeight={750}>{company.name}</Typography>{company.bridgeLinked && <Chip size="small" color="info" variant="outlined" label="Γέφυρα" sx={{ mt: .25 }} />}</Box></Stack></TableCell>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{company.code || "—"}</TableCell>
          <TableCell><Chip size="small" color={company.isActive ? "success" : "default"} label={company.isActive ? "Ενεργή" : "Ανενεργή"} /></TableCell>
          <TableCell>{company.country || "—"}</TableCell>
          <TableCell>{company.contactName || company.contactEmail || company.contactPhone || "—"}</TableCell>
          <TableCell align="right">{company.parameterItemCount}</TableCell>
          <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={.25}>
            <Tooltip title="Προβολή εταιρείας"><IconButton size="small" color="primary" aria-label="Προβολή εταιρείας" onClick={event => { event.stopPropagation(); onOpen(company); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Επεξεργασία εταιρείας"><IconButton size="small" color="success" aria-label="Επεξεργασία εταιρείας" onClick={event => { event.stopPropagation(); onEdit(company); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title={company.isGlobal ? "Η καθολική εταιρεία δεν διαγράφεται" : "Διαγραφή εταιρείας"}><span><IconButton size="small" color="error" aria-label="Διαγραφή εταιρείας" disabled={company.isGlobal} onClick={event => { event.stopPropagation(); onDelete(company); }}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
          </Stack></TableCell>
        </TableRow>)}{companies.length === 0 && <TableRow><TableCell colSpan={7}><EmptyDirectory text="Δεν βρέθηκαν ασφαλιστικές εταιρείες." /></TableCell></TableRow>}</TableBody>
      </Table>
    </Box>
  </Card>;
}

function OfficeDirectoryTable({ offices, onOpen, onEdit, onDelete }: { offices: OfficeDto[]; onOpen: (office: OfficeDto) => void; onEdit: (office: OfficeDto) => void; onDelete: (office: OfficeDto) => void }) {
  return <Card variant="outlined" sx={{ overflow: "hidden" }}>
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 860 }}>
        <TableHead><TableRow sx={{ bgcolor: "rgba(25,118,210,.07)" }}>
          <TableCell sx={{ fontWeight: 800 }}>Πρακτορείο / υποκατάστημα</TableCell><TableCell sx={{ fontWeight: 800 }}>Κωδικός</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Κατάσταση</TableCell><TableCell sx={{ fontWeight: 800 }}>Πόλη</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Επικοινωνία</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>Χρήστες</TableCell>
          <TableCell align="right" sx={{ fontWeight: 800 }}>Ενέργειες</TableCell>
        </TableRow></TableHead>
        <TableBody>{offices.map(office => <TableRow key={office.id} hover onClick={() => onOpen(office)} sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}>
          <TableCell><Stack direction="row" spacing={1} alignItems="center"><HomeWorkIcon color="primary" fontSize="small" /><Box><Typography fontWeight={750}>{office.name}</Typography>{office.isHeadquarters && <Chip size="small" icon={<StarIcon />} color="warning" label="Κεντρικό" sx={{ mt: .25 }} />}</Box></Stack></TableCell>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{office.code || "—"}</TableCell>
          <TableCell><Chip size="small" color={office.isActive ? "success" : "default"} label={office.isActive ? "Ενεργό" : "Ανενεργό"} /></TableCell>
          <TableCell>{[office.city, office.postalCode].filter(Boolean).join(" · ") || "—"}</TableCell>
          <TableCell>{office.email || office.phone || office.address || "—"}</TableCell>
          <TableCell align="right">{office.userCount}</TableCell>
          <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={.25}>
            <Tooltip title="Προβολή πρακτορείου"><IconButton size="small" color="primary" aria-label="Προβολή πρακτορείου" onClick={event => { event.stopPropagation(); onOpen(office); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Επεξεργασία πρακτορείου"><IconButton size="small" color="success" aria-label="Επεξεργασία πρακτορείου" onClick={event => { event.stopPropagation(); onEdit(office); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
            {!office.isHeadquarters && <Tooltip title="Διαγραφή πρακτορείου"><IconButton size="small" color="error" aria-label="Διαγραφή πρακτορείου" onClick={event => { event.stopPropagation(); onDelete(office); }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>}
          </Stack></TableCell>
        </TableRow>)}{offices.length === 0 && <TableRow><TableCell colSpan={7}><EmptyDirectory text="Δεν βρέθηκαν πρακτορεία ή υποκαταστήματα." /></TableCell></TableRow>}</TableBody>
      </Table>
    </Box>
  </Card>;
}

function EmptyDirectory({ text }: { text: string }) {
  return <Card variant="outlined" sx={{ p: 4, textAlign: "center", gridColumn: "1 / -1" }}><Typography color="text.secondary">{text}</Typography></Card>;
}

function CompanyPoliciesSection({ companyId }: { companyId: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [expiry, setExpiry] = useState("all");
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const policiesQ = useQuery({
    queryKey: ["production-company-policies", companyId],
    queryFn: async () => (await api.get<CompanyPolicyRow[]>("/policies", { params: { insuranceCompanyId: companyId } })).data,
  });
  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("el-GR");
    const today = new Date();
    const limit30 = new Date(today); limit30.setDate(limit30.getDate() + 30);
    const limit90 = new Date(today); limit90.setDate(limit90.getDate() + 90);
    return (policiesQ.data ?? []).filter(row => {
      const haystack = [row.policyNumber, row.customerDisplay, row.producerName, row.policyType, row.status].filter(Boolean).join(" ").toLocaleLowerCase("el-GR");
      if (needle && !haystack.includes(needle)) return false;
      if (status !== "all" && row.status !== status) return false;
      if (type !== "all" && row.policyType !== type) return false;
      const end = new Date(row.endDate);
      if (expiry === "expired" && end >= today) return false;
      if (expiry === "next30" && (end < today || end > limit30)) return false;
      if (expiry === "next90" && (end < today || end > limit90)) return false;
      return true;
    }).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  }, [policiesQ.data, search, status, type, expiry]);
  const filterCount = [status !== "all", type !== "all", expiry !== "all"].filter(Boolean).length;
  const clearFilters = () => { setStatus("all"); setType("all"); setExpiry("all"); setSearch(""); };
  const money = (value: number | string) => Number(value || 0).toLocaleString("el-GR", { style: "currency", currency: "EUR" });
  const date = (value: string) => new Date(value).toLocaleDateString("el-GR");
  const types = [...new Set((policiesQ.data ?? []).map(row => row.policyType).filter(Boolean))];
  const statuses = [...new Set((policiesQ.data ?? []).map(row => row.status).filter(Boolean))];
  return <ProfileSection title="Όλα τα συμβόλαια εταιρείας">
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 1.25 }}>
      <TextField size="small" fullWidth placeholder="Αναζήτηση αριθμού, πελάτη, συνεργάτη ή κλάδου…" value={search} onChange={event => setSearch(event.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: .75, color: "text.secondary" }} /> }} />
      <Button variant="outlined" startIcon={<FilterListIcon />} onClick={event => setFilterAnchor(event.currentTarget)} sx={{ whiteSpace: "nowrap" }}>Λοιπά φίλτρα{filterCount ? ` (${filterCount})` : ""}</Button>
      <Chip size="small" color="info" variant="outlined" label={`${rows.length} / ${(policiesQ.data ?? []).length} συμβόλαια`} />
    </Stack>
    <Popover open={!!filterAnchor} anchorEl={filterAnchor} onClose={() => setFilterAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
      <Stack spacing={1.25} sx={{ p: 1.75, width: { xs: 270, sm: 330 } }}>
        <Typography fontWeight={800}>Φίλτρα συμβολαίων</Typography>
        <TextField select size="small" label="Κατάσταση" value={status} onChange={event => setStatus(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλες</option>{statuses.map(option => <option key={option} value={option}>{option}</option>)}</TextField>
        <TextField select size="small" label="Κλάδος" value={type} onChange={event => setType(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλοι</option>{types.map(option => <option key={option} value={option}>{option}</option>)}</TextField>
        <TextField select size="small" label="Λήξη" value={expiry} onChange={event => setExpiry(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλες οι ημερομηνίες</option><option value="expired">Έχουν λήξει</option><option value="next30">Λήγουν σε 30 ημέρες</option><option value="next90">Λήγουν σε 90 ημέρες</option></TextField>
        <Button color="error" variant="outlined" onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
      </Stack>
    </Popover>
    <Box sx={{ maxHeight: 500, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
      {policiesQ.isLoading ? <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} /></Box> : <Table size="small" stickyHeader sx={{ minWidth: 920 }}>
        <TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Πελάτης</TableCell><TableCell>Κλάδος / κατάσταση</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Συνεργάτης</TableCell><TableCell align="right">Προβολή</TableCell></TableRow></TableHead>
        <TableBody>{rows.map(row => <TableRow key={row.id} hover onClick={() => setSelectedPolicyId(row.id)} sx={{ cursor: "pointer" }}>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.policyNumber || "—"}</TableCell><TableCell>{row.customerDisplay || "—"}</TableCell><TableCell><Stack spacing={.25}><Typography variant="body2">{row.policyType || "—"}</Typography><Chip size="small" label={row.status} /></Stack></TableCell><TableCell>{date(row.startDate)}</TableCell><TableCell>{date(row.endDate)}</TableCell><TableCell align="right">{money(row.premium)}</TableCell><TableCell>{row.producerName || "Έδρα"}</TableCell><TableCell align="right"><IconButton size="small" aria-label="Προβολή συμβολαίου" onClick={event => { event.stopPropagation(); setSelectedPolicyId(row.id); }}><VisibilityIcon fontSize="small" /></IconButton></TableCell>
        </TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>{policiesQ.isError ? "Δεν φορτώθηκαν τα συμβόλαια." : "Δεν βρέθηκαν συμβόλαια με τα συγκεκριμένα φίλτρα."}</Typography></TableCell></TableRow>}</TableBody>
      </Table>}
    </Box>
    <PolicyDetailDrawer policyId={selectedPolicyId} open={!!selectedPolicyId} onClose={() => setSelectedPolicyId(null)} />
  </ProfileSection>;
}

function CompanyParametricsSection({ companyId, companyName }: { companyId: string; companyName: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<CompanyParameterKind | "all">("all");
  const [editing, setEditing] = useState<CompanyParameterRow | null>(null);
  const paramsQ = useQuery({ queryKey: ["production-company-parameters", companyId], queryFn: async () => (await api.get<CompanyParameterRow[]>("/company-parameters", { params: { insuranceCompanyId: companyId } })).data });
  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("el-GR");
    return (paramsQ.data ?? []).filter(row => (kind === "all" || row.kind === kind) && (!needle || `${row.code} ${row.name} ${row.parentCode ?? ""} ${row.notes ?? ""}`.toLocaleLowerCase("el-GR").includes(needle))).sort((a, b) => a.kind.localeCompare(b.kind) || a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  }, [paramsQ.data, search, kind]);
  const groups = (paramsQ.data ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.kind] = (acc[row.kind] ?? 0) + 1; return acc; }, {});
  return <ProfileSection title="Σύνδεση & όλα τα παραμετρικά">
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 1.25 }}>
      <TextField size="small" fullWidth placeholder="Αναζήτηση κωδικού, ονόματος, γονέα…" value={search} onChange={event => setSearch(event.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: .75, color: "text.secondary" }} /> }} />
      <TextField select size="small" label="Κατηγορία" value={kind} onChange={event => setKind(event.target.value as CompanyParameterKind | "all")} SelectProps={{ native: true }} sx={{ minWidth: 150 }}><option value="all">Όλες</option><option value="Branch">Κλάδοι</option><option value="Package">Πακέτα</option><option value="Use">Χρήσεις</option><option value="Coverage">Καλύψεις</option></TextField>
    </Stack>
    <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>{Object.entries(groups).map(([name, count]) => <Chip key={name} size="small" variant="outlined" label={`${name}: ${count}`} />)}<Chip size="small" color="info" label={`${rows.length} εμφανίζονται`} /></Stack>
    <Box sx={{ maxHeight: 500, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
      {paramsQ.isLoading ? <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} /></Box> : <Table size="small" stickyHeader sx={{ minWidth: 900 }}>
        <TableHead><TableRow><TableCell>Κατηγορία</TableCell><TableCell>Κωδικός</TableCell><TableCell>Ονομασία</TableCell><TableCell>Κλάδος</TableCell><TableCell>Γονέας</TableCell><TableCell>Γέφυρα</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Ενέργεια</TableCell></TableRow></TableHead>
        <TableBody>{rows.map(row => <TableRow key={row.id} hover><TableCell><Chip size="small" variant="outlined" label={row.kind} /></TableCell><TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.policyType || "—"}{row.vehicleUseCategory ? ` · ${row.vehicleUseCategory}` : ""}</TableCell><TableCell>{row.parentCode || "—"}</TableCell><TableCell>{row.bridgeSystem || row.bridgeCode ? `${row.bridgeSystem ?? ""} ${row.bridgeCode ?? ""}`.trim() : "—"}</TableCell><TableCell><Chip size="small" color={row.isActive ? "success" : "default"} label={row.isActive ? "Ενεργό" : "Ανενεργό"} /></TableCell><TableCell align="right"><Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(row)}>Επεξεργασία</Button></TableCell></TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>Δεν βρέθηκαν παραμετρικά.</Typography></TableCell></TableRow>}</TableBody>
      </Table>}
    </Box>
    <ParametricEditDialog item={editing} companyId={companyId} companyName={companyName} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ["production-company-parameters", companyId] }); }} />
  </ProfileSection>;
}

function ParametricEditDialog({ item, companyId, companyName, onClose, onSaved }: { item: CompanyParameterRow | null; companyId: string; companyName: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: "", name: "", parentCode: "", notes: "", displayOrder: "0", isActive: true });
  useEffect(() => { if (item) setForm({ code: item.code, name: item.name, parentCode: item.parentCode ?? "", notes: item.notes ?? "", displayOrder: String(item.displayOrder), isActive: item.isActive }); }, [item]);
  const mutation = useMutation({ mutationFn: async () => api.put(`/company-parameters/${item!.id}`, { insuranceCompanyId: companyId, kind: item!.kind, code: form.code.trim(), name: form.name.trim(), policyType: item!.policyType, vehicleUseCategory: item!.vehicleUseCategory, parentCode: form.parentCode.trim() || null, bridgeSystem: item!.bridgeSystem, bridgeCode: item!.bridgeCode, bridgeField: item!.bridgeField, defaultValuesJson: item!.defaultValuesJson, effectiveFrom: item!.effectiveFrom, effectiveTo: item!.effectiveTo, isActive: form.isActive, displayOrder: Number(form.displayOrder) || 0, source: item!.source, notes: form.notes.trim() || null }).then(response => response.data), onSuccess: onSaved });
  return <Dialog open={!!item} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Επεξεργασία παραμετρικού · {companyName}</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}><TextField label="Κωδικός" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /><TextField label="Ονομασία" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><TextField label="Γονικός κωδικός" value={form.parentCode} onChange={event => setForm({ ...form, parentCode: event.target.value })} /><TextField label="Σημειώσεις" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} multiline minRows={2} /><TextField label="Σειρά εμφάνισης" type="number" value={form.displayOrder} onChange={event => setForm({ ...form, displayOrder: event.target.value })} /><Button variant={form.isActive ? "contained" : "outlined"} onClick={() => setForm({ ...form, isActive: !form.isActive })}>{form.isActive ? "Ενεργό" : "Ανενεργό"}</Button></Stack></DialogContent><DialogActions><Button onClick={onClose}>Ακύρωση</Button><Button variant="contained" onClick={() => mutation.mutate()} disabled={!form.code.trim() || !form.name.trim() || mutation.isPending}>Αποθήκευση</Button></DialogActions></Dialog>;
}

function CompanyCommunicationSection({ companyId, workspace }: { companyId: string; workspace?: CompanyWorkspace }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "Email", direction: "Outbound", subject: "", body: "", contactId: "", contactName: "", contactEmail: "", contactPhone: "", occurredAt: new Date().toISOString().slice(0, 16) });
  const contacts = workspace?.contacts ?? [];
  const communications = workspace?.communications ?? [];
  const save = useMutation({
    mutationFn: async () => api.post(`/insurance-companies/${companyId}/workspace/communications`, { kind: form.kind, direction: form.direction, subject: form.subject || null, body: form.body || null, contactName: form.contactName || null, contactEmail: form.contactEmail || null, contactPhone: form.contactPhone || null, occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : null }),
    onSuccess: () => { setOpen(false); setForm(current => ({ ...current, subject: "", body: "", occurredAt: new Date().toISOString().slice(0, 16) })); void qc.invalidateQueries({ queryKey: ["production-company-workspace", companyId] }); },
  });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/insurance-companies/${companyId}/workspace/communications/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ["production-company-workspace", companyId] }) });
  const chooseContact = (id: string) => { const contact = contacts.find(row => row.id === id); setForm(current => ({ ...current, contactId: id, contactName: contact?.name ?? "", contactEmail: contact?.email ?? "", contactPhone: contact?.phone || contact?.mobile || "" })); };
  return <Stack spacing={1.5}>
    <ProfileSection title="Πολλαπλές επαφές, τηλέφωνα & email">
      {contacts.length === 0 ? <Typography color="text.secondary">Δεν έχουν καταχωρηθεί επαφές.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: .9 }}>{contacts.map(contact => <Box key={contact.id} sx={{ p: 1, border: "1px solid", borderColor: contact.isPrimary ? "primary.light" : "divider", borderRadius: 1.25, bgcolor: contact.isPrimary ? "rgba(25,118,210,.06)" : "transparent" }}><Typography fontWeight={800}>{contact.name}{contact.isPrimary && <Chip size="small" color="primary" label="Κύρια" sx={{ ml: .75 }} />}</Typography><Typography variant="caption" color="text.secondary">{[contact.role, contact.department].filter(Boolean).join(" · ") || "Επαφή"}</Typography><Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mt: .5 }}><Typography variant="body2">{contact.email || "—"}</Typography><Typography variant="body2">{contact.phone || "—"}</Typography><Typography variant="body2">{contact.mobile || "—"}</Typography></Stack></Box>)}</Box>}
    </ProfileSection>
    <ProfileSection title="Τελευταίες επικοινωνίες">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Ιστορικό επικοινωνίας με την ασφαλιστική εταιρεία.</Typography><Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Προσθήκη πρόσφατης επικοινωνίας</Button></Stack>
      <Box sx={{ maxHeight: 330, overflow: "auto" }}>{communications.length === 0 ? <Typography color="text.secondary">Δεν έχει καταχωρηθεί επικοινωνία.</Typography> : <Stack spacing={.75}>{communications.map(item => <Box key={item.id} sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.25, bgcolor: "rgba(248,250,252,.8)" }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={.75}><Box><Stack direction="row" spacing={.5} alignItems="center"><Chip size="small" color="info" variant="outlined" label={item.kind} /><Chip size="small" variant="outlined" label={item.direction === "Inbound" ? "Εισερχόμενη" : item.direction === "Outbound" ? "Εξερχόμενη" : item.direction} /></Stack><Typography fontWeight={800} sx={{ mt: .45 }}>{item.subject || "Χωρίς θέμα"}</Typography><Typography variant="caption" color="text.secondary">{new Date(item.occurredAt).toLocaleString("el-GR")} · {item.contactName || item.contactEmail || item.contactPhone || "Χωρίς επαφή"}</Typography></Box><IconButton size="small" color="error" aria-label="Διαγραφή επικοινωνίας" onClick={() => remove.mutate(item.id)}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack>{item.body && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: .75 }}>{item.body}</Typography>}</Box>)}</Stack>}</Box>
    </ProfileSection>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Προσθήκη πρόσφατης επικοινωνίας</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}><TextField select size="small" label="Κανάλι" value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value })} SelectProps={{ native: true }}><option>Email</option><option>Τηλέφωνο</option><option>SMS</option><option>Συνάντηση</option><option>Σημείωση</option></TextField><TextField select size="small" label="Κατεύθυνση" value={form.direction} onChange={event => setForm({ ...form, direction: event.target.value })} SelectProps={{ native: true }}><option value="Outbound">Εξερχόμενη</option><option value="Inbound">Εισερχόμενη</option><option value="Internal">Εσωτερική σημείωση</option></TextField>{contacts.length > 0 && <TextField select size="small" label="Επαφή εταιρείας" value={form.contactId} onChange={event => chooseContact(event.target.value)} SelectProps={{ native: true }}><option value="">Χωρίς επιλογή</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</TextField>}<Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField fullWidth size="small" label="Όνομα επαφής" value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} /><TextField fullWidth size="small" label="Email / τηλέφωνο" value={form.contactEmail || form.contactPhone} onChange={event => setForm({ ...form, contactEmail: event.target.value })} /></Stack><TextField size="small" type="datetime-local" label="Ημερομηνία & ώρα" value={form.occurredAt} onChange={event => setForm({ ...form, occurredAt: event.target.value })} InputLabelProps={{ shrink: true }} /><TextField size="small" label="Θέμα" value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /><TextField size="small" label="Σημειώσεις επικοινωνίας" value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} multiline minRows={4} /></Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Ακύρωση</Button><Button variant="contained" color="primary" onClick={() => save.mutate()} disabled={save.isPending}>Αποθήκευση</Button></DialogActions></Dialog>
  </Stack>;
}

function ProductionCompanyProfileDialog({ open, company, onClose, onEdit }: { open: boolean; company: CompanyDto | null; onClose: () => void; onEdit: (company: CompanyDto) => void }) {
  const [tab, setTab] = useState(0);
  const q = useQuery({ queryKey: ["production-company-profile", company?.id], enabled: open && !!company, queryFn: async () => (await api.get<CarrierProfile>(`/insurance-companies/${company!.id}/profile`)).data });
  const workspaceQ = useQuery({ queryKey: ["production-company-workspace", company?.id], enabled: open && !!company, queryFn: async () => (await api.get<CompanyWorkspace>(`/insurance-companies/${company!.id}/workspace`)).data });
  const p = q.data;
  const workspace = workspaceQ.data;
  const customValue = (...aliases: string[]) => workspace?.fields.find(field => aliases.some(alias => field.key.toLocaleLowerCase("el-GR").includes(alias) || field.label.toLocaleLowerCase("el-GR").includes(alias)))?.value ?? null;
  const eur = (value: number) => value.toLocaleString("el-GR", { style: "currency", currency: "EUR" });
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString("el-GR") : "—";
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
    <DialogTitle sx={{ pr: 6, "& .MuiButton-root": { minWidth: 150, minHeight: 44, px: 2.5, fontSize: ".95rem", fontWeight: 850, color: "#fff", borderRadius: 1.75, background: "linear-gradient(135deg, #43a047 0%, #1b5e20 100%)", boxShadow: "0 3px 8px rgba(46,125,50,.3)", "&:hover": { background: "linear-gradient(135deg, #4caf50 0%, #145214 100%)", color: "#fff", transform: "translateY(-1px)" } } }}><Stack direction="row" alignItems="center" spacing={1.25}><BusinessIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{company?.name ?? "—"}</Typography><Typography variant="caption" sx={{ fontFamily: "monospace" }}>{company?.code}</Typography></Box>{company && <Button variant="contained" size="small" color="success" startIcon={<EditIcon />} onClick={() => onEdit(company)} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, boxShadow: 2, "&:hover": { bgcolor: "success.dark", color: "#fff" } }}>Επεξεργασία</Button>}</Stack></DialogTitle>
    <DialogContent dividers>
      {q.isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {q.error && <Alert severity="error">Δεν φορτώθηκαν τα στοιχεία της εταιρείας.</Alert>}
      {p && <>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="standard" sx={{
          position: "sticky",
          // DialogContent keeps a padded scroll edge. Start the sticky
          // surface above that edge so content can never show through the
          // gap while the user scrolls the long company profile.
          top: "-24px",
          zIndex: 4,
          mb: 2,
          px: .5,
          py: .5,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          boxShadow: "0 3px 10px rgba(15,23,42,.12)",
          overflow: "visible",
          "& .MuiTabs-scroller": { overflow: "visible !important" },
          "& .MuiTabs-flexContainer": { gap: .75, flexWrap: "wrap" },
          "& .MuiTabs-indicator": { display: "none" },
          "& .MuiTab-root": {
            minHeight: 54,
            minWidth: { xs: 132, md: 168 },
            px: 1.5,
            py: .75,
            border: "1px solid #b8c0c8",
            borderRadius: 1.5,
            background: "linear-gradient(180deg, #f7f8fa 0%, #e1e5e9 100%)",
            color: "#263238",
            textTransform: "none",
            fontWeight: 750,
            fontSize: { xs: ".82rem", md: ".9rem" },
            lineHeight: 1.25,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(15,23,42,.12)",
            transition: "background .18s ease, border-color .18s ease, color .18s ease, box-shadow .18s ease",
            "&:hover": { background: "linear-gradient(180deg, #e7e9ec 0%, #cbd1d6 100%)", borderColor: "#7b8792", color: "#17212b", boxShadow: "inset 0 1px 0 rgba(255,255,255,.65), 0 2px 5px rgba(15,23,42,.18)" },
            "&.Mui-selected": { background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)", borderColor: "#0d47a1", color: "#fff", boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 3px 8px rgba(13,71,161,.3)" },
            "&.Mui-selected:hover": { background: "linear-gradient(135deg, #1565c0 0%, #0b3d91 100%)", color: "#fff" },
          },
        }}>
          <Tab icon={<InfoOutlinedIcon fontSize="small" />} iconPosition="start" label="Σύνοψη" /><Tab icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="Παραγωγή & συμβόλαια" /><Tab icon={<TuneIcon fontSize="small" />} iconPosition="start" label="Σύνδεση & παραμετρικά" /><Tab icon={<ContactPhoneIcon fontSize="small" />} iconPosition="start" label="Επικοινωνία" /><Tab icon={<FolderIcon fontSize="small" />} iconPosition="start" label="Έγγραφα & πεδία" />
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
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            <ProfileSection title="Διεύθυνση & στοιχεία έδρας">
              <ProfileLine label="Διεύθυνση" value={customValue("address", "διεύθυνση", "εδρα", "έδρα")} />
              <ProfileLine label="Πόλη" value={customValue("city", "πόλη")} />
              <ProfileLine label="Τ.Κ." value={customValue("postal", "ταχυδρομ", "τκ", "zip")} mono />
              <ProfileLine label="Χώρα" value={p.country} />
              <ProfileLine label="ΑΦΜ / VAT" value={p.afmVat} mono />
              <ProfileLine label="Κωδικός συνεργασίας" value={p.agentCode} mono />
            </ProfileSection>
            <ProfileSection title="Ιστοσελίδα & ψηφιακή παρουσία">
              <ProfileLine label="Ιστοσελίδα" value={p.website} link={p.website ?? undefined} />
              <ProfileLine label="Facebook" value={customValue("facebook", "fb")} link={customValue("facebook", "fb") ?? undefined} />
              <ProfileLine label="Instagram" value={customValue("instagram", "insta")} link={customValue("instagram", "insta") ?? undefined} />
              <ProfileLine label="LinkedIn" value={customValue("linkedin", "linked in")} link={customValue("linkedin", "linked in") ?? undefined} />
              <ProfileLine label="X / Twitter" value={customValue("twitter", "x.com")} link={customValue("twitter", "x.com") ?? undefined} />
              <ProfileLine label="Google Maps" value={customValue("google maps", "maps")} link={customValue("google maps", "maps") ?? undefined} />
            </ProfileSection>
          </Box>
          <ProfileSection title="Πρόσωπα, στελέχη & πολλαπλές επικοινωνίες">
            {workspaceQ.isLoading && <Typography variant="body2" color="text.secondary">Φόρτωση επαφών…</Typography>}
            {!workspaceQ.isLoading && (workspace?.contacts ?? []).filter(contact => contact.isActive).length === 0 && <Typography variant="body2" color="text.secondary">Δεν έχουν καταχωρηθεί επιπλέον στελέχη. Μπορείτε να τα προσθέσετε από την καρτέλα «Έγγραφα & πεδία».</Typography>}
            <Stack spacing={.75}>
              {(workspace?.contacts ?? []).filter(contact => contact.isActive).map(contact => <Box key={contact.id} sx={{ p: 1, border: "1px solid", borderColor: contact.isPrimary ? "primary.light" : "divider", borderRadius: 1.25, bgcolor: contact.isPrimary ? "rgba(25,118,210,.06)" : "rgba(248,250,252,.8)" }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={.5}>
                  <Box><Typography fontWeight={800}>{contact.name}{contact.isPrimary && <Chip size="small" color="primary" label="Κύρια επαφή" sx={{ ml: .75 }} />}</Typography><Typography variant="caption" color="text.secondary">{[contact.role, contact.department].filter(Boolean).join(" · ") || "Στέλεχος / επαφή"}</Typography></Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Typography variant="body2">{contact.email || "—"}</Typography><Typography variant="body2">{contact.phone || "—"}</Typography><Typography variant="body2">{contact.mobile || "—"}</Typography></Stack>
                </Stack>
                {contact.notes && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }}>{contact.notes}</Typography>}
              </Box>)}
            </Stack>
          </ProfileSection>
          <ProfileSection title="Επιπλέον στοιχεία εταιρείας">
            {(workspace?.fields ?? []).filter(field => field.isActive && field.value?.trim()).length === 0 ? <Typography variant="body2" color="text.secondary">Δεν έχουν συμπληρωθεί πρόσθετα πεδία. Τα πεδία που δημιουργεί το γραφείο εμφανίζονται αυτόματα εδώ.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 2 }}>{(workspace?.fields ?? []).filter(field => field.isActive && field.value?.trim()).map(field => <ProfileLine key={field.id} label={field.label} value={field.value} link={/^https?:\/\//i.test(field.value ?? "") ? field.value ?? undefined : undefined} />)}</Box>}
          </ProfileSection>
        </Stack>}
        {tab === 1 && <Stack spacing={1.5}><ProfileMetricGrid items={[["Ενεργά", String(p.activePolicies), "success"], ["Μικτά", eur(p.activePremiumTotal), "info"], ["Καθαρά", eur(p.activeNetPremiumTotal), "info"], ["Σύνολο ζημιών", String(p.totalClaims), p.openClaims ? "warning" : "success"]]} /></Stack>}
        {tab === 2 && <Stack spacing={1.5}><ProfileMetricGrid items={[["Κλάδοι", String(p.branchCount), "info"], ["Πακέτα", String(p.packageCount), "info"], ["Χρήσεις", String(p.useCount), "info"], ["Καλύψεις", String(p.coverageCount), "info"], ["Γέφυρα", p.bridgeLinked ? "Συνδεδεμένη" : "Χωρίς σύνδεση", p.bridgeLinked ? "success" : "warning"]]} /><ProfileSection title="Σύνδεση εταιρείας"><ProfileLine label="Πηγή γέφυρας" value={p.bridgeLinkedSourceCarrier} /><ProfileLine label="Κατάσταση" value={p.isActive ? "Ενεργή" : "Ανενεργή"} /><ProfileLine label="Δημιουργήθηκε" value={date(p.createdAt)} /></ProfileSection></Stack>}
        {tab === 3 && <Stack spacing={1.5}><ProfileSection title="Στοιχεία επικοινωνίας"><ProfileLine label="Όνομα επαφής" value={p.contactName} /><ProfileLine label="Email" value={p.contactEmail} link={p.contactEmail ? `mailto:${p.contactEmail}` : undefined} /><ProfileLine label="Τηλέφωνο" value={p.contactPhone} link={p.contactPhone ? `tel:${p.contactPhone}` : undefined} /></ProfileSection><ProfileSection title="Σημειώσεις"><Typography sx={{ whiteSpace: "pre-wrap" }}>{p.notes || "Δεν υπάρχουν σημειώσεις."}</Typography></ProfileSection></Stack>}
        {tab === 1 && company && <CompanyPoliciesSection companyId={company.id} />}
        {tab === 2 && company && <CompanyParametricsSection companyId={company.id} companyName={company.name} />}
        {tab === 3 && company && <CompanyCommunicationSection companyId={company.id} workspace={workspace} />}
        {tab === 4 && company && <CompanyDocumentsWorkspace companyId={company.id} />}
      </>}
    </DialogContent><DialogActions sx={{ px: 3, py: 2 }}><Button variant="contained" color="error" onClick={onClose} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, "&:hover": { bgcolor: "error.dark", color: "#fff" } }}>Κλείσιμο</Button></DialogActions>
  </Dialog>;
}

interface CompanyWorkspaceFolder { id: string; name: string; description: string | null; parentFolderId: string | null; color: string; documentCount: number; createdAt: string; }
interface CompanyWorkspaceDocument { id: string; folderId: string | null; fileName: string; mimeType: string; sizeBytes: number; category: string; description: string | null; tags: string[]; documentDate: string | null; expiresOn: string | null; isConfidential: boolean; uploadedByUserId: string | null; createdAt: string; }
interface CompanyWorkspaceField { id: string; key: string; label: string; fieldType: string; options: string[]; isRequired: boolean; isActive: boolean; sortOrder: number; value: string | null; }
interface CompanyWorkspaceCategory { id: string; name: string; color: string; isActive: boolean; sortOrder: number; documentCount: number; }
interface CompanyWorkspaceContact { id: string; name: string; role: string | null; department: string | null; email: string | null; phone: string | null; mobile: string | null; notes: string | null; preferredChannel: string; isPrimary: boolean; isActive: boolean; }
interface CompanyWorkspace { folders: CompanyWorkspaceFolder[]; documents: CompanyWorkspaceDocument[]; fields: CompanyWorkspaceField[]; categories: CompanyWorkspaceCategory[]; contacts: CompanyWorkspaceContact[]; communications: CompanyCommunicationRow[]; }

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
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle sx={{ "& .MuiButton-root": { minWidth: 150, minHeight: 44, px: 2.5, fontSize: ".95rem", fontWeight: 850, color: "#fff", borderRadius: 1.75, background: "linear-gradient(135deg, #43a047 0%, #1b5e20 100%)", boxShadow: "0 3px 8px rgba(46,125,50,.3)", "&:hover": { background: "linear-gradient(135deg, #4caf50 0%, #145214 100%)", color: "#fff", transform: "translateY(-1px)" } } }}><Stack direction="row" alignItems="center" spacing={1.25}><HomeWorkIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{office?.name}</Typography><Typography variant="caption" sx={{ fontFamily: "monospace" }}>{office?.code}</Typography></Box>{office && <Button variant="contained" size="small" color="success" startIcon={<EditIcon />} onClick={() => onEdit(office)} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, boxShadow: 2, "&:hover": { bgcolor: "success.dark", color: "#fff" } }}>Επεξεργασία</Button>}</Stack></DialogTitle><DialogContent dividers><Stack spacing={1.5}><ProfileMetricGrid items={[["Κατάσταση", office?.isActive ? "Ενεργό" : "Ανενεργό", office?.isActive ? "success" : "warning"], ["Ρόλος", office?.isHeadquarters ? "Κεντρικό" : "Υποκατάστημα", office?.isHeadquarters ? "info" : "info"], ["Χρήστες", String(office?.userCount ?? 0), "info"]]} /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}><ProfileSection title="Ταυτότητα & διεύθυνση"><ProfileLine label="Κωδικός" value={office?.code} mono /><ProfileLine label="Όνομα" value={office?.name} /><ProfileLine label="Πόλη / ΤΚ" value={[office?.city, office?.postalCode].filter(Boolean).join(" · ")} /><ProfileLine label="Διεύθυνση" value={office?.address} /></ProfileSection><ProfileSection title="Επικοινωνία"><ProfileLine label="Email" value={office?.email} link={office?.email ? `mailto:${office.email}` : undefined} /><ProfileLine label="Τηλέφωνο" value={office?.phone} link={office?.phone ? `tel:${office.phone}` : undefined} /></ProfileSection></Box><ProfileSection title="Πρόσωπα & ρόλοι">{usersQ.isLoading ? <CircularProgress size={20} /> : users.length === 0 ? <Typography color="text.secondary">Δεν έχουν ανατεθεί χρήστες.</Typography> : users.map(user => <Box key={user.userId} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5, py: 0.65, borderBottom: "1px solid", borderColor: "divider" }}><Typography fontWeight={700}>{`${user.firstName} ${user.lastName}`.trim() || user.email}</Typography><Typography variant="body2" color="text.secondary">{user.role} · {user.email}{user.isPrimary ? " · κύριο γραφείο" : ""}</Typography></Box>)}</ProfileSection><ProfileSection title="Σημειώσεις & εσωτερική πληροφόρηση"><Typography sx={{ whiteSpace: "pre-wrap" }}>{office?.notes || "Δεν έχουν καταχωρηθεί σημειώσεις."}</Typography></ProfileSection></Stack></DialogContent><DialogActions sx={{ px: 3, py: 2 }}><Button variant="contained" color="error" onClick={onClose} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, "&:hover": { bgcolor: "error.dark", color: "#fff" } }}>Κλείσιμο</Button></DialogActions></Dialog>;
}
