import { DetailProfileTabs } from "./profile/DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, useProfileFieldEditor, type ProfileFieldSession } from "./profile/ProfileFieldEditor";
import { CLAIM_FIELDS, CLAIM_CARD_FIELDS, CLAIM_CARD_TABS, claimInformationGroups, claimFieldValue, claimUpdatePayload } from "./profile/claimProfile";
import { PolicyFieldColumns } from "./profile/PolicyFieldColumns";
import { Children, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api } from "../api/client";
import { money, date, dateTime } from "../utils/format";
import { EntityAuditTable } from "./EntityAuditTable";

interface ClaimRow {
  kind?: string;
  settledAmount?: number | null;
  currency?: string;
  updatedAt?: string;
  id: string;
  claimNumber: string;
  policyId: string;
  policyNumber?: string;
  customerId?: string;
  customerName?: string;
  customerDisplay?: string;
  incidentDate: string;
  reportedDate: string;
  status: string;
  claimedAmount: number | null;
  approvedAmount: number | null;
  description: string | null;
  policyType?: string;
  insuranceCompanyName?: string;
  insuranceCompanyId?: string | null;
  vehicleUseCategory?: string | null;
  coverCode?: string | null;
  packageCode?: string | null;
  createdAt?: string;
  affectsBonusMalus?: boolean;
  usaeCode?: string | null;
  usaeKind?: string | null;
  usaeStatus?: string | null;
  liabilityPercent?: number | null;
  isInternalDamage?: boolean;
  usaeSentAt?: string | null;
  usaeReceiptCode?: string | null;
  isFriendlySettlement?: boolean;
}

interface PolicyDetail {
  id: string;
  policyNumber: string;
  policyType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  customerDisplay?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerVat?: string;
  insuranceCompanyName?: string;
  insuranceCompanyCode?: string;
  producerName?: string;
  producerCode?: string;
  premium?: number;
  netPremium?: number | null;
  vatAmount?: number | null;
  stampDutyAmount?: number | null;
  insuranceContributionAmount?: number | null;
  otherChargesAmount?: number | null;
  currency?: string;
  paymentFrequency?: string;
  paymentCollectionMethod?: string | null;
  paidDirectlyToCarrier?: boolean;
  deliveredAt?: string | null;
  deliveredTo?: string | null;
  deliveryMethod?: string | null;
  vehicleRegistrationPlate?: string | null;
  vehicleUseCategory?: string | null;
  carrierUseCode?: string | null;
  characteristic?: string | null;
  deductible?: number | null;
  position?: string | null;
  reasonForCirculation?: string | null;
  driverVatNumber?: string | null;
  handoverDate?: string | null;
  officeReceivedAt?: string | null;
  policyNotes?: string | null;
  specsJson?: string | null;
  applicationNumber?: string | null;
  issuedAt?: string | null;
  nextRenewalDate?: string | null;
  contractPartyDisplay?: string | null;
  previousInsuranceCompanyName?: string | null;
  totalReceived?: number;
  outstanding?: number;
  totalCommissions?: number;
  documentCount?: number;
  claimCount?: number;
  covers?: {
    coverCode: string;
    coverName?: string | null;
    grossPremium?: number;
    netPremium?: number;
    coverageAmount?: number | null;
  }[];
}

interface CustomerDetail {
  id: string;
  customerNumber?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  type?: string;
  status?: string;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  altPhone?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  birthDate?: string | null;
  occupation?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  nationality?: string | null;
  taxOffice?: string | null;
  amka?: string | null;
  idNumber?: string | null;
  driverLicenseNumber?: string | null;
  notes?: string | null;
}

interface ClaimProfileData {
  policy: PolicyDetail | null;
  customer: CustomerDetail | null;
  provisions: any[];
  indemnities: any[];
  victims: any[];
  involved: any[];
  communications: any[];
}

const STATUS_COLOR: Record<
  string,
  "default" | "info" | "warning" | "success" | "error"
> = {
  Reported: "info",
  UnderReview: "warning",
  Investigating: "warning",
  Approved: "success",
  Paid: "success",
  Settled: "success",
  Rejected: "error",
  Closed: "default",
};

const CLAIM_STATUS_LABELS: Record<string, string> = {
  Reported: "Δηλώθηκε",
  UnderReview: "Υπό εξέταση",
  Investigating: "Υπό διερεύνηση",
  Approved: "Εγκρίθηκε",
  Paid: "Πληρώθηκε",
  Settled: "Διευθετήθηκε",
  Rejected: "Απορρίφθηκε",
  Closed: "Κλειστή",
  Active: "Ενεργό",
  Inactive: "Ανενεργό",
};

