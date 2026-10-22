import { SearchableTextField } from "../components/SearchableTextField";
import { useEffect, useMemo, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  Checkbox, DialogTitle, FormControlLabel, IconButton, Popover, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, TablePagination, Tabs, TextField, Tooltip, Typography, Snackbar
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
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
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
import { exportActionSx } from "../components/actionButtonStyles";
import { type CarrierProfile, type CompanyDto } from "./InsuranceCompaniesPage";
import { type OfficeDto } from "./AgencyOfficesPage";
import { contractDurationLabel } from "../utils/contractDuration";
import { DetailProfileTabs } from "../components/profile/DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, profileFieldGridSx, useProfileFieldEditor } from "../components/profile/ProfileFieldEditor";
import { customerFieldError } from "../components/customer/customerValidation";
import { persistProfileWrites } from "../components/profile/profileDrafts";
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
  policyTypeText?: string | null;
  vehicleUseCategory: string | null;
  vehicleUseCategoryText?: string | null;
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
        } catch (error) {
          failed.push(extractErrorMessage(error));
        }
      }
      return failed;
    },
    onSuccess: failed => {
      if (failed.length === 0) setSuccess("Οι εγγραφές διαγράφηκαν επιτυχώς.");
      if (failed.length > 0) {
        const uniqueReasons = Array.from(new Set(failed));
        setError(`${failed.length} εγγραφές δεν διαγράφηκαν. ${uniqueReasons.join(" ")}`);
      }
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
              <Typography variant="h4" fontWeight={850}>Εταιρείες &amp; Πρακτορεία</Typography>
              <Typography variant="body2" color="text.secondary">
                Λειτουργική εικόνα ασφαλιστικών εταιρειών και συνεργαζόμενων πρακτορείων.
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
      <ProductionOfficeProfileDialog open={!!officeProfile} office={officeProfile} onClose={() => setOfficeProfile(null)} onChanged={setOfficeProfile} />
      <Dialog open={!!companyDeleteTarget} onClose={() => setCompanyDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Διαγραφή ασφαλιστικής εταιρείας</DialogTitle>
        <DialogContent><Typography>Είστε σίγουρος ότι θέλετε να διαγράψετε την εταιρεία «{companyDeleteTarget?.name}»; Η διαγραφή επιτρέπεται μόνο αν δεν έχει παραγωγή, συμβόλαια ή άλλο συνδεδεμένο ιστορικό.</Typography></DialogContent>
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  useEffect(() => { setPage(0); }, [companies, isBroker]);
  const lastPage = Math.max(0, Math.ceil(companies.length / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);
  const visibleRows = companies.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);
  const selectable = visibleRows.filter(company => !company.isGlobal);
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
        <TableBody>{visibleRows.map(company => <TableRow key={company.id} hover onClick={() => onOpen(company)} sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}>
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
    <TablePagination component="div" count={companies.length} page={safePage}
      onPageChange={(_event, next) => setPage(next)} rowsPerPage={rowsPerPage}
      onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
      rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Εγγραφές ανά σελίδα"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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
      const start = new Date(row.startDate).getTime();
      const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
      if (from !== null && (!Number.isFinite(start) || start < from)) return false;
      if (to !== null && (!Number.isFinite(start) || start > to)) return false;
      return true;
    }).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  }, [policiesQ.data, search, status, type, expiry, fromDate, toDate]);
  useEffect(() => { setPage(0); }, [search, status, type, expiry, fromDate, toDate]);
  const pagedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const filterCount = [status !== "all", type !== "all", expiry !== "all", fromDate, toDate].filter(Boolean).length;
  const clearFilters = () => { setStatus("all"); setType("all"); setExpiry("all"); setFromDate(""); setToDate(""); setSearch(""); };
  const money = (value: number | string) => Number(value || 0).toLocaleString("el-GR", { style: "currency", currency: "EUR" });
  const date = (value: string) => new Date(value).toLocaleDateString("el-GR");
  const types = [...new Set((policiesQ.data ?? []).map(row => row.policyType).filter(Boolean))];
  const statuses = [...new Set((policiesQ.data ?? []).map(row => row.status).filter(Boolean))];
  return <ProfileSection title="Όλα τα συμβόλαια στην εταιρεία">
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 1.25 }}>
      <TextField size="small" fullWidth placeholder="Αναζήτηση αριθμού, πελάτη, συνεργάτη ή κλάδου…" value={search} onChange={event => setSearch(event.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: .75, color: "text.secondary" }} /> }} />
      <Button variant="outlined" startIcon={<FilterListIcon />} onClick={event => setFilterAnchor(event.currentTarget)} sx={{ whiteSpace: "nowrap" }}>Λοιπά φίλτρα{filterCount ? ` (${filterCount})` : ""}</Button>
      <Chip size="small" color="info" variant="outlined" label={`${rows.length} / ${(policiesQ.data ?? []).length} συμβόλαια`} />
    </Stack>
    <Popover open={!!filterAnchor} anchorEl={filterAnchor} onClose={() => setFilterAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
      <Stack spacing={1.25} sx={{ p: 1.75, width: { xs: "calc(100vw - 24px)", sm: 480 }, maxWidth: "100%", boxSizing: "border-box" }}>
        <Typography fontWeight={800}>Φίλτρα συμβολαίων</Typography>
        <TextField select size="small" label="Κατάσταση" value={status} onChange={event => setStatus(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλες</option>{statuses.map(option => <option key={option} value={option}>{policyStatusLabel(option)}</option>)}</TextField>
        <TextField select size="small" label="Κλάδος" value={type} onChange={event => setType(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλοι</option>{types.map(option => <option key={option} value={option}>{policyTypeLabel(option)}</option>)}</TextField>
        <TextField select size="small" label="Λήξη" value={expiry} onChange={event => setExpiry(event.target.value)} SelectProps={{ native: true }}><option value="all">Όλες οι ημερομηνίες</option><option value="expired">Έχουν λήξει</option><option value="next30">Λήγουν σε 30 ημέρες</option><option value="next90">Λήγουν σε 90 ημέρες</option></TextField>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ "& > *": { minWidth: 0, flex: 1 } }}>
          <TextField fullWidth type="date" size="small" label="Έναρξη από" value={fromDate} onChange={event => setFromDate(event.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth type="date" size="small" label="Έναρξη έως" value={toDate} onChange={event => setToDate(event.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
        <Button color="error" variant="outlined" onClick={clearFilters}>Καθαρισμός φίλτρων</Button>
      </Stack>
    </Popover>
    <Box sx={{ maxHeight: 500, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
      {policiesQ.isLoading ? <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} /></Box> : <Table size="small" stickyHeader sx={{ minWidth: 920 }}>
        <TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Πελάτης</TableCell><TableCell>Κλάδος / κατάσταση</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell>Διάρκεια</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Συνεργάτης</TableCell><TableCell align="right">Προβολή</TableCell></TableRow></TableHead>
        <TableBody>{pagedRows.map(row => <TableRow key={row.id} hover onClick={() => setSelectedPolicyId(row.id)} sx={{ cursor: "pointer" }}>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.policyNumber || "—"}</TableCell><TableCell>{row.customerDisplay || "—"}</TableCell><TableCell><Stack spacing={.25}><Typography variant="body2">{policyTypeLabel(row.policyType || "") || "—"}</Typography><Chip size="small" label={policyStatusLabel(row.status)} /></Stack></TableCell><TableCell>{date(row.startDate)}</TableCell><TableCell>{date(row.endDate)}</TableCell><TableCell>{contractDurationLabel(row.startDate, row.endDate)}</TableCell><TableCell align="right">{money(row.premium)}</TableCell><TableCell>{row.producerName || "Έδρα"}</TableCell><TableCell align="right"><IconButton size="small" aria-label="Προβολή συμβολαίου" onClick={event => { event.stopPropagation(); setSelectedPolicyId(row.id); }}><VisibilityIcon fontSize="small" /></IconButton></TableCell>
        </TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={9}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>{policiesQ.isError ? "Δεν φορτώθηκαν τα συμβόλαια." : "Δεν βρέθηκαν συμβόλαια με τα συγκεκριμένα φίλτρα."}</Typography></TableCell></TableRow>}</TableBody>
      </Table>}
    </Box>
    <TablePagination component="div" count={rows.length} page={page} onPageChange={(_event, next) => setPage(next)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Εγγραφές ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
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
    const headers = ["Αριθμός συμβολαίου", "Έναρξη", "Λήξη", "Διάρκεια", "Πελάτης", "Κλάδος", "Κατάσταση", "Μικτά ασφάλιστρα", "Καθαρά ασφάλιστρα", "Προμήθεια %"];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = filteredRows.map(row => [row.policyNumber, row.startDate, row.endDate, contractDurationLabel(row.startDate, row.endDate), row.customerDisplay, policyTypeLabel(row.policyType), policyStatusLabel(row.status), row.premium, row.netPremium, row.specialCommissionPercent].map(escape).join(";"));
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
      <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!filteredRows.length} sx={{ ...exportActionSx, whiteSpace: "nowrap" }}>Εξαγωγή CSV</Button>
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
      <SearchableTextField select fullWidth size="small" label="Εταιρεία / υποεταιρεία" value={draft.partnerInsuranceCompanyId} onChange={event => setDraft(current => ({ ...current, partnerInsuranceCompanyId: event.target.value }))} SelectProps={{ native: true }} disabled={!!editing || companiesQ.isLoading}><option value="">Επιλέξτε εταιρεία</option>{options.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}{item.isBroker ? " · πρακτορείο" : ""}</option>)}</SearchableTextField>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}><TextField select size="small" label="Τύπος σχέσης" value={draft.relationshipType} onChange={event => setDraft(current => ({ ...current, relationshipType: event.target.value }))} SelectProps={{ native: true }}><option>Συνεργαζόμενη ασφαλιστική</option><option>Υποεταιρεία / θυγατρική</option><option>Δίκτυο / διαχειριστής χαρτοφυλακίου</option><option>Πρακτορείο / broker</option><option>Άλλη επιχειρηματική συνεργασία</option></TextField><TextField size="small" label="Κωδικός συνεργασίας" value={draft.cooperationCode} onChange={event => setDraft(current => ({ ...current, cooperationCode: event.target.value }))} /><TextField size="small" label="Υπεύθυνος επικοινωνίας" value={draft.contactName} onChange={event => setDraft(current => ({ ...current, contactName: event.target.value }))} /><TextField size="small" type="email" label="Email συνεργασίας" value={draft.contactEmail} onChange={event => setDraft(current => ({ ...current, contactEmail: event.target.value }))} /><TextField size="small" label="Τηλέφωνο συνεργασίας" value={draft.contactPhone} onChange={event => setDraft(current => ({ ...current, contactPhone: event.target.value }))} /><FormControlLabel control={<Switch checked={draft.isActive} onChange={event => setDraft(current => ({ ...current, isActive: event.target.checked }))} />} label={draft.isActive ? "Ενεργή συνεργασία" : "Ανενεργή συνεργασία"} /></Box><TextField fullWidth multiline minRows={3} size="small" label="Σημειώσεις και όροι συνεργασίας" value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} />
    </Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setDialogOpen(false)} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={() => void save()} disabled={saving || !draft.partnerInsuranceCompanyId} sx={{ color: "#fff" }}>{saving ? "Αποθήκευση…" : "Αποθήκευση συνεργασίας"}</Button></DialogActions></Dialog>
  </ProfileSection>;
}

function CompanyParametricsSection({ companyId, companyName }: { companyId: string; companyName: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<CompanyParameterKind | "all">("all");
  const [editing, setEditing] = useState<CompanyParameterRow | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const paramsQ = useQuery({ queryKey: ["production-company-parameters", companyId], queryFn: async () => (await api.get<CompanyParameterRow[]>("/company-parameters", { params: { insuranceCompanyId: companyId } })).data });
  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("el-GR");
    return (paramsQ.data ?? []).filter(row => (kind === "all" || row.kind === kind) && (!needle || `${row.code} ${row.name} ${row.parentCode ?? ""} ${row.policyTypeText ?? row.policyType ?? ""} ${row.vehicleUseCategoryText ?? row.vehicleUseCategory ?? ""} ${row.notes ?? ""}`.toLocaleLowerCase("el-GR").includes(needle))).sort((a, b) => a.kind.localeCompare(b.kind) || a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  }, [paramsQ.data, search, kind]);
  useEffect(() => { setPage(0); }, [search, kind]);
  const pagedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
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
        <TableBody>{pagedRows.map(row => <TableRow key={row.id} hover><TableCell><Chip size="small" variant="outlined" label={COMPANY_PARAMETER_KIND_LABEL[row.kind] ?? row.kind} /></TableCell><TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.policyTypeText ?? row.policyType ?? "—"}{(row.vehicleUseCategoryText ?? row.vehicleUseCategory) ? ` · ${row.vehicleUseCategoryText ?? row.vehicleUseCategory}` : ""}</TableCell><TableCell>{row.parentCode || "—"}</TableCell><TableCell>{row.bridgeCode || "—"}</TableCell><TableCell><Chip size="small" color={row.isActive ? "success" : "default"} label={row.isActive ? "Ενεργό" : "Ανενεργό"} /></TableCell><TableCell align="right"><Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(row)}>Επεξεργασία</Button></TableCell></TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>Δεν βρέθηκαν παραμετρικά.</Typography></TableCell></TableRow>}</TableBody>
      </Table>}
    </Box>
    <TablePagination component="div" count={rows.length} page={page} onPageChange={(_event, next) => setPage(next)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Εγγραφές ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
    <ParametricEditDialog item={editing} companyId={companyId} companyName={companyName} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ["production-company-parameters", companyId] }); }} />
  </ProfileSection>;
}

