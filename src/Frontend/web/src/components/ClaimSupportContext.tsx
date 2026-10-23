import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { ProfileEditableField } from "./profile/ProfileFieldEditor";
import { PolicyFieldColumns } from "./profile/PolicyFieldColumns";
import { ClaimListTableFrame } from "./ClaimListLayout";
import { money, date } from "../utils/format";

interface LinkedClaim { id: string; policyId: string; claimNumber: string; policyNumber: string; customerDisplay: string; insuranceCompanyName: string; incidentDate: string; reportedDate: string; status: string; claimedAmount: number | null; approvedAmount: number | null; description: string | null; liabilityPercent?: number | null; usaeReceiptCode?: string | null }
interface LinkedPolicy { currency: string; vehicleRegistrationPlate?: string | null; startDate: string; endDate: string }
interface Victim { id: string; fullName: string; phone?: string | null; vehiclePlate?: string | null; description?: string | null; reserveAmount?: number | null; paidAmount?: number | null; currency: string }

export function ClaimContextFields({ claim, policy }: { claim: LinkedClaim; policy?: LinkedPolicy }) {
  const { t } = useTranslation();
  const amount = (value: number | null | undefined) => value == null ? "—" : policy?.currency ? money(value, policy.currency) : value.toLocaleString("el-GR", { minimumFractionDigits: 2 });
  const groups = [
    [["Αριθμός ζημιάς", claim.claimNumber], ["Πελάτης", claim.customerDisplay], ["Συμβόλαιο", claim.policyNumber], ["Ασφαλιστική εταιρεία", claim.insuranceCompanyName], ["Πινακίδα οχήματος", policy?.vehicleRegistrationPlate], ["Έναρξη συμβολαίου", policy?.startDate ? date(policy.startDate) : "—"], ["Λήξη συμβολαίου", policy?.endDate ? date(policy.endDate) : "—"]],
    [["Ημερομηνία συμβάντος", date(claim.incidentDate)], ["Ημερομηνία αναγγελίας", date(claim.reportedDate)], ["Κατάσταση ζημιάς", String(t(`claims.statuses.${claim.status}`, claim.status))], ["Αιτηθέν ποσό", amount(claim.claimedAmount)], ["Εγκεκριμένο ποσό", amount(claim.approvedAmount)], ["Ποσοστό υπαιτιότητας", claim.liabilityPercent == null ? "—" : `${claim.liabilityPercent}%`], ["Αριθμός παραλαβής ΥΣΑΕ", claim.usaeReceiptCode], ["Περιγραφή συμβάντος", claim.description]],
  ];
  return <PolicyFieldColumns section="claim-support-context" groups={groups.map(group => group.map(([label, value]) => <ProfileEditableField key={label} label={label!} value={value ?? ""} multiline={label === "Περιγραφή συμβάντος"} />))} />;
}

export function ClaimSupportContext({ kind, record }: { kind: "indemnities" | "friendly-settlements"; record: Record<string, unknown> }) {
  const [search, setSearch] = useState(""), [page, setPage] = useState(0);
  const claim = useQuery({ queryKey: ["claim-support-context", record.claimId], enabled: !!record.claimId,
    queryFn: async () => (await api.get<LinkedClaim[]>("/claims", { params: { claimId: record.claimId } })).data[0] ?? null });
  const policy = useQuery({ queryKey: ["claim-support-policy", claim.data?.policyId], enabled: !!claim.data?.policyId,
    queryFn: async () => (await api.get<LinkedPolicy>(`/policies/${claim.data!.policyId}/detail`)).data });
  const victims = useQuery({ queryKey: ["claim-support-victims", record.id], enabled: kind === "friendly-settlements",
    queryFn: async () => (await api.get<Victim[]>("/claim-victims", { params: { settlementId: record.id } })).data });
  const filtered = (victims.data ?? []).filter(row => [row.fullName, row.phone, row.vehiclePlate, row.description].some(value => value?.toLocaleLowerCase("el-GR").includes(search.trim().toLocaleLowerCase("el-GR"))));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1));
  if (claim.isLoading) return <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>;
  if (claim.isError || !claim.data) return <Alert severity="warning" action={<Button onClick={() => void claim.refetch()}>Επανάληψη</Button>}>Δεν είναι διαθέσιμα τα συνδεδεμένα στοιχεία ζημιάς.</Alert>;
  return <Stack gap={1.25}>
    {policy.isError && <Alert severity="warning" action={<Button onClick={() => void policy.refetch()}>Επανάληψη</Button>}>Δεν φορτώθηκαν τα πρόσθετα στοιχεία συμβολαίου.</Alert>}
    <ClaimContextFields claim={claim.data} policy={policy.data} />
    {kind === "friendly-settlements" && <>
      <Typography fontWeight={800}>Παθόντες διακανονισμού</Typography>
      <TextField label="Αναζήτηση παθόντα, τηλεφώνου ή πινακίδας" size="small" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      {victims.isError ? <Alert severity="error" action={<Button onClick={() => void victims.refetch()}>Επανάληψη</Button>}>Δεν φορτώθηκαν οι παθόντες.</Alert> : victims.isLoading ? <CircularProgress size={22} /> :
        <ClaimListTableFrame label="Παθόντες" minWidth={650} pagination={<TablePagination component="div" page={currentPage} count={filtered.length} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, next) => setPage(next)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />}>
          <Table size="small"><TableHead><TableRow><TableCell>Ονοματεπώνυμο</TableCell><TableCell>Τηλέφωνο</TableCell><TableCell>Πινακίδα</TableCell><TableCell>Πρόβλεψη</TableCell><TableCell>Πληρωθέντα</TableCell></TableRow></TableHead><TableBody>{filtered.slice(currentPage * 10, currentPage * 10 + 10).map(row => <TableRow key={row.id}><TableCell>{row.fullName}</TableCell><TableCell>{row.phone || "—"}</TableCell><TableCell>{row.vehiclePlate || "—"}</TableCell><TableCell>{row.reserveAmount == null ? "—" : money(row.reserveAmount, row.currency)}</TableCell><TableCell>{row.paidAmount == null ? "—" : money(row.paidAmount, row.currency)}</TableCell></TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={5}>Δεν βρέθηκαν παθόντες.</TableCell></TableRow>}</TableBody></Table>
        </ClaimListTableFrame>}
    </>}
  </Stack>;
}