function claimStatusLabel(status: string | null | undefined, t: TFunction) {
  if (!status) return "—";
  return CLAIM_STATUS_LABELS[status] ?? t(`claims.statuses.${status}`, status);
}

const PROFILE_TABS = CLAIM_CARD_TABS.map((label,index)=>({label,icon:[<InfoOutlinedIcon fontSize="small"/>,<DescriptionOutlinedIcon fontSize="small"/>,<DirectionsCarOutlinedIcon fontSize="small"/>,<AccountBalanceWalletOutlinedIcon fontSize="small"/>,<GroupsOutlinedIcon fontSize="small"/>][index]}));

export function ClaimDetailDrawer({
  claim,
  open,
  onClose,
  canEdit = false,
  initialEditing = false,
  onEdit: _onEdit,
  onSaved,
}: {
  claim: ClaimRow | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  initialEditing?: boolean;
  onEdit?: (claim: ClaimRow) => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [snapshot, setSnapshot] = useState<ClaimRow | null>(claim);
  useEffect(() => { setSnapshot(claim); setTab(0); }, [claim?.id, open]);
  const profileQ = useQuery({
    queryKey: ["claim-profile", claim?.id],
    enabled: open && !!claim?.id,
    queryFn: async (): Promise<ClaimProfileData> => {
      const read = async <T,>(
        request: Promise<{ data: T }>,
        fallback: T,
      ): Promise<T> => request.then((r) => r.data).catch(() => fallback);
      const empty: any[] = [];
      const [
        policy,
        customer,
        provisions,
        indemnities,
        victims,
        involved,
        communications,
      ] = await Promise.all([
        read(
          api.get<PolicyDetail>(`/policies/${claim!.policyId}/detail`),
          null,
        ),
        claim?.customerId
          ? read(
              api.get<CustomerDetail>(`/customers/${claim.customerId}`),
              null,
            )
          : Promise.resolve(null),
        read(
          api.get<any[]>("/claim-provisions", {
            params: { claimId: claim!.id },
          }),
          empty,
        ),
        read(
          api.get<any[]>("/indemnities", { params: { claimId: claim!.id } }),
          empty,
        ),
        read(
          api.get<any[]>("/claim-victims", { params: { claimId: claim!.id } }),
          empty,
        ),
        claim?.customerId
          ? read(
              api.get<any[]>(
                `/customers/${claim.customerId}/claim-involved-parties`,
              ),
              empty,
            )
          : Promise.resolve(empty),
        read(
          api.get<any[]>(`/policies/${claim!.policyId}/communications`),
          empty,
        ),
      ]);
      return {
        policy,
        customer,
        provisions,
        indemnities,
        victims,
        involved,
        communications,
      };
    },
  });

  const qc = useQueryClient();
  const session = useProfileFieldEditor({
    initialEditing: initialEditing && canEdit,
    sessionKey: open ? claim?.id ?? "" : "", values: Object.fromEntries(CLAIM_FIELDS.map(([key]) => [key, claimFieldValue(key,(snapshot as unknown as Record<string,unknown>)?.[key] ?? (key==="currency"?"EUR":key==="kind"?"VehicleDamage":key==="affectsBonusMalus"?true:""))])), onClose,
    refresh: () => { void qc.invalidateQueries({ queryKey: ["claim-profile", claim?.id] }); void qc.invalidateQueries({ queryKey: ["claims"] }); onSaved?.(); },
    write: async (changes, accept) => {
      if (!canEdit || !snapshot) throw new Error("Δεν επιτρέπεται η επεξεργασία ζημιάς.");
      if (!Object.keys(changes).length) return;
      const body = claimUpdatePayload({ ...snapshot }, changes);
      const saved=(await api.put<ClaimRow>("/claims/"+snapshot.id,body)).data;
      setSnapshot({...snapshot,...saved});accept(Object.keys(changes));
    }
  });

  const policy = profileQ.data?.policy;
  const customer = profileQ.data?.customer;
  const currency=snapshot?.currency||policy?.currency||"EUR";
  const reserves = useMemo(
    () =>
      (profileQ.data?.provisions ?? []).filter(row=>(row.currency||currency)===currency).reduce(
        (sum, row) => sum + Number(row.reserveAmount ?? 0),
        0,
      ),
    [profileQ.data?.provisions,currency],
  );
  const indemnityTotal = useMemo(
    () =>
      (profileQ.data?.indemnities ?? []).filter(row=>(row.currency||currency)===currency).reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0,
      ),
    [profileQ.data?.indemnities,currency],
  );
  const victimPaid = useMemo(
    () =>
      (profileQ.data?.victims ?? []).filter(row=>(row.currency||currency)===currency).reduce(
        (sum, row) => sum + Number(row.paidAmount ?? 0),
        0,
      ),
    [profileQ.data?.victims,currency],
  );
  if (!snapshot) return null;

  const statusLabel = claimStatusLabel(snapshot.status, t);
  const customerName =
    snapshot.customerName ??
    snapshot.customerDisplay ??
    customer?.companyName ??
    ([customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
      "—");
  const fmt = (value: number | null | undefined, moneyCurrency=currency) =>
    value == null ? "—" : money(value,moneyCurrency);
  const openLink = (path: string) => {
    window.location.href = path;
  };

  return (
    <Dialog
      open={open}
      onClose={session.requestClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{ sx: profileDialogPaperSx }}
    >
      <DialogTitle sx={{ py: .75, borderBottom: 1, borderColor: "divider" }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
          spacing={1.25}
        >
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 800 }}
            >
              Καρτέλα Ζημιάς
            </Typography>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              flexWrap="wrap"
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "1.1rem", md: "1.35rem" },
                  fontFamily: "monospace",
                }}
              >
                {snapshot.claimNumber}
              </Typography>
              <Chip
                color={STATUS_COLOR[snapshot.status] ?? "default"}
                label={statusLabel}
              />
              {snapshot.isFriendlySettlement && (
                <Chip
                  color="info"
                  variant="outlined"
                  label="Φιλικός διακανονισμός"
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {customerName} ·{" "}
              {snapshot.policyNumber || "χωρίς αριθμό συμβολαίου"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={session.requestClose} aria-label="Κλείσιμο">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          p: { xs: 1, md: 1.75 },
          bgcolor: "#f7f9fc",
          "& .MuiTypography-root": { lineHeight: 1.3 },
          "& .MuiTable-root":{minWidth:620},"& .MuiTableCell-root":{py:.5,px:1,fontSize:12,borderColor:"#d2dae3"},"& .MuiTableHead-root":{bgcolor:"#e0e7ef"},"& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)":{bgcolor:"#e9edf2"},
        }}
      >
        <DetailProfileTabs value={tab} onChange={setTab} items={PROFILE_TABS} />
        <ProfileEditorFeedback session={session} />
        {profileQ.isLoading && tab > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        )}
        {profileQ.isError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Δεν ήταν δυνατή η φόρτωση όλων των συνδεδεμένων στοιχείων. Τα βασικά
            στοιχεία της ζημιάς παραμένουν διαθέσιμα.
          </Alert>
        )}
        {(!profileQ.isLoading || tab <= 1) && (
          <>
            {tab === 0 && (
              <SummaryTab
                claim={snapshot}
                session={canEdit ? session : undefined}
                policy={policy}
                customer={customer}
                customerName={customerName}
                onOpen={openLink}
              />
            )}
            {tab === 1 && (
              <><Button variant="contained" color="success" size="small" startIcon={<HistoryOutlinedIcon/>} sx={{mb:1,color:"#fff"}} onClick={()=>setHistoryOpen(true)}>Ιστορικό ζημιάς</Button><ClaimFieldsTab
                claim={snapshot}
                session={canEdit ? session : undefined}
                t={t}
                fmt={fmt}
              /></>
            )}
            {tab === 2 && (
              <PolicyVehicleTab
                policy={policy}
                claim={snapshot}
                t={t}
                onOpen={openLink}
              />
            )}
            {tab === 3 && (
              <FinancialTab
                claim={snapshot}
                policy={policy}
                provisions={profileQ.data?.provisions ?? []}
                indemnities={profileQ.data?.indemnities ?? []}
                victims={profileQ.data?.victims ?? []}
                session={canEdit?session:undefined}
                reserves={reserves}
                indemnityTotal={indemnityTotal}
                victimPaid={victimPaid}
                t={t}
                fmt={fmt}
              />
            )}
            {tab === 4 && (
              <PeopleCommunicationsTab claimId={snapshot.id} canEdit={canEdit} onSaved={()=>void qc.invalidateQueries({queryKey:["claim-profile",snapshot.id]})}
                involved={profileQ.data?.involved ?? []}
                communications={profileQ.data?.communications ?? []}
              />
            )}

          </>
        )}
      </DialogContent>
      <Dialog open={historyOpen} onClose={()=>setHistoryOpen(false)} fullWidth maxWidth="lg"><DialogTitle>Ιστορικό ζημιάς</DialogTitle><DialogContent><HistoryTab claim={snapshot} onOpen={openLink}/></DialogContent><DialogActions><Button variant="contained" color="error" onClick={()=>setHistoryOpen(false)}>Κλείσιμο</Button></DialogActions></Dialog>
      <DialogActions sx={{ px: 1.25, py: .6 }}>
        {canEdit ? <ProfileEditorActions session={session} label="ζημιάς" /> : <Button color="error" variant="contained" onClick={session.requestClose}>Κλείσιμο</Button>}
      </DialogActions>
    </Dialog>
  );
}