function ParametricEditDialog({ item, companyId, companyName, onClose, onSaved }: { item: CompanyParameterRow | null; companyId: string; companyName: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: "", name: "", bridgeCode: "", notes: "", displayOrder: "0" });
  useEffect(() => { if (item) setForm({ code: item.code, name: item.name, bridgeCode: item.bridgeCode ?? "", notes: item.notes ?? "", displayOrder: String(item.displayOrder) }); }, [item]);
  const mutation = useMutation({ mutationFn: async () => api.put(`/company-parameters/${item!.id}`, { insuranceCompanyId: companyId, kind: item!.kind, code: form.code.trim(), name: form.name.trim(), policyType: item!.policyType, vehicleUseCategory: item!.vehicleUseCategory, policyTypeText: item!.policyTypeText, vehicleUseCategoryText: item!.vehicleUseCategoryText, parentCode: item!.parentCode, bridgeSystem: item!.bridgeSystem, bridgeCode: form.bridgeCode.trim() || null, bridgeField: item!.bridgeField, defaultValuesJson: item!.defaultValuesJson, effectiveFrom: item!.effectiveFrom, effectiveTo: item!.effectiveTo, isActive: item!.isActive, displayOrder: Number(form.displayOrder) || 0, source: item!.source, notes: form.notes.trim() || null }).then(response => response.data), onSuccess: onSaved });
  return <Dialog open={!!item} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Επεξεργασία παραμετρικού · {companyName}</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}><TextField label="Κωδικός" value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /><TextField label="Ονομασία" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><TextField label="Κωδικός από γέφυρα" value={form.bridgeCode} onChange={event => setForm({ ...form, bridgeCode: event.target.value })} helperText="Ο κωδικός με τον οποίο έχει αντιστοιχιστεί το παραμετρικό στη γέφυρα εταιρείας." /><TextField label="Σημειώσεις" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} multiline minRows={2} /><TextField label="Σειρά εμφάνισης" type="number" value={form.displayOrder} onChange={event => setForm({ ...form, displayOrder: event.target.value })} /></Stack></DialogContent><DialogActions><Button color="error" onClick={onClose}>Ακύρωση</Button><Button variant="contained" onClick={() => mutation.mutate()} disabled={!form.code.trim() || !form.name.trim() || mutation.isPending}>Αποθήκευση</Button></DialogActions></Dialog>;
}

