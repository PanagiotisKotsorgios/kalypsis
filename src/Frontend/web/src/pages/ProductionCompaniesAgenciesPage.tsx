import { useEffect, useMemo, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  Checkbox, DialogTitle, FormControlLabel, IconButton, Popover, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, TextField, Tooltip, Typography, Snackbar
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BusinessIcon from "@mui/icons-material/Business";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import FilterListIcon from "@mui/icons-material/FilterList";
import FolderIcon from "@mui/icons-material/Folder";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import HandshakeIcon from "@mui/icons-material/Handshake";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import BarChartIcon from "@mui/icons-material/BarChart";
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { PolicyDetailDrawer } from "../components/PolicyDetailDrawer";
import { type CarrierProfile, type CompanyDto } from "./InsuranceCompaniesPage";
import { type OfficeDto } from "./AgencyOfficesPage";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";

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
const COMPANY_PARAMETER_KIND_LABEL: Record<CompanyParameterKind, string> = {
  Branch: "Κλάδος",
  Coverage: "Κάλυψη",
  Use: "Χρήση",
  Package: "Πακέτο",
};

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
  const [companyProfileEditing, setCompanyProfileEditing] = useState(false);
  const [companyQuickCreateOpen, setCompanyQuickCreateOpen] = useState(false);
  const [officeQuickCreateOpen, setOfficeQuickCreateOpen] = useState(false);
  const [officeProfile, setOfficeProfile] = useState<OfficeDto | null>(null);
  const [companyEditor, setCompanyEditor] = useState<CompanyDto | null | undefined>(undefined);
  const [officeEditor, setOfficeEditor] = useState<OfficeDto | null | undefined>(undefined);
  const [companyDeleteTarget, setCompanyDeleteTarget] = useState<CompanyDto | null>(null);
  const [officeDeleteTarget, setOfficeDeleteTarget] = useState<OfficeDto | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<Set<string>>(new Set());
  const [bulkDeleteKind, setBulkDeleteKind] = useState<"company" | "office" | null>(null);
  const [bulkDeleteText, setBulkDeleteText] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    setSelectedCompanyIds(new Set());
    setSelectedOfficeIds(new Set());
  }, [tab, search]);
  const [error, setError] = useState<string | null>(null);

  const companiesQ = useQuery({
    queryKey: ["production-companies-directory"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies")).data,
  });
  const needle = search.trim().toLocaleLowerCase("el");
  const companies = useMemo(() => (companiesQ.data ?? [])
    // Broker/praktoreio records are office-owned relationships.  A global
    // carrier catalogue row (for example the platform's Grand Cover seed)
    // must never appear as an agency that belongs to every office.
    .filter(c => c.isBroker ? !c.isGlobal : (!c.isGlobal || c.isUsedByTenant))
    .filter(c => !needle || [c.name, c.code, c.agentCode, c.contactName, c.contactEmail, c.afmVat]
      .some(value => value?.toLocaleLowerCase("el").includes(needle))), [companiesQ.data, needle]);
  const insuranceCompanies = useMemo(() => companies.filter(c => !c.isBroker), [companies]);
  const brokerAgencies = useMemo(() => companies.filter(c => !!c.isBroker), [companies]);
  const visibleCompanies = tab === 0 ? insuranceCompanies : brokerAgencies;
  const eligibleCompanies = useMemo(() => visibleCompanies.filter(company => !company.isGlobal), [visibleCompanies]);
  const selectedCount = selectedCompanyIds.size;

  const deleteOffice = useMutation({
    mutationFn: async (id: string) => api.delete(`/agency-offices/${id}`),
    onSuccess: () => { setOfficeDeleteTarget(null); setSuccess("Η εγγραφή διαγράφηκε επιτυχώς."); void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] }); void qc.invalidateQueries({ queryKey: ["agency-offices"] }); },
    onError: e => setError(extractErrorMessage(e)),
  });
  const deleteCompany = useMutation({
    mutationFn: async (id: string) => api.delete(`/insurance-companies/${id}`),
    onSuccess: () => { setCompanyDeleteTarget(null); setSuccess("Η εγγραφή διαγράφηκε επιτυχώς."); void qc.invalidateQueries({ queryKey: ["production-companies-directory"] }); void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); },
    onError: e => setError(extractErrorMessage(e)),
  });
  const bulkDelete = useMutation({
    mutationFn: async ({ kind, ids }: { kind: "company" | "office"; ids: string[] }) => {
      const failed: string[] = [];
      for (const id of ids) {
        try {
          await api.delete(kind === "company" ? `/insurance-companies/${id}` : `/agency-offices/${id}`);
        } catch {
          failed.push(id);
        }
      }
      return failed;
    },
    onSuccess: failed => {
      if (failed.length === 0) setSuccess("Οι εγγραφές διαγράφηκαν επιτυχώς.");
      if (failed.length > 0) setError(`${failed.length} εγγραφές δεν διαγράφηκαν. Ελέγξτε τα δικαιώματα και δοκιμάστε ξανά.`);
      setSelectedCompanyIds(new Set());
      setSelectedOfficeIds(new Set());
      setBulkDeleteKind(null);
      setBulkDeleteText("");
      void qc.invalidateQueries({ queryKey: ["production-companies-directory"] });
      void qc.invalidateQueries({ queryKey: ["insurance-companies"] });
      void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] });
      void qc.invalidateQueries({ queryKey: ["agency-offices"] });
    },
    onError: e => setError(extractErrorMessage(e)),
  });

  const loading = companiesQ.isLoading;
  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 2, p: { xs: 1.25, md: 2 }, bgcolor: "rgba(25,118,210,0.035)" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            {tab === 0 ? <BusinessIcon color="primary" sx={{ fontSize: 34 }} /> : <HandshakeIcon color="primary" sx={{ fontSize: 34 }} />}
            <Box>
              <Typography variant="h4" fontWeight={850}>Εταιρείες &amp; Πρακτορεία Παραγωγής</Typography>
              <Typography variant="body2" color="text.secondary">
                Λειτουργική εικόνα ασφαλιστικών εταιρειών και συνεργαζόμενων πρακτορείων: παραγωγή, συμβόλαια, ζημιές, επαφές και υπεύθυνοι.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {selectedCount > 0 && <Button variant="contained" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => { setBulkDeleteKind("company"); setBulkDeleteText(""); }}>
              Μαζική διαγραφή ({selectedCount})
            </Button>}
            <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={() => setCompanyQuickCreateOpen(true)} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, boxShadow: 2, "&:hover": { bgcolor: "success.dark", color: "#fff" } }}>
              {tab === 0 ? "Νέα ασφαλιστική" : "Νέο πρακτορείο"}
            </Button>
            <TextField size="small" label="Αναζήτηση" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          </Stack>
        </Stack>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} sx={{ mt: 1 }}>
          <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label={`Ασφαλιστικές (${insuranceCompanies.length})`} />
          <Tab icon={<HandshakeIcon fontSize="small" />} iconPosition="start" label={`Πρακτορεία (${brokerAgencies.length})`} />
        </Tabs>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box> : (
        <CompanyDirectoryTable isBroker={tab === 1} companies={visibleCompanies} selectedIds={selectedCompanyIds} onToggle={id => setSelectedCompanyIds(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })} onToggleAll={checked => setSelectedCompanyIds(checked ? new Set(eligibleCompanies.map(company => company.id)) : new Set())} onOpen={company => { setCompanyProfileEditing(false); setCompanyProfile(company); }} onEdit={company => { setCompanyProfileEditing(true); setCompanyProfile(company); }} onDelete={setCompanyDeleteTarget} />
      )}

      <ProductionCompanyQuickCreateDialog open={companyQuickCreateOpen} isBroker={tab === 1}
        onClose={() => setCompanyQuickCreateOpen(false)}
        onSaved={(saved) => { setCompanyQuickCreateOpen(false); void qc.invalidateQueries({ queryKey: ["production-companies-directory"] }); void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); if (saved) { setCompanyProfileEditing(false); setCompanyProfile(saved); } }} />
      <ProductionOfficeQuickCreateDialog open={officeQuickCreateOpen}
        onClose={() => setOfficeQuickCreateOpen(false)}
        onSaved={(saved) => { setOfficeQuickCreateOpen(false); void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] }); void qc.invalidateQueries({ queryKey: ["agency-offices"] }); if (saved) setOfficeProfile(saved); }} />
      <ProductionCompanyEditorDialog open={companyEditor !== undefined} item={companyEditor ?? null}
        onClose={() => setCompanyEditor(undefined)}
        onSaved={(saved) => { void qc.invalidateQueries({ queryKey: ["production-companies-directory"] }); void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); setCompanyEditor(undefined); if (saved) setCompanyProfile(saved); }} />
      <ProductionOfficeEditorDialog open={officeEditor !== undefined} item={officeEditor ?? null}
        onClose={() => setOfficeEditor(undefined)}
        onSaved={(saved) => { void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] }); void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setOfficeEditor(undefined); if (saved) setOfficeProfile(saved); }} />
      <ProductionCompanyProfileDialog open={!!companyProfile} company={companyProfile} startEditing={companyProfileEditing} onClose={() => { setCompanyProfile(null); setCompanyProfileEditing(false); }} onChanged={saved => { setCompanyProfile(saved); setCompanyProfileEditing(false); void qc.invalidateQueries({ queryKey: ["production-companies-directory"] }); void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); }} />
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
      <Dialog open={!!bulkDeleteKind} onClose={() => { if (!bulkDelete.isPending) { setBulkDeleteKind(null); setBulkDeleteText(""); } }} maxWidth="sm" fullWidth>
        <DialogTitle>Οριστική μαζική διαγραφή</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>Θα διαγραφούν {selectedCount} {bulkDeleteKind === "company" ? "ασφαλιστικές εταιρείες" : "πρακτορεία"}. Η ενέργεια δεν αναιρείται.</Alert>
          <Typography variant="body2" sx={{ mb: 1 }}>Πληκτρολογήστε <strong>ΔΙΑΓΡΑΦΗ</strong> για επιβεβαίωση.</Typography>
          <TextField fullWidth autoFocus value={bulkDeleteText} onChange={event => setBulkDeleteText(event.target.value)} placeholder="ΔΙΑΓΡΑΦΗ" disabled={bulkDelete.isPending} />
        </DialogContent>
        <DialogActions><Button color="inherit" onClick={() => { setBulkDeleteKind(null); setBulkDeleteText(""); }} disabled={bulkDelete.isPending}>Ακύρωση</Button><Button color="error" variant="contained" startIcon={<DeleteOutlineIcon />} disabled={bulkDelete.isPending || bulkDeleteText.trim() !== "ΔΙΑΓΡΑΦΗ"} onClick={() => bulkDelete.mutate({ kind: bulkDeleteKind!, ids: Array.from(bulkDeleteKind === "company" ? selectedCompanyIds : selectedOfficeIds) })}>{bulkDelete.isPending ? <CircularProgress size={18} color="inherit" /> : "Διαγραφή"}</Button></DialogActions>
      </Dialog>
      <Snackbar open={!!success} autoHideDuration={4500} onClose={() => setSuccess(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setSuccess(null)} sx={{ color: "#fff", fontWeight: 800 }}>{success}</Alert>
      </Snackbar>
    </Box>
  );
}