function Panel({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: .5, overflowX:"auto",
        mb: 1,
        borderRadius: 2,
        borderColor: "#c4d0de",
        boxShadow: "none",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        mb={1}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ color: "#0b5cad", display: "grid", placeItems: "center" }}>
            {icon}
          </Box>
          <Typography
            sx={{
              fontWeight: 850,
              fontSize: { xs: "1rem", md: "1.15rem" },
              color: "#162235",
            }}
          >
            {title}
          </Typography>
        </Stack>
        {action}
      </Stack>
      {children}
    </Box>
  );
}
export function ClaimInfoFields({ children }: { children: ReactNode }) {
  return <PolicyFieldColumns section="claim-related" groups={claimInformationGroups(Children.toArray(children))} />;
}
function InfoItem({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return <Box sx={{ color, minWidth: 0 }}><ProfileEditableField label={label} value={typeof value === "string" || typeof value === "number" ? String(value) : undefined} /></Box>;
}
function EmptyState({ text }: { text: string }) {
  return (
    <Box
      sx={{
        p: 2,
        textAlign: "center",
        bgcolor: "#f8fafc",
        border: "1px dashed #c7d2df",
        borderRadius: 2,
      }}
    >
      <Typography color="text.secondary">{text}</Typography>
    </Box>
  );
}

function SummaryTab({
  claim,
  session,
  policy,
  customer,
  customerName,
  onOpen,
}: {
  claim: ClaimRow;
  session?: ProfileFieldSession;
  policy: PolicyDetail | null | undefined;
  customer: CustomerDetail | null | undefined;
  customerName: string;
  onOpen: (path: string) => void;
}) {
  return (
    <Stack spacing={1}>
      <ClaimProfileFields claim={claim} session={session} related={{policyNumber:claim.policyNumber,customerName,insuranceCompanyName:claim.insuranceCompanyName??policy?.insuranceCompanyName,customerVat:customer?.vatNumber,customerPhone:customer?.phone,customerMobile:customer?.mobilePhone,customerEmail:customer?.email,customerAddress:[customer?.address,customer?.city,customer?.postalCode].filter(Boolean).join(", ")}}/>
      <Stack direction="row" spacing={1}><Button size="small" variant="contained" color="success" sx={{color:"#fff"}} onClick={()=>onOpen(`/app/policies?search=${encodeURIComponent(claim.policyNumber??"")}`)}>Καρτέλα συμβολαίου</Button>{claim.customerId&&<Button size="small" variant="contained" color="success" sx={{color:"#fff"}} onClick={()=>onOpen(`/app/customers/${claim.customerId}`)}>Καρτέλα πελάτη</Button>}</Stack>
    </Stack>
  );
}
function ClaimFieldsTab({claim,session}:{claim:ClaimRow;session?:ProfileFieldSession;t:TFunction;fmt:(value:number|null|undefined)=>string}){
  return <ClaimProfileFields claim={claim} session={session} section="additional"/>;
}

function PolicyVehicleTab({
  policy,
  claim,
  t,
  onOpen,
}: {
  policy: PolicyDetail | null | undefined;
  claim: ClaimRow;
  t: TFunction;
  onOpen: (path: string) => void;
}) {
  if (!policy)
    return (
      <EmptyState text="Δεν ήταν δυνατή η φόρτωση των στοιχείων του συμβολαίου." />
    );
  return (
    <Stack spacing={1}>
      <Panel
        title="Συμβόλαιο"
        icon={<DescriptionOutlinedIcon />}
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() =>
              onOpen(
                `/app/policies?search=${encodeURIComponent(policy.policyNumber)}`,
              )
            }
          >
            Άνοιγμα συμβολαίου
          </Button>
        }
      >
        <ClaimInfoFields>
          <InfoItem
            label="Αριθμός συμβολαίου"
            value={policy.policyNumber || claim.policyNumber}
          />
          <InfoItem label="Κλάδος" value={policy.policyType} />
          <InfoItem label="Κατάσταση" value={claimStatusLabel(policy.status, t)} />
          <InfoItem
            label="Έναρξη"
            value={policy.startDate ? date(policy.startDate) : "—"}
          />
          <InfoItem
            label="Λήξη"
            value={policy.endDate ? date(policy.endDate) : "—"}
          />
          <InfoItem
            label="Ασφαλιστική"
            value={`${policy.insuranceCompanyName ?? "—"}${policy.insuranceCompanyCode ? ` · ${policy.insuranceCompanyCode}` : ""}`}
          />
          <InfoItem
            label="Συνεργάτης"
            value={`${policy.producerName ?? "—"}${policy.producerCode ? ` · ${policy.producerCode}` : ""}`}
          />
          <InfoItem label="Αριθμός αίτησης" value={policy.applicationNumber} />
          <InfoItem
            label="Προηγούμενη ασφαλιστική"
            value={policy.previousInsuranceCompanyName}
          />
        </ClaimInfoFields>
      </Panel>
      <Panel
        title="Όχημα και σύνδεση"
        icon={<DirectionsCarOutlinedIcon />}
        action={
          policy.vehicleRegistrationPlate ? (
            <Chip color="success" label="Συνδεδεμένο όχημα" />
          ) : (
            <Chip color="warning" label="Χωρίς όχημα" />
          )
        }
      >
        <ClaimInfoFields>
          <InfoItem
            label="Αριθμός κυκλοφορίας"
            value={policy.vehicleRegistrationPlate}
          />
          <InfoItem label="Χρήση οχήματος" value={policy.vehicleUseCategory} />
          <InfoItem
            label="Κωδικός χρήσης ασφαλιστικής"
            value={policy.carrierUseCode}
          />
          <InfoItem label="Χαρακτηριστικό" value={policy.characteristic} />
          <InfoItem label="Θέση" value={policy.position} />
          <InfoItem
            label="Απαλλαγή"
            value={policy.deductible == null ? "—" : money(policy.deductible)}
          />
          <InfoItem label="ΑΦΜ οδηγού" value={policy.driverVatNumber} />
          <InfoItem
            label="Λόγος κυκλοφορίας"
            value={policy.reasonForCirculation}
          />
          <InfoItem
            label="Παράδοση"
            value={policy.handoverDate ? date(policy.handoverDate) : "—"}
          />
          <InfoItem
            label="Παραλαβή από γραφείο"
            value={
              policy.officeReceivedAt ? date(policy.officeReceivedAt) : "—"
            }
          />
        </ClaimInfoFields>
        {policy.policyNotes && (
          <Typography sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>
            <strong>Σημειώσεις:</strong> {policy.policyNotes}
          </Typography>
        )}
      </Panel>
      <Panel title="Καλύψεις ασφαλιστηρίου" icon={<InfoOutlinedIcon />}>
        {policy.covers?.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Κάλυψη</TableCell>
                <TableCell>Ονομασία</TableCell>
                <TableCell align="right">Ποσό κάλυψης</TableCell>
                <TableCell align="right">Μικτά</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {policy.covers.map((cover, index) => (
                <TableRow key={`${cover.coverCode}-${index}`}>
                  <TableCell sx={{ fontWeight: 750 }}>
                    {cover.coverCode}
                  </TableCell>
                  <TableCell>{cover.coverName ?? "—"}</TableCell>
                  <TableCell align="right">
                    {cover.coverageAmount == null
                      ? "—"
                      : money(cover.coverageAmount)}
                  </TableCell>
                  <TableCell align="right">
                    {money(cover.grossPremium ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="Δεν έχουν καταχωρηθεί αναλυτικές καλύψεις στο συμβόλαιο." />
        )}
      </Panel>
    </Stack>
  );
}

function FinancialTab({
  claim,
  session,
  policy,
  provisions,
  indemnities,
  victims,
  reserves,
  indemnityTotal,
  victimPaid,
  t,
  fmt,
}: {
  claim: ClaimRow;
  session?: ProfileFieldSession;
  policy: PolicyDetail | null | undefined;
  provisions: any[];
  indemnities: any[];
  victims: any[];
  reserves: number;
  indemnityTotal: number;
  victimPaid: number;
  t: TFunction;
  fmt: (value: number | null | undefined, currency?:string) => string;
}) {
  return (
    <Stack spacing={1}>
      <ClaimProfileFields claim={claim} session={session} section="financial"/>
      <ClaimInfoFields><InfoItem label="Προβλέψεις" value={fmt(reserves)}/><InfoItem label="Αποζημιώσεις" value={fmt(indemnityTotal)}/><InfoItem label="Πληρωμένο σε παθόντες" value={fmt(victimPaid)}/></ClaimInfoFields>
      <Panel
        title="Οικονομική εικόνα συμβολαίου"
        icon={<AccountBalanceWalletOutlinedIcon />}
      >
        <ClaimInfoFields>
          <InfoItem
            label="Ασφάλιστρο συμβολαίου"
            value={fmt(policy?.premium)}
          />
          <InfoItem label="Καθαρά ασφάλιστρα" value={fmt(policy?.netPremium)} />
          <InfoItem
            label="Εισπράξεις"
            value={fmt(policy?.totalReceived)}
            color="#15803d"
          />
          <InfoItem
            label="Ανεξόφλητο"
            value={fmt(policy?.outstanding)}
            color={Number(policy?.outstanding ?? 0) > 0 ? "#b91c1c" : "#15803d"}
          />
          <InfoItem label="Πληρωμένο σε παθόντες" value={fmt(victimPaid)} />
          <InfoItem label="Προμήθειες" value={fmt(policy?.totalCommissions)} />
        </ClaimInfoFields>
      </Panel>
      <Panel
        title={`Προβλέψεις (${provisions.length})`}
        icon={<InfoOutlinedIcon />}
      >
        {provisions.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ημερομηνία</TableCell>
                <TableCell>Εκτιμητής</TableCell>
                <TableCell align="right">Πρόβλεψη</TableCell>
                <TableCell>Σημειώσεις</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {provisions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.evaluationDate ? date(row.evaluationDate) : "—"}
                  </TableCell>
                  <TableCell>{row.assessorName ?? "—"}</TableCell>
                  <TableCell align="right">{fmt(row.reserveAmount,row.currency)}</TableCell>
                  <TableCell>{row.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="Δεν έχουν καταχωρηθεί προβλέψεις." />
        )}
      </Panel>
      <Panel
        title={`Αποζημιώσεις και παθόντες (${indemnities.length + victims.length})`}
        icon={<AccountBalanceWalletOutlinedIcon />}
      >
        {indemnities.length || victims.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Τύπος</TableCell>
                <TableCell>Δικαιούχος</TableCell>
                <TableCell>Ημερομηνία</TableCell>
                <TableCell align="right">Ποσό</TableCell>
                <TableCell>Κατάσταση</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {indemnities.map((row) => (
                <TableRow key={`i-${row.id}`}>
                  <TableCell>Αποζημίωση</TableCell>
                  <TableCell>{row.payeeName ?? row.payeeType ?? "—"}</TableCell>
                  <TableCell>{row.paidOn ? date(row.paidOn) : "—"}</TableCell>
                  <TableCell align="right">{fmt(row.amount,row.currency)}</TableCell>
                  <TableCell>
                    <Chip size="small" color="success" label="Καταχωρημένη" />
                  </TableCell>
                </TableRow>
              ))}
              {victims.map((row) => (
                <TableRow key={`v-${row.id}`}>
                  <TableCell>Παθών</TableCell>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell align="right">
                    {fmt(row.paidAmount ?? row.reserveAmount,row.currency)}
                  </TableCell>
                  <TableCell>{claimStatusLabel(row.status, t)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="Δεν έχουν καταχωρηθεί αποζημιώσεις ή παθόντες." />
        )}
      </Panel>
    </Stack>
  );
}

function PeopleCommunicationsTab({involved,communications,claimId,canEdit,onSaved}:{involved:any[];communications:any[];claimId:string;canEdit:boolean;onSaved:()=>void}) {
  const [party,setParty]=useState<Record<string,unknown>|null>(null);
  const [error,setError]=useState("");
  async function remove(row:any){if(!window.confirm("Θέλετε να διαγράψετε τον επιλεγμένο εμπλεκόμενο;"))return;try{await api.delete("/claim-involved-parties/"+row.id);onSaved();}catch{setError("Δεν ήταν δυνατή η διαγραφή.");}}

  return (
    <Stack spacing={1}>
      <Panel
        title={`Εμπλεκόμενα πρόσωπα (${involved.length})`}
        icon={<GroupsOutlinedIcon />}
        action={canEdit?<Button variant="contained" color="success" size="small" onClick={()=>setParty({role:"OtherDriver",fullName:"",atFault:false})}>Προσθήκη</Button>:undefined}
      >
        {error&&<Alert severity="error">{error}</Alert>}
        {party&&<ClaimPartyDialog party={party} claimId={claimId} canEdit={canEdit} onClose={()=>setParty(null)} onSaved={onSaved}/>}
        {involved.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ρόλος</TableCell>
                <TableCell>Ονοματεπώνυμο</TableCell>
                <TableCell>Τηλέφωνο</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Όχημα</TableCell>
                <TableCell>Ασφαλιστική</TableCell>
                <TableCell>Σημειώσεις</TableCell><TableCell>Ενέργειες</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {involved.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.role}</TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>{row.fullName}</TableCell>
                  <TableCell>{row.phone ?? "—"}</TableCell>
                  <TableCell>{row.email ?? "—"}</TableCell>
                  <TableCell>{row.vehiclePlate ?? "—"}</TableCell>
                  <TableCell>{row.insuranceCompany ?? "—"}</TableCell>
                  <TableCell>{row.notes ?? "—"}</TableCell><TableCell><Stack direction="row" spacing={.5}><Button size="small" variant="contained" color="success" onClick={()=>setParty(row)}>{canEdit?"Επεξεργασία":"Προβολή"}</Button>{canEdit&&<Button size="small" color="error" onClick={()=>void remove(row)}>Διαγραφή</Button>}</Stack></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="Δεν έχουν καταχωρηθεί εμπλεκόμενα πρόσωπα." />
        )}
      </Panel>
      <Panel
        title={`Επικοινωνίες για το συμβόλαιο (${communications.length})`}
        icon={<GroupsOutlinedIcon />}
      >
        {communications.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ημερομηνία</TableCell>
                <TableCell>Τύπος</TableCell>
                <TableCell>Κατεύθυνση</TableCell>
                <TableCell>Θέμα</TableCell>
                <TableCell>Περιγραφή</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {communications.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.occurredAt ? dateTime(row.occurredAt) : "—"}
                  </TableCell>
                  <TableCell>{row.kind ?? "—"}</TableCell>
                  <TableCell>{row.direction ?? "—"}</TableCell>
                  <TableCell>{row.subject ?? "—"}</TableCell>
                  <TableCell>{row.body ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="Δεν έχουν καταγραφεί επικοινωνίες για το συμβόλαιο." />
        )}
      </Panel>
    </Stack>
  );
}

export function HistoryTab({
  claim,
  onOpen,
}: {
  claim: ClaimRow;
  onOpen: (path: string) => void;
}) {
  return (
    <Stack spacing={1}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={1}>
          <Button
            variant="contained" color="success" sx={{ color: "#fff" }}
            startIcon={<OpenInNewIcon />}
            onClick={() =>
              onOpen(
                `/app/policies?search=${encodeURIComponent(claim.policyNumber ?? "")}`,
              )
            }
          >
            Προβολή συμβολαίου
          </Button>
          {claim.customerId && (
            <Button
              variant="contained" color="success" sx={{ color: "#fff" }}
              startIcon={<OpenInNewIcon />}
              onClick={() => onOpen(`/app/customers/${claim.customerId}`)}
            >
              Προβολή πελάτη
            </Button>
          )}
        </Stack>
      <Panel title="Ιστορικό μεταβολών" icon={<HistoryOutlinedIcon />}>
        <EntityAuditTable entityName="Claim" entityId={claim.id} />
      </Panel>
    </Stack>
  );
}


export function ClaimProfileFields({claim,session,section="main",related={}}:{claim:ClaimRow;session?:ProfileFieldSession;section?:string;related?:Record<string,unknown>}) {
  const definitions=CLAIM_CARD_FIELDS.filter(f=>f.section===section);
  const fields=definitions.map(field=>{
    const readonly=field.path.startsWith("@");const raw=related[field.key]??(claim as unknown as Record<string,unknown>)[field.key]??(field.key==="currency"?"EUR":field.key==="kind"?"VehicleDamage":field.key==="affectsBonusMalus"?true:"");
    const options=field.kind==="boolean"?[{value:"true",label:"Ναι"},{value:"false",label:"Όχι"}]:field.choices;
    return <ProfileEditableField key={field.key} field={!readonly&&session?field.key:undefined} session={session} label={field.label} value={claimFieldValue(field.key,raw)} type={field.kind==="date"?"date":field.kind==="datetime-local"?"datetime-local":field.kind==="number"?"number":"text"} multiline={field.kind==="multiline"} options={options}/>;
  });
  return <PolicyFieldColumns section={"claim-"+section} groups={claimInformationGroups(fields)}/>;
}

const PARTY_FIELDS=[["role","Ρόλος"],["fullName","Ονοματεπώνυμο"],["vatNumber","ΑΦΜ"],["idNumber","Ταυτότητα"],["phone","Τηλέφωνο"],["email","Email"],["address","Διεύθυνση"],["vehiclePlate","Πινακίδα"],["insuranceCompany","Ασφαλιστική"],["policyNumberOther","Συμβόλαιο"],["claimedAmount","Αιτούμενο ποσό"],["atFault","Υπαίτιος"],["notes","Σημειώσεις"]] as const;
function ClaimPartyDialog({party,claimId,canEdit,onClose,onSaved}:{party:Record<string,unknown>;claimId:string;canEdit:boolean;onClose:()=>void;onSaved:()=>void}){
 const [snapshot,setSnapshot]=useState(party);
 const session=useProfileFieldEditor({initialEditing:canEdit,sessionKey:String(party.id??"new"),values:Object.fromEntries(PARTY_FIELDS.map(([key])=>[key,String(snapshot[key]??(key==="atFault"?false:""))])),onClose,refresh:onSaved,write:async(changes,accept)=>{
  const body:Record<string,unknown>={...snapshot,...changes,replaceAdditional:true};if(!String(body.fullName??"").trim())throw new Error("Συμπληρώστε ονοματεπώνυμο.");
  if(body.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email)))throw new Error("Συμπληρώστε έγκυρο email.");
  if(body.phone&&!/^[+0-9 ()-]{7,40}$/.test(String(body.phone)))throw new Error("Συμπληρώστε έγκυρο τηλέφωνο.");
  body.atFault=body.atFault===true||body.atFault==="true";body.claimedAmount=body.claimedAmount==null||body.claimedAmount===""?null:Number(String(body.claimedAmount).replace(",","."));
  if(body.claimedAmount!=null&&(!Number.isFinite(body.claimedAmount)||Number(body.claimedAmount)<0))throw new Error("Το ποσό δεν μπορεί να είναι αρνητικό.");
  const saved=party.id?(await api.put("/claim-involved-parties/"+party.id,body)).data:(await api.post("/claims/"+claimId+"/involved-parties",body)).data;
  setSnapshot(saved);accept(Object.keys(changes));onSaved();if(!party.id)onClose();
 }});
 return <Dialog open onClose={session.requestClose} fullWidth maxWidth="md" PaperProps={{sx:profileDialogPaperSx}}><DialogTitle>Εμπλεκόμενος ζημιάς</DialogTitle><DialogContent><ProfileEditorFeedback session={session}/><PolicyFieldColumns section="claim-party" groups={claimInformationGroups(PARTY_FIELDS.map(([key,label])=><ProfileEditableField key={key} label={label} value={String(snapshot[key]??"")} field={canEdit?key:undefined} session={session} type={key==="claimedAmount"?"number":"text"} multiline={key==="notes"} options={key==="atFault"?[{value:"true",label:"Ναι"},{value:"false",label:"Όχι"}]:key==="role"?[{value:"OtherDriver",label:"Άλλος οδηγός"},{value:"Passenger",label:"Επιβάτης"},{value:"Pedestrian",label:"Πεζός"},{value:"Witness",label:"Μάρτυρας"},{value:"Owner",label:"Ιδιοκτήτης"},{value:"Insurer",label:"Ασφαλιστική"},{value:"Other",label:"Άλλο"}]:undefined}/>))}/></DialogContent><DialogActions>{canEdit?<ProfileEditorActions session={session} label="εμπλεκομένου"/>:<Button variant="contained" color="error" onClick={session.requestClose}>Κλείσιμο</Button>}</DialogActions></Dialog>;
}