function CompanyCommunicationSection({ companyId, workspace }: { companyId: string; workspace?: CompanyWorkspace }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyKind, setHistoryKind] = useState("");
  const [historyDirection, setHistoryDirection] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(10);
  const [form, setForm] = useState({ kind: "Email", direction: "Outbound", subject: "", body: "", contactId: "", contactName: "", contactEmail: "", contactPhone: "", occurredAt: new Date().toISOString().slice(0, 16) });
  const contacts = workspace?.contacts ?? [];
  const communications = workspace?.communications ?? [];
  const filteredCommunications = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase("el-GR");
    return communications.filter(item => {
      if (historyKind && item.kind !== historyKind) return false;
      if (historyDirection && item.direction !== historyDirection) return false;
      if (!query) return true;
      return [item.subject, item.body, item.contactName, item.contactEmail, item.contactPhone, item.kind]
        .some(value => (value ?? "").toLocaleLowerCase("el-GR").includes(query));
    });
  }, [communications, historyDirection, historyKind, historySearch]);
  const pagedCommunications = filteredCommunications.slice(historyPage * historyRowsPerPage, historyPage * historyRowsPerPage + historyRowsPerPage);
  useEffect(() => { setHistoryPage(0); }, [historySearch, historyKind, historyDirection]);
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(filteredCommunications.length / historyRowsPerPage) - 1);
    if (historyPage > lastPage) setHistoryPage(lastPage);
  }, [filteredCommunications.length, historyPage, historyRowsPerPage]);
  const save = useMutation({
    mutationFn: async () => api.post(`/insurance-companies/${companyId}/workspace/communications`, { kind: form.kind, direction: form.direction, subject: form.subject || null, body: form.body || null, contactName: form.contactName || null, contactEmail: form.contactEmail || null, contactPhone: form.contactPhone || null, occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : null }),
    onSuccess: () => { setOpen(false); setForm(current => ({ ...current, subject: "", body: "", occurredAt: new Date().toISOString().slice(0, 16) })); void qc.invalidateQueries({ queryKey: ["production-company-workspace", companyId] }); },
  });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/insurance-companies/${companyId}/workspace/communications/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ["production-company-workspace", companyId] }) });
  const chooseContact = (id: string) => { const contact = contacts.find(row => row.id === id); setForm(current => ({ ...current, contactId: id, contactName: contact?.name ?? "", contactEmail: contact?.email ?? "", contactPhone: contact?.phone || contact?.mobile || "" })); };
  return <Stack spacing={1}>
    <Button variant="outlined" color="primary" startIcon={<ContactPhoneIcon />} onClick={() => setHistoryOpen(true)} sx={{ alignSelf: "flex-start" }}>Τελευταίες επικοινωνίες ({communications.length})</Button>
    <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="xl">
      <DialogTitle>Τελευταίες επικοινωνίες</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ mb: 1.25 }}><Typography variant="body2" color="text.secondary">Πλήρες ιστορικό επικοινωνίας με την ασφαλιστική εταιρεία.</Typography><Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Νέα επικοινωνία</Button></Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(300px,1fr) minmax(210px,.55fr) minmax(210px,.55fr)" }, gap: 1.25, mb: 1.25, alignItems: "start", "& .MuiFormControl-root": { minWidth: 0, width: "100%" } }}>
          <TextField size="small" label="Αναζήτηση" placeholder="Θέμα, επαφή, email, τηλέφωνο…" value={historySearch} onChange={event => setHistorySearch(event.target.value)} InputLabelProps={{ shrink: true }} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: .75, color: "text.secondary" }} /> }} />
          <TextField select size="small" label="Κανάλι" value={historyKind} onChange={event => setHistoryKind(event.target.value)} InputLabelProps={{ shrink: true }} SelectProps={{ native: true }}><option value="">Όλα τα κανάλια</option>{Array.from(new Set(communications.map(item => item.kind))).map(kind => <option key={kind} value={kind}>{kind}</option>)}</TextField>
          <TextField select size="small" label="Κατεύθυνση" value={historyDirection} onChange={event => setHistoryDirection(event.target.value)} InputLabelProps={{ shrink: true }} SelectProps={{ native: true }}><option value="">Όλες</option><option value="Inbound">Εισερχόμενη</option><option value="Outbound">Εξερχόμενη</option><option value="Internal">Εσωτερική</option></TextField>
        </Box>
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ maxHeight: 430, overflow: "auto" }}><Table size="small" stickyHeader sx={{ minWidth: 900 }}><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Κανάλι</TableCell><TableCell>Κατεύθυνση</TableCell><TableCell>Επαφή</TableCell><TableCell>Θέμα / σημείωση</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead><TableBody>{pagedCommunications.map(item => <TableRow key={item.id} hover><TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(item.occurredAt).toLocaleString("el-GR")}</TableCell><TableCell><Chip size="small" color="info" variant="outlined" label={item.kind} /></TableCell><TableCell><Chip size="small" variant="outlined" label={item.direction === "Inbound" ? "Εισερχόμενη" : item.direction === "Outbound" ? "Εξερχόμενη" : "Εσωτερική"} /></TableCell><TableCell><Typography variant="body2" fontWeight={700}>{item.contactName || "—"}</Typography><Typography variant="caption" color="text.secondary">{item.contactEmail || item.contactPhone || "Χωρίς στοιχεία"}</Typography></TableCell><TableCell sx={{ maxWidth: 360 }}><Typography variant="body2" fontWeight={700} noWrap title={item.subject || "Χωρίς θέμα"}>{item.subject || "Χωρίς θέμα"}</Typography><Typography variant="caption" color="text.secondary" noWrap display="block" title={item.body || ""}>{item.body || "—"}</Typography></TableCell><TableCell align="right"><Tooltip title="Διαγραφή"><IconButton size="small" color="error" aria-label="Διαγραφή επικοινωνίας" onClick={() => remove.mutate(item.id)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>)}{pagedCommunications.length === 0 && <TableRow><TableCell colSpan={6}><Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>Δεν βρέθηκαν επικοινωνίες.</Typography></TableCell></TableRow>}</TableBody></Table></Box>
          <TablePagination component="div" count={filteredCommunications.length} page={historyPage} onPageChange={(_event, next) => setHistoryPage(next)} rowsPerPage={historyRowsPerPage} onRowsPerPageChange={event => { setHistoryRowsPerPage(Number(event.target.value)); setHistoryPage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Εγγραφές ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
        </Card>
      </DialogContent>
      <DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setHistoryOpen(false)} sx={{ color: "#fff" }}>Κλείσιμο</Button></DialogActions>
    </Dialog>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Προσθήκη πρόσφατης επικοινωνίας</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}><TextField select size="small" label="Κανάλι" value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value })} SelectProps={{ native: true }}><option>Email</option><option>Τηλέφωνο</option><option>SMS</option><option>Συνάντηση</option><option>Σημείωση</option></TextField><TextField select size="small" label="Κατεύθυνση" value={form.direction} onChange={event => setForm({ ...form, direction: event.target.value })} SelectProps={{ native: true }}><option value="Outbound">Εξερχόμενη</option><option value="Inbound">Εισερχόμενη</option><option value="Internal">Εσωτερική σημείωση</option></TextField>{contacts.length > 0 && <SearchableTextField select size="small" label="Επαφή εταιρείας" value={form.contactId} onChange={event => chooseContact(event.target.value)} SelectProps={{ native: true }}><option value="">Χωρίς επιλογή</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</SearchableTextField>}<Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField fullWidth size="small" label="Όνομα επαφής" value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} /><TextField fullWidth size="small" label="Email / τηλέφωνο" value={form.contactEmail || form.contactPhone} onChange={event => setForm({ ...form, contactEmail: event.target.value })} /></Stack><TextField size="small" type="datetime-local" label="Ημερομηνία & ώρα" value={form.occurredAt} onChange={event => setForm({ ...form, occurredAt: event.target.value })} InputLabelProps={{ shrink: true }} /><TextField size="small" label="Θέμα" value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /><TextField size="small" label="Σημειώσεις επικοινωνίας" value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} multiline minRows={4} /></Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Ακύρωση</Button><Button variant="contained" color="primary" onClick={() => save.mutate()} disabled={save.isPending}>Αποθήκευση</Button></DialogActions></Dialog>
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
export const toCompanyApiPayload = (form: CompanyEditorForm, options?: {
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
  { label: "Γενικά", icon: <InfoOutlinedIcon fontSize="small" /> },
  { label: "Παραγωγή", icon: <DescriptionIcon fontSize="small" /> },
  { label: "Σύνδεση & παραμετρικά", icon: <TuneIcon fontSize="small" /> },
  { label: "Επικοινωνία", icon: <ContactPhoneIcon fontSize="small" /> },
  { label: "Έγγραφα & πεδία", icon: <FolderIcon fontSize="small" /> },
];

const SPLIT_WORKSPACE_TAB_LABELS = [
  { label: "Γενικά", icon: <InfoOutlinedIcon fontSize="small" /> },
  { label: "Επικοινωνία", icon: <ContactPhoneIcon fontSize="small" /> },
  { label: "Παραγωγή", icon: <DescriptionIcon fontSize="small" /> },
  { label: "Παραμετρικά", icon: <TuneIcon fontSize="small" /> },
  { label: "Έγγραφα", icon: <FolderIcon fontSize="small" /> },
  { label: "Πεδία", icon: <TuneIcon fontSize="small" /> },
];

export function WorkspaceProfileTabs({ value, onChange, splitWorkspace = false }: { value: number; onChange: (value: number) => void; splitWorkspace?: boolean }) {
  const items = splitWorkspace ? SPLIT_WORKSPACE_TAB_LABELS : PROFILE_TAB_LABELS;
  return <DetailProfileTabs value={value} onChange={onChange} items={items} />;
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
      <WorkspaceProfileTabs value={tab} onChange={setTab} splitWorkspace />
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
      {tab === 1 && <Stack spacing={1.5}><ProfileSection title="Επικοινωνία εταιρείας"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}><TextField label="Ονοματεπώνυμο επαφής" value={form.contactName ?? ""} onChange={e => update({ contactName: e.target.value })} /><TextField label="Email" type="email" value={form.contactEmail ?? ""} onChange={e => update({ contactEmail: e.target.value })} /><TextField label="Τηλέφωνο" value={form.contactPhone ?? ""} onChange={e => update({ contactPhone: e.target.value })} /></Box></ProfileSection></Stack>}
      {tab === 2 && <Stack spacing={1.5}><ProfileSection title="Παραγωγή και συμβόλαια"><TextField fullWidth label="Κωδικός συνεργασίας / πρακτορείου" value={form.agentCode ?? ""} onChange={e => update({ agentCode: e.target.value })} /><FormControlLabel sx={{ mt: 1 }} control={<Switch checked={form.installZeroCommissionDefaults} onChange={e => update({ installZeroCommissionDefaults: e.target.checked })} />} label="Προσθήκη αρχικών κανόνων προμήθειας" /><Alert severity="info">Οι κανόνες προμηθειών και τα παραμετρικά μπορούν να συμπληρωθούν από την καρτέλα μετά τη δημιουργία.</Alert></ProfileSection></Stack>}
      {tab === 3 && <Stack spacing={1.5}><ProfileSection title="Σύνδεση εταιρείας και γέφυρα"><FormControlLabel control={<Switch checked={form.createBridge} onChange={e => update({ createBridge: e.target.checked })} />} label="Δημιουργία γέφυρας εταιρείας" />{form.createBridge && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5, mt: 1 }}><TextField label="Όνομα γέφυρας" value={form.bridgeName ?? ""} onChange={e => update({ bridgeName: e.target.value })} /><FormControlLabel control={<Switch checked={form.bridgeAutoSync} onChange={e => update({ bridgeAutoSync: e.target.checked })} />} label="Αυτόματος συγχρονισμός" /><TextField label="Ρυθμίσεις γέφυρας (JSON)" value={form.bridgeConfigJson ?? ""} onChange={e => update({ bridgeConfigJson: e.target.value })} multiline minRows={4} sx={{ gridColumn: { md: "1 / -1" } }} /></Box>}</ProfileSection></Stack>}
      {tab === 4 && <Stack spacing={1.5}><ProfileSection title="Έγγραφα"><Alert severity="info">Μετά την αποθήκευση ενεργοποιούνται τα έγγραφα και οι φάκελοι της εταιρείας.</Alert><Typography color="text.secondary">Η καρτέλα θα ανοίξει αυτόματα μετά τη δημιουργία ώστε να συνεχίσετε με τα αρχεία της εταιρείας.</Typography></ProfileSection></Stack>}
      {tab === 5 && <Stack spacing={1.5}><ProfileSection title="Πεδία"><Alert severity="info">Μετά την αποθήκευση ενεργοποιούνται τα προσαρμόσιμα πεδία της εταιρείας.</Alert><Typography color="text.secondary">Στην πλήρη καρτέλα μπορείτε να προσθέσετε όσα ειδικά πεδία χρειάζεται η συνεργασία.</Typography></ProfileSection></Stack>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}><Button onClick={onClose} color="error" variant="contained" sx={{ color: "#fff", fontWeight: 800 }}>Ακύρωση επεξεργασίας</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} disabled={save.isPending || !form.name.trim() || !form.code.trim()} onClick={() => save.mutate()}>{save.isPending ? <CircularProgress size={18} color="inherit" /> : item ? "Αποθήκευση αλλαγών" : "Δημιουργία & αποθήκευση"}</Button></DialogActions>
  </Dialog>;
}