function CompanyDirectoryTable({ isBroker = false, companies, selectedIds, onToggle, onToggleAll, onOpen, onEdit, onDelete }: { isBroker?: boolean; companies: CompanyDto[]; selectedIds: Set<string>; onToggle: (id: string) => void; onToggleAll: (checked: boolean) => void; onOpen: (company: CompanyDto) => void; onEdit: (company: CompanyDto) => void; onDelete: (company: CompanyDto) => void }) {
  const selectable = companies.filter(company => !company.isGlobal);
  const allSelected = selectable.length > 0 && selectable.every(company => selectedIds.has(company.id));
  const someSelected = selectable.some(company => selectedIds.has(company.id));
  return <Card variant="outlined" sx={{ overflow: "hidden" }}>
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead><TableRow sx={{ bgcolor: "rgba(25,118,210,.07)" }}>
          <TableCell padding="checkbox"><Checkbox size="small" checked={allSelected} indeterminate={!allSelected && someSelected} onChange={event => onToggleAll(event.target.checked)} inputProps={{ "aria-label": "Επιλογή εταιρειών" }} /></TableCell>
          <TableCell sx={{ fontWeight: 800 }}>{isBroker ? "Πρακτορείο / διαμεσολαβητής" : "Ασφαλιστική εταιρεία"}</TableCell><TableCell sx={{ fontWeight: 800 }}>Κωδικός</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Κατάσταση</TableCell><TableCell sx={{ fontWeight: 800 }}>Χώρα</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Επικοινωνία</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>Παραμετρικά</TableCell>
          <TableCell align="right" sx={{ fontWeight: 800 }}>Ενέργειες</TableCell>
        </TableRow></TableHead>
        <TableBody>{companies.map(company => <TableRow key={company.id} hover onClick={() => onOpen(company)} sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}>
          <TableCell padding="checkbox"><Checkbox size="small" checked={selectedIds.has(company.id)} disabled={company.isGlobal} onClick={event => event.stopPropagation()} onChange={() => onToggle(company.id)} inputProps={{ "aria-label": `Επιλογή ${company.name}` }} /></TableCell>
          <TableCell><Stack direction="row" spacing={1} alignItems="center"><BusinessIcon color="primary" fontSize="small" /><Box><Typography fontWeight={750}>{company.name}</Typography>{company.bridgeLinked && <Chip size="small" color="info" variant="outlined" label="Γέφυρα" sx={{ mt: .25 }} />}</Box></Stack></TableCell>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{company.code || "—"}</TableCell>
          <TableCell><Chip size="small" color={company.isActive ? "success" : "default"} label={company.isActive ? "Ενεργή" : "Ανενεργή"} /></TableCell>
          <TableCell>{company.country || "—"}</TableCell>
          <TableCell>{company.contactName || company.contactEmail || company.contactPhone || "—"}</TableCell>
          <TableCell align="right">{company.parameterItemCount}</TableCell>
          <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={.25}>
            <Tooltip title={isBroker ? "Προβολή πρακτορείου" : "Προβολή εταιρείας"}><IconButton size="small" color="primary" aria-label={isBroker ? "Προβολή πρακτορείου" : "Προβολή εταιρείας"} onClick={event => { event.stopPropagation(); onOpen(company); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title={isBroker ? "Επεξεργασία πρακτορείου" : "Επεξεργασία εταιρείας"}><IconButton size="small" color="success" aria-label={isBroker ? "Επεξεργασία πρακτορείου" : "Επεξεργασία εταιρείας"} onClick={event => { event.stopPropagation(); onEdit(company); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title={company.isGlobal ? `Η καθολική ${isBroker ? "οντότητα" : "εταιρεία"} δεν διαγράφεται` : `Διαγραφή ${isBroker ? "πρακτορείου" : "εταιρείας"}`}><span><IconButton size="small" color="error" aria-label={`Διαγραφή ${isBroker ? "πρακτορείου" : "εταιρείας"}`} disabled={company.isGlobal} onClick={event => { event.stopPropagation(); onDelete(company); }}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
          </Stack></TableCell>
        </TableRow>)}{companies.length === 0 && <TableRow><TableCell colSpan={8}><EmptyDirectory text={isBroker ? "Δεν βρέθηκαν συνεργαζόμενα πρακτορεία." : "Δεν βρέθηκαν ασφαλιστικές εταιρείες."} /></TableCell></TableRow>}</TableBody>
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
        <TextField select size="small" label="Κατάσταση" value={status} onChange={event => setStatus(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλες</option>{statuses.map(option => <option key={option} value={option}>{policyStatusLabel(option)}</option>)}</TextField>
        <TextField select size="small" label="Κλάδος" value={type} onChange={event => setType(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλοι</option>{types.map(option => <option key={option} value={option}>{policyTypeLabel(option)}</option>)}</TextField>
        <TextField select size="small" label="Λήξη" value={expiry} onChange={event => setExpiry(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλες οι ημερομηνίες</option><option value="expired">Έχουν λήξει</option><option value="next30">Λήγουν σε 30 ημέρες</option><option value="next90">Λήγουν σε 90 ημέρες</option></TextField>
        <Button color="error" variant="outlined" onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
      </Stack>
    </Popover>
    <Box sx={{ maxHeight: 500, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
      {policiesQ.isLoading ? <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} /></Box> : <Table size="small" stickyHeader sx={{ minWidth: 920 }}>
        <TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Πελάτης</TableCell><TableCell>Κλάδος / κατάσταση</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Συνεργάτης</TableCell><TableCell align="right">Προβολή</TableCell></TableRow></TableHead>
        <TableBody>{rows.map(row => <TableRow key={row.id} hover onClick={() => setSelectedPolicyId(row.id)} sx={{ cursor: "pointer" }}>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.policyNumber || "—"}</TableCell><TableCell>{row.customerDisplay || "—"}</TableCell><TableCell><Stack spacing={.25}><Typography variant="body2">{policyTypeLabel(row.policyType || "") || "—"}</Typography><Chip size="small" label={policyStatusLabel(row.status)} /></Stack></TableCell><TableCell>{date(row.startDate)}</TableCell><TableCell>{date(row.endDate)}</TableCell><TableCell align="right">{money(row.premium)}</TableCell><TableCell>{row.producerName || "Έδρα"}</TableCell><TableCell align="right"><IconButton size="small" aria-label="Προβολή συμβολαίου" onClick={event => { event.stopPropagation(); setSelectedPolicyId(row.id); }}><VisibilityIcon fontSize="small" /></IconButton></TableCell>
        </TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>{policiesQ.isError ? "Δεν φορτώθηκαν τα συμβόλαια." : "Δεν βρέθηκαν συμβόλαια με τα συγκεκριμένα φίλτρα."}</Typography></TableCell></TableRow>}</TableBody>
      </Table>}
    </Box>
    <PolicyDetailDrawer policyId={selectedPolicyId} open={!!selectedPolicyId} presentation="modal" onClose={() => setSelectedPolicyId(null)} />
  </ProfileSection>;
}

const POLICY_STATUS_LABELS: Record<string, string> = {
  Prospect: "Πιθανό συμβόλαιο",
  Draft: "Πρόχειρο",
  Active: "Ενεργό",
  Expired: "Ληγμένο",
  Cancelled: "Ακυρωμένο",
  Renewed: "Ανανεωμένο",
  PendingRenewal: "Προς ανανέωση",
  Undelivered: "Απαράδοτο",
  AwaitingIssue: "Προς έκδοση",
  ActiveProspect: "Ενεργός πιθανός πελάτης",
};
const POLICY_TYPE_LABELS: Record<string, string> = {
  Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπά",
};
const policyStatusLabel = (status: string) => POLICY_STATUS_LABELS[status] ?? status;
const policyTypeLabel = (type: string) => POLICY_TYPE_LABELS[type] ?? type;
const isActivePolicyStatus = (status: string) => ["Active", "Ενεργό", "Ενεργη", "Ενεργό συμβόλαιο"].includes(status);

function CompanyStatisticsSection({ companyId, profile }: { companyId: string; profile: CarrierProfile }) {
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const policiesQ = useQuery({
    queryKey: ["production-company-statistics-policies", companyId],
    queryFn: async () => (await api.get<CompanyPolicyRow[]>("/policies", { params: { insuranceCompanyId: companyId } })).data,
  });

  const allRows = policiesQ.data ?? [];
  const statuses = useMemo(() => [...new Set(allRows.map(row => row.status).filter(Boolean))].sort(), [allRows]);
  const types = useMemo(() => [...new Set(allRows.map(row => row.policyType).filter(Boolean))].sort(), [allRows]);
  const filteredRows = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
    return allRows.filter(row => {
      if (status !== "all" && row.status !== status) return false;
      if (type !== "all" && row.policyType !== type) return false;
      const start = new Date(row.startDate).getTime();
      if (from !== null && (!Number.isFinite(start) || start < from)) return false;
      if (to !== null && (!Number.isFinite(start) || start > to)) return false;
      return true;
    });
  }, [allRows, fromDate, status, toDate, type]);

  const stats = useMemo(() => {
    const gross = filteredRows.reduce((sum, row) => sum + Number(row.premium || 0), 0);
    const net = filteredRows.reduce((sum, row) => sum + Number(row.netPremium || 0), 0);
    const active = filteredRows.filter(row => isActivePolicyStatus(row.status)).length;
    const avg = filteredRows.length ? gross / filteredRows.length : 0;
    const commissionValues = filteredRows.map(row => Number(row.specialCommissionPercent || 0)).filter(value => Number.isFinite(value));
    const averageCommission = commissionValues.length ? commissionValues.reduce((sum, value) => sum + value, 0) / commissionValues.length : 0;
    return { gross, net, active, avg, averageCommission };
  }, [filteredRows]);

  const monthly = useMemo(() => {
    const grouped = new Map<string, { label: string; sort: number; policies: number; gross: number; net: number }>();
    for (const row of filteredRows) {
      const parsed = new Date(row.startDate);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      const existing = grouped.get(key) ?? { label: parsed.toLocaleDateString("el-GR", { month: "short", year: "2-digit" }), sort: parsed.getTime(), policies: 0, gross: 0, net: 0 };
      existing.policies += 1;
      existing.gross += Number(row.premium || 0);
      existing.net += Number(row.netPremium || 0);
      grouped.set(key, existing);
    }
    return [...grouped.values()].sort((a, b) => a.sort - b.sort);
  }, [filteredRows]);

  const statusData = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of filteredRows) {
      const label = policyStatusLabel(row.status || "Χωρίς κατάσταση");
      grouped.set(label, (grouped.get(label) ?? 0) + 1);
    }
    return [...grouped.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  const typeData = useMemo(() => {
    const grouped = new Map<string, { name: string; policies: number; gross: number }>();
    for (const row of filteredRows) {
      const name = policyTypeLabel(row.policyType || "Χωρίς κλάδο");
      const current = grouped.get(name) ?? { name, policies: 0, gross: 0 };
      current.policies += 1;
      current.gross += Number(row.premium || 0);
      grouped.set(name, current);
    }
    return [...grouped.values()].sort((a, b) => b.gross - a.gross).slice(0, 10);
  }, [filteredRows]);

  const eur = (value: number) => value.toLocaleString("el-GR", { style: "currency", currency: "EUR" });
  const chartTooltip = (value: unknown, name: unknown): [string, string] => [
    name === "policies" ? String(value ?? "") : eur(Number(value ?? 0)),
    name === "policies" ? "Συμβόλαια" : name === "gross" ? "Μικτά" : "Καθαρά",
  ];
  const clearFilters = () => { setStatus("all"); setType("all"); setFromDate(""); setToDate(""); };
  const filterCount = [status !== "all", type !== "all", fromDate, toDate].filter(Boolean).length;
  const exportCsv = () => {
    const headers = ["Αριθμός συμβολαίου", "Έναρξη", "Λήξη", "Πελάτης", "Κλάδος", "Κατάσταση", "Μικτά ασφάλιστρα", "Καθαρά ασφάλιστρα", "Προμήθεια %"];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = filteredRows.map(row => [row.policyNumber, row.startDate, row.endDate, row.customerDisplay, policyTypeLabel(row.policyType), policyStatusLabel(row.status), row.premium, row.netPremium, row.specialCommissionPercent].map(escape).join(";"));
    const blob = new Blob([`\uFEFF${headers.map(escape).join(";")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `στατιστικά-${companyId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const colors = ["#1976d2", "#43a047", "#f9a825", "#e53935", "#8e24aa", "#00838f"];

  return <Stack spacing={1.5}>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
      <Button variant="outlined" startIcon={<FilterListIcon />} onClick={event => setFilterAnchor(event.currentTarget)} sx={{ whiteSpace: "nowrap" }}>Λοιπά φίλτρα{filterCount ? ` (${filterCount})` : ""}</Button>
      <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!filteredRows.length} sx={{ whiteSpace: "nowrap" }}>Εξαγωγή CSV</Button>
    </Stack>
    <Popover open={!!filterAnchor} anchorEl={filterAnchor} onClose={() => setFilterAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
      <Stack spacing={1.25} sx={{ p: 1.75, width: { xs: 280, sm: 360 } }}>
        <Typography fontWeight={800}>Φίλτρα στατιστικών</Typography>
        <TextField select size="small" label="Κατάσταση" value={status} onChange={event => setStatus(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλες</option>{statuses.map(option => <option key={option} value={option}>{policyStatusLabel(option)}</option>)}</TextField>
        <TextField select size="small" label="Κλάδος / τύπος" value={type} onChange={event => setType(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλοι</option>{types.map(option => <option key={option} value={option}>{policyTypeLabel(option)}</option>)}</TextField>
        <Stack direction="row" spacing={1}><TextField type="date" size="small" label="Από έναρξη" value={fromDate} onChange={event => setFromDate(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth /><TextField type="date" size="small" label="Έως έναρξη" value={toDate} onChange={event => setToDate(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth /></Stack>
        <Button color="error" variant="outlined" onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
      </Stack>
    </Popover>
    <ProfileMetricGrid items={[
      ["Συμβόλαια", `${filteredRows.length} / ${allRows.length}`, "info"],
      ["Ενεργά", String(stats.active), "success"],
      ["Μικτά ασφάλιστρα", eur(stats.gross), "info"],
      ["Καθαρά ασφάλιστρα", eur(stats.net), "info"],
      ["Μέσο ασφάλιστρο", eur(stats.avg), "info"],
      ["Μέση προμήθεια", `${stats.averageCommission.toLocaleString("el-GR", { maximumFractionDigits: 2 })}%`, "success"],
      ["Ζημιές", `${profile.totalClaims} (${profile.openClaims} ανοιχτές)`, profile.openClaims ? "warning" : "success"],
      ["Κανόνες προμήθειας", String(profile.commissionRuleCount), "info"],
      ["Παραμετρικά", `${profile.branchCount} κλάδοι · ${profile.packageCount} πακέτα`, "info"],
    ]} />
    {policiesQ.isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress /></Box>}
    {policiesQ.isError && <Alert severity="error">Δεν φορτώθηκαν τα δεδομένα συμβολαίων για τα στατιστικά.</Alert>}
    {!policiesQ.isLoading && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, gap: 1.5 }}>
      <Card variant="outlined" sx={{ p: 1.5 }}><Typography fontWeight={800} sx={{ mb: 1 }}>Παραγωγή ανά μήνα</Typography><Box sx={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={value => `${value}`} /><RechartsTooltip formatter={chartTooltip} /><Legend formatter={value => value === "gross" ? "Μικτά" : value === "net" ? "Καθαρά" : "Συμβόλαια"} /><Line type="monotone" dataKey="gross" stroke="#1976d2" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="net" stroke="#43a047" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></Box></Card>
      <Card variant="outlined" sx={{ p: 1.5 }}><Typography fontWeight={800} sx={{ mb: 1 }}>Κατανομή κατάστασης</Typography><Box sx={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>{statusData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart></ResponsiveContainer></Box></Card>
      <Card variant="outlined" sx={{ p: 1.5 }}><Typography fontWeight={800} sx={{ mb: 1 }}>Πλήθος συμβολαίων ανά μήνα</Typography><Box sx={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><RechartsTooltip /><Bar dataKey="policies" name="Συμβόλαια" fill="#0b4f92" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></Box></Card>
      <Card variant="outlined" sx={{ p: 1.5 }}><Typography fontWeight={800} sx={{ mb: 1 }}>Παραγωγή ανά κλάδο</Typography><Box sx={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={typeData} layout="vertical" margin={{ top: 8, right: 16, left: 28, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={value => `${value}`} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} /><RechartsTooltip formatter={chartTooltip} /><Bar dataKey="gross" name="Μικτά" fill="#43a047" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></Box></Card>
    </Box>}
    {!policiesQ.isLoading && filteredRows.length === 0 && <Alert severity="info">Δεν υπάρχουν συμβόλαια με τα επιλεγμένα φίλτρα.</Alert>}
  </Stack>;
}

function CompanyPartnerCompaniesSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyPartnerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    partnerInsuranceCompanyId: "", relationshipType: "Συνεργαζόμενη ασφαλιστική",
    cooperationCode: "", contactName: "", contactEmail: "", contactPhone: "", notes: "", isActive: true,
  });
  const partnersQ = useQuery({
    queryKey: ["production-company-partners", companyId],
    queryFn: async () => (await api.get<CompanyPartnerRow[]>(`/insurance-companies/${companyId}/partners`)).data,
  });
  const companiesQ = useQuery({
    queryKey: ["insurance-companies", "partner-options"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies")).data,
  });
  const options = useMemo(() => (companiesQ.data ?? [])
    .filter(item => item.isActive && item.id !== companyId && (!item.isBroker || !item.isGlobal))
    .sort((a, b) => a.name.localeCompare(b.name, "el")), [companiesQ.data, companyId]);
  const openEditor = (row?: CompanyPartnerRow) => {
    setError(null);
    setEditing(row ?? null);
    setDraft({
      partnerInsuranceCompanyId: row?.partnerInsuranceCompanyId ?? options[0]?.id ?? "",
      relationshipType: row?.relationshipType ?? "Συνεργαζόμενη ασφαλιστική",
      cooperationCode: row?.cooperationCode ?? "", contactName: row?.contactName ?? "",
      contactEmail: row?.contactEmail ?? "", contactPhone: row?.contactPhone ?? "",
      notes: row?.notes ?? "", isActive: row?.isActive ?? true,
    });
    setDialogOpen(true);
  };
  const save = async () => {
    if (!draft.partnerInsuranceCompanyId) return;
    setSaving(true); setError(null);
    try {
      const body = { ...draft, cooperationCode: draft.cooperationCode.trim() || null,
        contactName: draft.contactName.trim() || null, contactEmail: draft.contactEmail.trim() || null,
        contactPhone: draft.contactPhone.trim() || null, notes: draft.notes.trim() || null };
      if (editing) await api.put(`/insurance-companies/${companyId}/partners/${editing.id}`, body);
      else await api.post(`/insurance-companies/${companyId}/partners`, body);
      setDialogOpen(false);
      await qc.invalidateQueries({ queryKey: ["production-company-partners", companyId] });
    } catch (e) { setError(extractErrorMessage(e)); }
    finally { setSaving(false); }
  };
  const remove = async (row: CompanyPartnerRow) => {
    if (!window.confirm(`Αφαίρεση της «${row.partnerName}» από τις συνεργασίες του πρακτορείου;`)) return;
    try { await api.delete(`/insurance-companies/${companyId}/partners/${row.id}`); await qc.invalidateQueries({ queryKey: ["production-company-partners", companyId] }); }
    catch (e) { setError(extractErrorMessage(e)); }
  };
  const rows = partnersQ.data ?? [];
  return <ProfileSection title="Συνεργαζόμενες ασφαλιστικές και υποεταιρείες">
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1 }}>
      <Typography variant="body2" color="text.secondary">Καταχωρήστε όλες τις εταιρείες, τα δίκτυα και τις υποεταιρείες με τις οποίες συνεργάζεται το πρακτορείο.</Typography>
      <Button size="small" variant="contained" color="primary" startIcon={<HandshakeIcon />} onClick={() => openEditor()} sx={{ flexShrink: 0 }}>Προσθήκη συνεργασίας</Button>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>{error}</Alert>}
    {partnersQ.isLoading ? <CircularProgress size={22} /> : rows.length === 0 ? <Alert severity="info">Δεν έχουν καταχωρηθεί συνεργαζόμενες εταιρείες ακόμη.</Alert> : <Box sx={{ overflowX: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
      <Table size="small" sx={{ minWidth: 760 }}><TableHead><TableRow><TableCell>Εταιρεία / υποεταιρεία</TableCell><TableCell>Τύπος σχέσης</TableCell><TableCell>Κωδικός συνεργασίας</TableCell><TableCell>Επικοινωνία</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead><TableBody>
        {rows.map(row => <TableRow key={row.id} hover><TableCell><Typography fontWeight={800}>{row.partnerName}</Typography><Typography variant="caption" color="text.secondary">{row.partnerCode}{row.partnerIsBroker ? " · Πρακτορείο / δίκτυο" : " · Ασφαλιστική εταιρεία"}</Typography></TableCell><TableCell>{row.relationshipType}</TableCell><TableCell sx={{ fontFamily: "monospace" }}>{row.cooperationCode || "—"}</TableCell><TableCell><Typography variant="body2">{row.contactName || "—"}</Typography><Typography variant="caption" color="text.secondary">{row.contactEmail || row.contactPhone || "—"}</Typography></TableCell><TableCell><Chip size="small" color={row.isActive ? "success" : "default"} label={row.isActive ? "Ενεργή" : "Ανενεργή"} /></TableCell><TableCell align="right"><Stack direction="row" spacing={.5} justifyContent="flex-end"><IconButton size="small" color="primary" title="Επεξεργασία συνεργασίας" onClick={() => openEditor(row)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" title="Αφαίρεση συνεργασίας" onClick={() => void remove(row)}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack></TableCell></TableRow>)}
      </TableBody></Table>
    </Box>}
    <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md"><DialogTitle>{editing ? "Επεξεργασία συνεργασίας" : "Προσθήκη συνεργαζόμενης εταιρείας"}</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}>
      <TextField select fullWidth size="small" label="Εταιρεία / υποεταιρεία" value={draft.partnerInsuranceCompanyId} onChange={event => setDraft(current => ({ ...current, partnerInsuranceCompanyId: event.target.value }))} SelectProps={{ native: true }} disabled={!!editing || companiesQ.isLoading}><option value="">Επιλέξτε εταιρεία</option>{options.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}{item.isBroker ? " · πρακτορείο" : ""}</option>)}</TextField>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}><TextField select size="small" label="Τύπος σχέσης" value={draft.relationshipType} onChange={event => setDraft(current => ({ ...current, relationshipType: event.target.value }))} SelectProps={{ native: true }}><option>Συνεργαζόμενη ασφαλιστική</option><option>Υποεταιρεία / θυγατρική</option><option>Δίκτυο / διαχειριστής χαρτοφυλακίου</option><option>Πρακτορείο / broker</option><option>Άλλη επιχειρηματική συνεργασία</option></TextField><TextField size="small" label="Κωδικός συνεργασίας" value={draft.cooperationCode} onChange={event => setDraft(current => ({ ...current, cooperationCode: event.target.value }))} /><TextField size="small" label="Υπεύθυνος επικοινωνίας" value={draft.contactName} onChange={event => setDraft(current => ({ ...current, contactName: event.target.value }))} /><TextField size="small" type="email" label="Email συνεργασίας" value={draft.contactEmail} onChange={event => setDraft(current => ({ ...current, contactEmail: event.target.value }))} /><TextField size="small" label="Τηλέφωνο συνεργασίας" value={draft.contactPhone} onChange={event => setDraft(current => ({ ...current, contactPhone: event.target.value }))} /><FormControlLabel control={<Switch checked={draft.isActive} onChange={event => setDraft(current => ({ ...current, isActive: event.target.checked }))} />} label={draft.isActive ? "Ενεργή συνεργασία" : "Ανενεργή συνεργασία"} /></Box><TextField fullWidth multiline minRows={3} size="small" label="Σημειώσεις και όροι συνεργασίας" value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} />
    </Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setDialogOpen(false)} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={() => void save()} disabled={saving || !draft.partnerInsuranceCompanyId} sx={{ color: "#fff" }}>{saving ? "Αποθήκευση…" : "Αποθήκευση συνεργασίας"}</Button></DialogActions></Dialog>
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
    <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>{Object.entries(groups).map(([name, count]) => <Chip key={name} size="small" variant="outlined" label={`${COMPANY_PARAMETER_KIND_LABEL[name as CompanyParameterKind] ?? name}: ${count}`} />)}<Chip size="small" color="info" label={`${rows.length} εγγραφές εμφανίζονται`} /></Stack>
    <Box sx={{ maxHeight: 500, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
      {paramsQ.isLoading ? <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} /></Box> : <Table size="small" stickyHeader sx={{ minWidth: 900 }}>
        <TableHead><TableRow><TableCell>Κατηγορία</TableCell><TableCell>Κωδικός</TableCell><TableCell>Ονομασία</TableCell><TableCell>Κλάδος</TableCell><TableCell>Γονέας</TableCell><TableCell>Γέφυρα</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Ενέργεια</TableCell></TableRow></TableHead>
        <TableBody>{rows.map(row => <TableRow key={row.id} hover><TableCell><Chip size="small" variant="outlined" label={COMPANY_PARAMETER_KIND_LABEL[row.kind] ?? row.kind} /></TableCell><TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.policyType || "—"}{row.vehicleUseCategory ? ` · ${row.vehicleUseCategory}` : ""}</TableCell><TableCell>{row.parentCode || "—"}</TableCell><TableCell>{row.bridgeSystem || row.bridgeCode ? `${row.bridgeSystem ?? ""} ${row.bridgeCode ?? ""}`.trim() : "—"}</TableCell><TableCell><Chip size="small" color={row.isActive ? "success" : "default"} label={row.isActive ? "Ενεργό" : "Ανενεργό"} /></TableCell><TableCell align="right"><Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(row)}>Επεξεργασία</Button></TableCell></TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>Δεν βρέθηκαν παραμετρικά.</Typography></TableCell></TableRow>}</TableBody>
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

type CompanyEditorForm = {
  name: string; code: string; country: string | null; website: string | null; isActive: boolean;
  isBroker: boolean;
  agentCode: string | null; contactName: string | null; contactEmail: string | null;
  contactPhone: string | null; afmVat: string | null; notes: string | null;
  address: string | null; city: string | null; postalCode: string | null;
  facebook: string | null; instagram: string | null; linkedin: string | null;
  twitter: string | null; googleMaps: string | null;
  createBridge: boolean; bridgeName: string | null; bridgeAutoSync: boolean; bridgeConfigJson: string | null;
  installZeroCommissionDefaults: boolean;
};

const blankCompanyEditorForm = (): CompanyEditorForm => ({
  name: "", code: "", country: "", website: null, isActive: true, isBroker: false,
  agentCode: null, contactName: null, contactEmail: null, contactPhone: null,
  afmVat: null, notes: null, address: null, city: null, postalCode: null,
  facebook: null, instagram: null, linkedin: null, twitter: null, googleMaps: null,
  createBridge: false, bridgeName: null,
  bridgeAutoSync: false, bridgeConfigJson: null, installZeroCommissionDefaults: false,
});

// The API intentionally rejects unmapped JSON properties.  The editor also
// holds workspace-only fields (address/social links), so never spread the
// complete form into the carrier endpoint.  Keep this payload in one place so
// create, edit and inline profile edit cannot drift apart again.
const toCompanyApiPayload = (form: CompanyEditorForm, options?: {
  createBridge?: boolean;
  bridgeName?: string | null;
  bridgeAutoSync?: boolean;
  bridgeConfigJson?: string | null;
  installZeroCommissionDefaults?: boolean;
}) => {
  const createBridge = options?.createBridge ?? Boolean(form.createBridge);
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    country: form.country?.trim() || null,
    website: form.website?.trim() || null,
    isActive: Boolean(form.isActive),
    isBroker: Boolean(form.isBroker),
    agentCode: form.agentCode?.trim() || null,
    contactName: form.contactName?.trim() || null,
    contactEmail: form.contactEmail?.trim() || null,
    contactPhone: form.contactPhone?.trim() || null,
    afmVat: form.afmVat?.trim() || null,
    notes: form.notes?.trim() || null,
    createBridge,
    bridgeName: createBridge ? (options?.bridgeName ?? form.bridgeName)?.trim() || null : null,
    bridgeAutoSync: createBridge ? (options?.bridgeAutoSync ?? Boolean(form.bridgeAutoSync)) : false,
    bridgeConfigJson: createBridge ? (options?.bridgeConfigJson ?? form.bridgeConfigJson)?.trim() || null : null,
    installZeroCommissionDefaults: options?.installZeroCommissionDefaults ?? Boolean(form.installZeroCommissionDefaults),
  };
};

/**
 * Fast first entry: only the two identity fields are required.  Once saved,
 * the normal profile opens so the operator can use the full editor without
 * forcing a long form on the very first step.
 */
function ProductionCompanyQuickCreateDialog({ open, isBroker = false, onClose, onSaved }: {
  open: boolean;
  isBroker?: boolean;
  onClose: () => void;
  onSaved: (saved?: CompanyDto) => void;
}) {
  const [form, setForm] = useState({ name: "", code: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setForm({ name: "", code: "" });
      setError(null);
    }
  }, [open]);
  const save = useMutation({
    mutationFn: async () => {
      const draft = { ...blankCompanyEditorForm(), name: form.name, code: form.code, isBroker };
      const payload = toCompanyApiPayload(draft, {
        createBridge: false,
        installZeroCommissionDefaults: false,
      });
      return (await api.post<CompanyDto>("/insurance-companies", payload)).data;
    },
    onSuccess: saved => onSaved(saved),
    onError: error => setError(extractErrorMessage(error)),
  });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle><Stack direction="row" spacing={1} alignItems="center"><BusinessIcon color="primary" /><Box><Typography variant="h6" fontWeight={850}>{isBroker ? "Νέο πρακτορείο" : "Νέα ασφαλιστική"}</Typography><Typography variant="body2" color="text.secondary">Καταχωρήστε μόνο τα βασικά στοιχεία. Τα υπόλοιπα συμπληρώνονται μετά από την «Επεξεργασία».</Typography></Box></Stack></DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      <Stack spacing={1.5} sx={{ pt: .5 }}>
        <TextField autoFocus required fullWidth label="Επωνυμία ασφαλιστικής" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
        <TextField required fullWidth label="Κωδικός εταιρείας" value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))} helperText="Ο κωδικός χρησιμοποιείται στις γέφυρες και στα αρχεία παραγωγής." />
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 2.5, py: 1.5 }}>
      <Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={onClose} sx={{ color: "#fff", fontWeight: 800 }}>Ακύρωση</Button>
      <Button color="success" variant="contained" startIcon={save.isPending ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} disabled={save.isPending || !form.name.trim() || !form.code.trim()} onClick={() => save.mutate()} sx={{ color: "#fff", fontWeight: 800 }}>{save.isPending ? "Αποθήκευση…" : "Δημιουργία"}</Button>
    </DialogActions>
  </Dialog>;
}

/**
 * Fast first entry for a new agency office. Keep the first step deliberately
 * small, matching the insurance-company flow; the saved office then opens in
 * its full profile where all address, contact, status and notes fields can be
 * completed.
 */
function ProductionOfficeQuickCreateDialog({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: (saved?: OfficeDto) => void;
}) {
  const [form, setForm] = useState({ name: "", code: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setForm({ name: "", code: "" });
      setError(null);
    }
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        city: null,
        address: null,
        postalCode: null,
        phone: null,
        email: null,
        isHeadquarters: false,
        isActive: true,
        notes: null,
      };
      return (await api.post<OfficeDto>("/agency-offices", body)).data;
    },
    onSuccess: saved => onSaved(saved),
    onError: error => setError(extractErrorMessage(error)),
  });

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>
      <Stack direction="row" spacing={1} alignItems="center">
        <HomeWorkIcon color="primary" />
        <Box>
          <Typography variant="h6" fontWeight={850}>Νέο πρακτορείο</Typography>
          <Typography variant="body2" color="text.secondary">
            Καταχωρήστε μόνο τα βασικά στοιχεία. Τα υπόλοιπα συμπληρώνονται από την πλήρη καρτέλα.
          </Typography>
        </Box>
      </Stack>
    </DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      <Stack spacing={1.5} sx={{ pt: .5 }}>
        <TextField
          autoFocus required fullWidth label="Όνομα πρακτορείου"
          value={form.name}
          onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
        />
        <TextField
          required fullWidth label="Κωδικός πρακτορείου"
          value={form.code}
          onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))}
          helperText="Ο κωδικός χρησιμοποιείται στις λίστες και στις εσωτερικές αναφορές."
        />
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 2.5, py: 1.5 }}>
      <Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={onClose} sx={{ color: "#fff", fontWeight: 800 }}>
        Ακύρωση
      </Button>
      <Button
        color="success" variant="contained"
        startIcon={save.isPending ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
        disabled={save.isPending || !form.name.trim() || !form.code.trim()}
        onClick={() => save.mutate()}
        sx={{ color: "#fff", fontWeight: 800 }}
      >
        {save.isPending ? "Αποθήκευση…" : "Δημιουργία"}
      </Button>
    </DialogActions>
  </Dialog>;
}

const PROFILE_TAB_LABELS = [
  { label: "Σύνοψη", icon: <InfoOutlinedIcon fontSize="small" /> },
  { label: "Παραγωγή & συμβόλαια", icon: <DescriptionIcon fontSize="small" /> },
  { label: "Σύνδεση & παραμετρικά", icon: <TuneIcon fontSize="small" /> },
  { label: "Επικοινωνία", icon: <ContactPhoneIcon fontSize="small" /> },
  { label: "Έγγραφα & πεδία", icon: <FolderIcon fontSize="small" /> },
];

function WorkspaceProfileTabs({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <Tabs value={value} onChange={(_, next: number) => onChange(next)} variant="standard" sx={{
    position: "sticky", top: 0, zIndex: 4, mb: 2, px: .5, py: .5,
    border: "1px solid", borderColor: "divider", borderRadius: 2,
    bgcolor: "background.paper", boxShadow: "0 3px 10px rgba(15,23,42,.12)",
    overflow: "visible", "& .MuiTabs-scroller": { overflow: "visible !important" },
    "& .MuiTabs-flexContainer": { gap: .75, flexWrap: "wrap" },
    "& .MuiTabs-indicator": { display: "none" },
    "& .MuiTab-root": {
      minHeight: 54, minWidth: { xs: 132, md: 168 }, px: 1.5, py: .75,
      border: "1px solid #263238", borderRadius: 1.5,
      background: "linear-gradient(180deg, #e5e7eb 0%, #b8c0c8 100%) !important",
      color: "#111827 !important", borderColor: "#263238 !important", opacity: "1 !important", textTransform: "none", fontWeight: 750,
      transition: "background .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease",
      "&:hover": { background: "linear-gradient(180deg, #d4d8de 0%, #9ca6b1 100%) !important", color: "#0b2545 !important", borderColor: "#111827 !important", transform: "none" },
      "&.Mui-selected": { background: "linear-gradient(135deg, #0b5cad 0%, #063b73 100%) !important", color: "#fff !important", borderColor: "#062f63 !important", boxShadow: "0 3px 8px rgba(6,47,99,.35)" },
    },
  }}>{PROFILE_TAB_LABELS.map(item => <Tab key={item.label} icon={item.icon} iconPosition="start" label={item.label} />)}</Tabs>;
}

function ProductionCompanyEditorDialog({ open, item, onClose, onSaved }: {
  open: boolean; item: CompanyDto | null; onClose: () => void; onSaved: (saved?: CompanyDto) => void;
}) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<CompanyEditorForm>(blankCompanyEditorForm);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    setTab(0);
    setError(null);
    setLogoFile(null);
    if (item) setForm({ ...blankCompanyEditorForm(), name: item.name, code: item.code, country: item.country, website: item.website, isActive: item.isActive, isBroker: Boolean(item.isBroker), agentCode: item.agentCode, contactName: item.contactName, contactEmail: item.contactEmail, contactPhone: item.contactPhone, afmVat: item.afmVat, notes: item.notes });
    else if (open) setForm(blankCompanyEditorForm());
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = toCompanyApiPayload(form);
      if (item) {
        const saved = (await api.put<CompanyDto>(`/insurance-companies/${item.id}`, body)).data;
        if (logoFile) {
          if (logoFile.size > 4_000_000) throw new Error("Το λογότυπο δεν μπορεί να ξεπερνά τα 4 MB.");
          const logoData = new FormData();
          logoData.append("file", logoFile);
          await api.post(`/insurance-companies/${item.id}/logo`, logoData, { headers: { "Content-Type": "multipart/form-data" } });
        }
        return saved;
      }
      const created = (await api.post<CompanyDto>("/insurance-companies", body)).data;
      if (logoFile) {
        if (logoFile.size > 4_000_000) throw new Error("Το λογότυπο δεν μπορεί να ξεπερνά τα 4 MB.");
        const logoData = new FormData();
        logoData.append("file", logoFile);
        await api.post(`/insurance-companies/${created.id}/logo`, logoData, { headers: { "Content-Type": "multipart/form-data" } });
      }
      const extraFields = [
        ["address", "Διεύθυνση", form.address], ["city", "Πόλη", form.city], ["postal-code", "Τ.Κ.", form.postalCode],
        ["facebook", "Facebook", form.facebook], ["instagram", "Instagram", form.instagram], ["linkedin", "LinkedIn", form.linkedin],
        ["twitter", "X / Twitter", form.twitter], ["google-maps", "Google Maps", form.googleMaps],
      ] as const;
      for (const [key, label, value] of extraFields) {
        if (!value?.trim()) continue;
        const field = (await api.post<CompanyWorkspaceField>(`/insurance-companies/${created.id}/workspace/fields`, { label, key, fieldType: key.includes("facebook") || key.includes("instagram") || key.includes("linkedin") || key.includes("twitter") || key.includes("maps") ? "url" : "text", options: [], isRequired: false, sortOrder: 0 })).data;
        await api.put(`/insurance-companies/${created.id}/workspace/fields/${field.id}/value`, { value: value.trim() });
      }
      return created;
    },
    onSuccess: saved => onSaved(saved as CompanyDto),
    onError: e => setError(extractErrorMessage(e)),
  });
  const update = (patch: Partial<CompanyEditorForm>) => setForm(current => ({ ...current, ...patch }));

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
    <DialogTitle sx={{ pr: 6 }}><Stack direction="row" alignItems="center" spacing={1.25}><BusinessIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{item ? "Επεξεργασία ασφαλιστικής εταιρείας" : "Νέα ασφαλιστική εταιρεία"}</Typography><Typography variant="body2" color="text.secondary">Η ίδια πλήρης καρτέλα χρησιμοποιείται για δημιουργία και επεξεργασία.</Typography></Box></Stack></DialogTitle>
    <DialogContent dividers sx={{ pt: 0, maxHeight: "75vh", overflowY: "auto" }}>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      <WorkspaceProfileTabs value={tab} onChange={setTab} />
      {tab === 0 && <Stack spacing={1.5}>
        <ProfileSection title="Λογότυπο εταιρείας"><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Button component="label" size="small" variant="outlined" color="primary" startIcon={<CloudUploadIcon />}>{logoFile ? logoFile.name : "Επιλογή λογοτύπου"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0] ?? null; if (file && file.size > 4_000_000) { setError("Το λογότυπο δεν μπορεί να ξεπερνά τα 4 MB."); setLogoFile(null); } else { setError(null); setLogoFile(file); } event.currentTarget.value = ""; }} /></Button><Typography variant="caption" color="text.secondary">PNG, JPG ή WEBP · προαιρετικό</Typography></Stack></ProfileSection>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}>
          <ProfileSection title="Ταυτότητα εταιρείας"><TextField fullWidth required label="Κωδικός" value={form.code} onChange={e => update({ code: e.target.value.toUpperCase() })} /><TextField fullWidth required label="Επωνυμία" value={form.name} onChange={e => update({ name: e.target.value })} sx={{ mt: 1.25 }} /><TextField fullWidth label="Χώρα" value={form.country ?? ""} onChange={e => update({ country: e.target.value })} sx={{ mt: 1.25 }} /></ProfileSection>
          <ProfileSection title="Διεύθυνση & στοιχεία"><TextField fullWidth label="ΑΦΜ / VAT" value={form.afmVat ?? ""} onChange={e => update({ afmVat: e.target.value })} /><TextField fullWidth label="Διεύθυνση" value={form.address ?? ""} onChange={e => update({ address: e.target.value })} sx={{ mt: 1.25 }} /><Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, mt: 1.25 }}><TextField fullWidth label="Πόλη" value={form.city ?? ""} onChange={e => update({ city: e.target.value })} /><TextField fullWidth label="Τ.Κ." value={form.postalCode ?? ""} onChange={e => update({ postalCode: e.target.value })} /></Box><TextField fullWidth label="Website" value={form.website ?? ""} onChange={e => update({ website: e.target.value })} sx={{ mt: 1.25 }} /><TextField fullWidth label="Κωδικός συνεργασίας" value={form.agentCode ?? ""} onChange={e => update({ agentCode: e.target.value })} sx={{ mt: 1.25 }} /></ProfileSection>
          <ProfileSection title="Κατάσταση"><FormControlLabel control={<Switch checked={form.isActive} onChange={e => update({ isActive: e.target.checked })} />} label={form.isActive ? "Ενεργή" : "Ανενεργή"} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Η εταιρεία θα εμφανίζεται στις λίστες παραγωγής και στις νέες καταχωρήσεις.</Typography></ProfileSection>
        </Box>
        <ProfileSection title="Επικοινωνία"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}><TextField label="Ονοματεπώνυμο επαφής" value={form.contactName ?? ""} onChange={e => update({ contactName: e.target.value })} /><TextField label="Email" type="email" value={form.contactEmail ?? ""} onChange={e => update({ contactEmail: e.target.value })} /><TextField label="Τηλέφωνο" value={form.contactPhone ?? ""} onChange={e => update({ contactPhone: e.target.value })} /></Box></ProfileSection>
        <ProfileSection title="Ιστοσελίδα & ψηφιακή παρουσία"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.25 }}><TextField label="Facebook" value={form.facebook ?? ""} onChange={e => update({ facebook: e.target.value })} /><TextField label="Instagram" value={form.instagram ?? ""} onChange={e => update({ instagram: e.target.value })} /><TextField label="LinkedIn" value={form.linkedin ?? ""} onChange={e => update({ linkedin: e.target.value })} /><TextField label="X / Twitter" value={form.twitter ?? ""} onChange={e => update({ twitter: e.target.value })} /><TextField label="Google Maps" value={form.googleMaps ?? ""} onChange={e => update({ googleMaps: e.target.value })} /></Box></ProfileSection>
        <ProfileSection title="Σύνδεση και γέφυρα"><FormControlLabel control={<Switch checked={form.createBridge} onChange={e => update({ createBridge: e.target.checked })} />} label="Δημιουργία γέφυρας εταιρείας" />{form.createBridge && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5, mt: 1 }}><TextField label="Όνομα γέφυρας" value={form.bridgeName ?? ""} onChange={e => update({ bridgeName: e.target.value })} /><FormControlLabel control={<Switch checked={form.bridgeAutoSync} onChange={e => update({ bridgeAutoSync: e.target.checked })} />} label="Αυτόματος συγχρονισμός" /><TextField label="Ρυθμίσεις γέφυρας (JSON)" value={form.bridgeConfigJson ?? ""} onChange={e => update({ bridgeConfigJson: e.target.value })} multiline minRows={3} sx={{ gridColumn: { md: "1 / -1" } }} /></Box>}</ProfileSection>
        <ProfileSection title="Παραγωγή και προμήθειες"><FormControlLabel control={<Switch checked={form.installZeroCommissionDefaults} onChange={e => update({ installZeroCommissionDefaults: e.target.checked })} />} label="Προσθήκη αρχικών κανόνων προμήθειας" /><TextField fullWidth label="Κωδικός συνεργασίας / πρακτορείου" value={form.agentCode ?? ""} onChange={e => update({ agentCode: e.target.value })} sx={{ mt: 1 }} /></ProfileSection>
        <ProfileSection title="Σημειώσεις"><TextField fullWidth multiline minRows={4} label="Εσωτερικές σημειώσεις" value={form.notes ?? ""} onChange={e => update({ notes: e.target.value })} /></ProfileSection>
      </Stack>}
      {tab === 1 && <Stack spacing={1.5}><ProfileSection title="Παραγωγή και συμβόλαια"><TextField fullWidth label="Κωδικός συνεργασίας / πρακτορείου" value={form.agentCode ?? ""} onChange={e => update({ agentCode: e.target.value })} /><FormControlLabel sx={{ mt: 1 }} control={<Switch checked={form.installZeroCommissionDefaults} onChange={e => update({ installZeroCommissionDefaults: e.target.checked })} />} label="Προσθήκη αρχικών κανόνων προμήθειας" /><Alert severity="info">Οι κανόνες προμηθειών και τα παραμετρικά μπορούν να συμπληρωθούν από την καρτέλα μετά τη δημιουργία.</Alert></ProfileSection></Stack>}
      {tab === 2 && <Stack spacing={1.5}><ProfileSection title="Σύνδεση εταιρείας και γέφυρα"><FormControlLabel control={<Switch checked={form.createBridge} onChange={e => update({ createBridge: e.target.checked })} />} label="Δημιουργία γέφυρας εταιρείας" />{form.createBridge && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5, mt: 1 }}><TextField label="Όνομα γέφυρας" value={form.bridgeName ?? ""} onChange={e => update({ bridgeName: e.target.value })} /><FormControlLabel control={<Switch checked={form.bridgeAutoSync} onChange={e => update({ bridgeAutoSync: e.target.checked })} />} label="Αυτόματος συγχρονισμός" /><TextField label="Ρυθμίσεις γέφυρας (JSON)" value={form.bridgeConfigJson ?? ""} onChange={e => update({ bridgeConfigJson: e.target.value })} multiline minRows={4} sx={{ gridColumn: { md: "1 / -1" } }} /></Box>}</ProfileSection></Stack>}
      {tab === 3 && <Stack spacing={1.5}><ProfileSection title="Επικοινωνία εταιρείας"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}><TextField label="Ονοματεπώνυμο επαφής" value={form.contactName ?? ""} onChange={e => update({ contactName: e.target.value })} /><TextField label="Email" type="email" value={form.contactEmail ?? ""} onChange={e => update({ contactEmail: e.target.value })} /><TextField label="Τηλέφωνο" value={form.contactPhone ?? ""} onChange={e => update({ contactPhone: e.target.value })} /></Box></ProfileSection></Stack>}
      {tab === 4 && <Stack spacing={1.5}><ProfileSection title="Έγγραφα και προσαρμόσιμα πεδία"><Alert severity="info">Μετά την αποθήκευση ενεργοποιούνται τα έγγραφα, οι φάκελοι και τα προσαρμόσιμα πεδία της εταιρείας.</Alert><Typography color="text.secondary">Η καρτέλα θα ανοίξει αυτόματα μετά τη δημιουργία ώστε να συνεχίσετε με αρχεία, επαφές, παραμετρικά και επικοινωνίες.</Typography></ProfileSection></Stack>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}><Button onClick={onClose} color="error" variant="contained" sx={{ color: "#fff", fontWeight: 800 }}>Ακύρωση επεξεργασίας</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} disabled={save.isPending || !form.name.trim() || !form.code.trim()} onClick={() => save.mutate()}>{save.isPending ? <CircularProgress size={18} color="inherit" /> : item ? "Αποθήκευση αλλαγών" : "Δημιουργία & αποθήκευση"}</Button></DialogActions>
  </Dialog>;
}

