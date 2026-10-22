import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Box, Button, Chip, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { CustomerPopup } from "./CustomerWorkspace";
import { NEED_LABEL, RELATION_LABEL, filterCustomerNeeds, filterFamilyMembers, matchesFamilySearch, type CustomerNeed, type FamilyMember, type FamilyPolicy } from "./customerFamilyData";

interface CompactColumn<T> { key: string; title: string; cell: (row: T) => ReactNode; align?: "left" | "right" | "center"; }
const tableSx = {
  border: "1px solid #d5e0ec", borderRadius: 1, bgcolor: "#f8fafc", overflow: "hidden",
  "& th": { bgcolor: "#e9eef4", fontWeight: 800, whiteSpace: "nowrap", color: "#102d55" },
  "& td, & th": { py: .55, px: 1, borderColor: "#dfe5ed", fontSize: 12.5 },
  "& tbody tr:nth-of-type(even)": { bgcolor: "#f0f2f5" },
  "& tbody tr:hover": { bgcolor: "#e5edf7" },
};

export function CustomerCompactTable<T>({ rows, columns, rowKey, searchText, searchPlaceholder, filters, label, minWidth = 730 }: {
  rows: T[]; columns: CompactColumn<T>[]; rowKey: (row: T) => string;
  searchText: (row: T) => string; searchPlaceholder: string; filters?: ReactNode; label: string; minWidth?: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const filtered = rows.filter(row => matchesFamilySearch(searchText(row), search));
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  useEffect(() => { setPage(0); }, [rows]);
  return <Box>
    <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 1, pt: .75 }}>
      <TextField size="small" label="Αναζήτηση" placeholder={searchPlaceholder} value={search}
        onChange={event => { setSearch(event.target.value); setPage(0); }}
        inputProps={{ "aria-label": `Αναζήτηση — ${label}` }} sx={{ flex: "1 1 220px", minWidth: 0 }} />
      {filters}
      <Chip size="small" label={`${filtered.length} εγγραφές`} sx={{ bgcolor: "#159b59", color: "#fff", fontWeight: 800, height: 23 }} />
    </Stack>
    <Box sx={tableSx}>
      <TableContainer tabIndex={0} sx={{ maxHeight: 290, overflow: "auto" }}>
        <Table size="small" stickyHeader aria-label={label} sx={{ minWidth }}>
          <TableHead><TableRow>{columns.map(column => <TableCell key={column.key} align={column.align}>{column.title}</TableCell>)}</TableRow></TableHead>
          <TableBody>{visible.map(row => <TableRow key={rowKey(row)}>{columns.map(column => <TableCell key={column.key} align={column.align}>{column.cell(row)}</TableCell>)}</TableRow>)}
            {visible.length === 0 && <TableRow><TableCell colSpan={columns.length} sx={{ textAlign: "center", py: "18px !important", color: "text.secondary" }}>Δεν βρέθηκαν εγγραφές με αυτά τα φίλτρα.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={filtered.length} page={safePage} rowsPerPage={pageSize}
        onPageChange={(_event, next) => setPage(next)} onRowsPerPageChange={event => { setPageSize(Number(event.target.value)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="Ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
        sx={{ "& .MuiTablePagination-toolbar": { minHeight: 40, pl: 1, flexWrap: "wrap", py: .25 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: 11.5 }, "& .MuiTablePagination-input": { ml: .5, mr: 1 }, "& .MuiTablePagination-actions": { ml: 1 }, "& .MuiTablePagination-spacer": { flex: "1 1 0", display: { xs: "none", sm: "block" } } }} />
    </Box>
  </Box>;
}

const textCell = (value: string | null | undefined, maxWidth = 190) => <Tooltip title={value || ""} enterTouchDelay={0}><Typography variant="body2" noWrap sx={{ maxWidth, fontSize: 12.5 }}>{value || "—"}</Typography></Tooltip>;
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("el-GR") : "—";

export function CustomerNeedsTable({ needs, onEdit, onDelete, deleting = false }: { needs: CustomerNeed[]; onEdit: (need: CustomerNeed) => void; onDelete: (need: CustomerNeed) => void; deleting?: boolean }) {
  const [kind, setKind] = useState("");
  const [coverage, setCoverage] = useState("");
  const rows = useMemo(() => filterCustomerNeeds(needs, kind, coverage), [needs, kind, coverage]);
  return <CustomerCompactTable rows={rows} rowKey={need => need.id} label="Περιουσία και ανάγκες ασφάλισης" minWidth={900}
    searchPlaceholder="Περιγραφή, τύπος ή σημειώσεις…" searchText={need => `${need.title} ${NEED_LABEL[need.kind] ?? need.kind} ${need.notes ?? ""}`}
    filters={<><TextField select size="small" label="Τύπος" value={kind} onChange={event => setKind(event.target.value)} sx={{ minWidth: 130 }}><MenuItem value="">Όλοι</MenuItem>{[...new Set(needs.map(need => need.kind))].map(value => <MenuItem key={value} value={value}>{NEED_LABEL[value] ?? value}</MenuItem>)}</TextField>
      <TextField select size="small" label="Κάλυψη" value={coverage} onChange={event => setCoverage(event.target.value)} sx={{ minWidth: 160 }}><MenuItem value="">Όλες</MenuItem><MenuItem value="insured">Με κάλυψη</MenuItem><MenuItem value="uninsured">Χωρίς κάλυψη</MenuItem></TextField></>}
    columns={[
      { key: "kind", title: "Τύπος", cell: need => NEED_LABEL[need.kind] ?? need.kind },
      { key: "title", title: "Περιγραφή", cell: need => textCell(need.title, 200) },
      { key: "asset", title: "Υπάρχει", cell: need => need.hasAsset ? "Ναι" : "Όχι" },
      { key: "coverage", title: "Κάλυψη", cell: need => <Chip size="small" color={need.isInsured ? "success" : "warning"} label={need.isInsured ? "Ασφαλισμένο" : "Χωρίς κάλυψη"} sx={{ height: 21, fontSize: 11 }} /> },
      { key: "priority", title: "Προτερ.", cell: need => `${need.priority}/5` },
      { key: "contact", title: "Επόμ. επικοινωνία", cell: need => date(need.nextContactAt) },
      { key: "notes", title: "Σημειώσεις", cell: need => textCell(need.notes) },
      { key: "actions", title: "Ενέργειες", align: "right", cell: need => <Stack direction="row" justifyContent="flex-end" spacing={.25}><Tooltip title="Επεξεργασία"><IconButton size="small" color="success" aria-label={`Επεξεργασία ${need.title}`} onClick={() => onEdit(need)}><EditIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Διαγραφή"><IconButton size="small" color="error" disabled={deleting} aria-label={`Διαγραφή ${need.title}`} onClick={() => onDelete(need)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Stack> },
    ]} />;
}

export function FamilyMembersTable({ members, onRemove, removing = false }: { members: FamilyMember[]; onRemove: (member: FamilyMember) => void; removing?: boolean }) {
  const [relationship, setRelationship] = useState("");
  const [coverage, setCoverage] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const rows = useMemo(() => filterFamilyMembers(members, relationship, coverage), [members, relationship, coverage]);
  const detail = members.find(member => member.relationshipId === detailId);
  return <>
    <CustomerCompactTable rows={rows} rowKey={member => member.relationshipId} label="Οικογένεια και συνδεδεμένοι πελάτες"
      searchPlaceholder="Μέλος, συμβόλαιο, ανάγκη ή σημειώσεις…"
      searchText={member => `${member.displayName} ${RELATION_LABEL[member.relationshipType] ?? member.relationshipType} ${member.notes ?? ""} ${member.policies.map(policy => `${policy.policyNumber} ${policy.policyType}`).join(" ")} ${member.needs.map(need => `${need.title} ${NEED_LABEL[need.kind] ?? need.kind} ${need.notes ?? ""}`).join(" ")}`}
      filters={<><TextField select size="small" label="Σχέση" value={relationship} onChange={event => setRelationship(event.target.value)} sx={{ minWidth: 150 }}><MenuItem value="">Όλες</MenuItem>{[...new Set(members.map(member => member.relationshipType))].map(value => <MenuItem key={value} value={value}>{RELATION_LABEL[value] ?? value}</MenuItem>)}</TextField>
        <TextField select size="small" label="Εμφάνιση" value={coverage} onChange={event => setCoverage(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Όλα τα μέλη</MenuItem><MenuItem value="policies">Με συμβόλαια</MenuItem><MenuItem value="needs">Με ανάγκες</MenuItem><MenuItem value="uninsured">Με ακάλυπτες ανάγκες</MenuItem></TextField></>}
      columns={[
        { key: "name", title: "Πελάτης", cell: member => <Button size="small" onClick={() => setDetailId(member.relationshipId)} sx={{ p: 0, minWidth: 0, fontWeight: 750 }}>{textCell(member.displayName, 210)}</Button> },
        { key: "relation", title: "Σχέση", cell: member => RELATION_LABEL[member.relationshipType] ?? member.relationshipType },
        { key: "policies", title: "Συμβόλαια", align: "center", cell: member => member.policies.length },
        { key: "needs", title: "Ανάγκες", align: "center", cell: member => member.needs.length },
        { key: "uninsured", title: "Ακάλυπτες", align: "center", cell: member => <Chip size="small" color={member.needs.some(need => !need.isInsured) ? "warning" : "success"} label={member.needs.filter(need => !need.isInsured).length} sx={{ height: 21, fontSize: 11 }} /> },
        { key: "notes", title: "Σημειώσεις", cell: member => textCell(member.notes) },
        { key: "actions", title: "Ενέργειες", align: "right", cell: member => <Stack direction="row" justifyContent="flex-end" spacing={.25}><Tooltip title="Συμβόλαια και ανάγκες μέλους"><IconButton size="small" color="primary" aria-label={`Προβολή ${member.displayName}`} onClick={() => setDetailId(member.relationshipId)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Αφαίρεση σχέσης"><IconButton size="small" color="error" disabled={removing} aria-label={`Αφαίρεση ${member.displayName}`} onClick={() => onRemove(member)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Stack> },
      ]} />
    <CustomerPopup open={!!detail} onClose={() => setDetailId(null)} title={detail ? `Συμβόλαια & ανάγκες · ${detail.displayName}` : "Στοιχεία μέλους"} wide>
      {detail && <Stack spacing={2}>
        <Typography variant="body2">{RELATION_LABEL[detail.relationshipType] ?? detail.relationshipType}{detail.notes ? ` · ${detail.notes}` : ""}</Typography>
        <Box><Typography fontWeight={800}>Συμβόλαια</Typography><FamilyPoliciesTable policies={detail.policies} /></Box>
        <Box><Typography fontWeight={800}>Ανάγκες ασφάλισης</Typography><CustomerCompactTable rows={detail.needs} rowKey={need => need.id} label="Ανάγκες μέλους" minWidth={630}
          searchPlaceholder="Περιγραφή ή τύπος…" searchText={need => `${need.title} ${NEED_LABEL[need.kind] ?? need.kind} ${need.notes ?? ""}`}
          columns={[{ key: "kind", title: "Τύπος", cell: need => NEED_LABEL[need.kind] ?? need.kind }, { key: "title", title: "Περιγραφή", cell: need => textCell(need.title) }, { key: "coverage", title: "Κάλυψη", cell: need => need.isInsured ? "Ασφαλισμένο" : "Χωρίς κάλυψη" }, { key: "priority", title: "Προτεραιότητα", cell: need => `${need.priority}/5` }, { key: "notes", title: "Σημειώσεις", cell: need => textCell(need.notes, 300) }]} /></Box>
      </Stack>}
    </CustomerPopup>
  </>;
}

function FamilyPoliciesTable({ policies }: { policies: FamilyPolicy[] }) {
  const [status, setStatus] = useState("");
  const statusLabels: Record<string, string> = { Active: "Ενεργό", Draft: "Πρόχειρο", Expired: "Ληγμένο", Cancelled: "Ακυρωμένο", Renewed: "Ανανεωμένο", Prospect: "Πιθανό", PendingRenewal: "Προς ανανέωση" };
  const typeLabels: Record<string, string> = { Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπά" };
  const rows = useMemo(() => policies.filter(policy => !status || policy.status === status), [policies, status]);
  return <CustomerCompactTable rows={rows} rowKey={policy => policy.id} label="Συμβόλαια μέλους" minWidth={670}
    searchPlaceholder="Αριθμός ή κλάδος…" searchText={policy => `${policy.policyNumber} ${typeLabels[policy.policyType] ?? policy.policyType}`}
    filters={<TextField select size="small" label="Κατάσταση" value={status} onChange={event => setStatus(event.target.value)} sx={{ minWidth: 150 }}><MenuItem value="">Όλες</MenuItem>{[...new Set(policies.map(policy => policy.status))].map(value => <MenuItem key={value} value={value}>{statusLabels[value] ?? value}</MenuItem>)}</TextField>}
    columns={[{ key: "number", title: "Αριθμός", cell: policy => policy.policyNumber }, { key: "type", title: "Κλάδος", cell: policy => typeLabels[policy.policyType] ?? policy.policyType }, { key: "status", title: "Κατάσταση", cell: policy => statusLabels[policy.status] ?? policy.status }, { key: "start", title: "Έναρξη", cell: policy => date(policy.startDate) }, { key: "end", title: "Λήξη", cell: policy => date(policy.endDate) }, { key: "premium", title: "Ασφάλιστρο", cell: policy => `${policy.premium.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${policy.currency}` }]} />;
}