const COMPANY_CORE_FIELDS = [
  ["name", "Επωνυμία"], ["code", "Κωδικός"], ["afmVat", "ΑΦΜ / VAT"], ["country", "Χώρα"],
  ["website", "Ιστοσελίδα"], ["contactName", "Υπεύθυνος"], ["contactEmail", "Email"], ["contactPhone", "Τηλέφωνο"], ["isActive", "Κατάσταση"], ["notes", "Σημειώσεις"],
] as const;

export function CompanyProfileFields({ session, contact = false, isBroker = false }: { session: ReturnType<typeof useProfileFieldEditor>; contact?: boolean; isBroker?: boolean }) {
  const fields = contact ? COMPANY_CORE_FIELDS.filter(([field]) => ["contactName", "contactEmail", "contactPhone", "notes"].includes(field)) : COMPANY_CORE_FIELDS;
  return <Box sx={profileFieldGridSx}>{fields.map(([field, label]) =>
    <ProfileEditableField key={field} field={field} label={label} session={session}
      options={field === "isActive" ? [{ value: "true", label: "Ενεργή" }, { value: "false", label: "Ανενεργή" }] : undefined}
      link={field === "website" ? session.values[field] : field === "contactEmail" && session.values[field] ? "mailto:" + session.values[field] : field === "contactPhone" && session.values[field] ? "tel:" + session.values[field] : undefined}
      type={field === "contactEmail" ? "email" : "text"} multiline={field === "notes"}
      validate={value => customerFieldError(field === "contactEmail" ? "email" : field === "contactPhone" ? "phone" : field, value)} />
  )}{!contact && <ProfileEditableField label="Τύπος" value={isBroker ? "Πρακτορείο" : "Ασφαλιστική εταιρεία"} />}</Box>;
}