function ProductionCompanyProfileDialog({ open, company, startEditing = false, onClose, onChanged }: { open: boolean; company: CompanyDto | null; startEditing?: boolean; onClose: () => void; onChanged?: (saved: CompanyDto) => void }) {
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState<CompanyEditorForm>(blankCompanyEditorForm);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [fieldEntryOpen, setFieldEntryOpen] = useState(false);
  const [newField, setNewField] = useState({ label: "", key: "", fieldType: "text", value: "" });
  const [fieldEdit, setFieldEdit] = useState<{ id: string; label: string; key: string; fieldType: string; value: string } | null>(null);
  const [logoLocalPreview, setLogoLocalPreview] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState({ name: "", role: "", department: "", email: "", phone: "", mobile: "", notes: "", isPrimary: false });
  const q = useQuery({ queryKey: ["production-company-profile", company?.id], enabled: open && !!company, queryFn: async () => (await api.get<CarrierProfile>(`/insurance-companies/${company!.id}/profile`)).data });
  const workspaceQ = useQuery({ queryKey: ["production-company-workspace", company?.id], enabled: open && !!company, queryFn: async () => (await api.get<CompanyWorkspace>(`/insurance-companies/${company!.id}/workspace`)).data });
  const p = q.data;
  const logoQ = useQuery<string | null>({
    queryKey: ["production-company-logo", company?.id, p?.logoUrl],
    enabled: open && !!company && !!p?.logoUrl,
    queryFn: async () => {
      const response = await api.get<Blob>(`/insurance-companies/${company!.id}/logo`, { responseType: "blob" });
      return response.data?.size ? URL.createObjectURL(response.data) : null;
    },
  });
  const qc = useQueryClient();
  const workspace = workspaceQ.data;
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString("el-GR") : "—";
  useEffect(() => {
    setTab(0);
    setEditing(startEditing);
    setInlineError(null);
    setLogoLocalPreview(null);
  }, [company?.id, open, startEditing]);
  useEffect(() => () => {
    if (logoQ.data) URL.revokeObjectURL(logoQ.data);
    if (logoLocalPreview) URL.revokeObjectURL(logoLocalPreview);
  }, [logoQ.data, logoLocalPreview]);
  useEffect(() => {
    if (!p) return;
    setDraft({ ...blankCompanyEditorForm(), name: p.name, code: p.code, country: p.country, website: p.website, isActive: p.isActive, isBroker: Boolean(p.isBroker), agentCode: p.agentCode, contactName: p.contactName, contactEmail: p.contactEmail, contactPhone: p.contactPhone, afmVat: p.afmVat, notes: p.notes });
  }, [p]);
  useEffect(() => {
    if (!workspace) return;
    setFieldDrafts(Object.fromEntries(workspace.fields.map(field => [field.id, field.value ?? ""])));
  }, [workspace]);
  const updateDraft = (patch: Partial<CompanyEditorForm>) => setDraft(current => ({ ...current, ...patch }));
  const save = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Δεν επιλέχθηκε εταιρεία.");
      const body = toCompanyApiPayload(draft, {
        createBridge: false,
        bridgeName: null,
        bridgeAutoSync: false,
        bridgeConfigJson: null,
        installZeroCommissionDefaults: false,
      });
      return (await api.put<CompanyDto>(`/insurance-companies/${company.id}`, body)).data;
    },
    onSuccess: saved => { setEditing(false); setInlineError(null); onChanged?.(saved); void qc.invalidateQueries({ queryKey: ["production-company-profile", company?.id] }); void qc.invalidateQueries({ queryKey: ["production-company-workspace", company?.id] }); },
    onError: error => setInlineError(extractErrorMessage(error)),
  });
  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!company) throw new Error("Δεν επιλέχθηκε εταιρεία.");
      const formData = new FormData();
      formData.append("file", file);
      return (await api.post<{ logoUrl: string | null }>(`/insurance-companies/${company.id}/logo`, formData, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: async () => {
      setLogoLocalPreview(null);
      await qc.invalidateQueries({ queryKey: ["production-company-profile", company?.id] });
      await qc.invalidateQueries({ queryKey: ["production-company-logo", company?.id] });
      await qc.invalidateQueries({ queryKey: ["production-companies-directory"] });
      await qc.invalidateQueries({ queryKey: ["insurance-companies"] });
    },
    onError: error => setInlineError(extractErrorMessage(error)),
  });
  const deleteLogo = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Δεν επιλέχθηκε εταιρεία.");
      await api.delete(`/insurance-companies/${company.id}/logo`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["production-company-profile", company?.id] });
      await qc.invalidateQueries({ queryKey: ["production-company-logo", company?.id] });
      await qc.invalidateQueries({ queryKey: ["production-companies-directory"] });
      await qc.invalidateQueries({ queryKey: ["insurance-companies"] });
    },
    onError: error => setInlineError(extractErrorMessage(error)),
  });
  const handleLogoFile = (file: File) => {
    if (file.size > 4_000_000) {
      setInlineError("Το λογότυπο δεν μπορεί να ξεπερνά τα 4 MB.");
      return;
    }
    setInlineError(null);
    setLogoLocalPreview(URL.createObjectURL(file));
    uploadLogo.mutate(file);
  };
  const saveField = async (fieldId: string) => {
    if (!company) return;
    setSavingFieldId(fieldId);
    try {
      await api.put(`/insurance-companies/${company.id}/workspace/fields/${fieldId}/value`, { value: fieldDrafts[fieldId] ?? "" });
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", company.id] });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    } finally {
      setSavingFieldId(null);
    }
  };
  const openContactEditor = (contact?: CompanyWorkspaceContact) => {
    setEditingContactId(contact?.id ?? null);
    setContactDraft({ name: contact?.name ?? "", role: contact?.role ?? "", department: contact?.department ?? "", email: contact?.email ?? "", phone: contact?.phone ?? "", mobile: contact?.mobile ?? "", notes: contact?.notes ?? "", isPrimary: contact?.isPrimary ?? false });
    setContactDialogOpen(true);
  };
  const saveContact = async () => {
    if (!company || !contactDraft.name.trim()) return;
    try {
      const body = { ...contactDraft, name: contactDraft.name.trim(), role: contactDraft.role.trim() || null, department: contactDraft.department.trim() || null, email: contactDraft.email.trim() || null, phone: contactDraft.phone.trim() || null, mobile: contactDraft.mobile.trim() || null, notes: contactDraft.notes.trim() || null, preferredChannel: "Email" };
      if (editingContactId) await api.put(`/insurance-companies/${company.id}/workspace/contacts/${editingContactId}`, body);
      else await api.post(`/insurance-companies/${company.id}/workspace/contacts`, body);
      setContactDialogOpen(false);
      setEditingContactId(null);
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", company.id] });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    }
  };
  const deleteContact = async (contact: CompanyWorkspaceContact) => {
    if (!company || !window.confirm(`Διαγραφή επαφής «${contact.name}»;`)) return;
    try {
      await api.delete(`/insurance-companies/${company.id}/workspace/contacts/${contact.id}`);
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", company.id] });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    }
  };
  const openFieldCreator = (label: string, key: string) => {
    setNewField({ label: label === "Νέο πεδίο" ? "" : label, key, fieldType: key === "website" || key.includes("facebook") || key.includes("instagram") || key.includes("linkedin") || key.includes("maps") ? "url" : "text", value: "" });
    setFieldEntryOpen(true);
  };
  const fieldKeyForLabel = (label: string, fallback: string) => {
    const slug = label.trim().toLocaleLowerCase("el-GR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
    return slug || `${fallback}-${Date.now()}`;
  };
  const createField = async () => {
    if (!company || !newField.label.trim() || !newField.value.trim()) return;
    try {
      const key = newField.key === "custom-field" ? fieldKeyForLabel(newField.label, "custom-field") : newField.key;
      const created = (await api.post<CompanyWorkspaceField>(`/insurance-companies/${company.id}/workspace/fields`, { label: newField.label.trim(), key, fieldType: newField.fieldType, options: [], isRequired: false, sortOrder: workspace?.fields.length ?? 0 })).data;
      if (newField.value.trim()) await api.put(`/insurance-companies/${company.id}/workspace/fields/${created.id}/value`, { value: newField.value.trim() });
      setFieldDialogOpen(false);
      setFieldEntryOpen(false);
      setNewField({ label: "", key: "", fieldType: "text", value: "" });
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", company.id] });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    }
  };
  const openFieldEditor = (field: CompanyWorkspaceField) => {
    setFieldEdit({ id: field.id, label: field.label, key: field.key, fieldType: field.fieldType, value: field.value ?? "" });
  };
  const updateField = async () => {
    if (!company || !fieldEdit?.label.trim() || !fieldEdit.value.trim()) return;
    try {
      await api.put(`/insurance-companies/${company.id}/workspace/fields/${fieldEdit.id}`, {
        label: fieldEdit.label.trim(), key: fieldEdit.key, fieldType: fieldEdit.fieldType,
        options: [], isRequired: false, sortOrder: workspace?.fields.find(field => field.id === fieldEdit.id)?.sortOrder ?? 0,
      });
      await api.put(`/insurance-companies/${company.id}/workspace/fields/${fieldEdit.id}/value`, { value: fieldEdit.value.trim() });
      setFieldEdit(null);
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", company.id] });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    }
  };
  const deleteField = async (field: CompanyWorkspaceField) => {
    if (!company || !window.confirm(`Διαγραφή του πεδίου «${field.label}»;`)) return;
    try {
      await api.delete(`/insurance-companies/${company.id}/workspace/fields/${field.id}`);
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", company.id] });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    }
  };
  const customField = (...aliases: string[]) => workspace?.fields.find(field => aliases.some(alias => field.key.toLocaleLowerCase("el-GR").includes(alias) || field.label.toLocaleLowerCase("el-GR").includes(alias)));
  const renderCustomField = (label: string, aliases: string[], mono = false) => {
    const field = customField(...aliases);
    if (editing && !field) return <Stack direction="row" spacing={.75} alignItems="center" sx={{ py: .4 }}><ProfileLine label={label} value={null} mono={mono} /><Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => openFieldCreator(label, aliases[0])} sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>Προσθήκη</Button></Stack>;
    if (editing && field) return <Stack direction="row" spacing={.75} alignItems="flex-start" sx={{ py: .4 }}><TextField fullWidth size="small" label={label} value={fieldDrafts[field.id] ?? ""} onChange={event => setFieldDrafts(current => ({ ...current, [field.id]: event.target.value }))} /><Button size="small" variant="outlined" onClick={() => void saveField(field.id)} disabled={savingFieldId === field.id}>{savingFieldId === field.id ? <CircularProgress size={16} /> : "Αποθήκευση"}</Button></Stack>;
    return <ProfileLine label={label} value={field?.value ?? null} mono={mono} link={field?.value && /^https?:\/\//i.test(field.value) ? field.value : undefined} />;
  };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
    <DialogTitle sx={{ pr: 6, "& .MuiButton-containedSuccess": { minWidth: 150, minHeight: 44, px: 2.5, fontSize: ".95rem", fontWeight: 850, color: "#fff", borderRadius: 1.75, background: "linear-gradient(135deg, #43a047 0%, #1b5e20 100%)", boxShadow: "0 3px 8px rgba(46,125,50,.3)", "&:hover": { background: "linear-gradient(135deg, #4caf50 0%, #145214 100%)", color: "#fff", transform: "translateY(-1px)" } } }}><Stack direction="row" alignItems="center" spacing={1.25}><BusinessIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{p?.name ?? company?.name ?? "—"}</Typography><Typography variant="caption" sx={{ fontFamily: "monospace" }}>{p?.code ?? company?.code}</Typography></Box>{company && (editing ? <Stack direction="row" spacing={.75}><Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={() => save.mutate()} disabled={save.isPending || !draft.name.trim() || !draft.code.trim()}>{save.isPending ? <CircularProgress size={18} color="inherit" /> : "Αποθήκευση"}</Button><Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={() => { setEditing(false); setInlineError(null); setDraft({ ...blankCompanyEditorForm(), name: p?.name ?? company.name, code: p?.code ?? company.code, country: p?.country ?? company.country, website: p?.website ?? company.website, isActive: p?.isActive ?? company.isActive, agentCode: p?.agentCode ?? company.agentCode, contactName: p?.contactName ?? company.contactName, contactEmail: p?.contactEmail ?? company.contactEmail, contactPhone: p?.contactPhone ?? company.contactPhone, afmVat: p?.afmVat ?? company.afmVat, notes: p?.notes ?? company.notes }); }}>Ακύρωση</Button></Stack> : <Button variant="contained" size="small" color="success" startIcon={<EditIcon />} onClick={() => setEditing(true)} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, boxShadow: 2, "&:hover": { bgcolor: "success.dark", color: "#fff" } }}>Επεξεργασία</Button>)}</Stack></DialogTitle>
    <DialogContent dividers sx={{
      // Keep the profile surface flush with the dialog edge so its sticky
      // navigation never leaves a gap or gets clipped while scrolling.
      pt: 0,
      scrollbarWidth: "auto",
      scrollbarColor: "#0b2545 #e8eef5",
      "&::-webkit-scrollbar": { width: 14, height: 14 },
      "&::-webkit-scrollbar-track": { background: "#e8eef5", borderRadius: 999 },
      "&::-webkit-scrollbar-thumb": {
        background: "linear-gradient(180deg, #123b67 0%, #0b2545 100%)",
        borderRadius: 999,
        border: "3px solid #e8eef5",
      },
      "&::-webkit-scrollbar-thumb:hover": { background: "#1976d2" },
      "&::-webkit-scrollbar-corner": { background: "#e8eef5" },
      // Apply the same cross-browser treatment to any nested scroll surface
      // (for example the contracts and documents panes).
      "& *": {
        scrollbarWidth: "auto",
        scrollbarColor: "#0b2545 #e8eef5",
      },
      "& *::-webkit-scrollbar": { width: 14, height: 14 },
      "& *::-webkit-scrollbar-track": { background: "#e8eef5", borderRadius: 999 },
      "& *::-webkit-scrollbar-thumb": {
        background: "linear-gradient(180deg, #123b67 0%, #0b2545 100%)",
        borderRadius: 999,
        border: "3px solid #e8eef5",
      },
      "& *::-webkit-scrollbar-thumb:hover": { background: "#1976d2" },
      "& *::-webkit-scrollbar-corner": { background: "#e8eef5" },
    }}>
      {q.isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {q.error && <Alert severity="error">Δεν φορτώθηκαν τα στοιχεία της εταιρείας.</Alert>}
      {inlineError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setInlineError(null)}>{inlineError}</Alert>}
      {p && <>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="standard" sx={{
          position: "sticky",
          // Keep the navigation flush with the dialog's scroll viewport so it
          // remains fully visible while the long company profile is scrolled.
          top: 0,
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
            border: "1px solid #263238",
            borderRadius: 1.5,
            background: "linear-gradient(180deg, #e5e7eb 0%, #b8c0c8 100%) !important",
            color: "#111827 !important",
            borderColor: "#263238 !important",
            opacity: "1 !important",
            textTransform: "none",
            fontWeight: 750,
            fontSize: { xs: ".82rem", md: ".9rem" },
            lineHeight: 1.25,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(15,23,42,.12)",
            transition: "background .18s ease, border-color .18s ease, color .18s ease, box-shadow .18s ease",
            "&:hover": { background: "linear-gradient(180deg, #d4d8de 0%, #9ca6b1 100%) !important", borderColor: "#111827 !important", color: "#0b2545 !important", boxShadow: "inset 0 1px 0 rgba(255,255,255,.65), 0 2px 5px rgba(15,23,42,.22)" },
            "&.Mui-selected": { background: "linear-gradient(135deg, #0b5cad 0%, #063b73 100%) !important", borderColor: "#062f63 !important", color: "#fff !important", boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 3px 8px rgba(6,47,99,.35)" },
            "&.Mui-selected:hover": { background: "linear-gradient(135deg, #084d91 0%, #042b54 100%) !important", color: "#fff !important" },
          },
        }}>
          <Tab icon={<InfoOutlinedIcon fontSize="small" />} iconPosition="start" label="Σύνοψη" /><Tab icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="Παραγωγή & συμβόλαια" /><Tab icon={<TuneIcon fontSize="small" />} iconPosition="start" label="Σύνδεση & παραμετρικά" /><Tab icon={<ContactPhoneIcon fontSize="small" />} iconPosition="start" label="Επικοινωνία" /><Tab icon={<FolderIcon fontSize="small" />} iconPosition="start" label="Έγγραφα & πεδία" /><Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Στατιστικά" />
        </Tabs>
        {tab === 0 && <Stack spacing={1.5}>
          <ProfileSection title="Λογότυπο εταιρείας">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <Avatar src={logoLocalPreview ?? logoQ.data ?? undefined} variant="rounded" sx={{ width: 88, height: 64, bgcolor: "rgba(11,37,69,.06)", border: "1px solid", borderColor: "divider", "& img": { objectFit: "contain", p: .75 } }}>
                <BusinessIcon color="disabled" />
              </Avatar>
              <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap>
                {editing && <Button component="label" size="small" variant="contained" color="primary" startIcon={<CloudUploadIcon />} disabled={uploadLogo.isPending}>
                  {uploadLogo.isPending ? <CircularProgress size={16} color="inherit" /> : "Ανέβασμα λογοτύπου"}
                  <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) handleLogoFile(file); event.currentTarget.value = ""; }} />
                </Button>}
                {editing && p.logoUrl && <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => deleteLogo.mutate()} disabled={deleteLogo.isPending}>Αφαίρεση</Button>}
              </Stack>
              {!editing && !p.logoUrl && <Typography variant="body2" color="text.secondary">Δεν έχει καταχωρηθεί λογότυπο.</Typography>}
            </Stack>
          </ProfileSection>
          <Box sx={{ display: editing ? "none" : "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}><ProfileSection title="Ταυτότητα εταιρείας"><ProfileLine label="ΑΦΜ / VAT" value={p.afmVat} /><ProfileLine label="Χώρα" value={p.country} /><ProfileLine label="Κωδικός συνεργασίας" value={p.agentCode} mono /><ProfileLine label="Website" value={p.website} link={p.website ?? undefined} /></ProfileSection><ProfileSection title="Επαφή & υπεύθυνοι"><ProfileLine label="Υπεύθυνος" value={p.contactName} /><ProfileLine label="Email" value={p.contactEmail} link={p.contactEmail ? `mailto:${p.contactEmail}` : undefined} /><ProfileLine label="Τηλέφωνο" value={p.contactPhone} link={p.contactPhone ? `tel:${p.contactPhone}` : undefined} /></ProfileSection></Box>
          <Box sx={{ display: editing ? "none" : "block" }}><ProfileSection title="Σημειώσεις"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{p.notes || "Δεν έχουν καταχωρηθεί σημειώσεις."}</Typography></ProfileSection></Box>
          {editing && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            <ProfileSection title="Ταυτότητα εταιρείας"><Stack spacing={1}><TextField fullWidth required size="small" label="Επωνυμία" value={draft.name} onChange={event => updateDraft({ name: event.target.value })} /><TextField fullWidth required size="small" label="Κωδικός" value={draft.code} onChange={event => updateDraft({ code: event.target.value.toUpperCase() })} /><TextField fullWidth size="small" label="ΑΦΜ / VAT" value={draft.afmVat ?? ""} onChange={event => updateDraft({ afmVat: event.target.value })} /><TextField fullWidth size="small" label="Χώρα" value={draft.country ?? ""} onChange={event => updateDraft({ country: event.target.value })} /><TextField fullWidth size="small" label="Κωδικός συνεργασίας" value={draft.agentCode ?? ""} onChange={event => updateDraft({ agentCode: event.target.value })} /><TextField fullWidth size="small" label="Website" value={draft.website ?? ""} onChange={event => updateDraft({ website: event.target.value })} /></Stack></ProfileSection>
            <ProfileSection title="Επαφή & υπεύθυνοι"><Stack spacing={1}><TextField fullWidth size="small" label="Ονοματεπώνυμο επαφής" value={draft.contactName ?? ""} onChange={event => updateDraft({ contactName: event.target.value })} /><TextField fullWidth size="small" type="email" label="Email" value={draft.contactEmail ?? ""} onChange={event => updateDraft({ contactEmail: event.target.value })} /><TextField fullWidth size="small" label="Τηλέφωνο" value={draft.contactPhone ?? ""} onChange={event => updateDraft({ contactPhone: event.target.value })} /><FormControlLabel control={<Switch checked={draft.isActive} onChange={event => updateDraft({ isActive: event.target.checked })} />} label={draft.isActive ? "Ενεργή" : "Ανενεργή"} /></Stack></ProfileSection>
            <Box sx={{ gridColumn: { md: "1 / -1" } }}><ProfileSection title="Σημειώσεις"><TextField fullWidth multiline minRows={3} size="small" label="Εσωτερικές σημειώσεις" value={draft.notes ?? ""} onChange={event => updateDraft({ notes: event.target.value })} /></ProfileSection></Box>
          </Box>}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            <ProfileSection title="Διεύθυνση & στοιχεία έδρας">
              {renderCustomField("Διεύθυνση", ["address", "διεύθυνση", "εδρα", "έδρα"])}
              {renderCustomField("Πόλη", ["city", "πόλη"])}
              {renderCustomField("Τ.Κ.", ["postal", "ταχυδρομ", "τκ", "zip"], true)}
              {!editing && <ProfileLine label="Χώρα" value={p.country} />}
              {!editing && <ProfileLine label="ΑΦΜ / VAT" value={p.afmVat} mono />}
              {!editing && <ProfileLine label="Κωδικός συνεργασίας" value={p.agentCode} mono />}
            </ProfileSection>
            <ProfileSection title="Ιστοσελίδα & ψηφιακή παρουσία">
              {!editing && <ProfileLine label="Ιστοσελίδα" value={p.website} link={p.website ?? undefined} />}
              {renderCustomField("Facebook", ["facebook", "fb"])}
              {renderCustomField("Instagram", ["instagram", "insta"])}
              {renderCustomField("LinkedIn", ["linkedin", "linked in"])}
              {renderCustomField("X / Twitter", ["twitter", "x.com"])}
              {renderCustomField("Google Maps", ["google maps", "maps"])}
            </ProfileSection>
          </Box>
          <ProfileSection title="Πρόσωπα, στελέχη & πολλαπλές επικοινωνίες">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Κύριες και πρόσθετες επαφές της εταιρείας.</Typography>
              {editing && <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => openContactEditor()}>Προσθήκη επαφής</Button>}
            </Stack>
            {workspaceQ.isLoading && <Typography variant="body2" color="text.secondary">Φόρτωση επαφών…</Typography>}
            {!workspaceQ.isLoading && (workspace?.contacts ?? []).filter(contact => contact.isActive).length === 0 && <Typography variant="body2" color="text.secondary">Δεν έχουν καταχωρηθεί επιπλέον στελέχη.</Typography>}
            <Stack spacing={.75}>
              {(workspace?.contacts ?? []).filter(contact => contact.isActive).map(contact => <Box key={contact.id} sx={{ p: 1, border: "1px solid", borderColor: contact.isPrimary ? "primary.light" : "divider", borderRadius: 1.25, bgcolor: contact.isPrimary ? "rgba(25,118,210,.06)" : "rgba(248,250,252,.8)" }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={.5}>
                  <Box><Typography fontWeight={800}>{contact.name}{contact.isPrimary && <Chip size="small" color="primary" label="Κύρια επαφή" sx={{ ml: .75 }} />}</Typography><Typography variant="caption" color="text.secondary">{[contact.role, contact.department].filter(Boolean).join(" · ") || "Στέλεχος / επαφή"}</Typography></Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center"><Typography variant="body2">{contact.email || "—"}</Typography><Typography variant="body2">{contact.phone || "—"}</Typography><Typography variant="body2">{contact.mobile || "—"}</Typography>{editing && <><Button size="small" variant="outlined" color="primary" startIcon={<EditIcon />} onClick={() => openContactEditor(contact)}>Επεξεργασία</Button><IconButton size="small" color="error" aria-label="Διαγραφή επαφής" onClick={() => void deleteContact(contact)}><DeleteOutlineIcon fontSize="small" /></IconButton></>}</Stack>
                </Stack>
                {contact.notes && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .5 }}>{contact.notes}</Typography>}
              </Box>)}
            </Stack>
          </ProfileSection>
          <ProfileSection title="Επιπλέον στοιχεία εταιρείας">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Πρόσθετα πεδία που ορίζει το γραφείο.</Typography>
              {editing && <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => openFieldCreator("Νέο πεδίο", "custom-field")}>Προσθήκη πεδίου</Button>}
            </Stack>
            {(workspace?.fields ?? []).filter(field => field.isActive).length === 0 ? <Typography color="text.secondary">Δεν έχουν συμπληρωθεί πρόσθετα πεδία.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 2 }}>{(workspace?.fields ?? []).filter(field => field.isActive).map(field => editing ? <Stack key={field.id} direction="row" spacing={.75} alignItems="flex-start" sx={{ py: .4 }}><TextField fullWidth size="small" label={field.label} value={fieldDrafts[field.id] ?? ""} onChange={event => setFieldDrafts(current => ({ ...current, [field.id]: event.target.value }))} /><Button size="small" variant="outlined" onClick={() => void saveField(field.id)} disabled={savingFieldId === field.id}>{savingFieldId === field.id ? <CircularProgress size={16} /> : "Αποθήκευση"}</Button><IconButton size="small" color="primary" title="Επεξεργασία τίτλου και περιεχομένου" onClick={() => openFieldEditor(field)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" title="Διαγραφή πεδίου" onClick={() => void deleteField(field)}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack> : <ProfileLine key={field.id} label={field.label} value={field.value} link={/^https?:\/\//i.test(field.value ?? "") ? field.value ?? undefined : undefined} />)}</Box>}
          </ProfileSection>
        </Stack>}
        {tab === 2 && <Stack spacing={1.5}><ProfileMetricGrid items={[["Κλάδοι", String(p.branchCount), "info"], ["Πακέτα", String(p.packageCount), "info"], ["Χρήσεις", String(p.useCount), "info"], ["Καλύψεις", String(p.coverageCount), "info"], ["Γέφυρα", p.bridgeLinked ? "Συνδεδεμένη" : "Χωρίς σύνδεση", p.bridgeLinked ? "success" : "warning"]]} /><ProfileSection title="Σύνδεση εταιρείας"><ProfileLine label="Πηγή γέφυρας" value={p.bridgeLinkedSourceCarrier} /><ProfileLine label="Κατάσταση" value={p.isActive ? "Ενεργή" : "Ανενεργή"} /><ProfileLine label="Δημιουργήθηκε" value={date(p.createdAt)} /></ProfileSection></Stack>}
          {tab === 3 && <Stack spacing={1.5}>{editing ? <ProfileSection title="Στοιχεία επικοινωνίας"><Stack spacing={1.25}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.25 }}><TextField size="small" label="Όνομα επαφής" value={draft.contactName ?? ""} onChange={event => updateDraft({ contactName: event.target.value })} /><TextField size="small" type="email" label="Email" value={draft.contactEmail ?? ""} onChange={event => updateDraft({ contactEmail: event.target.value })} /><TextField size="small" label="Τηλέφωνο" value={draft.contactPhone ?? ""} onChange={event => updateDraft({ contactPhone: event.target.value })} /></Box><Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => openContactEditor()}>Προσθήκη 2ης επικοινωνίας / στελέχους</Button></Stack></ProfileSection> : <ProfileSection title="Στοιχεία επικοινωνίας"><ProfileLine label="Όνομα επαφής" value={p.contactName} /><ProfileLine label="Email" value={p.contactEmail} link={p.contactEmail ? `mailto:${p.contactEmail}` : undefined} /><ProfileLine label="Τηλέφωνο" value={p.contactPhone} link={p.contactPhone ? `tel:${p.contactPhone}` : undefined} /></ProfileSection>}<ProfileSection title="Σημειώσεις">{editing ? <TextField fullWidth multiline minRows={3} size="small" label="Εσωτερικές σημειώσεις" value={draft.notes ?? ""} onChange={event => updateDraft({ notes: event.target.value })} /> : <Typography sx={{ whiteSpace: "pre-wrap" }}>{p.notes || "Δεν υπάρχουν σημειώσεις."}</Typography>}</ProfileSection></Stack>}
        {tab === 1 && company && <CompanyPoliciesSection companyId={company.id} />}
        {tab === 2 && company && <><CompanyParametricsSection companyId={company.id} companyName={company.name} />{(company.isBroker || p.isBroker) && <CompanyPartnerCompaniesSection companyId={company.id} />}</>}
        {tab === 3 && company && <CompanyCommunicationSection companyId={company.id} workspace={workspace} />}
        {tab === 4 && company && <CompanyDocumentsWorkspace companyId={company.id} />}
        {tab === 5 && company && <CompanyStatisticsSection companyId={company.id} profile={p} />}
      </>}
      <Dialog open={fieldEntryOpen} onClose={() => setFieldEntryOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Προσθήκη πεδίου</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}><TextField autoFocus fullWidth size="small" label="Τίτλος πεδίου" value={newField.label} onChange={event => setNewField(current => ({ ...current, label: event.target.value }))} /><TextField fullWidth size="small" label="Περιεχόμενο πεδίου" value={newField.value} onChange={event => setNewField(current => ({ ...current, value: event.target.value }))} multiline minRows={3} /></Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setFieldEntryOpen(false)} sx={{ color: "#fff" }}>Ακύρωση επεξεργασίας</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void createField()} disabled={!newField.label.trim() || !newField.value.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
      <Dialog open={!!fieldEdit} onClose={() => setFieldEdit(null)} fullWidth maxWidth="sm"><DialogTitle>Επεξεργασία πεδίου</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}><TextField autoFocus fullWidth size="small" label="Τίτλος πεδίου" value={fieldEdit?.label ?? ""} onChange={event => setFieldEdit(current => current ? ({ ...current, label: event.target.value }) : current)} /><TextField fullWidth size="small" label="Περιεχόμενο πεδίου" value={fieldEdit?.value ?? ""} onChange={event => setFieldEdit(current => current ? ({ ...current, value: event.target.value }) : current)} multiline minRows={3} /></Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setFieldEdit(null)} sx={{ color: "#fff" }}>Ακύρωση επεξεργασίας</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void updateField()} disabled={!fieldEdit?.label.trim() || !fieldEdit?.value.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
      </DialogContent><Dialog open={fieldDialogOpen} onClose={() => setFieldDialogOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Προσθήκη κειμένου</DialogTitle><DialogContent><TextField autoFocus fullWidth size="small" label="Κείμενο" value={newField.value} onChange={event => setNewField(current => ({ ...current, value: event.target.value }))} multiline minRows={3} sx={{ mt: 1 }} /></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setFieldDialogOpen(false)} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void createField()} disabled={!newField.value.trim()}>Αποθήκευση</Button></DialogActions></Dialog><Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} fullWidth maxWidth="md"><DialogTitle>{editingContactId ? "Επεξεργασία επαφής" : "Προσθήκη επαφής"}</DialogTitle><DialogContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, pt: 1 }}><TextField autoFocus size="small" label="Ονοματεπώνυμο *" value={contactDraft.name} onChange={event => setContactDraft(current => ({ ...current, name: event.target.value }))} /><TextField size="small" label="Ρόλος" value={contactDraft.role} onChange={event => setContactDraft(current => ({ ...current, role: event.target.value }))} /><TextField size="small" label="Τμήμα" value={contactDraft.department} onChange={event => setContactDraft(current => ({ ...current, department: event.target.value }))} /><TextField size="small" type="email" label="Email" value={contactDraft.email} onChange={event => setContactDraft(current => ({ ...current, email: event.target.value }))} /><TextField size="small" label="Τηλέφωνο" value={contactDraft.phone} onChange={event => setContactDraft(current => ({ ...current, phone: event.target.value }))} /><TextField size="small" label="Κινητό" value={contactDraft.mobile} onChange={event => setContactDraft(current => ({ ...current, mobile: event.target.value }))} /><TextField size="small" multiline minRows={2} label="Σημειώσεις" value={contactDraft.notes} onChange={event => setContactDraft(current => ({ ...current, notes: event.target.value }))} sx={{ gridColumn: { sm: "1 / -1" } }} /><FormControlLabel control={<Switch checked={contactDraft.isPrimary} onChange={event => setContactDraft(current => ({ ...current, isPrimary: event.target.checked }))} />} label="Κύρια επαφή" /></Box></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setContactDialogOpen(false)} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void saveContact()} disabled={!contactDraft.name.trim()}>Αποθήκευση</Button></DialogActions></Dialog><DialogActions sx={{ px: 3, py: 2 }}><Button variant="contained" color="error" startIcon={editing ? <CloseIcon /> : undefined} onClick={onClose} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, "&:hover": { bgcolor: "error.dark", color: "#fff" } }}>{editing ? "Ακύρωση" : "Κλείσιμο"}</Button></DialogActions>
  </Dialog>;
}

