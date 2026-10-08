import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api, extractErrorMessage } from "../api/client";
import { money, date, dateTime } from "../utils/format";
import { EntityAuditTimeline } from "./EntityAuditTimeline";

interface ClaimRow {
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

const PROFILE_TABS = [
  { label: "Σύνοψη", icon: <InfoOutlinedIcon fontSize="small" /> },
  {
    label: "Στοιχεία ζημιάς",
    icon: <DescriptionOutlinedIcon fontSize="small" />,
  },
  {
    label: "Συμβόλαιο & όχημα",
    icon: <DirectionsCarOutlinedIcon fontSize="small" />,
  },
  {
    label: "Οικονομικά",
    icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
  },
  {
    label: "Εμπλεκόμενοι & επικοινωνίες",
    icon: <GroupsOutlinedIcon fontSize="small" />,
  },
  { label: "Ιστορικό", icon: <HistoryOutlinedIcon fontSize="small" /> },
];

export function ClaimDetailDrawer({
  claim,
  open,
  onClose,
  canEdit = false,
  onEdit,
  onSaved,
}: {
  claim: ClaimRow | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onEdit?: (claim: ClaimRow) => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [snapshot, setSnapshot] = useState<ClaimRow | null>(claim);
  const [form, setForm] = useState({
    incidentDate: "",
    reportedDate: "",
    claimedAmount: 0,
    approvedAmount: 0,
    description: "",
    status: "Reported",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(claim);
    setTab(0);
    setEditMode(false);
    if (claim)
      setForm({
        incidentDate: claim.incidentDate,
        reportedDate: claim.reportedDate,
        claimedAmount: claim.claimedAmount ?? 0,
        approvedAmount: claim.approvedAmount ?? 0,
        description: claim.description ?? "",
        status: claim.status,
      });
  }, [claim?.id, open]);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!snapshot) throw new Error("Δεν επιλέχθηκε ζημιά.");
      const updated = (
        await api.put<ClaimRow>(`/claims/${snapshot.id}`, {
          incidentDate: form.incidentDate,
          reportedDate: form.reportedDate,
          claimedAmount: form.claimedAmount > 0 ? form.claimedAmount : null,
          approvedAmount: form.approvedAmount > 0 ? form.approvedAmount : null,
          description: form.description.trim() || null,
        })
      ).data;
      if (form.status !== snapshot.status) {
        return (
          await api.post<ClaimRow>(`/claims/${snapshot.id}/status`, {
            status: form.status,
            approvedAmount:
              form.approvedAmount > 0 ? form.approvedAmount : null,
          })
        ).data;
      }
      return updated;
    },
    onSuccess: (updated) => {
      setSnapshot(updated);
      setEditMode(false);
      onSaved?.();
    },
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const policy = profileQ.data?.policy;
  const customer = profileQ.data?.customer;
  const reserves = useMemo(
    () =>
      (profileQ.data?.provisions ?? []).reduce(
        (sum, row) => sum + Number(row.reserveAmount ?? 0),
        0,
      ),
    [profileQ.data?.provisions],
  );
  const indemnityTotal = useMemo(
    () =>
      (profileQ.data?.indemnities ?? []).reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0,
      ),
    [profileQ.data?.indemnities],
  );
  const victimPaid = useMemo(
    () =>
      (profileQ.data?.victims ?? []).reduce(
        (sum, row) => sum + Number(row.paidAmount ?? 0),
        0,
      ),
    [profileQ.data?.victims],
  );
  if (!snapshot) return null;

  const statusLabel = claimStatusLabel(snapshot.status, t);
  const customerName =
    snapshot.customerName ??
    snapshot.customerDisplay ??
    customer?.companyName ??
    ([customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
      "—");
  const fmt = (value: number | null | undefined) =>
    value == null ? "—" : money(value);
  const openLink = (path: string) => {
    window.location.href = path;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        sx: {
          height: { xs: "100vh", md: "calc(100vh - 32px)" },
          maxHeight: "none",
          m: { xs: 0, md: 2 },
          borderRadius: { xs: 0, md: 2.5 },
        },
      }}
    >
      <DialogTitle sx={{ py: 1.5, borderBottom: 1, borderColor: "divider" }}>
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
              Πλήρης καρτέλα ζημιάς
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
                  fontSize: { xs: "1.45rem", md: "1.8rem" },
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
            {canEdit && (
              <Button
                startIcon={editMode ? <SaveIcon /> : <EditIcon />}
                variant="contained"
                color={editMode ? "primary" : "success"}
                onClick={() =>
                  editMode
                    ? saveMutation.mutate()
                    : onEdit
                      ? onEdit(snapshot)
                      : setEditMode(true)
                }
                disabled={saveMutation.isPending}
                sx={{ color: "#fff", fontWeight: 800 }}
              >
                {editMode ? "Αποθήκευση" : "Επεξεργασία ζημιάς"}
              </Button>
            )}
            <IconButton onClick={onClose} aria-label="Κλείσιμο">
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
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={profileTabsSx}
        >
          {PROFILE_TABS.map((item) => (
            <Tab
              key={item.label}
              icon={item.icon}
              iconPosition="start"
              label={item.label}
            />
          ))}
        </Tabs>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {profileQ.isLoading && (
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
        {!profileQ.isLoading && (
          <>
            {tab === 0 && (
              <SummaryTab
                claim={snapshot}
                policy={policy}
                customer={customer}
                customerName={customerName}
                statusLabel={statusLabel}
                fmt={fmt}
                onOpen={openLink}
              />
            )}
            {tab === 1 && (
              <ClaimFieldsTab
                claim={snapshot}
                editMode={editMode}
                form={form}
                setForm={setForm}
                t={t}
                fmt={fmt}
              />
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
                reserves={reserves}
                indemnityTotal={indemnityTotal}
                victimPaid={victimPaid}
                t={t}
                fmt={fmt}
              />
            )}
            {tab === 4 && (
              <PeopleCommunicationsTab
                involved={profileQ.data?.involved ?? []}
                communications={profileQ.data?.communications ?? []}
              />
            )}
            {tab === 5 && (
              <HistoryTab claim={snapshot} policy={policy} onOpen={openLink} />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: 1,
          borderColor: "divider",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          Κάθε ζημιά συνδέεται με το συμβόλαιο, τον πελάτη και τα οικονομικά
          της.
        </Typography>
        <Button
          color="error"
          variant="contained"
          startIcon={<CloseIcon />}
          onClick={onClose}
          sx={{ color: "#fff", fontWeight: 800 }}
        >
          Κλείσιμο καρτέλας
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const profileTabsSx = {
  position: "sticky",
  top: 0,
  zIndex: 4,
  mb: 2,
  px: 0.5,
  py: 0.5,
  border: "1px solid #263238",
  borderRadius: 2,
  bgcolor: "#fff",
  boxShadow: "0 3px 10px rgba(15,23,42,.12)",
  overflow: "visible",
  "& .MuiTabs-scroller": { overflow: "visible !important" },
  "& .MuiTabs-flexContainer": { gap: 0.75, flexWrap: "wrap" },
  "& .MuiTabs-indicator": { display: "none" },
  "& .MuiTab-root": {
    minHeight: 52,
    minWidth: { xs: 150, md: 172 },
    px: 1.2,
    py: 0.65,
    border: "1px solid #263238",
    borderRadius: 1.5,
    background: "linear-gradient(180deg,#e5e7eb 0%,#b8c0c8 100%) !important",
    color: "#111827 !important",
    opacity: "1 !important",
    textTransform: "none",
    fontWeight: 800,
    fontSize: { xs: ".78rem", md: ".88rem" },
    transition:
      "background .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease",
    "&:hover": {
      background: "linear-gradient(180deg,#d4d8de 0%,#9ca6b1 100%) !important",
      color: "#0b2545 !important",
      borderColor: "#111827 !important",
      transform: "none",
    },
    "&.Mui-selected": {
      background: "linear-gradient(135deg,#0b5cad 0%,#063b73 100%) !important",
      color: "#fff !important",
      borderColor: "#062f63 !important",
      boxShadow: "0 3px 8px rgba(6,47,99,.35)",
    },
  },
};

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
    <Card
      variant="outlined"
      sx={{
        p: { xs: 1, md: 1.35 },
        mb: 1,
        borderRadius: 2,
        borderColor: "#c4d0de",
        boxShadow: "0 6px 18px rgba(15,23,42,.06)",
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
    </Card>
  );
}
function InfoGrid({ children }: { children: ReactNode }) {
  return (
    <Grid container spacing={1}>
      {children}
    </Grid>
  );
}
function InfoItem({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Box
        sx={{
          px: 1,
          py: 0.65,
          minHeight: 52,
          bgcolor: "#f5f8fb",
          border: "1px solid #e0e7ef",
          borderRadius: 1.25,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", fontWeight: 700 }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            mt: 0.15,
            fontWeight: 750,
            color: color ?? "#162235",
            wordBreak: "break-word",
          }}
        >
          {value || "—"}
        </Typography>
      </Box>
    </Grid>
  );
}
function KPI({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <Box
      sx={{
        p: 1.1,
        borderRadius: 1.5,
        bgcolor: "#eef4fb",
        border: "1px solid #d7e3f0",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", fontWeight: 700 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.15,
          fontSize: { xs: "1.05rem", md: "1.2rem" },
          fontWeight: 900,
          color: color ?? "#162235",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
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
  policy,
  customer,
  customerName,
  statusLabel,
  fmt,
  onOpen,
}: {
  claim: ClaimRow;
  policy: PolicyDetail | null | undefined;
  customer: CustomerDetail | null | undefined;
  customerName: string;
  statusLabel: string;
  fmt: (value: number | null | undefined) => string;
  onOpen: (path: string) => void;
}) {
  return (
    <Stack spacing={1}>
      <InfoGrid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="Αιτούμενο ποσό"
            value={fmt(claim.claimedAmount)}
            color="#b45309"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="Εγκεκριμένο ποσό"
            value={fmt(claim.approvedAmount)}
            color="#15803d"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI label="Ημερομηνία συμβάντος" value={date(claim.incidentDate)} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI label="Κατάσταση" value={statusLabel} color="#0b5cad" />
        </Grid>
      </InfoGrid>
      <Panel
        title="Σύνδεση ζημιάς"
        icon={<DescriptionOutlinedIcon />}
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() =>
              onOpen(
                `/app/policies?search=${encodeURIComponent(claim.policyNumber ?? "")}`,
              )
            }
          >
            Άνοιγμα συμβολαίου
          </Button>
        }
      >
        <InfoGrid>
          <InfoItem label="Αριθμός ζημιάς" value={claim.claimNumber} />
          <InfoItem label="Αριθμός συμβολαίου" value={claim.policyNumber} />
          <InfoItem label="Πελάτης / ασφαλισμένος" value={customerName} />
          <InfoItem
            label="Ασφαλιστική εταιρεία"
            value={claim.insuranceCompanyName ?? policy?.insuranceCompanyName}
          />
          <InfoItem
            label="Κλάδος"
            value={claim.policyType ?? policy?.policyType}
          />
          <InfoItem
            label="Όχημα / πινακίδα"
            value={policy?.vehicleRegistrationPlate ?? "Δεν έχει συνδεθεί"}
          />
        </InfoGrid>
      </Panel>
      <Panel
        title="Πελάτης και στοιχεία επικοινωνίας"
        icon={<GroupsOutlinedIcon />}
        action={
          customer?.id ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => onOpen(`/app/customers/${customer.id}`)}
            >
              Άνοιγμα καρτέλας πελάτη
            </Button>
          ) : undefined
        }
      >
        <InfoGrid>
          <InfoItem label="Ονοματεπώνυμο / επωνυμία" value={customerName} />
          <InfoItem label="ΑΦΜ" value={customer?.vatNumber} />
          <InfoItem label="Email" value={customer?.email} />
          <InfoItem label="Τηλέφωνο" value={customer?.phone} />
          <InfoItem label="Κινητό" value={customer?.mobilePhone} />
          <InfoItem
            label="Διεύθυνση"
            value={[customer?.address, customer?.city, customer?.postalCode]
              .filter(Boolean)
              .join(", ")}
          />
        </InfoGrid>
      </Panel>
      <Panel title="Περιγραφή" icon={<InfoOutlinedIcon />}>
        {claim.description ? (
          <Typography sx={{ whiteSpace: "pre-wrap", color: "#26364a" }}>
            {claim.description}
          </Typography>
        ) : (
          <EmptyState text="Δεν έχει καταχωρηθεί περιγραφή για τη ζημιά." />
        )}
      </Panel>
    </Stack>
  );
}

function ClaimFieldsTab({
  claim,
  editMode,
  form,
  setForm,
  t,
  fmt,
}: {
  claim: ClaimRow;
  editMode: boolean;
  form: {
    incidentDate: string;
    reportedDate: string;
    claimedAmount: number;
    approvedAmount: number;
    description: string;
    status: string;
  };
  setForm: (value: any) => void;
  t: TFunction;
  fmt: (value: number | null | undefined) => string;
}) {
  if (editMode)
    return (
      <Panel title="Επεξεργασία ζημιάς" icon={<EditIcon />}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Ημερομηνία συμβάντος"
              InputLabelProps={{ shrink: true }}
              value={form.incidentDate}
              onChange={(e) =>
                setForm({ ...form, incidentDate: e.target.value })
              }
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Ημερομηνία δήλωσης"
              InputLabelProps={{ shrink: true }}
              value={form.reportedDate}
              onChange={(e) =>
                setForm({ ...form, reportedDate: e.target.value })
              }
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Αιτούμενο ποσό"
              value={form.claimedAmount}
              onChange={(e) =>
                setForm({ ...form, claimedAmount: Number(e.target.value) })
              }
              InputProps={{
                endAdornment: <InputAdornment position="end">€</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Εγκεκριμένο ποσό"
              value={form.approvedAmount}
              onChange={(e) =>
                setForm({ ...form, approvedAmount: Number(e.target.value) })
              }
              InputProps={{
                endAdornment: <InputAdornment position="end">€</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              label="Κατάσταση"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {[
                "Reported",
                "UnderReview",
                "Approved",
                "Rejected",
                "Paid",
                "Closed",
              ].map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`claims.statuses.${s}`, s)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={5}
              label="Περιγραφή"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Grid>
        </Grid>
      </Panel>
    );
  return (
    <Stack spacing={1}>
      <Panel
        title="Βασικά στοιχεία και ημερομηνίες"
        icon={<DescriptionOutlinedIcon />}
      >
        <InfoGrid>
          <InfoItem label="Αριθμός ζημιάς" value={claim.claimNumber} />
          <InfoItem
            label="Ημερομηνία συμβάντος"
            value={date(claim.incidentDate)}
          />
          <InfoItem
            label="Ημερομηνία δήλωσης"
            value={date(claim.reportedDate)}
          />
          <InfoItem
            label="Κατάσταση"
            value={claimStatusLabel(claim.status, t)}
          />
          <InfoItem
            label="Δημιουργία εγγραφής"
            value={claim.createdAt ? dateTime(claim.createdAt) : "—"}
          />
          <InfoItem
            label="Αιτούμενο / εγκεκριμένο"
            value={`${fmt(claim.claimedAmount)} / ${fmt(claim.approvedAmount)}`}
          />
        </InfoGrid>
      </Panel>
      <Panel
        title="ΥΣΑΕ και ασφαλιστική διαχείριση"
        icon={<InfoOutlinedIcon />}
      >
        <InfoGrid>
          <InfoItem
            label="Επηρεάζει Bonus-Malus"
            value={claim.affectsBonusMalus === false ? "Όχι" : "Ναι"}
            color={claim.affectsBonusMalus === false ? "#15803d" : undefined}
          />
          <InfoItem label="Κωδικός ΥΣΑΕ" value={claim.usaeCode} />
          <InfoItem label="Είδος ΥΣΑΕ" value={claim.usaeKind} />
          <InfoItem label="Κατάσταση ΥΣΑΕ" value={claim.usaeStatus} />
          <InfoItem
            label="Ποσοστό ευθύνης"
            value={
              claim.liabilityPercent == null
                ? "—"
                : `${claim.liabilityPercent}%`
            }
          />
          <InfoItem
            label="Εσωτερική ζημιά"
            value={claim.isInternalDamage ? "Ναι" : "Όχι"}
          />
          <InfoItem
            label="Κωδικός παραλαβής ΥΣΑΕ"
            value={claim.usaeReceiptCode}
          />
          <InfoItem
            label="Αποστολή ΥΣΑΕ"
            value={
              claim.usaeSentAt
                ? dateTime(claim.usaeSentAt)
                : "Δεν έχει αποσταλεί"
            }
          />
          <InfoItem
            label="Φιλικός διακανονισμός"
            value={claim.isFriendlySettlement ? "Ναι" : "Όχι"}
          />
        </InfoGrid>
      </Panel>
      <Panel title="Περιγραφή ζημιάς" icon={<InfoOutlinedIcon />}>
        {claim.description ? (
          <Typography sx={{ whiteSpace: "pre-wrap" }}>
            {claim.description}
          </Typography>
        ) : (
          <EmptyState text="Δεν υπάρχει περιγραφή." />
        )}
      </Panel>
    </Stack>
  );
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
        <InfoGrid>
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
        </InfoGrid>
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
        <InfoGrid>
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
        </InfoGrid>
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
  policy: PolicyDetail | null | undefined;
  provisions: any[];
  indemnities: any[];
  victims: any[];
  reserves: number;
  indemnityTotal: number;
  victimPaid: number;
  t: TFunction;
  fmt: (value: number | null | undefined) => string;
}) {
  return (
    <Stack spacing={1}>
      <InfoGrid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="Αιτούμενο"
            value={fmt(claim.claimedAmount)}
            color="#b45309"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="Εγκεκριμένο"
            value={fmt(claim.approvedAmount)}
            color="#15803d"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI label="Προβλέψεις" value={fmt(reserves)} color="#7c3aed" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="Αποζημιώσεις"
            value={fmt(indemnityTotal)}
            color="#0b5cad"
          />
        </Grid>
      </InfoGrid>
      <Panel
        title="Οικονομική εικόνα συμβολαίου"
        icon={<AccountBalanceWalletOutlinedIcon />}
      >
        <InfoGrid>
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
        </InfoGrid>
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
                  <TableCell align="right">{fmt(row.reserveAmount)}</TableCell>
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
                  <TableCell align="right">{fmt(row.amount)}</TableCell>
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
                    {fmt(row.paidAmount ?? row.reserveAmount)}
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

function PeopleCommunicationsTab({
  involved,
  communications,
}: {
  involved: any[];
  communications: any[];
}) {
  return (
    <Stack spacing={1}>
      <Panel
        title={`Εμπλεκόμενα πρόσωπα (${involved.length})`}
        icon={<GroupsOutlinedIcon />}
      >
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
                <TableCell>Σημειώσεις</TableCell>
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
                  <TableCell>{row.notes ?? "—"}</TableCell>
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

function HistoryTab({
  claim,
  policy,
  onOpen,
}: {
  claim: ClaimRow;
  policy: PolicyDetail | null | undefined;
  onOpen: (path: string) => void;
}) {
  return (
    <Stack spacing={1}>
      <Panel title="Σύνδεσμοι και αρχεία" icon={<DescriptionOutlinedIcon />}>
        <InfoGrid>
          <InfoItem
            label="Αριθμός εγγράφων συμβολαίου"
            value={policy?.documentCount ?? 0}
          />
          <InfoItem
            label="Δημιουργία ζημιάς"
            value={claim.createdAt ? dateTime(claim.createdAt) : "—"}
          />
          <InfoItem
            label="Παραδόθηκε συμβόλαιο"
            value={
              policy?.deliveredAt
                ? date(policy.deliveredAt)
                : "Δεν έχει δηλωθεί"
            }
          />
          <InfoItem label="Μέθοδος παράδοσης" value={policy?.deliveryMethod} />
          <InfoItem
            label="Πληρωμή στην ασφαλιστική"
            value={policy?.paidDirectlyToCarrier ? "Ναι" : "Όχι"}
          />
          <InfoItem
            label="Επόμενη ανανέωση"
            value={policy?.nextRenewalDate ? date(policy.nextRenewalDate) : "—"}
          />
        </InfoGrid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={1}>
          <Button
            variant="outlined"
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
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => onOpen(`/app/customers/${claim.customerId}`)}
            >
              Προβολή πελάτη
            </Button>
          )}
        </Stack>
      </Panel>
      <Panel title="Ιστορικό μεταβολών" icon={<HistoryOutlinedIcon />}>
        <EntityAuditTimeline entityName="Claim" entityId={claim.id} />
      </Panel>
    </Stack>
  );
}