function ProductionCompanyProfileDialog({ open, company, startEditing = false, onClose, onChanged }: { open: boolean; company: CompanyDto | null; startEditing?: boolean; onClose: () => void; onChanged?: (saved: CompanyDto) => void }) {
  const [tab, setTab] = useState(0);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [fieldEntryOpen, setFieldEntryOpen] = useState(false);
  const [newField, setNewField] = useState({ label: "", key: "", fieldType: "text", value: "" });
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
    setStatisticsOpen(false);
    setInlineError(null);
    setLogoLocalPreview(null);
  }, [company?.id, open]);
  useEffect(() => () => {
    if (logoQ.data) URL.revokeObjectURL(logoQ.data);
  }, [logoQ.data]);
  useEffect(() => () => { if (logoLocalPreview) URL.revokeObjectURL(logoLocalPreview); }, [logoLocalPreview]);
  const baseKeys = COMPANY_CORE_FIELDS.map(([key]) => key);
  const values = Object.fromEntries([
    ...baseKeys.map(key => [key, String(p?.[key] ?? "")]),
    ...(workspace?.fields ?? []).map(field => ["custom:" + field.id, field.value ?? ""]),
  ]);
  const refreshProfile = () => {
    void qc.invalidateQueries({ queryKey: ["production-company-profile", company?.id] });
    void qc.invalidateQueries({ queryKey: ["production-company-workspace", company?.id] });
    void qc.invalidateQueries({ queryKey: ["production-companies-directory"] });
    void qc.invalidateQueries({ queryKey: ["insurance-companies"] });
  };
  const session = useProfileFieldEditor({
    sessionKey: open ? company?.id ?? "" : "", initialEditing: startEditing, values, onClose, refresh: refreshProfile,
    write: async (changes, accept) => {
      if (!company || !p) throw new Error("Δεν έχει φορτωθεί η καρτέλα εταιρείας.");
      await persistProfileWrites(changes, async primaryChanges => {
        const primary = Object.entries(primaryChanges);
        for (const [key, value] of primary) {
          if (!baseKeys.some(field => field === key)) throw new Error("Το πεδίο εταιρείας δεν υποστηρίζεται.");
          if (key === "isActive" && !["true", "false"].includes(value)) throw new Error("Επιλέξτε Ενεργή ή Ανενεργή.");
          const error = customerFieldError(key === "contactEmail" ? "email" : key === "contactPhone" ? "phone" : key, value);
          if (error) throw new Error(error);
        }
        const current = qc.getQueryData<CarrierProfile>(["production-company-profile", company.id]) ?? p;
        const next = { ...blankCompanyEditorForm(), ...Object.fromEntries(baseKeys.map(key => [key, current[key]])),
          isBroker: current.isBroker ?? company.isBroker ?? false, ...Object.fromEntries(primary) } as CompanyEditorForm;
        if (changes.isActive !== undefined) next.isActive = changes.isActive === "true";
        if (!next.name.trim() || !next.code.trim()) throw new Error("Συμπληρώστε την επωνυμία και τον κωδικό.");
        const saved = (await api.put<CompanyDto>("/insurance-companies/" + company.id, toCompanyApiPayload(next, {
          createBridge: false, bridgeName: null, bridgeAutoSync: false, bridgeConfigJson: null, installZeroCommissionDefaults: false,
        }))).data;
        qc.setQueryData(["production-company-profile", company.id], { ...current, ...saved });
        onChanged?.(saved);
      }, async (key, value) => {
        const fieldId = key.slice(7);
        await api.put("/insurance-companies/" + company.id + "/workspace/fields/" + fieldId + "/value", { value });
        qc.setQueryData<CompanyWorkspace>(["production-company-workspace", company.id], previous => previous ? {
          ...previous, fields: previous.fields.map(field => field.id === fieldId ? { ...field, value } : field),
        } : previous);
      }, accept);
    },
  });
  const editing = session.editAll;
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
    const fieldType = key.includes("expiry") || key.includes("date") ? "date"
      : key === "website" || key.includes("facebook") || key.includes("instagram") || key.includes("linkedin") || key.includes("maps") ? "url" : "text";
    setNewField({ label: label === "Νέο πεδίο" ? "" : label, key, fieldType, value: "" });
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
      setFieldEntryOpen(false);
      setNewField({ label: "", key: "", fieldType: "text", value: "" });
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", company.id] });
    } catch (error) {
      setInlineError(extractErrorMessage(error));
    }
  };
  const customField = (...aliases: string[]) => workspace?.fields.find(field => aliases.some(alias => field.key.toLocaleLowerCase("el-GR").includes(alias) || field.label.toLocaleLowerCase("el-GR").includes(alias)));
  const renderCustomField = (label: string, aliases: string[], mono = false) => {
    const field = customField(...aliases);
    return <ProfileEditableField key={label} label={label} mono={mono} link={field?.value ?? undefined}
      session={field ? session : undefined} field={field ? "custom:" + field.id : undefined}
      type={field?.fieldType === "date" ? "date" : field?.fieldType === "number" ? "number" : "text"}
      onRequestEdit={!field && !workspaceQ.isLoading && !workspaceQ.isError ? () => openFieldCreator(label, aliases[0]) : undefined} />;
  };
  const addressFields: [string, string[], boolean?][] = [
    ["Διεύθυνση", ["address", "διεύθυνση", "εδρα", "έδρα"]], ["Πόλη", ["city", "πόλη"]], ["Τ.Κ.", ["postal", "ταχυδρομ", "τκ", "zip"], true],
    ["Σύμβαση με ασφαλιστική εταιρεία", ["company-contract", "σύμβαση με ασφαλιστική"]],
    ["Ημερομηνία λήξης σύμβασης", ["contract-expiry", "λήξη σύμβασης"]],
    ["Google Maps", ["google maps", "maps"]],
  ];
  const knownCustomIds = new Set(addressFields.map(([, aliases]) => customField(...aliases)?.id).filter(Boolean));
  const isSocialCustomField = (field: CompanyWorkspaceField) =>
    /facebook|instagram|linked\s*in|twitter|x\.com|tiktok|youtube|social|κοινωνικ[άα]\s+δ[ίι]κτυα|\bfb\b|\binsta\b/i.test(`${field.key} ${field.label}`);
  const isDuplicateCoreField = (field: CompanyWorkspaceField) => {
    const label = `${field.key} ${field.label}`.toLocaleLowerCase("el-GR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_]/g, " ");
    return /κωδικος συνεργασιας|cooperation code|agent code|υπευθυνος λογαριασμου|account manager/.test(label);
  };
  const isContactCustomField = (field: CompanyWorkspaceField) => companyFieldPlacement(field) === "contact";
  const placedFields = (placement: CompanyFieldPlacement) => (workspace?.fields ?? []).filter(field => field.isActive && companyFieldPlacement(field) === placement);
  const renderPlacedFields = (placement: CompanyFieldPlacement) => {
    const fields = placedFields(placement);
    if (fields.length === 0) return null;
    return <ProfileSection title={`Προσαρμόσιμα πεδία · ${companyFieldPlacementLabel[placement]}`}><Box sx={profileFieldGridSx}>{fields.map(field => <ProfileEditableField key={field.id} label={field.label} field={"custom:" + field.id} session={session} link={field.value ?? undefined} type={field.fieldType === "date" ? "date" : field.fieldType === "number" ? "number" : "text"} />)}</Box></ProfileSection>;
  };
  return <Dialog open={open} onClose={session.requestClose} fullWidth maxWidth="xl" PaperProps={{ sx: profileDialogPaperSx }}>
    <DialogTitle sx={{ px: 1.25, py: .9, bgcolor: "#0b305c", color: "#fff" }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <BusinessIcon /><Box sx={{ minWidth: 0 }}><Typography variant="h6" fontWeight={850} sx={{ overflowWrap: "anywhere" }}>{p?.name ?? company?.name ?? "—"}</Typography><Typography variant="caption">{p?.code ?? company?.code}</Typography></Box>
      </Stack>
    </DialogTitle>
    <DialogContent dividers sx={{
      // Keep the profile surface flush with the dialog edge so its sticky
      // navigation never leaves a gap or gets clipped while scrolling.
      p: { xs: .65, md: 1.25 }, minHeight: 0,
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
      {workspaceQ.isError && <Alert severity="error" sx={{ mb: .75 }}>Δεν φορτώθηκαν τα πρόσθετα στοιχεία της εταιρείας. Δοκιμάστε να ανοίξετε ξανά την καρτέλα.</Alert>}
      {inlineError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setInlineError(null)}>{inlineError}</Alert>}
      <ProfileEditorFeedback session={session} />
      {p && <>
        <WorkspaceProfileTabs value={tab} onChange={setTab} splitWorkspace />

        {tab === 0 && <Stack spacing={.75}>
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

          <CompanyProfileFields session={session} isBroker={p.isBroker ?? company?.isBroker} />
          <Box sx={profileFieldGridSx}>{addressFields.map(([label, aliases, mono]) => renderCustomField(label, aliases, mono))}</Box>
          <Box sx={profileFieldGridSx}>{(workspace?.fields ?? []).filter(field => field.isActive && companyFieldPlacement(field) === "general" && !knownCustomIds.has(field.id) && !isSocialCustomField(field) && !isDuplicateCoreField(field)).map(field =>
            <Box key={field.id} sx={{ minWidth: 0 }}>
              <ProfileEditableField label={field.label} field={"custom:" + field.id} session={session} link={field.value ?? undefined}
                type={field.fieldType === "date" ? "date" : field.fieldType === "number" ? "number" : "text"} />
            </Box>)}</Box>
        </Stack>}
        {tab === 3 && <Stack spacing={1.5}><ProfileMetricGrid items={[["Κλάδοι", String(p.branchCount), "info"], ["Πακέτα", String(p.packageCount), "info"], ["Χρήσεις", String(p.useCount), "info"], ["Καλύψεις", String(p.coverageCount), "info"], ["Γέφυρα", p.bridgeLinked ? "Συνδεδεμένη" : "Χωρίς σύνδεση", p.bridgeLinked ? "success" : "warning"]]} /><ProfileSection title="Σύνδεση εταιρείας"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: .75 }}>{[["Πηγή γέφυρας", p.bridgeLinkedSourceCarrier], ["Κατάσταση", p.isActive ? "Ενεργή" : "Ανενεργή"], ["Δημιουργήθηκε", date(p.createdAt)]].map(([label, value]) => <Box key={label} sx={{ minWidth: 0, px: 1.1, py: .85, border: "1px solid #d6e3f0", borderRadius: 1.5, bgcolor: "#f8fafc" }}><Typography variant="caption" color="text.secondary" fontWeight={750} display="block">{label}</Typography><Typography variant="body2" color="#102d55" fontWeight={850} noWrap title={value || "—"}>{value || "—"}</Typography></Box>)}</Box></ProfileSection>{renderPlacedFields("connection")}</Stack>}

        {tab === 1 && <Stack spacing={.75}>
          <ProfileSection title="Πρόσωπα, στελέχη & πολλαπλές επικοινωνίες">
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Κύριες και πρόσθετες επαφές, τηλέφωνα και email της εταιρείας.</Typography>
              <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => openContactEditor()}>Προσθήκη επαφής</Button>
            </Stack>
            <CompanyProfileFields session={session} contact />
            <Box sx={{ ...profileFieldGridSx, mt: .75 }}>{(workspace?.fields ?? []).filter(field => field.isActive && isContactCustomField(field) && !isSocialCustomField(field) && !knownCustomIds.has(field.id) && !isDuplicateCoreField(field)).map(field => <Box key={field.id} sx={{ minWidth: 0 }}><ProfileEditableField label={field.label} field={"custom:" + field.id} session={session} link={field.value ?? undefined} type={field.fieldType === "date" ? "date" : field.fieldType === "number" ? "number" : "text"} /></Box>)}</Box>
            {workspaceQ.isLoading && <Typography variant="body2" color="text.secondary">Φόρτωση επαφών…</Typography>}
            {!workspaceQ.isLoading && (workspace?.contacts ?? []).filter(contact => contact.isActive).length === 0 && <Typography variant="body2" color="text.secondary">Δεν έχουν καταχωρηθεί επιπλέον στελέχη.</Typography>}
            {(workspace?.contacts ?? []).filter(contact => contact.isActive).map(contact => <Box key={contact.id} sx={{ mt: .75, pt: .75, borderTop: "1px solid", borderColor: "divider" }}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography variant="subtitle2" fontWeight={800}>{contact.name}{contact.isPrimary && <Chip size="small" color="primary" label="Κύρια" sx={{ ml: .75 }} />}</Typography><Stack direction="row" spacing={.5}><Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openContactEditor(contact)}>Επεξεργασία</Button><IconButton size="small" color="error" aria-label="Διαγραφή επαφής" onClick={() => void deleteContact(contact)}><DeleteOutlineIcon fontSize="small" /></IconButton></Stack></Stack><Box sx={{ ...profileFieldGridSx, mt: .5 }}><ProfileEditableField label="Ρόλος / τμήμα" value={[contact.role, contact.department].filter(Boolean).join(" · ")} /><ProfileEditableField label="Email" value={contact.email} link={contact.email ? `mailto:${contact.email}` : undefined} /><ProfileEditableField label="Τηλέφωνο" value={contact.phone} link={contact.phone ? `tel:${contact.phone}` : undefined} /><ProfileEditableField label="Κινητό" value={contact.mobile} link={contact.mobile ? `tel:${contact.mobile}` : undefined} />{contact.notes && <ProfileEditableField label="Σημειώσεις" value={contact.notes} multiline />}</Box></Box>)}
          </ProfileSection>
        </Stack>}
        {tab === 2 && company && <Stack spacing={1.5}><CompanyPoliciesSection companyId={company.id} />{renderPlacedFields("production")}</Stack>}
        {tab === 3 && company && <><CompanyParametricsSection companyId={company.id} companyName={company.name} />{(company.isBroker || p.isBroker) && <CompanyPartnerCompaniesSection companyId={company.id} />}</>}
        {tab === 1 && company && <CompanyCommunicationSection companyId={company.id} workspace={workspace} />}
        {tab === 4 && company && <CompanyDocumentsWorkspace companyId={company.id} view="documents" />}
        {tab === 5 && company && <CompanyDocumentsWorkspace companyId={company.id} view="fields" />}
      </>}
      <Dialog open={fieldEntryOpen} onClose={() => setFieldEntryOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Προσθήκη πεδίου</DialogTitle><DialogContent><Stack spacing={1.25} sx={{ pt: 1 }}><TextField autoFocus fullWidth size="small" label="Τίτλος πεδίου" value={newField.label} onChange={event => setNewField(current => ({ ...current, label: event.target.value }))} /><TextField fullWidth size="small" type={newField.fieldType === "date" ? "date" : newField.fieldType === "number" ? "number" : "text"} InputLabelProps={newField.fieldType === "date" ? { shrink: true } : undefined} label="Περιεχόμενο πεδίου" value={newField.value} onChange={event => setNewField(current => ({ ...current, value: event.target.value }))} multiline={newField.fieldType === "text"} minRows={newField.fieldType === "text" ? 3 : undefined} /></Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setFieldEntryOpen(false)} sx={{ color: "#fff" }}>Ακύρωση επεξεργασίας</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void createField()} disabled={!newField.label.trim() || !newField.value.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
      </DialogContent><Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} fullWidth maxWidth="md"><DialogTitle>{editingContactId ? "Επεξεργασία επαφής" : "Προσθήκη επαφής"}</DialogTitle><DialogContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, pt: 1 }}><TextField autoFocus size="small" label="Ονοματεπώνυμο *" value={contactDraft.name} onChange={event => setContactDraft(current => ({ ...current, name: event.target.value }))} /><TextField size="small" label="Ρόλος" value={contactDraft.role} onChange={event => setContactDraft(current => ({ ...current, role: event.target.value }))} /><TextField size="small" label="Τμήμα" value={contactDraft.department} onChange={event => setContactDraft(current => ({ ...current, department: event.target.value }))} /><TextField size="small" type="email" label="Email" value={contactDraft.email} onChange={event => setContactDraft(current => ({ ...current, email: event.target.value }))} /><TextField size="small" label="Τηλέφωνο" value={contactDraft.phone} onChange={event => setContactDraft(current => ({ ...current, phone: event.target.value }))} /><TextField size="small" label="Κινητό" value={contactDraft.mobile} onChange={event => setContactDraft(current => ({ ...current, mobile: event.target.value }))} /><TextField size="small" multiline minRows={2} label="Σημειώσεις" value={contactDraft.notes} onChange={event => setContactDraft(current => ({ ...current, notes: event.target.value }))} sx={{ gridColumn: { sm: "1 / -1" } }} /><FormControlLabel control={<Switch checked={contactDraft.isPrimary} onChange={event => setContactDraft(current => ({ ...current, isPrimary: event.target.checked }))} />} label="Κύρια επαφή" /></Box></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setContactDialogOpen(false)} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void saveContact()} disabled={!contactDraft.name.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
      {p && <Dialog open={statisticsOpen} onClose={() => setStatisticsOpen(false)} fullWidth maxWidth="xl"><DialogTitle>Στατιστικά · {p.name}</DialogTitle><DialogContent dividers>{company && <CompanyStatisticsSection companyId={company.id} profile={p} />}</DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => setStatisticsOpen(false)} sx={{ color: "#fff" }}>Κλείσιμο</Button></DialogActions></Dialog>}
      <DialogActions sx={{ px: 1.25, py: .6 }}><Stack direction="row" spacing={.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap width="100%"><Button size="small" variant="contained" color="primary" startIcon={<BarChartIcon />} onClick={() => setStatisticsOpen(true)} disabled={!p} sx={{ color: "#fff", fontWeight: 800 }}>Στατιστικά</Button><ProfileEditorActions session={session} label={p?.isBroker ? "πρακτορείου" : "εταιρείας"} /></Stack></DialogActions>
  </Dialog>;
}