interface CompanyWorkspaceFolder { id: string; name: string; description: string | null; parentFolderId: string | null; color: string; documentCount: number; createdAt: string; }
interface CompanyWorkspaceDocument { id: string; folderId: string | null; fileName: string; mimeType: string; sizeBytes: number; category: string; description: string | null; tags: string[]; documentDate: string | null; expiresOn: string | null; isConfidential: boolean; uploadedByUserId: string | null; createdAt: string; }
interface CompanyWorkspaceField { id: string; key: string; label: string; fieldType: string; options: string[]; isRequired: boolean; isActive: boolean; sortOrder: number; value: string | null; }
interface CompanyWorkspaceCategory { id: string; name: string; color: string; isActive: boolean; sortOrder: number; documentCount: number; }
interface CompanyWorkspaceContact { id: string; name: string; role: string | null; department: string | null; email: string | null; phone: string | null; mobile: string | null; notes: string | null; preferredChannel: string; isPrimary: boolean; isActive: boolean; }
interface CompanyWorkspace { folders: CompanyWorkspaceFolder[]; documents: CompanyWorkspaceDocument[]; fields: CompanyWorkspaceField[]; categories: CompanyWorkspaceCategory[]; contacts: CompanyWorkspaceContact[]; communications: CompanyCommunicationRow[]; }