interface CompanyWorkspaceFolder { id: string; name: string; description: string | null; parentFolderId: string | null; color: string; documentCount: number; createdAt: string; }
interface CompanyWorkspaceDocument { id: string; folderId: string | null; fileName: string; mimeType: string; sizeBytes: number; category: string; description: string | null; tags: string[]; documentDate: string | null; expiresOn: string | null; isConfidential: boolean; uploadedByUserId: string | null; createdAt: string; }
interface CompanyWorkspaceField { id: string; key: string; label: string; fieldType: string; options: string[]; isRequired: boolean; isActive: boolean; sortOrder: number; value: string | null; }
interface CompanyWorkspaceCategory { id: string; name: string; color: string; isActive: boolean; sortOrder: number; documentCount: number; }
interface CompanyWorkspaceContact { id: string; name: string; role: string | null; department: string | null; email: string | null; phone: string | null; mobile: string | null; notes: string | null; preferredChannel: string; isPrimary: boolean; isActive: boolean; }
interface CompanyWorkspace { folders: CompanyWorkspaceFolder[]; documents: CompanyWorkspaceDocument[]; fields: CompanyWorkspaceField[]; categories: CompanyWorkspaceCategory[]; contacts: CompanyWorkspaceContact[]; communications: CompanyCommunicationRow[]; }

type CompanyFieldPlacement = "general" | "production" | "connection" | "contact";
const companyFieldPlacement = (field: CompanyWorkspaceField): CompanyFieldPlacement => {
  const configured = field.options.find(option => option.startsWith("__tab:"))?.slice(6);
  if (configured === "general" || configured === "production" || configured === "connection" || configured === "contact") return configured;
  return field.key.toLocaleLowerCase("el-GR").startsWith("contact-") ? "contact" : "general";
};
const companyFieldPlacementLabel: Record<CompanyFieldPlacement, string> = {
  general: "Γενικά", production: "Παραγωγή", connection: "Σύνδεση & παραμετρικά", contact: "Επικοινωνία",
};

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

function CompanyDocumentsWorkspace({ companyId, view }: { companyId: string; view: "documents" | "fields" }) {
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
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldPlacement, setFieldPlacement] = useState<CompanyFieldPlacement>("general");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldPage, setFieldPage] = useState(0);
  const [fieldRowsPerPage, setFieldRowsPerPage] = useState(10);
  const [documentPage, setDocumentPage] = useState(0);
  const [documentRowsPerPage, setDocumentRowsPerPage] = useState(10);
  const [previewDocument, setPreviewDocument] = useState<CompanyWorkspaceDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [movingDocument, setMovingDocument] = useState<CompanyWorkspaceDocument | null>(null);
  const [destinationFolderId, setDestinationFolderId] = useState("");
  const [movePending, setMovePending] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [documentNotice, setDocumentNotice] = useState<string | null>(null);
  const workspaceQ = useQuery({
    queryKey: ["production-company-workspace", companyId],
    queryFn: async () => (await api.get<CompanyWorkspace>(`/insurance-companies/${companyId}/workspace`)).data,
  });
  const workspace = workspaceQ.data;
  useEffect(() => {
    if (!workspace) return;
    if (selectedFolderId && !workspace.folders.some(folder => folder.id === selectedFolderId)) setSelectedFolderId(null);
  }, [workspace, selectedFolderId]);
  const selectedDocuments = (workspace?.documents ?? []).filter(document => !selectedFolderId || document.folderId === selectedFolderId);
  const pagedDocuments = selectedDocuments.slice(documentPage * documentRowsPerPage, documentPage * documentRowsPerPage + documentRowsPerPage);
  const activeFields = (workspace?.fields ?? []).filter(field => field.isActive);
  const pagedFields = activeFields.slice(fieldPage * fieldRowsPerPage, fieldPage * fieldRowsPerPage + fieldRowsPerPage);
  const endpoint = `/insurance-companies/${companyId}/workspace`;
  const refresh = () => void qc.invalidateQueries({ queryKey: ["production-company-workspace", companyId] });
  const openMoveDocument = (document: CompanyWorkspaceDocument) => {
    setMovingDocument(document);
    setDestinationFolderId(document.folderId ?? "");
    setMoveError(null);
  };
  const moveDocument = async () => {
    if (!movingDocument) return;
    setMovePending(true);
    setMoveError(null);
    try {
      await api.put(`${endpoint}/documents/${movingDocument.id}/folder`, { folderId: destinationFolderId || null });
      await qc.invalidateQueries({ queryKey: ["production-company-workspace", companyId] });
      setDocumentNotice(`Το αρχείο «${movingDocument.fileName}» μεταφέρθηκε επιτυχώς.`);
      setMovingDocument(null);
    } catch (e) { setMoveError(extractErrorMessage(e)); }
    finally { setMovePending(false); }
  };
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
  const resetFieldDialog = () => {
    setFieldDialog(false); setEditingFieldId(null); setFieldLabel(""); setFieldKey(""); setFieldType("text"); setFieldRequired(false); setFieldPlacement("general");
  };
  const openNewField = () => { resetFieldDialog(); setFieldDialog(true); };
  const openExistingField = (field: CompanyWorkspaceField) => {
    setEditingFieldId(field.id); setFieldLabel(field.label); setFieldKey(field.key); setFieldType(field.fieldType);
    setFieldRequired(field.isRequired); setFieldPlacement(companyFieldPlacement(field)); setFieldDialog(true);
  };
  const createField = async () => {
    try {
      const body = { label: fieldLabel, key: fieldKey, fieldType, options: [`__tab:${fieldPlacement}`], isRequired: fieldRequired, sortOrder: editingFieldId ? activeFields.find(field => field.id === editingFieldId)?.sortOrder ?? 0 : activeFields.length };
      if (editingFieldId) await api.put(`${endpoint}/fields/${editingFieldId}`, body);
      else await api.post(`${endpoint}/fields`, body);
      resetFieldDialog(); refresh();
    } catch (e) { setError(extractErrorMessage(e)); }
  };
  const deleteFieldDefinition = async (field: CompanyWorkspaceField) => {
    if (!window.confirm(`Διαγραφή του προσαρμόσιμου πεδίου «${field.label}»;`)) return;
    try { await api.delete(`${endpoint}/fields/${field.id}`); refresh(); }
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
  const previewFile = async (document: CompanyWorkspaceDocument) => {
    setPreviewDocument(document); setPreviewLoading(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    try {
      const response = await api.get(`${endpoint}/documents/${document.id}/download`, { responseType: "blob" });
      setPreviewUrl(URL.createObjectURL(response.data));
    } catch (e) { setError(extractErrorMessage(e)); setPreviewDocument(null); }
    finally { setPreviewLoading(false); }
  };
  const closePreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewDocument(null); };
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { setDocumentPage(0); }, [selectedFolderId]);
  useEffect(() => {
    const lastDocumentPage = Math.max(0, Math.ceil(selectedDocuments.length / documentRowsPerPage) - 1);
    if (documentPage > lastDocumentPage) setDocumentPage(lastDocumentPage);
    const lastFieldPage = Math.max(0, Math.ceil(activeFields.length / fieldRowsPerPage) - 1);
    if (fieldPage > lastFieldPage) setFieldPage(lastFieldPage);
  }, [activeFields.length, documentPage, documentRowsPerPage, fieldPage, fieldRowsPerPage, selectedDocuments.length]);
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
    {documentNotice && <Alert severity="success" onClose={() => setDocumentNotice(null)}>{documentNotice}</Alert>}
    {view === "documents" && <>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
      <Typography variant="body2" color="text.secondary">Οργανώστε συμβάσεις, αλληλογραφία, τιμοκαταλόγους και κάθε αρχείο της εταιρείας σε δικούς σας φακέλους.</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={() => setFolderDialog(true)}>Νέος φάκελος</Button>
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
        <Card variant="outlined" sx={{ overflow: "hidden" }}><Box sx={{ overflow: "auto", maxHeight: 430 }}><Table size="small" stickyHeader sx={{ minWidth: 760 }}><TableHead><TableRow><TableCell>Αρχείο</TableCell><TableCell>Κατηγορία</TableCell><TableCell>Μέγεθος</TableCell><TableCell>Ημερομηνία</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead><TableBody>{pagedDocuments.map(document => <TableRow key={document.id} hover><TableCell><Typography fontWeight={700}>{document.fileName}</Typography>{document.description && <Typography variant="caption" color="text.secondary">{document.description}</Typography>}{document.isConfidential && <Chip size="small" color="warning" label="Εμπιστευτικό" sx={{ ml: 0.75 }} />}</TableCell><TableCell>{document.category}</TableCell><TableCell>{(document.sizeBytes / 1024).toFixed(0)} KB</TableCell><TableCell>{new Date(document.createdAt).toLocaleDateString("el-GR")}</TableCell><TableCell align="right"><Tooltip title="Προεπισκόπηση"><IconButton size="small" color="primary" onClick={() => void previewFile(document)} aria-label={`Προεπισκόπηση ${document.fileName}`}><VisibilityIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Λήψη"><IconButton size="small" onClick={() => void downloadDocument(document)}><DownloadIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Μεταφορά σε φάκελο"><IconButton size="small" color="primary" aria-label={`Μεταφορά ${document.fileName} σε φάκελο`} onClick={() => openMoveDocument(document)}><DriveFileMoveIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Διαγραφή"><IconButton size="small" color="error" onClick={() => void deleteDocument(document)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>)}{pagedDocuments.length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>Δεν υπάρχουν αρχεία σε αυτή την προβολή.</Typography></TableCell></TableRow>}</TableBody></Table></Box><TablePagination component="div" count={selectedDocuments.length} page={documentPage} onPageChange={(_event, next) => setDocumentPage(next)} rowsPerPage={documentRowsPerPage} onRowsPerPageChange={event => { setDocumentRowsPerPage(Number(event.target.value)); setDocumentPage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Αρχεία ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} /></Card>
      </Stack>
    </Box>
    </>}
    <Dialog open={movingDocument !== null} onClose={() => { if (!movePending) setMovingDocument(null); }} fullWidth maxWidth="sm">
      <DialogTitle>Μεταφορά εγγράφου</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography sx={{ overflowWrap: "anywhere" }}>{movingDocument?.fileName}</Typography>
          {moveError && <Alert severity="error">{moveError}</Alert>}
          <TextField select fullWidth size="small" label="Φάκελος προορισμού" value={destinationFolderId}
            onChange={event => setDestinationFolderId(event.target.value)} SelectProps={{ native: true }} disabled={movePending}>
            <option value="">Χωρίς φάκελο</option>
            {(workspace?.folders ?? []).map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" startIcon={<CloseIcon />} disabled={movePending} onClick={() => setMovingDocument(null)}>Ακύρωση</Button>
        <Button variant="contained" startIcon={movePending ? <CircularProgress size={16} color="inherit" /> : <DriveFileMoveIcon />}
          disabled={movePending || destinationFolderId === (movingDocument?.folderId ?? "")}
          onClick={() => void moveDocument()}>Μεταφορά</Button>
      </DialogActions>
    </Dialog>
    {view === "fields" && <ProfileSection title="Διαχείριση προσαρμόσιμων πεδίων"><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Ορίστε τον τύπο, το tab εμφάνισης και τη σειρά των πρόσθετων πεδίων της εταιρείας.</Typography><Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={openNewField}>Νέο προσαρμόσιμο πεδίο</Button></Stack><Card variant="outlined" sx={{ overflow: "hidden" }}><Box sx={{ overflow: "auto", maxHeight: 460 }}><Table size="small" stickyHeader sx={{ minWidth: 760 }}><TableHead><TableRow><TableCell>Ετικέτα</TableCell><TableCell>Κλειδί</TableCell><TableCell>Τύπος</TableCell><TableCell>Εμφάνιση στο tab</TableCell><TableCell>Υποχρεωτικό</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead><TableBody>{pagedFields.map(field => <TableRow key={field.id} hover><TableCell sx={{ fontWeight: 750 }}>{field.label}</TableCell><TableCell sx={{ fontFamily: "monospace" }}>{field.key}</TableCell><TableCell>{field.fieldType === "date" ? "Ημερομηνία" : field.fieldType === "number" ? "Αριθμός" : field.fieldType === "url" ? "Σύνδεσμος" : "Κείμενο"}</TableCell><TableCell><Chip size="small" variant="outlined" color="primary" label={companyFieldPlacementLabel[companyFieldPlacement(field)]} /></TableCell><TableCell>{field.isRequired ? "Ναι" : "Όχι"}</TableCell><TableCell align="right"><Tooltip title="Επεξεργασία"><IconButton size="small" color="primary" onClick={() => openExistingField(field)}><EditIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Διαγραφή"><IconButton size="small" color="error" onClick={() => void deleteFieldDefinition(field)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>)}{pagedFields.length === 0 && <TableRow><TableCell colSpan={6}><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>Δεν έχουν οριστεί προσαρμόσιμα πεδία.</Typography></TableCell></TableRow>}</TableBody></Table></Box><TablePagination component="div" count={activeFields.length} page={fieldPage} onPageChange={(_event, next) => setFieldPage(next)} rowsPerPage={fieldRowsPerPage} onRowsPerPageChange={event => { setFieldRowsPerPage(Number(event.target.value)); setFieldPage(0); }} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Πεδία ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} /></Card></ProfileSection>}
    {view === "documents" && <><Dialog open={folderDialog} onClose={() => setFolderDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέος φάκελος εταιρείας</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><TextField label="Όνομα φακέλου" value={folderName} onChange={e => setFolderName(e.target.value)} autoFocus /><TextField label="Περιγραφή" value={folderDescription} onChange={e => setFolderDescription(e.target.value)} multiline minRows={2} /></Stack></DialogContent><DialogActions><Button onClick={() => setFolderDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createFolder()} disabled={!folderName.trim()}>Δημιουργία</Button></DialogActions></Dialog>
    <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} fullWidth maxWidth="xs"><DialogTitle>Νέα κατηγορία εγγράφων</DialogTitle><DialogContent><TextField fullWidth sx={{ mt: 1 }} label="Όνομα κατηγορίας" value={categoryName} onChange={e => setCategoryName(e.target.value)} autoFocus /></DialogContent><DialogActions><Button onClick={() => setCategoryDialog(false)}>Άκυρο</Button><Button variant="contained" onClick={() => void createCategory()} disabled={!categoryName.trim()}>Δημιουργία</Button></DialogActions></Dialog></>}
    {view === "fields" && <Dialog open={fieldDialog} onClose={resetFieldDialog} fullWidth maxWidth="xs"><DialogTitle>{editingFieldId ? "Επεξεργασία προσαρμόσιμου πεδίου" : "Νέο προσαρμόσιμο πεδίο"}</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><TextField label="Ετικέτα" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} autoFocus /><TextField label="Κλειδί (π.χ. υπεύθυνος-λογαριασμού)" value={fieldKey} onChange={e => setFieldKey(e.target.value)} /><TextField select SelectProps={{ native: true }} label="Τύπος" value={fieldType} onChange={e => setFieldType(e.target.value)}><option value="text">Κείμενο</option><option value="number">Αριθμός</option><option value="date">Ημερομηνία</option><option value="url">Σύνδεσμος</option></TextField><TextField select SelectProps={{ native: true }} label="Εμφάνιση στο tab" value={fieldPlacement} onChange={e => setFieldPlacement(e.target.value as CompanyFieldPlacement)}><option value="general">Γενικά</option><option value="production">Παραγωγή</option><option value="connection">Σύνδεση & παραμετρικά</option><option value="contact">Επικοινωνία</option></TextField><Button size="small" variant={fieldRequired ? "contained" : "outlined"} onClick={() => setFieldRequired(value => !value)}>{fieldRequired ? "Υποχρεωτικό" : "Προαιρετικό"}</Button></Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={resetFieldDialog} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => void createField()} disabled={!fieldLabel.trim() || !fieldKey.trim()}>{editingFieldId ? "Αποθήκευση" : "Προσθήκη"}</Button></DialogActions></Dialog>}
    <Dialog open={!!previewDocument} onClose={closePreview} fullWidth maxWidth="lg"><DialogTitle>Προεπισκόπηση · {previewDocument?.fileName}</DialogTitle><DialogContent dividers sx={{ minHeight: 520, display: "grid", placeItems: "center", bgcolor: "#edf3f9" }}>{previewLoading && <CircularProgress />}{!previewLoading && previewDocument && previewUrl && (previewDocument.mimeType.startsWith("image/") ? <Box component="img" src={previewUrl} alt={previewDocument.fileName} sx={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} /> : previewDocument.mimeType === "application/pdf" || previewDocument.mimeType.startsWith("text/") ? <Box component="iframe" src={previewUrl} title={`Προεπισκόπηση ${previewDocument.fileName}`} sx={{ width: "100%", height: "70vh", border: 0, bgcolor: "#fff" }} /> : <Stack spacing={1.5} alignItems="center"><DescriptionIcon color="primary" sx={{ fontSize: 54 }} /><Typography fontWeight={800}>Η ζωντανή προεπισκόπηση δεν υποστηρίζεται από τον browser για αυτόν τον τύπο αρχείου.</Typography><Button variant="contained" startIcon={<DownloadIcon />} onClick={() => void downloadDocument(previewDocument)}>Λήψη αρχείου</Button></Stack>)}</DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={closePreview} sx={{ color: "#fff" }}>Κλείσιμο</Button></DialogActions></Dialog>
  </Stack>;
}

function ProfileMetricGrid({ items }: { items: Array<[string, string, "success" | "warning" | "error" | "info"]> }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: `repeat(${Math.min(items.length, 6)},minmax(0,1fr))` }, gap: 1 }}>{items.map(([label, value, color]) => <Box key={label} sx={{ p: 1, borderRadius: 1, bgcolor: `rgba(${color === "success" ? "46,125,50" : color === "warning" ? "237,108,2" : color === "error" ? "211,47,47" : "25,118,210"},0.07)`, border: "1px solid", borderColor: `rgba(${color === "success" ? "46,125,50" : color === "warning" ? "237,108,2" : color === "error" ? "211,47,47" : "25,118,210"},0.2)` }}><Typography variant="caption" color="text.secondary" display="block">{label}</Typography><Typography fontWeight={800}>{value}</Typography></Box>)}</Box>;
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card variant="outlined" sx={{ p: .75, bgcolor: "#edf3f9", borderColor: "#d6e3f0", boxShadow: "none", minWidth: 0 }}><Typography variant="subtitle2" fontWeight={800} sx={{ mb: .5, color: "primary.dark", fontSize: ".8rem" }}>{title}</Typography>{children}</Card>;
}