interface CompanyPartnerRow {
  id: string;
  partnerInsuranceCompanyId: string;
  partnerName: string;
  partnerCode: string;
  partnerIsBroker: boolean;
  relationshipType: string;
  cooperationCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

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
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
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
      const body = { name: contactName, role: contactRole || null, department: contactDepartment || null, email: contactEmail || null, phone: contactPhone || null, mobile: contactMobile || null, notes: contactNotes || null, preferredChannel: "Email", isPrimary: contactPrimary };
      if (editingContactId) await api.put(`${endpoint}/contacts/${editingContactId}`, body);
      else await api.post(`${endpoint}/contacts`, body);
      setContactDialog(false); setEditingContactId(null); setContactName(""); setContactRole(""); setContactDepartment(""); setContactEmail(""); setContactPhone(""); setContactMobile(""); setContactNotes(""); setContactPrimary(false); refresh();
    } catch (e) { setError(extractErrorMessage(e)); }
  };
  const openContactDialog = (contact?: CompanyWorkspaceContact) => {
    setEditingContactId(contact?.id ?? null); setContactName(contact?.name ?? ""); setContactRole(contact?.role ?? ""); setContactDepartment(contact?.department ?? ""); setContactEmail(contact?.email ?? ""); setContactPhone(contact?.phone ?? ""); setContactMobile(contact?.mobile ?? ""); setContactNotes(contact?.notes ?? ""); setContactPrimary(contact?.isPrimary ?? false); setContactDialog(true);
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
  const predefinedFields = [
    ["Στοιχεία επικοινωνίας εταιρείας", "company-contact", "text"],
    ["Υπεύθυνος λογαριασμού", "account-manager", "text"],
    ["Τηλέφωνο λογιστηρίου", "accounting-phone", "text"],
    ["Σύμβαση με ασφαλιστική εταιρεία", "company-contract", "text"],
    ["Κωδικός συνεργασίας", "cooperation-code", "text"],
    ["Ημερομηνία λήξης σύμβασης", "contract-expiry", "date"],
  ] as const;
  const addPredefinedField = async (label: string, key: string, fieldType: string) => {
    try { await api.post(`${endpoint}/fields`, { label, key, fieldType, options: [], isRequired: false, sortOrder: workspace?.fields.length ?? 0 }); refresh(); }
    catch (e) { setError(extractErrorMessage(e)); }
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
  return <Stack spacing={1.5} sx={{ "& .MuiButton-sizeSmall": { minHeight: 32, px: 1.2, borderRadius: 1.25, fontWeight: 750 }, "& .MuiButton-sizeSmall.MuiButton-outlined": { bgcolor: "#1976d2", color: "#fff", borderColor: "#1976d2", "&:hover": { bgcolor: "#0d47a1", borderColor: "#0d47a1" } }, "& .MuiButton-sizeSmall.MuiButton-containedPrimary": { color: "#fff", "&:hover": { bgcolor: "#0d47a1" } } }}>
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
     <ProfileSection title="Επαφές εταιρείας"><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="caption" color="text.secondary">Υπεύθυνοι, τμήματα, τηλέφωνα, email και κανάλι επικοινωνίας.</Typography><Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => openContactDialog()}>Νέα επαφή</Button></Stack>{(workspace?.contacts ?? []).length === 0 ? <Typography color="text.secondary">Δεν έχουν καταχωρηθεί επαφές.</Typography> : <Stack spacing={0.75}>{workspace?.contacts.map(contact => <Box key={contact.id} sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: contact.isPrimary ? "rgba(25,118,210,.06)" : "transparent" }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={0.75}><Box><Typography fontWeight={800}>{contact.name}{contact.isPrimary && <Chip size="small" color="primary" label="Κύρια" sx={{ ml: 0.75 }} />}</Typography><Typography variant="caption" color="text.secondary">{[contact.role, contact.department].filter(Boolean).join(" · ") || "Χωρίς ρόλο"}</Typography></Box><Stack direction="row" spacing={.5}><Button size="small" variant="outlined" color="primary" startIcon={<EditIcon />} onClick={() => openContactDialog(contact)}>Επεξεργασία</Button><IconButton size="small" color="error" onClick={() => void deleteContact(contact)}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack></Stack><Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}><Typography variant="body2">{contact.email || "—"}</Typography><Typography variant="body2">{contact.phone || contact.mobile || "—"}</Typography></Stack>{contact.notes && <Typography variant="caption" color="text.secondary">{contact.notes}</Typography>}</Box>)}</Stack>}</ProfileSection>
     <ProfileSection title="Πεδία εταιρείας"><Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Συμπληρώστε στοιχεία επικοινωνίας, σύμβαση, λογιστήριο, υπεύθυνο λογαριασμού και εσωτερικούς κωδικούς.</Typography><Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>{predefinedFields.map(([label, key, fieldType]) => <Button key={key} size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => void addPredefinedField(label, key, fieldType)}>{label}</Button>)}<Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setFieldDialog(true)}>Προσαρμοσμένο πεδίο</Button></Stack>{(workspace?.fields ?? []).length === 0 ? <Typography color="text.secondary">Δεν έχουν οριστεί προσαρμόσιμα πεδία.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 1 }}>{workspace?.fields.map(field => <Stack key={field.id} direction="row" spacing={0.75} alignItems="flex-start"><TextField fullWidth size="small" label={`${field.label}${field.isRequired ? " *" : ""}`} value={fieldDrafts[field.id] ?? ""} onChange={e => setFieldDrafts(current => ({ ...current, [field.id]: e.target.value }))} /><Button size="small" variant="outlined" onClick={() => void saveField(field.id)}>Αποθήκευση</Button></Stack>)}</Box>}</ProfileSection>
    <Dialog open={folderDialog} onClose={() => setFolderDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέος φάκελος εταιρείας</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><TextField label="Όνομα φακέλου" value={folderName} onChange={e => setFolderName(e.target.value)} autoFocus /><TextField label="Περιγραφή" value={folderDescription} onChange={e => setFolderDescription(e.target.value)} multiline minRows={2} /></Stack></DialogContent><DialogActions><Button onClick={() => setFolderDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createFolder()} disabled={!folderName.trim()}>Δημιουργία</Button></DialogActions></Dialog>
    <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέα κατηγορία εγγράφων</DialogTitle><DialogContent><TextField fullWidth sx={{ mt: 1 }} label="Όνομα κατηγορίας" value={categoryName} onChange={e => setCategoryName(e.target.value)} autoFocus /></DialogContent><DialogActions><Button onClick={() => setCategoryDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createCategory()} disabled={!categoryName.trim()}>Δημιουργία</Button></DialogActions></Dialog>
    <Dialog open={contactDialog} onClose={() => setContactDialog(false)} fullWidth maxWidth="sm"><DialogTitle>{editingContactId ? "Επεξεργασία επαφής ασφαλιστικής" : "Νέα επαφή ασφαλιστικής"}</DialogTitle><DialogContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, pt: 1 }}><TextField label="Ονοματεπώνυμο" value={contactName} onChange={e => setContactName(e.target.value)} autoFocus /><TextField label="Ρόλος" value={contactRole} onChange={e => setContactRole(e.target.value)} /><TextField label="Τμήμα" value={contactDepartment} onChange={e => setContactDepartment(e.target.value)} /><TextField label="Email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} /><TextField label="Τηλέφωνο" value={contactPhone} onChange={e => setContactPhone(e.target.value)} /><TextField label="Κινητό" value={contactMobile} onChange={e => setContactMobile(e.target.value)} /><TextField label="Σημειώσεις" value={contactNotes} onChange={e => setContactNotes(e.target.value)} multiline minRows={2} sx={{ gridColumn: { sm: "1 / -1" } }} /><Button size="small" variant={contactPrimary ? "contained" : "outlined"} onClick={() => setContactPrimary(value => !value)} sx={{ justifySelf: "start" }}>{contactPrimary ? "Κύρια επαφή" : "Ορισμός ως κύρια"}</Button></Box></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setContactDialog(false)} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void createContact()} disabled={!contactName.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
    <Dialog open={fieldDialog} onClose={() => setFieldDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέο προσαρμόσιμο πεδίο</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><TextField label="Ετικέτα" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} autoFocus /><TextField label="Κλειδί (π.χ. υπεύθυνος-λογαριασμού)" value={fieldKey} onChange={e => setFieldKey(e.target.value)} /><TextField select SelectProps={{ native: true }} label="Τύπος" value={fieldType} onChange={e => setFieldType(e.target.value)}><option value="text">Κείμενο</option><option value="number">Αριθμός</option><option value="date">Ημερομηνία</option><option value="url">Σύνδεσμος</option></TextField><Button size="small" variant={fieldRequired ? "contained" : "outlined"} onClick={() => setFieldRequired(value => !value)}>{fieldRequired ? "Υποχρεωτικό" : "Προαιρετικό"}</Button></Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setFieldDialog(false)} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void createField()} disabled={!fieldLabel.trim() || !fieldKey.trim()}>Προσθήκη</Button></DialogActions></Dialog>
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
  return <Box sx={{ display: "grid", gridTemplateColumns: "minmax(130px, 0.45fr) 1fr", gap: 1, py: 0.45, borderBottom: "1px solid", borderColor: "divider" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={650} sx={{ fontFamily: mono ? "monospace" : undefined, wordBreak: "break-word", whiteSpace: "pre-wrap", color: value?.trim() ? "success.dark" : "error.dark" }}>{link && value ? <a href={link} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{shown}</a> : shown}</Typography></Box>;
}

type OfficeProfile = {
  vatNumber: string;
  legalForm: string;
  registrationNumber: string;
  website: string;
  secondaryPhones: string;
  secondaryEmails: string;
  openingHours: string;
  cooperatingCompanies: string;
  quoteSystem: string;
  quoteSystemDetails: string;
  services: string;
  socialLinks: string;
  accountingContact: string;
  internalProfileNotes: string;
};

const blankOfficeProfile = (): OfficeProfile => ({
  vatNumber: "", legalForm: "", registrationNumber: "", website: "",
  secondaryPhones: "", secondaryEmails: "", openingHours: "",
  cooperatingCompanies: "", quoteSystem: "", quoteSystemDetails: "",
  services: "", socialLinks: "", accountingContact: "", internalProfileNotes: "",
});

const parseOfficeProfile = (json?: string | null): OfficeProfile => {
  if (!json) return blankOfficeProfile();
  try { return { ...blankOfficeProfile(), ...(JSON.parse(json) as Partial<OfficeProfile>) }; }
  catch { return blankOfficeProfile(); }
};

type OfficeEditorForm = {
  code: string; name: string; city: string | null; address: string | null; postalCode: string | null;
  phone: string | null; email: string | null; isHeadquarters: boolean; isActive: boolean; notes: string | null;
  profile: OfficeProfile;
};

const blankOfficeEditorForm = (): OfficeEditorForm => ({ code: "", name: "", city: null, address: null, postalCode: null, phone: null, email: null, isHeadquarters: false, isActive: true, notes: null, profile: blankOfficeProfile() });

function ProductionOfficeEditorDialog({ open, item, onClose, onSaved }: {
  open: boolean; item: OfficeDto | null; onClose: () => void; onSaved: (saved?: OfficeDto) => void;
}) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<OfficeEditorForm>(blankOfficeEditorForm);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTab(0); setError(null);
    if (item) setForm({ code: item.code, name: item.name, city: item.city, address: item.address, postalCode: item.postalCode, phone: item.phone, email: item.email, isHeadquarters: item.isHeadquarters, isActive: item.isActive, notes: item.notes, profile: parseOfficeProfile(item.profileJson) });
    else if (open) setForm(blankOfficeEditorForm());
  }, [item, open]);
  const save = useMutation({
    mutationFn: async () => {
      const { profile, ...base } = form;
      const body = { ...base, code: form.code.trim().toUpperCase(), name: form.name.trim(), city: form.city?.trim() || null, address: form.address?.trim() || null, postalCode: form.postalCode?.trim() || null, phone: form.phone?.trim() || null, email: form.email?.trim() || null, notes: form.notes?.trim() || null, profileJson: JSON.stringify(profile) };
      if (item) return (await api.put(`/agency-offices/${item.id}`, body)).data;
      return (await api.post("/agency-offices", body)).data;
    },
    onSuccess: saved => onSaved(saved as OfficeDto),
    onError: e => setError(extractErrorMessage(e)),
  });
  const update = (patch: Partial<OfficeEditorForm>) => setForm(current => ({ ...current, ...patch }));
  const profileField = (key: keyof OfficeProfile, patch: string) => update({ profile: { ...form.profile, [key]: patch } });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
    <DialogTitle sx={{ pr: 6 }}><Stack direction="row" alignItems="center" spacing={1.25}><HomeWorkIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{item ? "Επεξεργασία πρακτορείου" : "Νέο πρακτορείο"}</Typography><Typography variant="body2" color="text.secondary">Πλήρης καρτέλα πρακτορείου με τα ίδια βασικά πεδία της ασφαλιστικής και επιπλέον στοιχεία λειτουργίας.</Typography></Box></Stack></DialogTitle>
    <DialogContent dividers sx={{ pt: 0, maxHeight: "75vh", overflowY: "auto" }}>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      <WorkspaceProfileTabs value={tab} onChange={setTab} />
      {tab === 0 && <Stack spacing={1.5}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}><ProfileSection title="Ταυτότητα πρακτορείου"><TextField fullWidth required label="Κωδικός" value={form.code} onChange={e => update({ code: e.target.value.toUpperCase() })} /><TextField fullWidth required label="Όνομα" value={form.name} onChange={e => update({ name: e.target.value })} sx={{ mt: 1.25 }} /><TextField fullWidth label="ΑΦΜ / VAT" value={form.profile.vatNumber} onChange={e => profileField("vatNumber", e.target.value)} sx={{ mt: 1.25 }} /><TextField fullWidth label="Νομική μορφή" value={form.profile.legalForm} onChange={e => profileField("legalForm", e.target.value)} sx={{ mt: 1.25 }} /></ProfileSection><ProfileSection title="Διεύθυνση & ψηφιακή παρουσία"><TextField fullWidth label="Πόλη" value={form.city ?? ""} onChange={e => update({ city: e.target.value })} /><TextField fullWidth label="Τ.Κ." value={form.postalCode ?? ""} onChange={e => update({ postalCode: e.target.value })} sx={{ mt: 1.25 }} /><TextField fullWidth label="Διεύθυνση" value={form.address ?? ""} onChange={e => update({ address: e.target.value })} sx={{ mt: 1.25 }} /><TextField fullWidth label="Ιστοσελίδα" value={form.profile.website} onChange={e => profileField("website", e.target.value)} sx={{ mt: 1.25 }} /></ProfileSection><ProfileSection title="Κύρια επικοινωνία"><TextField fullWidth label="Τηλέφωνο" value={form.phone ?? ""} onChange={e => update({ phone: e.target.value })} /><TextField fullWidth label="Email" type="email" value={form.email ?? ""} onChange={e => update({ email: e.target.value })} sx={{ mt: 1.25 }} /><TextField fullWidth label="ΓΕΜΗ / ειδικό μητρώο" value={form.profile.registrationNumber} onChange={e => profileField("registrationNumber", e.target.value)} sx={{ mt: 1.25 }} /></ProfileSection></Box><ProfileSection title="Κατάσταση"><FormControlLabel control={<Switch checked={form.isHeadquarters} onChange={e => update({ isHeadquarters: e.target.checked })} />} label="Κεντρικό πρακτορείο" /><FormControlLabel control={<Switch checked={form.isActive} onChange={e => update({ isActive: e.target.checked })} />} label={form.isActive ? "Ενεργό" : "Ανενεργό"} /></ProfileSection><ProfileSection title="Σημειώσεις"><TextField fullWidth multiline minRows={3} label="Εσωτερικές σημειώσεις" value={form.notes ?? ""} onChange={e => update({ notes: e.target.value })} /></ProfileSection></Stack>}
      {tab === 1 && <Stack spacing={1.5}><ProfileSection title="Παραγωγή και συμβόλαια"><Alert severity="info">Τα συμβόλαια, οι πελάτες και η παραγωγή του πρακτορείου εμφανίζονται στην καρτέλα μετά την αποθήκευση και φιλτράρονται ανά γραφείο.</Alert><TextField fullWidth multiline minRows={3} label="Συνεργαζόμενες ασφαλιστικές εταιρείες" placeholder="Μία ανά γραμμή ή χωρισμένες με κόμμα" value={form.profile.cooperatingCompanies} onChange={e => profileField("cooperatingCompanies", e.target.value)} sx={{ mt: 1.25 }} /><TextField fullWidth multiline minRows={3} label="Κλάδοι και υπηρεσίες που εξυπηρετεί" value={form.profile.services} onChange={e => profileField("services", e.target.value)} sx={{ mt: 1.25 }} /></ProfileSection></Stack>}
      {tab === 2 && <Stack spacing={1.5}><ProfileSection title="Σύνδεση και παραμετρικά"><TextField fullWidth label="Σύστημα πολυτιμολόγησης / έκδοσης που χρησιμοποιεί" value={form.profile.quoteSystem} onChange={e => profileField("quoteSystem", e.target.value)} /><TextField fullWidth multiline minRows={3} label="Λεπτομέρειες σύνδεσης και ροής εργασίας" value={form.profile.quoteSystemDetails} onChange={e => profileField("quoteSystemDetails", e.target.value)} sx={{ mt: 1.25 }} /><TextField fullWidth multiline minRows={3} label="Ώρες λειτουργίας και κανόνες εξυπηρέτησης" value={form.profile.openingHours} onChange={e => profileField("openingHours", e.target.value)} sx={{ mt: 1.25 }} /></ProfileSection></Stack>}
      {tab === 3 && <Stack spacing={1.5}><ProfileSection title="Επικοινωνία πρακτορείου"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}><TextField label="Κύριο τηλέφωνο" value={form.phone ?? ""} onChange={e => update({ phone: e.target.value })} /><TextField label="Κύριο email" type="email" value={form.email ?? ""} onChange={e => update({ email: e.target.value })} /><TextField label="Επιπλέον τηλέφωνα" multiline minRows={2} value={form.profile.secondaryPhones} onChange={e => profileField("secondaryPhones", e.target.value)} /><TextField label="Επιπλέον email" multiline minRows={2} value={form.profile.secondaryEmails} onChange={e => profileField("secondaryEmails", e.target.value)} /><TextField label="Λογιστήριο / οικονομική επαφή" value={form.profile.accountingContact} onChange={e => profileField("accountingContact", e.target.value)} /><TextField label="Facebook, Instagram, LinkedIn και άλλοι σύνδεσμοι" multiline minRows={2} value={form.profile.socialLinks} onChange={e => profileField("socialLinks", e.target.value)} /></Box></ProfileSection></Stack>}
      {tab === 4 && <Stack spacing={1.5}><ProfileSection title="Έγγραφα και πεδία"><Alert severity="info">Μετά την αποθήκευση μπορείτε να συνεχίσετε με χρήστες, έγγραφα και πρόσθετα πεδία του πρακτορείου από την πλήρη καρτέλα.</Alert><TextField fullWidth multiline minRows={5} label="Πρόσθετες πληροφορίες πρακτορείου" value={form.profile.internalProfileNotes} onChange={e => profileField("internalProfileNotes", e.target.value)} /></ProfileSection></Stack>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}><Button onClick={onClose} color="error" variant="contained" sx={{ color: "#fff", fontWeight: 800 }}>Ακύρωση επεξεργασίας</Button><Button variant="contained" color="success" startIcon={<SaveIcon />} disabled={save.isPending || !form.name.trim() || !form.code.trim()} onClick={() => save.mutate()}>{save.isPending ? <CircularProgress size={18} color="inherit" /> : item ? "Αποθήκευση αλλαγών" : "Δημιουργία & αποθήκευση"}</Button></DialogActions>
  </Dialog>;
}