function ProfileLine({ label, value, mono, link }: { label: string; value?: string | null; mono?: boolean; link?: string }) {
  return <Box sx={{ py: .15, minWidth: 0 }}><ProfileEditableField label={label} value={value} mono={mono} link={link} /></Box>;
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

export function buildOfficeProfileUpdate(office: OfficeDto, changes: Record<string, string>) {
  const baseKeys = ["code", "name", "city", "address", "postalCode", "phone", "email", "isHeadquarters", "isActive", "notes"] as const;
  const base: Record<string, unknown> = Object.fromEntries(baseKeys.map(key => [key, office[key]]));
  let profileJson = office.profileJson ?? null;
  const profileChanges = Object.entries(changes).filter(([key]) => key.startsWith("profile:"));
  if (profileChanges.length) {
    let profile: Record<string, unknown> = {};
    if (profileJson) {
      try {
        const parsed: unknown = JSON.parse(profileJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        profile = parsed as Record<string, unknown>;
      } catch { throw new Error("Τα υπάρχοντα πρόσθετα στοιχεία δεν είναι έγκυρα. Δεν τροποποιήθηκαν τα δεδομένα."); }
    }
    for (const [key, value] of profileChanges) {
      const property = key.slice(8);
      if (!Object.prototype.hasOwnProperty.call(blankOfficeProfile(), property)) throw new Error("Το πεδίο πρακτορείου δεν υποστηρίζεται.");
      profile[property] = value;
    }
    profileJson = JSON.stringify(profile);
  }
  for (const [key, value] of Object.entries(changes).filter(([field]) => !field.startsWith("profile:"))) {
    if (!baseKeys.some(field => field === key)) throw new Error("Το πεδίο πρακτορείου δεν υποστηρίζεται.");
    if (key === "email" || key === "phone") {
      const error = customerFieldError(key, value);
      if (error) throw new Error(error);
    }
    if (key === "isActive" || key === "isHeadquarters") {
      if (!["true", "false"].includes(value)) throw new Error("Επιλέξτε Ναι ή Όχι.");
      base[key] = value === "true";
    } else base[key] = value.trim() || null;
  }
  const code = String(base.code ?? "").trim().toUpperCase(), name = String(base.name ?? "").trim();
  if (!code || !name) throw new Error("Συμπληρώστε τον κωδικό και το όνομα πρακτορείου.");
  return { ...base, code, name, profileJson };
}

const OFFICE_PROFILE_FIELD_GROUPS: readonly (readonly [string, string])[][] = [
  [["code", "Κωδικός"], ["name", "Όνομα"], ["profile:vatNumber", "ΑΦΜ / VAT"], ["profile:legalForm", "Νομική μορφή"],
   ["profile:registrationNumber", "ΓΕΜΗ / ειδικό μητρώο"], ["city", "Πόλη"], ["address", "Διεύθυνση"], ["postalCode", "Τ.Κ."],
   ["profile:website", "Ιστοσελίδα"], ["phone", "Τηλέφωνο"], ["email", "Email"], ["isHeadquarters", "Κεντρικό πρακτορείο"], ["isActive", "Κατάσταση"], ["notes", "Σημειώσεις"]],
  [["profile:cooperatingCompanies", "Συνεργαζόμενες ασφαλιστικές"], ["profile:services", "Κλάδοι και υπηρεσίες"]],
  [["profile:quoteSystem", "Σύστημα πολυτιμολόγησης"], ["profile:quoteSystemDetails", "Λεπτομέρειες σύνδεσης"], ["profile:openingHours", "Ώρες λειτουργίας"]],
  [["phone", "Κύριο τηλέφωνο"], ["email", "Κύριο email"], ["profile:secondaryPhones", "Επιπλέον τηλέφωνα"], ["profile:secondaryEmails", "Επιπλέον email"],
   ["profile:accountingContact", "Λογιστήριο / οικονομική επαφή"], ["profile:socialLinks", "Κοινωνικά δίκτυα"], ["profile:openingHours", "Ώρες λειτουργίας"]],
  [["profile:internalProfileNotes", "Πρόσθετες πληροφορίες"], ["notes", "Εσωτερικές σημειώσεις"]],
];

export function OfficeProfileFields({ tab, session }: { tab: number; session: ReturnType<typeof useProfileFieldEditor> }) {
  return <Box sx={profileFieldGridSx}>{(OFFICE_PROFILE_FIELD_GROUPS[tab] ?? []).map(([field, label]) =>
    <ProfileEditableField key={field} field={field} label={label} session={session}
      link={field === "email" && session.values[field] ? "mailto:" + session.values[field] : field === "phone" && session.values[field] ? "tel:" + session.values[field] : field === "profile:website" ? session.values[field] : undefined}
      options={field === "isActive" ? [{ value: "true", label: "Ενεργό" }, { value: "false", label: "Ανενεργό" }]
        : field === "isHeadquarters" ? [{ value: "true", label: "Ναι" }, { value: "false", label: "Όχι" }] : undefined}
      type={field === "email" ? "email" : "text"} multiline={["notes", "profile:services", "profile:cooperatingCompanies", "profile:internalProfileNotes", "profile:quoteSystemDetails"].includes(field)}
      validate={field === "email" || field === "phone" ? value => customerFieldError(field, value) : undefined} />
  )}</Box>;
}

function ProductionOfficeProfileDialog({ open, office, onClose, onChanged }: {
  open: boolean; office: OfficeDto | null; onClose: () => void; onChanged: (office: OfficeDto) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [savedOffice, setSavedOffice] = useState<OfficeDto | null>(office);
  const currentOffice = savedOffice?.id === office?.id ? savedOffice : office;
  const profile = parseOfficeProfile(currentOffice?.profileJson);
  const usersQ = useQuery({ queryKey: ["production-office-users", office?.id], enabled: open && !!office, queryFn: async () => (await api.get<OfficeUserDto[]>("/agency-offices/" + office!.id + "/users")).data });
  const users = (usersQ.data ?? []).filter(user => user.isAssigned);
  useEffect(() => { setTab(0); setSavedOffice(office); }, [open, office?.id]);
  const values = Object.fromEntries([
    ...["code", "name", "city", "address", "postalCode", "phone", "email", "isHeadquarters", "isActive", "notes"].map(key => [key, String(currentOffice?.[key as keyof OfficeDto] ?? "")]),
    ...Object.entries(profile).map(([key, value]) => ["profile:" + key, String(value ?? "")]),
  ]);
  const session = useProfileFieldEditor({
    sessionKey: open ? office?.id ?? "" : "", values, onClose,
    refresh: () => { void qc.invalidateQueries({ queryKey: ["production-agency-offices-directory"] }); void qc.invalidateQueries({ queryKey: ["agency-offices"] }); },
    write: async (changes, accept) => {
      if (!currentOffice) throw new Error("Δεν έχει φορτωθεί η καρτέλα πρακτορείου.");
      if (!Object.keys(changes).length) return;
      const response = (await api.put<OfficeDto>("/agency-offices/" + currentOffice.id, buildOfficeProfileUpdate(currentOffice, changes))).data;
      const updated = { ...currentOffice, ...response };
      setSavedOffice(updated); onChanged(updated); accept(Object.keys(changes));
    },
  });
  return <Dialog open={open} onClose={session.requestClose} fullWidth maxWidth="xl" PaperProps={{ sx: profileDialogPaperSx }}>
    <DialogTitle sx={{ px: 1.25, py: .9, bgcolor: "#0b305c", color: "#fff" }}><Stack direction="row" alignItems="center" gap={1}><HomeWorkIcon /><Box sx={{ minWidth: 0 }}><Typography variant="h6" fontWeight={850}>{currentOffice?.name}</Typography><Typography variant="caption">{currentOffice?.code}</Typography></Box></Stack></DialogTitle>
    <DialogContent dividers sx={{ p: { xs: .65, md: 1.25 }, minHeight: 0 }}>
      <WorkspaceProfileTabs value={tab} onChange={setTab} />
      <ProfileEditorFeedback session={session} />
      <OfficeProfileFields tab={tab} session={session} />
      {tab === 2 && <ProfileSection title="Πρόσωπα και ρόλοι">
        {usersQ.isLoading ? <CircularProgress size={20} /> : usersQ.isError ? <Alert severity="error">Δεν φορτώθηκαν οι αναθέσεις χρηστών.</Alert> : users.length === 0 ? <Typography variant="body2" color="text.secondary">Δεν έχουν ανατεθεί χρήστες.</Typography>
          : users.map(user => <Box key={user.userId} sx={profileFieldGridSx}><ProfileLine label="Χρήστης" value={((user.firstName ?? "") + " " + (user.lastName ?? "")).trim() || user.email} /><ProfileLine label="Email" value={user.email} /><ProfileLine label="Ρόλος" value={({ AgencyAdmin: "Διαχειριστής", AgencyOfficeAdmin: "Υπεύθυνος γραφείου", AgencyUser: "Χρήστης γραφείου" })[user.role]} /><ProfileLine label="Κύριο γραφείο" value={user.isPrimary ? "Ναι" : "Όχι"} /></Box>)}
      </ProfileSection>}
    </DialogContent>
    <DialogActions sx={{ px: 1.25, py: .6 }}><ProfileEditorActions session={session} label="πρακτορείου" /></DialogActions>
  </Dialog>;
}