function ProductionOfficeProfileDialog({ open, office, onClose, onEdit }: { open: boolean; office: OfficeDto | null; onClose: () => void; onEdit: (office: OfficeDto) => void }) {
  const usersQ = useQuery({ queryKey: ["production-office-users", office?.id], enabled: open && !!office, queryFn: async () => (await api.get<OfficeUserDto[]>(`/agency-offices/${office!.id}/users`)).data });
  const users = (usersQ.data ?? []).filter(user => user.isAssigned);
  const [tab, setTab] = useState(0);
  const profile = parseOfficeProfile(office?.profileJson);
  useEffect(() => { if (open) setTab(0); }, [open, office?.id]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
    <DialogTitle sx={{ pr: 6 }}><Stack direction="row" alignItems="center" spacing={1.25}><HomeWorkIcon color="primary" /><Box flex={1}><Typography variant="h5" fontWeight={850}>{office?.name}</Typography><Typography variant="caption" sx={{ fontFamily: "monospace" }}>{office?.code}</Typography></Box>{office && <Button variant="contained" size="small" color="success" startIcon={<EditIcon />} onClick={() => onEdit(office)} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, boxShadow: 2, "&:hover": { bgcolor: "success.dark", color: "#fff" } }}>Επεξεργασία</Button>}</Stack></DialogTitle>
    <DialogContent dividers sx={{ pt: 0, maxHeight: "78vh", overflowY: "auto" }}>
      <WorkspaceProfileTabs value={tab} onChange={setTab} />
      {tab === 0 && <Stack spacing={1.5}><ProfileMetricGrid items={[["Κατάσταση", office?.isActive ? "Ενεργό" : "Ανενεργό", office?.isActive ? "success" : "warning"], ["Ρόλος", office?.isHeadquarters ? "Κεντρικό" : "Υποκατάστημα", "info"], ["Χρήστες", String(office?.userCount ?? 0), "info"]]} /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}><ProfileSection title="Ταυτότητα πρακτορείου"><ProfileLine label="Κωδικός" value={office?.code} mono /><ProfileLine label="Όνομα" value={office?.name} /><ProfileLine label="ΑΦΜ / VAT" value={profile.vatNumber} /><ProfileLine label="Νομική μορφή" value={profile.legalForm} /><ProfileLine label="ΓΕΜΗ / ειδικό μητρώο" value={profile.registrationNumber} /></ProfileSection><ProfileSection title="Διεύθυνση"><ProfileLine label="Πόλη / ΤΚ" value={[office?.city, office?.postalCode].filter(Boolean).join(" · ")} /><ProfileLine label="Διεύθυνση" value={office?.address} /><ProfileLine label="Ιστοσελίδα" value={profile.website} link={profile.website || undefined} /></ProfileSection><ProfileSection title="Κύρια επικοινωνία"><ProfileLine label="Email" value={office?.email} link={office?.email ? `mailto:${office.email}` : undefined} /><ProfileLine label="Τηλέφωνο" value={office?.phone} link={office?.phone ? `tel:${office.phone}` : undefined} /><ProfileLine label="Επιπλέον τηλέφωνα" value={profile.secondaryPhones} /><ProfileLine label="Επιπλέον email" value={profile.secondaryEmails} /></ProfileSection></Box></Stack>}
      {tab === 1 && <Stack spacing={1.5}><ProfileSection title="Παραγωγή και συμβόλαια"><Alert severity="info">Η παραγωγή, τα συμβόλαια και οι πελάτες του πρακτορείου εμφανίζονται με το ενεργό φίλτρο γραφείου.</Alert><ProfileLine label="Συνεργαζόμενες ασφαλιστικές" value={profile.cooperatingCompanies} /><ProfileLine label="Κλάδοι και υπηρεσίες" value={profile.services} /></ProfileSection></Stack>}
      {tab === 2 && <Stack spacing={1.5}><ProfileSection title="Σύνδεση και παραμετρικά"><ProfileLine label="Σύστημα πολυτιμολόγησης" value={profile.quoteSystem} /><ProfileLine label="Λεπτομέρειες σύνδεσης" value={profile.quoteSystemDetails} /><ProfileSection title="Πρόσωπα και ρόλοι">{usersQ.isLoading ? <CircularProgress size={20} /> : users.length === 0 ? <Typography color="text.secondary">Δεν έχουν ανατεθεί χρήστες.</Typography> : users.map(user => <Box key={user.userId} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5, py: 0.65, borderBottom: "1px solid", borderColor: "divider" }}><Typography fontWeight={700}>{`${user.firstName} ${user.lastName}`.trim() || user.email}</Typography><Typography variant="body2" color="text.secondary">{user.role} · {user.email}{user.isPrimary ? " · κύριο γραφείο" : ""}</Typography></Box>)}</ProfileSection></ProfileSection></Stack>}
      {tab === 3 && <Stack spacing={1.5}><ProfileSection title="Επικοινωνία πρακτορείου"><ProfileLine label="Ώρες λειτουργίας" value={profile.openingHours} /><ProfileLine label="Λογιστήριο / οικονομική επαφή" value={profile.accountingContact} /><ProfileLine label="Κοινωνικά δίκτυα και σύνδεσμοι" value={profile.socialLinks} /></ProfileSection></Stack>}
      {tab === 4 && <Stack spacing={1.5}><ProfileSection title="Έγγραφα και πρόσθετα πεδία"><Alert severity="info">Η καρτέλα είναι έτοιμη για έγγραφα, φακέλους και προσαρμοσμένα πεδία του πρακτορείου.</Alert><ProfileLine label="Πρόσθετες πληροφορίες" value={profile.internalProfileNotes} /><ProfileLine label="Εσωτερικές σημειώσεις" value={office?.notes} /></ProfileSection></Stack>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}><Button variant="contained" color="error" onClick={onClose} sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, "&:hover": { bgcolor: "error.dark", color: "#fff" } }}>Κλείσιμο</Button></DialogActions>
  </Dialog>;
}
