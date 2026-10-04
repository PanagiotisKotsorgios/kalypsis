import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { EntityAuditTimeline } from "./EntityAuditTimeline";
import { PropagateChangesDialog, type PropagatableChanges } from "./PropagateChangesDialog";
import { SearchableSelect } from "./SearchableSelect";
import { VehicleDetailDialog } from "../pages/CustomerVehiclesPage";

// Mirrors PolicyDetailDto from the backend (see PolicyDetailQuery.cs).
export interface PolicyDetail {
  id: string; policyNumber: string; policyType: string; status: string;
  startDate: string; endDate: string;
  createdAt: string; updatedAt: string | null; createdByName: string | null;
  customerId: string; customerDisplay: string;
  customerEmail: string | null; customerPhone: string | null; customerVat: string | null;
  insuranceCompanyId: string; insuranceCompanyName: string; insuranceCompanyCode: string | null;
  producerId: string | null; producerName: string | null; producerCode: string | null;
  premium: number; currency: string;
  paymentFrequency: string; premiumIncludesVat: boolean;
  specialCommissionPercent: number | null;
  specsJson: string | null;
  nextRenewalDate: string | null;
  renewalTransferToProducerId: string | null; renewalTransferToProducerName: string | null;
  renewalTransferToCarrierId: string | null; renewalTransferToCarrierName: string | null;
  retainCommissionsOnRenewal: boolean; retainDocumentNumberOnRenewal: boolean; retainSpecialCommissionsOnRenewal: boolean;
  renewalInstructions: string | null;
  deliveredAt: string | null; deliveredTo: string | null; deliveryMethod: string | null;
  paymentCollectionMethod: string | null;
  paidDirectlyToCarrier: boolean;
  renewedFromPolicyId: string | null; renewedFromPolicyNumber: string | null;
  endorsementCount: number; cancellationCount: number; claimCount: number; commissionTxnCount: number;
  documentCount: number; receiptCount: number;
  totalReceived: number; outstanding: number; totalCommissions: number;
  covers: PolicyCoverRow[]; coversGrossTotal: number;
  netPremium: number | null;
  vatAmount: number | null;
  stampDutyAmount: number | null;
  insuranceContributionAmount: number | null;
  otherChargesAmount: number | null;
  // ALIS-parity fields
  applicationNumber: string | null;
  contractPartyCustomerId: string | null;
  contractPartyDisplay: string | null;
  previousInsuranceCompanyId: string | null;
  previousInsuranceCompanyName: string | null;
  issuedAt: string | null;
  vehicleRegistrationPlate: string | null;
  // Motor-only extras
  driverVatNumber: string | null;
  reasonForCirculation: string | null;
  // Per-policy commission override (JSON blob {"Producer":15,"Manager":3,...})
  specialLevelPercentsJson: string | null;
  // Bridge-supplied Προμήθεια Γραφείου — summed from FinancialMovements
  // created at import time. Null on policies that never touched a bridge.
  bridgeAgencyCommissionAmount: number | null;
}

export interface PolicyCoverRow {
  id: string;
  coverCode: string;
  coverName: string | null;
  grossPremium: number;
  netPremium: number;
  coverageAmount: number | null;
  // Per-cover commission %; null → falls back to the matching CommissionRule.
  commissionPercent: number | null;
  agencyCommissionPercent: number | null;
}

interface Props {
  policyId: string | null;
  open: boolean;
  onClose: () => void;
  /** Producer portal: show the office-assigned policy without any edits or office commission configuration. */
  readOnly?: boolean;
  /** Use a centered modal when the policy is opened from another modal (for example a company profile). */
  presentation?: "drawer" | "modal";
}

interface PolicyCustomerPreview {
  id: string;
  customerNumber?: string;
  type?: string;
  status?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
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
  notes?: string | null;
}

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "info" | "error"> = {
  Active: "success", Draft: "default", Expired: "warning", Cancelled: "error",
  Renewed: "info", PendingRenewal: "warning", Prospect: "warning"
};

const FREQUENCIES = ["Annual", "Semiannual", "Quarterly", "Monthly", "Single"];
const DELIVERY_METHODS = ["Hand", "Post", "Email", "Courier"];
const POLICY_STATUS_LABELS: Record<string, string> = {
  Prospect: "Πιθανό συμβόλαιο", Draft: "Πρόχειρο", Active: "Ενεργό",
  Expired: "Ληγμένο", Cancelled: "Ακυρωμένο", Renewed: "Ανανεωμένο",
  PendingRenewal: "Προς ανανέωση", Undelivered: "Απαράδοτο", AwaitingIssue: "Προς έκδοση",
  ActiveProspect: "Ενεργός πιθανός πελάτης"
};
const POLICY_TYPE_LABELS: Record<string, string> = {
  Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπά"
};
const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  Prospect: "Πιθανός πελάτης", Active: "Ενεργός", Inactive: "Ανενεργός",
  Archived: "Αρχειοθετημένος", Lost: "Απολεσθείς"
};
const FREQUENCY_LABELS: Record<string, string> = {
  Annual: "Ετήσια", Semiannual: "Εξαμηνιαία", Quarterly: "Τριμηνιαία", Monthly: "Μηνιαία", Single: "Εφάπαξ"
};
const DELIVERY_METHOD_LABELS: Record<string, string> = {
  Hand: "Παράδοση με το χέρι", Post: "Ταχυδρομείο", Email: "Ηλεκτρονικό ταχυδρομείο", Courier: "Ταχυμεταφορά"
};
const policyStatusLabel = (value: string) => POLICY_STATUS_LABELS[value] ?? value;
const policyTypeLabel = (value: string) => POLICY_TYPE_LABELS[value] ?? value;
const customerStatusLabel = (value?: string) => value ? (CUSTOMER_STATUS_LABELS[value] ?? value) : "—";
const COLLECTION_METHODS = ["Cash", "BankDeposit", "Card", "DebitOrder", "Cheque", "Other"];
const COLLECTION_METHODS_LABEL: Record<string, string> = {
  Cash: "Μετρητά",
  BankDeposit: "Κατάθεση τραπέζης",
  Card: "Κάρτα",
  DebitOrder: "Πάγια εντολή",
  Cheque: "Επιταγή",
  Other: "Άλλο",
};

export function PolicyDetailDrawer({ policyId, open, onClose, readOnly = false, presentation = "drawer" }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [modalTab, setModalTab] = useState(0);
  const [changeProducerOpen, setChangeProducerOpen] = useState(false);
  const [customerPreviewOpen, setCustomerPreviewOpen] = useState(false);
  const [vehiclePreviewOpen, setVehiclePreviewOpen] = useState(false);
  const modalPresentation = presentation === "modal";
  const selectTab = (next: number | string) => {
    const normalized = Number(next);
    if (!Number.isInteger(normalized) || normalized < 0) return;
    if (modalPresentation) {
      setModalTab(normalized);
      return;
    }
    setTab(normalized);
  };

  useEffect(() => {
    if (open) {
      setModalTab(0);
      setTab(0);
      setEditing(false);
    }
  }, [open, policyId]);

  const q = useQuery({
    queryKey: ["policy-detail", policyId],
    enabled: !!policyId && open,
    queryFn: async () => (await api.get<PolicyDetail>(`/policies/${policyId}/detail`)).data
  });

  // Editable extended form (Phase 12 fields). Initialized from query data.
  const [form, setForm] = useState({
    paymentFrequency: "Annual",
    premiumIncludesVat: true,
    specialCommissionPercent: "",
    specsJson: "",
    nextRenewalDate: "",
    renewalTransferToProducerId: "",
    renewalTransferToCarrierId: "",
    retainCommissionsOnRenewal: false,
    retainDocumentNumberOnRenewal: false,
    retainSpecialCommissionsOnRenewal: false,
    renewalInstructions: "",
    deliveredAt: "",
    deliveredTo: "",
    deliveryMethod: "",
    paymentCollectionMethod: "",
    paidDirectlyToCarrier: false,
    // ALIS-parity fields
    applicationNumber: "",
    contractPartyCustomerId: "",
    previousInsuranceCompanyId: "",
    issuedAt: "",
    vehicleRegistrationPlate: "",
    driverVatNumber: "",
    reasonForCirculation: "",
    specialLevelPercentsJson: ""
  });
  const resetFormFromPolicy = (data: PolicyDetail) => {
    setForm({
      paymentFrequency: data.paymentFrequency,
      premiumIncludesVat: data.premiumIncludesVat,
      specialCommissionPercent: data.specialCommissionPercent?.toString() ?? "",
      specsJson: data.specsJson ?? "",
      nextRenewalDate: data.nextRenewalDate ?? "",
      renewalTransferToProducerId: data.renewalTransferToProducerId ?? "",
      renewalTransferToCarrierId: data.renewalTransferToCarrierId ?? "",
      retainCommissionsOnRenewal: data.retainCommissionsOnRenewal,
      retainDocumentNumberOnRenewal: data.retainDocumentNumberOnRenewal,
      retainSpecialCommissionsOnRenewal: data.retainSpecialCommissionsOnRenewal,
      renewalInstructions: data.renewalInstructions ?? "",
      deliveredAt: data.deliveredAt ?? "",
      deliveredTo: data.deliveredTo ?? "",
      deliveryMethod: data.deliveryMethod ?? "",
      paymentCollectionMethod: data.paymentCollectionMethod ?? "",
      paidDirectlyToCarrier: data.paidDirectlyToCarrier,
      applicationNumber: data.applicationNumber ?? "",
      contractPartyCustomerId: data.contractPartyCustomerId ?? "",
      previousInsuranceCompanyId: data.previousInsuranceCompanyId ?? "",
      issuedAt: data.issuedAt ?? "",
      vehicleRegistrationPlate: data.vehicleRegistrationPlate ?? "",
      driverVatNumber: data.driverVatNumber ?? "",
      reasonForCirculation: data.reasonForCirculation ?? "",
      specialLevelPercentsJson: data.specialLevelPercentsJson ?? ""
    });
  };
  useEffect(() => {
    if (q.data) resetFormFromPolicy(q.data);
  }, [q.data]);

  // Lookups for the SUMMARY tab's ALIS-parity fields — loaded once when the
  // drawer opens, cached across every policy the user opens in this session.
  const customersLookup = useQuery({
    queryKey: ["customers-lookup"],
    enabled: open,
    queryFn: async () => (await api.get<Array<{ id: string; firstName?: string; lastName?: string; companyName?: string; vatNumber?: string }>>("/customers")).data
  });
  const carriersLookup = useQuery({
    queryKey: ["carriers-lookup"],
    enabled: open,
    queryFn: async () => (await api.get<Array<{ id: string; name: string; code?: string }>>("/insurance-companies", { params: { onlyUsed: true } })).data
  });

  // Tab-specific data sources (loaded only when the tab is opened).
  const endorsements = useQuery({
    queryKey: ["policy-endorsements", policyId],
    enabled: open && (tab === 5 || (modalPresentation && modalTab === 3)) && !!policyId,
    queryFn: async () => (await api.get<any[]>("/endorsements", { params: { policyId } })).data.filter((e: any) => e.policyId === policyId)
  });
  const claims = useQuery({
    queryKey: ["policy-claims", policyId],
    enabled: open && (tab === 6 || (modalPresentation && modalTab === 3)) && !!policyId,
    queryFn: async () => (await api.get<any[]>("/claims", { params: { policyId } })).data
  });
  const receipts = useQuery({
    queryKey: ["policy-receipts", policyId],
    enabled: open && (tab === 7 || (modalPresentation && modalTab === 3)) && !!policyId,
    queryFn: async () => (await api.get<any[]>("/receipts")).data.filter((r: any) => r.policyId === policyId)
  });
  const communications = useQuery({
    queryKey: ["policy-communications", policyId],
    // Communications lazy-load moved to the merged Δραστηριότητα tab (index 11).
    enabled: open && (tab === 11 || (modalPresentation && modalTab === 4)) && !!policyId,
    queryFn: async () => (await api.get<PolicyCommunicationRow[]>(`/policies/${policyId}/communications`)).data
  });
  const commissionMatrix = useQuery({
    queryKey: ["policy-commission-matrix", policyId],
    // Also enabled on the Οικονομικά tab (index 1) so its summary card can
    // show the parametrization-computed producer / agency totals alongside
    // the bridge-supplied premiums.
    enabled: !readOnly && open && ((tab === 1) || (modalPresentation && modalTab === 1)) && !!policyId,
    queryFn: async () => (await api.get<PolicyCommissionMatrix>(`/policies/${policyId}/commission-splits`)).data
  });

  // Snapshot of the fields that support propagation to sibling policies —
  // captured BEFORE save so we can diff against the response and show the
  // «apply to other contracts of this customer» prompt afterwards.
  const [propagateChanges, setPropagateChanges] = useState<PropagatableChanges | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const before = {
        paymentFrequency: q.data?.paymentFrequency,
        specialCommissionPercent: q.data?.specialCommissionPercent,
        renewalTransferToProducerId: q.data?.renewalTransferToProducerId,
        renewalTransferToCarrierId: q.data?.renewalTransferToCarrierId,
        paymentCollectionMethod: q.data?.paymentCollectionMethod,
      };
      const saved = (await api.put<PolicyDetail>(`/policies/${policyId}/extended`, {
        paymentFrequency: form.paymentFrequency,
        premiumIncludesVat: form.premiumIncludesVat,
        specialCommissionPercent: form.specialCommissionPercent ? Number(form.specialCommissionPercent) : null,
        specsJson: form.specsJson || null,
        nextRenewalDate: form.nextRenewalDate || null,
        renewalTransferToProducerId: form.renewalTransferToProducerId || null,
        renewalTransferToCarrierId: form.renewalTransferToCarrierId || null,
        retainCommissionsOnRenewal: form.retainCommissionsOnRenewal,
        retainDocumentNumberOnRenewal: form.retainDocumentNumberOnRenewal,
        retainSpecialCommissionsOnRenewal: form.retainSpecialCommissionsOnRenewal,
        renewalInstructions: form.renewalInstructions || null,
        deliveredAt: form.deliveredAt || null,
        deliveredTo: form.deliveredTo || null,
        deliveryMethod: form.deliveryMethod || null,
        paymentCollectionMethod: form.paymentCollectionMethod || null,
        paidDirectlyToCarrier: form.paidDirectlyToCarrier,
        applicationNumber: form.applicationNumber.trim() || null,
        contractPartyCustomerId: form.contractPartyCustomerId || null,
        previousInsuranceCompanyId: form.previousInsuranceCompanyId || null,
        issuedAt: form.issuedAt || null,
        vehicleRegistrationPlate: form.vehicleRegistrationPlate.trim() || null,
        driverVatNumber: form.driverVatNumber.trim() || null,
        reasonForCirculation: form.reasonForCirculation.trim() || null,
        specialLevelPercentsJson: form.specialLevelPercentsJson.trim() || null
      })).data;
      // Diff the fields that map to propagatable ones.
      const diff: PropagatableChanges = {};
      if (saved.paymentFrequency !== before.paymentFrequency)
        diff.paymentFrequency = saved.paymentFrequency;
      if (saved.specialCommissionPercent !== before.specialCommissionPercent)
        diff.specialCommissionPercent = saved.specialCommissionPercent ?? null;
      if (saved.renewalTransferToProducerId !== before.renewalTransferToProducerId)
        diff.renewalTransferToProducerId = saved.renewalTransferToProducerId ?? null;
      if (saved.renewalTransferToCarrierId !== before.renewalTransferToCarrierId)
        diff.renewalTransferToCarrierId = saved.renewalTransferToCarrierId ?? null;
      if (saved.paymentCollectionMethod !== before.paymentCollectionMethod)
        diff.paymentCollectionMethod = saved.paymentCollectionMethod ?? null;
      return diff;
    },
    onSuccess: (diff) => {
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
      if (modalPresentation) setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Trigger the propagation prompt only when at least one propagatable
      // field actually moved. Dialog auto-dismisses silently if the
      // customer has no other contracts.
      if (Object.keys(diff).length > 0) setPropagateChanges(diff);
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  // ALIS-parity function-key shortcuts. F2 = Summary, F5 = Renewal,
  // F6 = Financials, F8 = Delivery, F9 = Commissions matrix, F12 = History.
  // Ignore while the operator is typing in an editable element so keyboard
  // shortcuts never eat form input.
  useEffect(() => {
    if (!open) return;
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    };
    const map: Record<string, number> = {
      F2: 0,   // Summary («Γενικά»)
      F6: 1,   // Financials («Οικονομικά»)
      F5: 3,   // Renewal («Αίτηση ανανέωσης»)
      F8: 4,   // Delivery («Παράδοση»)
      F9: 14,  // Commissions matrix («Προμήθειες»)
      F12: 12, // History («Ιστορικό»)
    };
    const onKey = (e: KeyboardEvent) => {
      const target = map[e.key];
      if (target === undefined) return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      if (modalPresentation) {
        const modalTarget = target === 0 ? 0 : target === 1 ? 1 : target === 12 ? 4 : (target === 6 || target === 7 || target === 14 ? 3 : 2);
        selectTab(modalTarget);
      } else {
        selectTab(target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const p = q.data;

  // Drawer is user-resizable from its left edge — same UX as the app
  // sidebar. Width persists per browser in localStorage so a wider drag
  // for high-res monitors sticks. Bounded so it can't disappear or
  // cover the whole viewport.
  const DRAWER_MIN = 520;
  const DRAWER_DEFAULT = 1200;
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DRAWER_DEFAULT;
    const stored = Number(localStorage.getItem("kalypsis.policyDetailDrawer.width"));
    if (Number.isFinite(stored) && stored >= DRAWER_MIN) return stored;
    return DRAWER_DEFAULT;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("kalypsis.policyDetailDrawer.width", String(drawerWidth));
  }, [drawerWidth]);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const max = Math.max(DRAWER_MIN, Math.floor(window.innerWidth * 0.98));
      const next = Math.min(max, Math.max(DRAWER_MIN, window.innerWidth - e.clientX));
      setDrawerWidth(next);
    };
    const onUp = () => setResizing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing]);

  const showSummary = modalPresentation ? modalTab === 0 : tab === 0;
  const showFinancials = modalPresentation ? modalTab === 1 : tab === 1;
  const showContract = modalPresentation ? modalTab === 2 : tab === 2;
  const showMovements = modalPresentation ? modalTab === 3 : false;
  const showDocumentsHistory = modalPresentation ? modalTab === 4 : false;
  const canEdit = !readOnly && (!modalPresentation || editing);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      transitionDuration={modalPresentation ? 0 : undefined}
      ModalProps={modalPresentation ? { sx: { zIndex: 1600 } } : undefined}
      PaperProps={{ sx: modalPresentation ? {
        // Match the company profile modal width so nested contracts have a
        // readable, compact two-column layout instead of a narrow sparse view.
        width: { xs: "calc(100vw - 16px)", md: "min(1536px, 94vw)" },
        height: { xs: "calc(100vh - 16px)", md: "min(900px, 92vh)" },
        maxHeight: "calc(100vh - 16px)", top: "50%", bottom: "auto", left: "50%", right: "auto",
        transform: "translate(-50%, -50%) !important", borderRadius: 2, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(2, 18, 42, .38)",
      } : { width: { xs: "100%", md: `min(${drawerWidth}px, 98vw)` }, overflow: "visible" } }}>
      {/* Left-edge drag handle — same UX as sidebar. Positioned outside
          the scroll area so it stays reachable while the operator scrolls
          the drawer content. */}
      <Box
        role="separator" aria-orientation="vertical"
        aria-label="Λαβή αλλαγής μεγέθους πλευρικής"
        onPointerDown={(e) => { setResizing(true); e.preventDefault(); }}
        sx={{
          position: "absolute", top: 0, bottom: 0, left: -5, width: 10, zIndex: 5,
          cursor: "col-resize", display: { xs: "none", md: "flex" },
          alignItems: "center", justifyContent: "center",
          "&::before": {
            content: '""', width: 4, height: "min(80px, 60%)", borderRadius: 2,
            bgcolor: resizing ? "primary.main" : "divider",
            transition: "background-color 120ms ease",
          },
          "&:hover::before": { bgcolor: "primary.main" }
        }}
      />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Sticky header */}
        <Box sx={{ p: modalPresentation ? 1.5 : 2.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={modalPresentation ? .75 : 1}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>
              {t("policyDetail.header")}
            </Typography>
            <Stack direction="row" spacing={.75} alignItems="center">
              {modalPresentation && !readOnly && !editing && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<EditIcon />}
                  onClick={() => setEditing(true)}
                  sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, boxShadow: 2, "&:hover": { color: "#fff", bgcolor: "success.dark" } }}
                >
                  Επεξεργασία
                </Button>
              )}
              {modalPresentation && !readOnly && editing && (
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  startIcon={<CloseIcon />}
                  onClick={() => { setEditing(false); if (q.data) resetFormFromPolicy(q.data); }}
                  sx={{ color: "#fff", fontWeight: 800, borderRadius: 1.5, "&:hover": { color: "#fff", bgcolor: "error.dark" } }}
                >
                  Ακύρωση επεξεργασίας
                </Button>
              )}
              <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
            </Stack>
          </Stack>
          {q.isLoading ? <CircularProgress size={20} /> : p ? (
            <>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "monospace" }}>{p.policyNumber}</Typography>
                <Chip size="small" color={STATUS_COLOR[p.status] ?? "default"} label={policyStatusLabel(p.status)} />
                <Chip size="small" variant="outlined" label={policyTypeLabel(p.policyType)} />
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {p.customerDisplay} · {p.insuranceCompanyName}
              </Typography>
              <Stack direction="row" spacing={modalPresentation ? 1.5 : 3} mt={modalPresentation ? 1 : 2} flexWrap="wrap" useFlexGap>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("policyDetail.premium")}</Typography>
                  <Typography fontWeight={700}>{p.premium.toFixed(2)} {p.currency}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("policyDetail.received")}</Typography>
                  <Typography fontWeight={700} color="success.main">{p.totalReceived.toFixed(2)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t("policyDetail.outstanding")}</Typography>
                  <Typography fontWeight={700} color={p.outstanding > 0 ? "error.main" : "text.primary"}>
                    {p.outstanding.toFixed(2)}
                  </Typography>
                </Box>
                {!readOnly && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t("policyDetail.commissions")}</Typography>
                    <Typography fontWeight={700}>{p.totalCommissions.toFixed(2)}</Typography>
                  </Box>
                )}
              </Stack>
              {p.documentCount === 0 && (
                <Alert severity="warning" sx={{ mt: 1.25, py: .25, fontWeight: 700, "& .MuiAlert-message": { py: .25 }, "& .MuiAlert-action": { alignItems: "center", py: 0 } }} action={
                  <Button color="inherit" size="small" onClick={() => selectTab(modalPresentation ? 4 : 8)}>
                    Ανέβασμα αρχείου
                  </Button>
                }>
                  Δεν υπάρχει συνημμένο αρχείο συμβολαίου. Ανεβάστε το PDF ή το σχετικό έγγραφο για να παραμείνει μαζί με την καρτέλα του.
                </Alert>
              )}
            </>
          ) : null}
        </Box>

        {/* Tab consolidation pass — Αντικείμενα + Καλύψεις collapsed into
            a single "Δεδομένα συμβολαίου" tab (renders both sub-sections
            stacked), Ιστορικό + Επικοινωνία collapsed into "Δραστηριότητα"
            (audit timeline + comms feed one under the other). Fewer tabs
            = less mental load per policy for the operator. */}
        <Tabs
          value={modalPresentation ? modalTab : tab}
          onChange={(_, value) => modalPresentation ? selectTab(value) : setTab(value)}
          variant={modalPresentation ? "standard" : "scrollable"}
          sx={modalPresentation ? {
            position: "sticky",
            top: 0,
            zIndex: 4,
            mx: 0,
            my: 0,
            mb: 2,
            px: .5,
            py: .5,
            border: "1px solid #b8c0c8",
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
              flex: { xs: "1 1 45%", sm: "0 1 auto" },
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
              "&:hover": {
                background: "linear-gradient(180deg, #e7e9ec 0%, #cbd1d6 100%)",
                borderColor: "#7b8792",
                color: "#17212b",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.65), 0 2px 5px rgba(15,23,42,.18)",
              },
              "&.Mui-selected": {
                background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)",
                borderColor: "#0d47a1",
                color: "#fff",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 3px 8px rgba(13,71,161,.3)",
              },
              // aria-selected is kept as a second selector because the
              // nested drawer can be rendered inside another Tabs surface.
              // It guarantees the active contract tab is visibly blue.
              "&[aria-selected=\"true\"]": {
                background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)",
                borderColor: "#0d47a1",
                color: "#fff",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 3px 8px rgba(13,71,161,.3)",
              },
              "&.Mui-selected:hover": { background: "linear-gradient(135deg, #1565c0 0%, #0b3d91 100%)", color: "#fff" },
              "& .MuiSvgIcon-root": { color: "inherit" },
            },
          } : {
            px: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            "& .MuiTab-root": { minHeight: 42, py: .5 },
          }}
        >
          {modalPresentation ? <>
            <Tab value={0} onClick={() => selectTab(0)} sx={modalTab === 0 ? { background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%) !important", borderColor: "#0d47a1 !important", color: "#fff !important", boxShadow: "0 3px 8px rgba(13,71,161,.3)" } : undefined} icon={<InfoOutlinedIcon fontSize="small" />} iconPosition="start" label="Σύνοψη" />
            <Tab value={1} onClick={() => selectTab(1)} sx={modalTab === 1 ? { background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%) !important", borderColor: "#0d47a1 !important", color: "#fff !important", boxShadow: "0 3px 8px rgba(13,71,161,.3)" } : undefined} icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />} iconPosition="start" label="Οικονομικά" />
            <Tab value={2} onClick={() => selectTab(2)} sx={modalTab === 2 ? { background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%) !important", borderColor: "#0d47a1 !important", color: "#fff !important", boxShadow: "0 3px 8px rgba(13,71,161,.3)" } : undefined} icon={<DescriptionOutlinedIcon fontSize="small" />} iconPosition="start" label="Στοιχεία συμβολαίου" />
            <Tab value={3} onClick={() => selectTab(3)} sx={modalTab === 3 ? { background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%) !important", borderColor: "#0d47a1 !important", color: "#fff !important", boxShadow: "0 3px 8px rgba(13,71,161,.3)" } : undefined} icon={<ReceiptLongOutlinedIcon fontSize="small" />} iconPosition="start" label="Κινήσεις" />
            <Tab value={4} onClick={() => selectTab(4)} sx={modalTab === 4 ? { background: "linear-gradient(135deg, #1976d2 0%, #0d47a1 100%) !important", borderColor: "#0d47a1 !important", color: "#fff !important", boxShadow: "0 3px 8px rgba(13,71,161,.3)" } : undefined} icon={<HistoryOutlinedIcon fontSize="small" />} iconPosition="start" label="Έγγραφα & ιστορικό" />
          </> : <>
            <Tab label={t("policyDetail.tab.summary")} />
            <Tab label={t("policyDetail.tab.financials")} />
            <Tab label={t("policyDetail.tab.parties")} />
            <Tab label={t("policyDetail.tab.renewal")} />
            <Tab label={t("policyDetail.tab.delivery")} />
            <Tab label={`${t("policyDetail.tab.endorsements")} (${p?.endorsementCount ?? 0})`} />
            <Tab label={`${t("policyDetail.tab.claims")} (${p?.claimCount ?? 0})`} />
            <Tab label={`${t("policyDetail.tab.receipts")} (${p?.receiptCount ?? 0})`} />
            <Tab label={`PDF Συμβολαίου (${p?.documentCount ?? 0})`} />
            <Tab label="Δεδομένα συμβολαίου" />
            <Tab label="Δόσεις" />
            <Tab label="Δραστηριότητα" />
          </>}
        </Tabs>

        {/* Scrollable content */}
        <Box sx={{
          flex: 1, overflowY: "auto", p: modalPresentation ? { xs: 1, md: 1.5 } : 3,
          ...(readOnly ? { "& button, & input, & textarea, & [role=button]": { pointerEvents: "none" } } : {}),
          ...(modalPresentation && !editing && !readOnly ? {
            "& input, & textarea, & .MuiSelect-select, & .MuiSwitch-switchBase": { pointerEvents: "none" },
            "& .MuiInputBase-root": { bgcolor: "rgba(248,250,252,.86)" },
          } : {}),
          ...(modalPresentation ? {
            "& .policy-kv": { py: .3, minHeight: 28 },
            "& .MuiDivider-root": { my: .75 },
          } : {}),
        }}>
          {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
          {saved && <Alert severity="success" sx={{ mb: 2 }}>{t("common.savedOk")}</Alert>}

          {!p ? <CircularProgress /> : (
            <>
              {/* SUMMARY */}
              {showSummary && modalPresentation && (
                <Stack spacing={1.25}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
                    <PolicySummarySection title="Στοιχεία συμβολαίου">
                      <PolicySummaryLine label={t("policyDetail.policyNumber")} value={p.policyNumber} mono />
                      <PolicySummaryLine label={t("policyDetail.policyType")} value={policyTypeLabel(p.policyType)} />
                      <PolicySummaryLine label={t("policyDetail.status")} value={<Chip size="small" color={STATUS_COLOR[p.status]} label={policyStatusLabel(p.status)} />} />
                      <PolicySummaryLine label={t("policyDetail.startDate")} value={p.startDate} />
                      <PolicySummaryLine label={t("policyDetail.endDate")} value={p.endDate} />
                      <PolicySummaryLine label={t("policyDetail.createdAt")} value={new Date(p.createdAt).toLocaleString("el-GR")} />
                      {p.updatedAt && <PolicySummaryLine label={t("policyDetail.updatedAt")} value={new Date(p.updatedAt).toLocaleString("el-GR")} />}
                      {p.createdByName && <PolicySummaryLine label={t("policyDetail.createdBy")} value={p.createdByName} />}
                      {p.renewedFromPolicyNumber && <PolicySummaryLine label={t("policyDetail.renewedFrom")} value={p.renewedFromPolicyNumber} mono />}
                    </PolicySummarySection>
                    <PolicySummarySection title="Πρόσωπα & σύνδεση">
                      <PolicySummaryLine label={t("policyDetail.customer")} value={p.customerDisplay} />
                      {p.customerVat && <PolicySummaryLine label="ΑΦΜ πελάτη" value={p.customerVat} mono />}
                      <PolicySummaryLine label={t("policyDetail.insurer")} value={p.insuranceCompanyName} />
                      <PolicySummaryLine label={t("policyDetail.producer")} value={p.producerName ?? "—"} />
                      <PolicySummaryLine label="Συμβαλλόμενος" value={p.contractPartyDisplay || "Ίδιος με τον ασφαλιζόμενο"} />
                      <PolicySummaryLine label="Προηγούμενη ασφαλιστική" value={p.previousInsuranceCompanyName || "Δεν αναφέρεται"} />
                    </PolicySummarySection>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
                    <PolicySummarySection title="Οικονομική εικόνα">
                      <PolicySummaryLine label={t("policyDetail.premium")} value={`${p.premium.toFixed(2)} ${p.currency}`} mono />
                      {p.netPremium !== null && <PolicySummaryLine label="Καθαρά ασφάλιστρα" value={`${p.netPremium.toFixed(2)} ${p.currency}`} mono />}
                      {p.vatAmount !== null && <PolicySummaryLine label="Φόρος ασφαλίστρων" value={`${p.vatAmount.toFixed(2)} ${p.currency}`} mono />}
                      <PolicySummaryLine label={t("policyDetail.received")} value={`${p.totalReceived.toFixed(2)} ${p.currency}`} valueColor="success.dark" mono />
                      <PolicySummaryLine label={t("policyDetail.outstanding")} value={`${p.outstanding.toFixed(2)} ${p.currency}`} valueColor={p.outstanding > 0 ? "error.dark" : undefined} mono />
                      {!readOnly && <PolicySummaryLine label={t("policyDetail.commissions")} value={`${p.totalCommissions.toFixed(2)} ${p.currency}`} mono />}
                    </PolicySummarySection>
                    <PolicySummarySection title="Καλύψεις & όχημα">
                      {p.covers.length > 0 ? <CoversBreakdown p={p} /> : <Typography variant="body2" color="text.secondary" sx={{ py: .5 }}>Δεν έχουν καταχωρηθεί αναλυτικές καλύψεις.</Typography>}
                      {(p.vehicleRegistrationPlate || form.vehicleRegistrationPlate) ? (
                        <>
                          <Divider sx={{ my: .75 }} />
                          <PolicySummaryLine label="Αρ. κυκλοφορίας" value={form.vehicleRegistrationPlate || p.vehicleRegistrationPlate} mono />
                          {(form.driverVatNumber || p.driverVatNumber) && <PolicySummaryLine label="ΑΦΜ οδηγού" value={form.driverVatNumber || p.driverVatNumber} mono />}
                          {(form.reasonForCirculation || p.reasonForCirculation) && <PolicySummaryLine label="Λόγος κυκλοφορίας" value={form.reasonForCirculation || p.reasonForCirculation} />}
                          <Button size="small" variant="contained" color="primary" onClick={() => setVehiclePreviewOpen(true)} sx={{ mt: .75, color: "#fff", fontWeight: 700 }}>Άνοιγμα πλήρους προφίλ οχήματος</Button>
                        </>
                      ) : <Typography variant="body2" color="text.secondary" sx={{ py: .5 }}>Δεν έχει συνδεθεί όχημα.</Typography>}
                    </PolicySummarySection>
                  </Box>

                  <PolicySummarySection title="Πρόσθετα στοιχεία">
                    {editing ? (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                        <TextField fullWidth size="small" label="Αρ. αίτησης" value={form.applicationNumber} onChange={e => setForm({ ...form, applicationNumber: e.target.value })} />
                        <TextField fullWidth size="small" type="date" label="Ημ. έκδοσης" InputLabelProps={{ shrink: true }} value={form.issuedAt} onChange={e => setForm({ ...form, issuedAt: e.target.value })} />
                        <TextField fullWidth size="small" label="Αρ. κυκλοφορίας" value={form.vehicleRegistrationPlate} onChange={e => setForm({ ...form, vehicleRegistrationPlate: e.target.value.toUpperCase() })} />
                        <TextField fullWidth size="small" label="ΑΦΜ οδηγού" value={form.driverVatNumber} onChange={e => setForm({ ...form, driverVatNumber: e.target.value })} />
                        <TextField fullWidth size="small" label="Λόγος κυκλοφορίας" value={form.reasonForCirculation} onChange={e => setForm({ ...form, reasonForCirculation: e.target.value })} />
                        <SearchableSelect disabled={!canEdit} label="Συμβαλλόμενος" value={form.contractPartyCustomerId} onChange={v => setForm({ ...form, contractPartyCustomerId: v })} emptyLabel="Ίδιος με τον ασφαλιζόμενο" options={(customersLookup.data ?? []).map(c => ({ value: c.id, label: c.companyName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—", hint: c.vatNumber ?? undefined }))} />
                        <SearchableSelect disabled={!canEdit} label="Προηγούμενη ασφαλιστική" value={form.previousInsuranceCompanyId} onChange={v => setForm({ ...form, previousInsuranceCompanyId: v })} emptyLabel="Δεν αναφέρεται" options={(carriersLookup.data ?? []).map(c => ({ value: c.id, label: c.name, hint: c.code }))} />
                      </Box>
                    ) : (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, columnGap: 2 }}>
                        <PolicySummaryLine label="Αρ. αίτησης" value={form.applicationNumber || "—"} mono />
                        <PolicySummaryLine label="Ημ. έκδοσης" value={form.issuedAt || "—"} />
                        <PolicySummaryLine label="ΑΦΜ οδηγού" value={form.driverVatNumber || "—"} mono />
                        <PolicySummaryLine label="Λόγος κυκλοφορίας" value={form.reasonForCirculation || "—"} />
                        <PolicySummaryLine label="Συμβαλλόμενος" value={p.contractPartyDisplay || "Ίδιος με τον ασφαλιζόμενο"} />
                        <PolicySummaryLine label="Προηγούμενη ασφαλιστική" value={p.previousInsuranceCompanyName || "Δεν αναφέρεται"} />
                      </Box>
                    )}
                  </PolicySummarySection>

                  <PolicySummarySection title="Πληρωμές, παράδοση & ανανέωση">
                    {editing ? (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                        <TextField select fullWidth size="small" label="Συχνότητα πληρωμής" value={form.paymentFrequency} onChange={e => setForm({ ...form, paymentFrequency: e.target.value })}>{FREQUENCIES.map(f => <MenuItem key={f} value={f}>{FREQUENCY_LABELS[f] ?? f}</MenuItem>)}</TextField>
                        <TextField select fullWidth size="small" label="Τρόπος είσπραξης" value={form.paymentCollectionMethod} onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })}><MenuItem value="">—</MenuItem>{COLLECTION_METHODS.map(m => <MenuItem key={m} value={m}>{COLLECTION_METHODS_LABEL[m]}</MenuItem>)}</TextField>
                        <TextField fullWidth size="small" type="date" label="Ημ. παράδοσης" InputLabelProps={{ shrink: true }} value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                        <TextField fullWidth size="small" label="Παραδόθηκε σε" value={form.deliveredTo} onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                        <TextField select fullWidth size="small" label="Μέθοδος παράδοσης" value={form.deliveryMethod} onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}><MenuItem value="">—</MenuItem>{DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{DELIVERY_METHOD_LABELS[m] ?? m}</MenuItem>)}</TextField>
                        <TextField fullWidth size="small" type="date" label="Επόμενη ανανέωση" InputLabelProps={{ shrink: true }} value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                        <TextField fullWidth size="small" label="Οδηγίες ανανέωσης" value={form.renewalInstructions} onChange={e => setForm({ ...form, renewalInstructions: e.target.value })} sx={{ gridColumn: { sm: "1 / -1" } }} />
                        <FormControlLabel control={<Switch checked={form.paidDirectlyToCarrier} onChange={e => setForm({ ...form, paidDirectlyToCarrier: e.target.checked })} />} label="Πληρώθηκε απευθείας στην ασφαλιστική" />
                        <FormControlLabel control={<Switch checked={form.premiumIncludesVat} onChange={e => setForm({ ...form, premiumIncludesVat: e.target.checked })} />} label="Το ασφάλιστρο περιλαμβάνει φόρο" />
                      </Box>
                    ) : (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, columnGap: 2 }}>
                        <PolicySummaryLine label="Συχνότητα πληρωμής" value={FREQUENCY_LABELS[form.paymentFrequency] ?? form.paymentFrequency} />
                        <PolicySummaryLine label="Τρόπος είσπραξης" value={form.paymentCollectionMethod ? (COLLECTION_METHODS_LABEL[form.paymentCollectionMethod] ?? form.paymentCollectionMethod) : "—"} />
                        <PolicySummaryLine label="Ημ. παράδοσης" value={form.deliveredAt || "—"} />
                        <PolicySummaryLine label="Μέθοδος παράδοσης" value={form.deliveryMethod ? (DELIVERY_METHOD_LABELS[form.deliveryMethod] ?? form.deliveryMethod) : "—"} />
                        <PolicySummaryLine label="Επόμενη ανανέωση" value={form.nextRenewalDate || p.nextRenewalDate || "—"} />
                        <PolicySummaryLine label="Πληρωμή στην ασφαλιστική" value={form.paidDirectlyToCarrier ? "Ναι" : "Όχι"} valueColor={form.paidDirectlyToCarrier ? "success.dark" : undefined} />
                        {form.renewalInstructions && <PolicySummaryLine label="Οδηγίες ανανέωσης" value={form.renewalInstructions} />}
                      </Box>
                    )}
                  </PolicySummarySection>
                </Stack>
              )}
              {showSummary && !modalPresentation && (
                <Stack spacing={modalPresentation ? 1 : 2}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: modalPresentation ? .5 : 0, ...(modalPresentation ? { p: 1.25, bgcolor: "rgba(248,250,252,.85)", border: "1px solid", borderColor: "divider", borderRadius: 1 } : {}) }}>
                    {modalPresentation && <Typography variant="subtitle2" fontWeight={800} sx={{ gridColumn: "1 / -1", mb: .25, color: "primary.dark" }}>Στοιχεία συμβολαίου</Typography>}
                    <KV label={t("policyDetail.policyNumber")} value={p.policyNumber} mono />
                    <KV label={t("policyDetail.policyType")} value={policyTypeLabel(p.policyType)} />
                    <KV label={t("policyDetail.status")} value={<Chip size="small" color={STATUS_COLOR[p.status]} label={policyStatusLabel(p.status)} />} />
                    <KV label={t("policyDetail.startDate")} value={p.startDate} />
                    <KV label={t("policyDetail.endDate")} value={p.endDate} />
                  </Box>
                  <Divider sx={modalPresentation ? { display: "none" } : undefined} />
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: modalPresentation ? .5 : 0, ...(modalPresentation ? { p: 1.25, bgcolor: "rgba(248,250,252,.85)", border: "1px solid", borderColor: "divider", borderRadius: 1 } : {}) }}>
                    {modalPresentation && <Typography variant="subtitle2" fontWeight={800} sx={{ gridColumn: "1 / -1", mb: .25, color: "primary.dark" }}>Ιστορικό καταχώρησης</Typography>}
                    <KV label={t("policyDetail.createdAt")} value={new Date(p.createdAt).toLocaleString("el-GR")} />
                    {p.updatedAt && <KV label={t("policyDetail.updatedAt")} value={new Date(p.updatedAt).toLocaleString("el-GR")} />}
                    {p.createdByName && <KV label={t("policyDetail.createdBy")} value={p.createdByName} />}
                    {p.renewedFromPolicyNumber && (
                      <KV label={t("policyDetail.renewedFrom")} value={p.renewedFromPolicyNumber} mono />
                    )}
                  </Box>

                  <Divider sx={modalPresentation ? { display: "none" } : undefined} />
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>
                    Πρόσθετα στοιχεία
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: modalPresentation ? 1 : 2, ...(modalPresentation ? { p: 1.25, bgcolor: "rgba(248,250,252,.85)", border: "1px solid", borderColor: "divider", borderRadius: 1 } : {}) }}>
                    <TextField fullWidth size="small" label="Αρ. αίτησης"
                      disabled={!canEdit}
                      value={form.applicationNumber}
                      onChange={e => setForm({ ...form, applicationNumber: e.target.value })}
                      helperText={modalPresentation ? undefined : "Ο αριθμός αίτησης που εκδίδει η εταιρεία πριν το οριστικό policy number."} />
                    <TextField fullWidth size="small" type="date" label="Ημ. έκδοσης" InputLabelProps={{ shrink: true }}
                      disabled={!canEdit}
                      value={form.issuedAt}
                      onChange={e => setForm({ ...form, issuedAt: e.target.value })}
                      helperText={modalPresentation ? undefined : "Πότε εκδόθηκε το συμβόλαιο από την εταιρεία."} />
                    <TextField fullWidth size="small" label="Αρ. κυκλοφορίας"
                    disabled={!canEdit}
                    value={form.vehicleRegistrationPlate}
                    onChange={e => setForm({ ...form, vehicleRegistrationPlate: e.target.value.toUpperCase() })}
                    helperText={modalPresentation ? undefined : "Πινακίδα οχήματος (μόνο για κλάδο αυτοκινήτου)."} />
                    <TextField fullWidth size="small" label="ΑΦΜ οδηγού"
                      disabled={!canEdit}
                      value={form.driverVatNumber}
                      onChange={e => setForm({ ...form, driverVatNumber: e.target.value })}
                      helperText={modalPresentation ? undefined : "Όταν ο οδηγός διαφέρει από τον ασφαλιζόμενο (π.χ. παιδί οδηγεί όχημα γονέα)."} />
                    <TextField fullWidth size="small" label="Λόγος κυκλοφορίας"
                      disabled={!canEdit}
                      value={form.reasonForCirculation}
                      onChange={e => setForm({ ...form, reasonForCirculation: e.target.value })}
                      placeholder="π.χ. Ιδιωτική, Επαγγελματική, Ταξί, Ασθενοφόρο"
                      helperText={modalPresentation ? undefined : "Διαφορετικό από τη χρήση οχήματος (ΕΙΧ/ΦΔΧ) — αφορά τον σκοπό χρήσης."} />
                  </Box>
                  {(p.vehicleRegistrationPlate || form.vehicleRegistrationPlate) && (
                    <Button size="small" variant="outlined" color="primary" onClick={() => setVehiclePreviewOpen(true)} sx={{ alignSelf: "flex-start" }}>
                      Προβολή πλήρους καρτέλας οχήματος · {form.vehicleRegistrationPlate || p.vehicleRegistrationPlate}
                    </Button>
                  )}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: modalPresentation ? 1 : 2, ...(modalPresentation ? { p: 1.25, bgcolor: "rgba(248,250,252,.85)", border: "1px solid", borderColor: "divider", borderRadius: 1 } : {}) }}>
                  <SearchableSelect
                    disabled={!canEdit}
                    label="Συμβαλλόμενος (αν διαφέρει από τον ασφαλιζόμενο)"
                    value={form.contractPartyCustomerId}
                    onChange={(v) => setForm({ ...form, contractPartyCustomerId: v })}
                    emptyLabel="— Ίδιος με τον ασφαλιζόμενο —"
                    options={(customersLookup.data ?? []).map(c => ({
                      value: c.id,
                      label: c.companyName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—",
                      hint: c.vatNumber ?? undefined
                    }))}
                    helperText={modalPresentation ? undefined : "Το πρόσωπο που υπογράφει τη σύμβαση και έχει την υποχρέωση καταβολής."} />
                  <SearchableSelect
                    disabled={!canEdit}
                    label="Προηγούμενη ασφαλιστική εταιρεία"
                    value={form.previousInsuranceCompanyId}
                    onChange={(v) => setForm({ ...form, previousInsuranceCompanyId: v })}
                    emptyLabel="— Δεν αναφέρεται —"
                    options={(carriersLookup.data ?? []).map(c => ({
                      value: c.id, label: c.name, hint: c.code
                    }))}
                    helperText={modalPresentation ? undefined : "Από πού μεταφέρθηκε το συμβόλαιο. Χρησιμοποιείται για churn / win-back analytics."} />
                  </Box>
                </Stack>
              )}

              {/* FINANCIALS */}
              {showFinancials && modalPresentation && (
                <Stack spacing={1.25}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
                    <PolicySummarySection title="Ασφάλιστρα & ανάλυση">
                      <PolicySummaryLine label={t("policyDetail.premium")} value={`${p.premium.toFixed(2)} ${p.currency}`} mono />
                      {p.netPremium !== null && <PolicySummaryLine label="Καθαρά ασφάλιστρα" value={`${p.netPremium.toFixed(2)} ${p.currency}`} mono />}
                      {p.vatAmount !== null && <PolicySummaryLine label="Φόρος ασφαλίστρων" value={`${p.vatAmount.toFixed(2)} ${p.currency}`} mono />}
                      {p.stampDutyAmount !== null && <PolicySummaryLine label="Χαρτόσημο" value={`${p.stampDutyAmount.toFixed(2)} ${p.currency}`} mono />}
                      {p.insuranceContributionAmount !== null && <PolicySummaryLine label="Ασφαλιστική εισφορά" value={`${p.insuranceContributionAmount.toFixed(2)} ${p.currency}`} mono />}
                      {p.otherChargesAmount !== null && <PolicySummaryLine label="Λοιπές επιβαρύνσεις" value={`${p.otherChargesAmount.toFixed(2)} ${p.currency}`} mono />}
                      <PolicySummaryLine label={t("policyDetail.totalReceived")} value={`${p.totalReceived.toFixed(2)} ${p.currency}`} valueColor="success.dark" mono />
                      <PolicySummaryLine label={t("policyDetail.outstanding")} value={`${p.outstanding.toFixed(2)} ${p.currency}`} valueColor={p.outstanding > 0 ? "error.dark" : undefined} mono />
                    </PolicySummarySection>
                    <PolicySummarySection title="Είσπραξη & ρυθμίσεις">
                      {editing ? (
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                          <TextField select fullWidth size="small" label={t("policyDetail.paymentFrequency")} value={form.paymentFrequency} onChange={e => setForm({ ...form, paymentFrequency: e.target.value })}>{FREQUENCIES.map(f => <MenuItem key={f} value={f}>{FREQUENCY_LABELS[f] ?? f}</MenuItem>)}</TextField>
                          <TextField select fullWidth size="small" label="Τρόπος είσπραξης" value={form.paymentCollectionMethod} onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })}><MenuItem value="">—</MenuItem>{COLLECTION_METHODS.map(m => <MenuItem key={m} value={m}>{COLLECTION_METHODS_LABEL[m]}</MenuItem>)}</TextField>
                          <TextField type="number" fullWidth size="small" label={t("policyDetail.specialCommission")} value={form.specialCommissionPercent} onChange={e => setForm({ ...form, specialCommissionPercent: e.target.value })} />
                          <FormControlLabel control={<Switch checked={form.paidDirectlyToCarrier} onChange={e => setForm({ ...form, paidDirectlyToCarrier: e.target.checked })} />} label="Πληρωμή απευθείας στην ασφαλιστική" />
                          <FormControlLabel control={<Switch checked={form.premiumIncludesVat} onChange={e => setForm({ ...form, premiumIncludesVat: e.target.checked })} />} label="Περιλαμβάνει φόρο" />
                        </Box>
                      ) : (
                        <>
                          <PolicySummaryLine label="Συχνότητα" value={FREQUENCY_LABELS[form.paymentFrequency] ?? form.paymentFrequency} />
                          <PolicySummaryLine label="Τρόπος είσπραξης" value={form.paymentCollectionMethod ? (COLLECTION_METHODS_LABEL[form.paymentCollectionMethod] ?? form.paymentCollectionMethod) : "—"} />
                          <PolicySummaryLine label="Ειδική προμήθεια" value={form.specialCommissionPercent ? `${form.specialCommissionPercent}%` : "—"} />
                          <PolicySummaryLine label="Πληρωμή στην ασφαλιστική" value={form.paidDirectlyToCarrier ? "Ναι" : "Όχι"} valueColor={form.paidDirectlyToCarrier ? "success.dark" : undefined} />
                          <PolicySummaryLine label="Περιλαμβάνει φόρο" value={form.premiumIncludesVat ? "Ναι" : "Όχι"} />
                          {!readOnly && <PolicySummaryLine label={t("policyDetail.totalCommissions")} value={`${p.totalCommissions.toFixed(2)} ${p.currency}`} mono />}
                        </>
                      )}
                    </PolicySummarySection>
                  </Box>
                  <PolicySummarySection title="Πηγή τιμών & προμήθειες">
                    <BridgeVsParametrizationCard policy={p} matrix={commissionMatrix.data} matrixLoading={commissionMatrix.isLoading} onCompute={() => commissionMatrix.refetch()} />
                    <Divider sx={{ my: 1 }} />
                    <PolicyCommissionMatrixTab loading={commissionMatrix.isLoading} matrix={commissionMatrix.data} currency={p.currency} readOnly={!canEdit} overrideJson={form.specialLevelPercentsJson} onOverrideChange={next => setForm({ ...form, specialLevelPercentsJson: next })} onSave={() => save.mutate()} saving={save.isPending} fallback={{ premium: p.premium, totalCommissions: p.totalCommissions, currency: p.currency }} />
                  </PolicySummarySection>
                  {p.covers.length > 0 && <PolicySummarySection title="Αναλυτικές καλύψεις"><CoversBreakdown p={p} /></PolicySummarySection>}
                </Stack>
              )}
              {showFinancials && !modalPresentation && (
                readOnly ? (
                  <Alert severity="info">
                    Η παραμετροποίηση και ο πίνακας προμηθειών ανήκουν στο γραφείο. Η δική σας ανάλυση ανά συμβόλαιο και μήνα είναι διαθέσιμη στον Πίνακα ελέγχου.
                  </Alert>
                ) : (
                <Stack spacing={2.5}>
                  {/* ---------- Πηγή τιμών ---------- */}
                  {/* Bridge-imported vs Kalypsis-computed values at a glance.
                      Gross / Net come from the policy row itself (populated
                      by the bridge parser on import, or manually entered).
                      Producer / Agency commissions are computed on demand
                      from the office's commission-rules matrix — the button
                      below fetches / refreshes them. */}
                  <BridgeVsParametrizationCard
                    policy={p}
                    matrix={commissionMatrix.data}
                    matrixLoading={commissionMatrix.isLoading}
                    onCompute={() => commissionMatrix.refetch()}
                  />

                  <KV label={t("policyDetail.premium")} value={`${p.premium.toFixed(2)} ${p.currency}`} />

                  {/* Tax / duty breakdown: rendered only when at least one
                      of the split-out numbers exists so cover-less legacy
                      policies stay compact. */}
                  {(p.netPremium !== null || p.vatAmount !== null || p.stampDutyAmount !== null
                    || p.insuranceContributionAmount !== null || p.otherChargesAmount !== null) && (
                    <TaxBreakdown p={p} />
                  )}

                  {/* Covers breakdown — shown only when the policy actually
                      has PolicyCover rows on file. Highlights any drift
                      between the stated premium and the sum of covers so the
                      operator can spot bad data before it feeds commission
                      calculations. */}
                  {p.covers && p.covers.length > 0 && <CoversBreakdown p={p} />}
                  <TextField select fullWidth label={t("policyDetail.paymentFrequency")} value={form.paymentFrequency}
                    disabled={!canEdit}
                    onChange={e => setForm({ ...form, paymentFrequency: e.target.value })}>
                    {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{FREQUENCY_LABELS[f] ?? f}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth label="Τρόπος είσπραξης" value={form.paymentCollectionMethod}
                    disabled={!canEdit}
                    onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })}>
                    <MenuItem value="">—</MenuItem>
                    {COLLECTION_METHODS.map(m => <MenuItem key={m} value={m}>{COLLECTION_METHODS_LABEL[m]}</MenuItem>)}
                  </TextField>
                  <FormControlLabel
                    control={<Switch disabled={!canEdit} checked={form.paidDirectlyToCarrier}
                      onChange={e => setForm({ ...form, paidDirectlyToCarrier: e.target.checked })} />}
                    label="Ο πελάτης πλήρωσε απευθείας στην ασφαλιστική"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
                    Η πληρωμή δεν περνά από το ταμείο του γραφείου και δεν εμφανίζεται ως εκκρεμής οφειλή προς την ασφαλιστική.
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch disabled={!canEdit} checked={form.premiumIncludesVat} onChange={e => setForm({ ...form, premiumIncludesVat: e.target.checked })} />
                    <Typography>Το ασφάλιστρο περιλαμβάνει φόρο ασφαλίστρων</Typography>
                  </Stack>
                  <TextField type="number" fullWidth label={t("policyDetail.specialCommission")}
                    disabled={!canEdit}
                    value={form.specialCommissionPercent}
                    onChange={e => setForm({ ...form, specialCommissionPercent: e.target.value })}
                    helperText={t("policyDetail.specialCommissionHelp")} />
                  <Divider />
                  <KV label={t("policyDetail.totalReceived")} value={`${p.totalReceived.toFixed(2)} ${p.currency}`} />
                  <KV label={t("policyDetail.outstanding")} value={`${p.outstanding.toFixed(2)} ${p.currency}`} />
                  <KV label={t("policyDetail.totalCommissions")} value={`${p.totalCommissions.toFixed(2)} ${p.currency}`} />

                  {/* ---------- Πίνακας προμηθειών (πρώην tab «Προμήθειες») ---------- */}
                  {/* Full ALIS-style matrix — one row per hierarchy level
                      (Producer / Manager / Unit / Assistant / Agency) with
                      %, €, and payable net columns plus a totals
                      footer. Was on its own tab; folded into Οικονομικά so
                      the operator has one place for every money-related
                      field. Overrides are edited via specialLevelPercentsJson
                      and persist through the same save handler as the rest
                      of the tab. */}
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>
                    Πίνακας προμηθειών
                  </Typography>
                  <PolicyCommissionMatrixTab
                    loading={commissionMatrix.isLoading}
                    matrix={commissionMatrix.data}
                    currency={p.currency}
                    readOnly={!canEdit}
                    overrideJson={form.specialLevelPercentsJson}
                    onOverrideChange={(next) => setForm({ ...form, specialLevelPercentsJson: next })}
                    onSave={() => save.mutate()}
                    saving={save.isPending}
                    fallback={{
                      premium: p.premium,
                      totalCommissions: p.totalCommissions,
                      currency: p.currency,
                    }}
                  />
                </Stack>
                )
              )}

              {/* PARTIES */}
              {showContract && modalPresentation && (
                <Stack spacing={1.25}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.25 }}>
                    <PolicySummarySection title="Πελάτης">
                      <PolicySummaryLine label="Όνομα" value={p.customerDisplay} />
                      {p.customerVat && <PolicySummaryLine label="ΑΦΜ" value={p.customerVat} mono />}
                      {p.customerEmail && <PolicySummaryLine label="Email" value={<a href={`mailto:${p.customerEmail}`}>{p.customerEmail}</a>} />}
                      {p.customerPhone && <PolicySummaryLine label="Τηλέφωνο" value={<a href={`tel:${p.customerPhone}`}>{p.customerPhone}</a>} />}
                      <Button size="small" variant="contained" color="primary" startIcon={<PersonOutlineIcon />} onClick={() => setCustomerPreviewOpen(true)} sx={{ mt: .75, color: "#fff", fontWeight: 700 }}>Άνοιγμα καρτέλας πελάτη</Button>
                    </PolicySummarySection>
                    <PolicySummarySection title="Ασφαλιστική εταιρεία">
                      <PolicySummaryLine label="Επωνυμία" value={p.insuranceCompanyName} />
                      {p.insuranceCompanyCode && <PolicySummaryLine label="Κωδικός" value={p.insuranceCompanyCode} mono />}
                    </PolicySummarySection>
                    <PolicySummarySection title="Συνεργάτης">
                      <PolicySummaryLine label="Όνομα" value={p.producerName ?? "—"} />
                      {p.producerCode && <PolicySummaryLine label="Κωδικός" value={p.producerCode} mono />}
                      {!readOnly && <Button size="small" variant="outlined" onClick={() => setChangeProducerOpen(true)} sx={{ mt: .75 }}>Αλλαγή συνεργάτη</Button>}
                    </PolicySummarySection>
                  </Box>

                  <PolicySummarySection title="Ανανέωση, παράδοση & καλύψεις">
                    {editing ? (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                        <TextField size="small" type="date" label={t("policyDetail.nextRenewal")} InputLabelProps={{ shrink: true }} value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                        <TextField size="small" type="date" label={t("policyDetail.deliveredAt")} InputLabelProps={{ shrink: true }} value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                        <TextField size="small" label={t("policyDetail.deliveredTo")} value={form.deliveredTo} onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                        <TextField select size="small" label={t("policyDetail.deliveryMethod")} value={form.deliveryMethod} onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}><MenuItem value="">—</MenuItem>{DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{DELIVERY_METHOD_LABELS[m] ?? m}</MenuItem>)}</TextField>
                        <TextField size="small" label={t("policyDetail.renewalInstructions")} value={form.renewalInstructions} onChange={e => setForm({ ...form, renewalInstructions: e.target.value })} sx={{ gridColumn: { sm: "1 / -1" } }} />
                        <FormControlLabel control={<Switch checked={form.retainCommissionsOnRenewal} onChange={e => setForm({ ...form, retainCommissionsOnRenewal: e.target.checked })} />} label={t("policyDetail.retainCommissions")} />
                        <FormControlLabel control={<Switch checked={form.retainDocumentNumberOnRenewal} onChange={e => setForm({ ...form, retainDocumentNumberOnRenewal: e.target.checked })} />} label={t("policyDetail.retainDocNumber")} />
                      </Box>
                    ) : (
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, columnGap: 2 }}>
                        <PolicySummaryLine label="Επόμενη ανανέωση" value={form.nextRenewalDate || p.nextRenewalDate || "—"} />
                        <PolicySummaryLine label="Ημ. παράδοσης" value={form.deliveredAt || "—"} />
                        <PolicySummaryLine label="Παραδόθηκε σε" value={form.deliveredTo || "—"} />
                        <PolicySummaryLine label="Μέθοδος παράδοσης" value={form.deliveryMethod ? (DELIVERY_METHOD_LABELS[form.deliveryMethod] ?? form.deliveryMethod) : "—"} />
                        <PolicySummaryLine label="Διατήρηση προμηθειών" value={form.retainCommissionsOnRenewal ? "Ναι" : "Όχι"} />
                        <PolicySummaryLine label="Οδηγίες ανανέωσης" value={form.renewalInstructions || "—"} />
                      </Box>
                    )}
                  </PolicySummarySection>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.25 }}>
                    <PolicySummarySection title="Αντικείμενα"><PolicyObjectsTab policyId={p.id} readOnly={!canEdit} /></PolicySummarySection>
                    <PolicySummarySection title="Καλύψεις"><PolicyCoversTab policyId={p.id} readOnly={!canEdit} /></PolicySummarySection>
                  </Box>
                </Stack>
              )}
              {showContract && !modalPresentation && (
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="overline" color="text.secondary" fontWeight={700}>{t("policyDetail.customer")}</Typography>
                    <Button size="small" variant="outlined" color="primary" startIcon={<PersonOutlineIcon />} onClick={() => setCustomerPreviewOpen(true)}>Προβολή καρτέλας</Button>
                  </Stack>
                  <KV label={t("policyDetail.name")} value={p.customerDisplay} />
                  {p.customerVat && <KV label="ΑΦΜ" value={p.customerVat} mono />}
                  {p.customerEmail && <KV label="Email" value={<a href={`mailto:${p.customerEmail}`}>{p.customerEmail}</a>} />}
                  {p.customerPhone && <KV label={t("policyDetail.phone")} value={<a href={`tel:${p.customerPhone}`}>{p.customerPhone}</a>} />}
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>{t("policyDetail.insurer")}</Typography>
                  <KV label={t("policyDetail.name")} value={p.insuranceCompanyName} />
                  {p.insuranceCompanyCode && <KV label={t("policyDetail.code")} value={p.insuranceCompanyCode} mono />}
                  <Divider />
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="overline" color="text.secondary" fontWeight={700}>{t("policyDetail.producer")}</Typography>
                    {canEdit && (
                    <Button size="small" variant="text" onClick={() => setChangeProducerOpen(true)}>
                      Αλλαγή συνεργάτη
                    </Button>
                    )}
                  </Stack>
                  <KV label={t("policyDetail.name")} value={p.producerName ?? "—"} />
                  {p.producerCode && <KV label={t("policyDetail.code")} value={p.producerCode} mono />}
                  {modalPresentation && (
                    <>
                      <Divider />
                      <Typography variant="overline" color="text.secondary" fontWeight={800}>
                        Ανανέωση, παράδοση και καλύψεις
                      </Typography>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                        <TextField size="small" type="date" label={t("policyDetail.nextRenewal")} InputLabelProps={{ shrink: true }}
                          disabled={!canEdit}
                          value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                        <TextField size="small" type="date" label={t("policyDetail.deliveredAt")} InputLabelProps={{ shrink: true }}
                          disabled={!canEdit}
                          value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                        <TextField size="small" label={t("policyDetail.deliveredTo")} value={form.deliveredTo}
                          disabled={!canEdit}
                          onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                        <TextField select size="small" label={t("policyDetail.deliveryMethod")} value={form.deliveryMethod}
                          disabled={!canEdit}
                          onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}>
                          <MenuItem value="">—</MenuItem>
                          {DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{DELIVERY_METHOD_LABELS[m] ?? m}</MenuItem>)}
                        </TextField>
                      </Box>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                        <FormControlLabel control={<Switch disabled={!canEdit} checked={form.retainCommissionsOnRenewal} onChange={e => setForm({ ...form, retainCommissionsOnRenewal: e.target.checked })} />} label={t("policyDetail.retainCommissions")} />
                        <FormControlLabel control={<Switch disabled={!canEdit} checked={form.retainDocumentNumberOnRenewal} onChange={e => setForm({ ...form, retainDocumentNumberOnRenewal: e.target.checked })} />} label={t("policyDetail.retainDocNumber")} />
                      </Stack>
                      <TextField size="small" fullWidth multiline minRows={2} label={t("policyDetail.renewalInstructions")}
                        disabled={!canEdit}
                        value={form.renewalInstructions} onChange={e => setForm({ ...form, renewalInstructions: e.target.value })} />
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
                        <Box sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.25, bgcolor: "rgba(248,250,252,.78)" }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" mb={.5}>Αντικείμενα</Typography>
                          <PolicyObjectsTab policyId={p.id} readOnly={!canEdit} />
                        </Box>
                        <Box sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.25, bgcolor: "rgba(248,250,252,.78)" }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" mb={.5}>Καλύψεις</Typography>
                          <PolicyCoversTab policyId={p.id} readOnly={!canEdit} />
                        </Box>
                      </Box>
                    </>
                  )}
                </Stack>
              )}

              {/* RENEWAL */}
              {tab === 3 && (
                <Stack spacing={2.5}>
                  <TextField type="date" fullWidth label={t("policyDetail.nextRenewal")} InputLabelProps={{ shrink: true }}
                    value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch checked={form.retainCommissionsOnRenewal} onChange={e => setForm({ ...form, retainCommissionsOnRenewal: e.target.checked })} />
                    <Typography>{t("policyDetail.retainCommissions")}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch checked={form.retainDocumentNumberOnRenewal} onChange={e => setForm({ ...form, retainDocumentNumberOnRenewal: e.target.checked })} />
                    <Typography>{t("policyDetail.retainDocNumber")}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch checked={form.retainSpecialCommissionsOnRenewal} onChange={e => setForm({ ...form, retainSpecialCommissionsOnRenewal: e.target.checked })} />
                    <Typography>{t("policyDetail.retainSpecialCommissions")}</Typography>
                  </Stack>
                  <TextField fullWidth multiline rows={3} label={t("policyDetail.renewalInstructions")}
                    value={form.renewalInstructions} onChange={e => setForm({ ...form, renewalInstructions: e.target.value })}
                    placeholder={t("policyDetail.renewalInstructionsPlaceholder")} />
                </Stack>
              )}

              {/* DELIVERY */}
              {tab === 4 && (
                <Stack spacing={2.5}>
                  <TextField type="date" fullWidth label={t("policyDetail.deliveredAt")} InputLabelProps={{ shrink: true }}
                    value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                  <TextField fullWidth label={t("policyDetail.deliveredTo")} value={form.deliveredTo}
                    onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                  <TextField select fullWidth label={t("policyDetail.deliveryMethod")} value={form.deliveryMethod}
                    onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}>
                    <MenuItem value="">—</MenuItem>
                    {DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{DELIVERY_METHOD_LABELS[m] ?? m}</MenuItem>)}
                  </TextField>
                  <TextField select fullWidth label="Τρόπος πληρωμής" value={form.paymentCollectionMethod}
                    onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })}
                    helperText="Πώς εισπράττεται το ασφάλιστρο από τον πελάτη.">
                    <MenuItem value="">—</MenuItem>
                    {COLLECTION_METHODS.map(m => <MenuItem key={m} value={m}>{COLLECTION_METHODS_LABEL[m]}</MenuItem>)}
                  </TextField>
                </Stack>
              )}

              {/* RELATED LISTS */}
              {tab === 5 && !modalPresentation && (
                endorsements.isLoading ? <CircularProgress /> :
                <SimpleList rows={endorsements.data ?? []}
                  cols={[
                    { key: "endorsementNumber", label: t("policyDetail.endorsementNo") },
                    { key: "issuedAt", label: t("policyDetail.issuedAt") },
                    { key: "premiumDelta", label: "ΔΑσφάλιστρο", numeric: true },
                    { key: "description", label: t("common.description") }
                  ]}
                  emptyKey="policyDetail.noEndorsements" />
              )}
              {tab === 6 && !modalPresentation && (
                claims.isLoading ? <CircularProgress /> :
                <SimpleList rows={claims.data ?? []}
                  cols={[
                    { key: "claimNumber", label: t("policyDetail.claimNo") },
                    { key: "incidentDate", label: t("policyDetail.incidentDate") },
                    { key: "status", label: t("common.status"),
                      format: (v) => v ? String(t(`claimStatus.${v}`, v)) : "—" },
                    { key: "approvedAmount", label: t("policyDetail.amount"), numeric: true }
                  ]}
                  emptyKey="policyDetail.noClaims" />
              )}
              {tab === 7 && !modalPresentation && (
                receipts.isLoading ? <CircularProgress /> :
                <SimpleList rows={receipts.data ?? []}
                  cols={[
                    { key: "number", label: t("policyDetail.receiptNo") },
                    { key: "receivedOn", label: t("policyDetail.paidOn") },
                    { key: "method", label: t("policyDetail.method"),
                      format: (v) => v ? String(t(`paymentMethod.${v}`, v)) : "—" },
                    { key: "amount", label: t("policyDetail.amount"), numeric: true }
                  ]}
                  emptyKey="policyDetail.noReceipts" />
              )}
              {showMovements && (
                <Stack spacing={1.5}>
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Πρόσθετες πράξεις</Typography>
                  {endorsements.isLoading ? <CircularProgress size={22} /> : <SimpleList rows={endorsements.data ?? []}
                    cols={[{ key: "endorsementNumber", label: t("policyDetail.endorsementNo") }, { key: "issuedAt", label: t("policyDetail.issuedAt") }, { key: "premiumDelta", label: "Διαφορά ασφαλίστρου", numeric: true }, { key: "description", label: t("common.description") }]}
                    emptyKey="policyDetail.noEndorsements" />}
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Ζημιές</Typography>
                  {claims.isLoading ? <CircularProgress size={22} /> : <SimpleList rows={claims.data ?? []}
                    cols={[{ key: "claimNumber", label: t("policyDetail.claimNo") }, { key: "incidentDate", label: t("policyDetail.incidentDate") }, { key: "status", label: t("common.status"), format: (v) => v ? String(t(`claimStatus.${v}`, v)) : "—" }, { key: "approvedAmount", label: t("policyDetail.amount"), numeric: true }]}
                    emptyKey="policyDetail.noClaims" />}
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Εισπράξεις</Typography>
                  {receipts.isLoading ? <CircularProgress size={22} /> : <SimpleList rows={receipts.data ?? []}
                    cols={[{ key: "number", label: t("policyDetail.receiptNo") }, { key: "receivedOn", label: t("policyDetail.paidOn") }, { key: "method", label: t("policyDetail.method"), format: (v) => v ? String(t(`paymentMethod.${v}`, v)) : "—" }, { key: "amount", label: t("policyDetail.amount"), numeric: true }]}
                    emptyKey="policyDetail.noReceipts" />}
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Δόσεις</Typography>
                  <PolicyInstallmentsTab policyId={p.id} readOnly={!canEdit} />
                </Stack>
              )}
              {tab === 8 && !modalPresentation && <PolicyContractPdf policyId={p.id} />}
              {showDocumentsHistory && (
                <Stack spacing={1.5}>
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Έγγραφο συμβολαίου</Typography>
                  <PolicyContractPdf policyId={p.id} readOnly={!canEdit} />
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Ιστορικό αλλαγών</Typography>
                  <EntityAuditTimeline entityName="Policy" entityId={p.id} />
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Επικοινωνίες</Typography>
                  <PolicyCommunicationsTab
                    policyId={p.id}
                    loading={communications.isLoading}
                    rows={communications.data ?? []}
                    readOnly={!canEdit}
                    onSaved={() => void qc.invalidateQueries({ queryKey: ["policy-communications", p.id] })}
                  />
                </Stack>
              )}
              {/* Merged "Δεδομένα συμβολαίου": objects (insured items) on
                  top, covers table below, one Divider between them so the
                  operator sees the shape of the contract in a single glance
                  instead of jumping between two tabs. */}
              {tab === 9 && !modalPresentation && (
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: "block" }}>
                      Αντικείμενα
                    </Typography>
                    <PolicyObjectsTab policyId={p.id} />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: "block" }}>
                      Καλύψεις
                    </Typography>
                    <PolicyCoversTab policyId={p.id} />
                  </Box>
                </Stack>
              )}
              {tab === 10 && !modalPresentation && <PolicyInstallmentsTab policyId={p.id} />}
              {/* Merged "Δραστηριότητα": audit trail (created / edited /
                  fields changed) on top, communications log (emails /
                  calls / notes) below. */}
              {tab === 11 && !modalPresentation && (
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: "block" }}>
                      Ιστορικό αλλαγών
                    </Typography>
                    <EntityAuditTimeline entityName="Policy" entityId={p.id} />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: "block" }}>
                      Επικοινωνία
                    </Typography>
                    <PolicyCommunicationsTab
                      policyId={p.id}
                      loading={communications.isLoading}
                      rows={communications.data ?? []}
                      onSaved={() => void qc.invalidateQueries({ queryKey: ["policy-communications", p.id] })}
                    />
                  </Box>
                </Stack>
              )}
            </>
          )}
        </Box>

        {/* Sticky footer with save (Summary now editable via ALIS-parity fields). */}
        {((!modalPresentation && tab >= 0 && tab <= 4) || (modalPresentation && editing)) && (
          <Box sx={{ p: modalPresentation ? 1 : 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {modalPresentation && editing ? (
                <Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={() => { setEditing(false); if (q.data) resetFormFromPolicy(q.data); }} sx={{ color: "#fff", fontWeight: 800 }}>
                  Ακύρωση επεξεργασίας
                </Button>
              ) : <Button onClick={onClose}>{t("common.cancel")}</Button>}
              {!readOnly && (!modalPresentation || editing) && (
                <Button variant="contained" color={modalPresentation ? "success" : "primary"} startIcon={<SaveIcon />} disabled={save.isPending} onClick={() => save.mutate()} sx={modalPresentation ? { color: "#fff", fontWeight: 800, "&:hover": { color: "#fff", bgcolor: "success.dark" } } : undefined}>
                  {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Box>
      <PropagateChangesDialog
        open={!!propagateChanges}
        sourcePolicyId={policyId}
        changes={propagateChanges ?? {}}
        onClose={(result) => {
          setPropagateChanges(null);
          if (result && result.updatedCount > 0) {
            void qc.invalidateQueries({ queryKey: ["policies"] });
          }
        }}
      />

      {p && !readOnly && (
        <ChangeProducerDialog
          open={changeProducerOpen}
          onClose={() => setChangeProducerOpen(false)}
          policyId={p.id}
          policyNumber={p.policyNumber}
          currentProducerId={p.producerId}
          currentProducerName={p.producerName}
          onSaved={() => {
            setChangeProducerOpen(false);
            void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
            void qc.invalidateQueries({ queryKey: ["policies"] });
          }}
        />
      )}
      {p && (
        <PolicyCustomerPreviewDialog
          open={customerPreviewOpen}
          customerId={p.customerId}
          fallback={{
            customerDisplay: p.customerDisplay,
            email: p.customerEmail,
            phone: p.customerPhone,
            vatNumber: p.customerVat,
          }}
          onClose={() => setCustomerPreviewOpen(false)}
          zIndex={1700}
        />
      )}
      {p && (p.vehicleRegistrationPlate || form.vehicleRegistrationPlate) && (
        <VehicleDetailDialog
          open={vehiclePreviewOpen}
          plate={form.vehicleRegistrationPlate || p.vehicleRegistrationPlate || ""}
          policyIds={[p.id]}
          onClose={() => setVehiclePreviewOpen(false)}
          zIndex={1700}
        />
      )}
    </Drawer>
  );
}

function PolicyCustomerPreviewDialog({ open, customerId, fallback, onClose, zIndex }: {
  open: boolean;
  customerId: string;
  fallback: { customerDisplay: string; email: string | null; phone: string | null; vatNumber: string | null };
  onClose: () => void;
  zIndex?: number;
}) {
  const q = useQuery({
    queryKey: ["policy-customer-preview", customerId],
    enabled: open && !!customerId,
    queryFn: async () => (await api.get<PolicyCustomerPreview>(`/customers/${customerId}`)).data,
  });
  const customer = q.data;
  const displayName = customer?.companyName || [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || fallback.customerDisplay;
  const phones = [customer?.phone, customer?.mobilePhone, customer?.altPhone].filter(Boolean).join(" · ") || fallback.phone || "—";
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" sx={zIndex ? { zIndex } : undefined}>
    <DialogTitle sx={{ py: 1.5 }}><Stack direction="row" spacing={1} alignItems="center"><PersonOutlineIcon color="primary" /><Box flex={1}><Typography variant="h6" fontWeight={850}>{displayName}</Typography><Typography variant="caption" color="text.secondary">Πλήρης σύνοψη πελάτη · {customer?.customerNumber || "—"}</Typography></Box><IconButton size="small" onClick={onClose}><CloseIcon /></IconButton></Stack></DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 1.25, md: 2 } }}>
      {q.isLoading && <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={26} /></Box>}
      {q.isError && <Alert severity="error">{extractErrorMessage(q.error)}</Alert>}
      {!q.isLoading && !q.isError && <Stack spacing={1.25}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: .9 }}>
          <CompactCustomerValue label="Κατάσταση" value={customerStatusLabel(customer?.status)} />
          <CompactCustomerValue label="Τύπος" value={customer?.type === "Company" ? "Νομικό πρόσωπο" : "Φυσικό πρόσωπο"} />
          <CompactCustomerValue label="ΑΦΜ" value={customer?.vatNumber || fallback.vatNumber || "—"} />
          <CompactCustomerValue label="Email" value={customer?.email || fallback.email || "—"} />
          <CompactCustomerValue label="Τηλέφωνα" value={phones} />
          <CompactCustomerValue label="Επάγγελμα" value={customer?.occupation || "—"} />
          <CompactCustomerValue label="Ημερομηνία γέννησης" value={customer?.birthDate ? new Date(customer.birthDate).toLocaleDateString("el-GR") : "—"} />
          <CompactCustomerValue label="Διεύθυνση" value={[customer?.address, customer?.city, customer?.postalCode].filter(Boolean).join(" · ") || "—"} />
        </Box>
        <Box sx={{ p: 1.1, borderRadius: 1.25, bgcolor: "rgba(25,118,210,.05)", border: "1px solid rgba(25,118,210,.16)" }}>
          <Typography variant="caption" color="text.secondary" display="block">Σημειώσεις</Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{customer?.notes || "Δεν έχουν καταχωρηθεί σημειώσεις."}</Typography>
        </Box>
      </Stack>}
    </DialogContent>
    <DialogActions sx={{ px: 2, py: 1.25 }}><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={onClose} sx={{ color: "#fff", fontWeight: 800 }}>Κλείσιμο</Button></DialogActions>
  </Dialog>;
}

function CompactCustomerValue({ label, value }: { label: string; value: string }) {
  return <Box sx={{ p: .9, borderRadius: 1, bgcolor: "rgba(248,250,252,.9)", border: "1px solid", borderColor: "divider", minWidth: 0 }}><Typography variant="caption" color="text.secondary" display="block">{label}</Typography><Typography variant="body2" fontWeight={700} sx={{ wordBreak: "break-word" }}>{value}</Typography></Box>;
}

/**
 * "Αλλαγή συνεργάτη" popup — accessed from the Συνεργάτης section of the
 * policy detail. Meant for correcting a wrong producer link (typically
 * from a bridge auto-mapping). Optionally lets the operator propagate the
 * same change to every future renewal (not older ones — historical
 * production stays intact under the original συνεργάτης).
 */
function ChangeProducerDialog({ open, onClose, policyId, policyNumber, currentProducerId, currentProducerName, onSaved }: {
  open: boolean;
  onClose: () => void;
  policyId: string;
  policyNumber: string;
  currentProducerId: string | null;
  currentProducerName: string | null;
  onSaved: () => void;
}) {
  const [newProducerId, setNewProducerId] = useState<string>("");
  const [transferRenewals, setTransferRenewals] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const producersQ = useQuery({
    queryKey: ["producers-lite-for-change"],
    enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data
  });

  useEffect(() => {
    if (open) { setNewProducerId(""); setTransferRenewals(false); setErr(null); }
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      // Bulk-update endpoint with a single-policy array — same payload the
      // multi-select toolbar uses. Handles both the direct producer change
      // and the optional renewal-transfer flag in one server round trip.
      return (await api.post("/policies/bulk-update", {
        policyIds: [policyId],
        producerId: newProducerId,
        renewalTransferToProducerId: transferRenewals ? newProducerId : null,
        renewalTransferToCarrierId: null,
        status: null,
        paymentCollectionMethod: null,
      })).data;
    },
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  const options = (producersQ.data ?? [])
    .filter(p => p.id !== currentProducerId)
    .map(p => ({ value: p.id, label: p.name, hint: p.code }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Αλλαγή συνεργάτη — συμβόλαιο {policyNumber}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Τρέχων συνεργάτης: <strong>{currentProducerName ?? "— κανένας —"}</strong>.
          Επιλέξτε άλλον για να διορθώσετε λανθασμένη αντιστοίχιση (π.χ. από γέφυρα).
          Οι προηγούμενες προμήθειες παραμένουν άθικτες.
        </Alert>
        <Stack spacing={2} mt={0.5}>
          <SearchableSelect
            label="Νέος συνεργάτης"
            value={newProducerId}
            onChange={v => setNewProducerId(v as string)}
            options={options}
          />
          <FormControlLabel
            control={<Switch checked={transferRenewals} onChange={e => setTransferRenewals(e.target.checked)} />}
            label="Μεταφορά ανανεώσεων στον νέο συνεργάτη"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained">Άκυρο</Button>
        <Button variant="contained" disabled={!newProducerId || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Καθαρό / ΦΠΑ / Χαρτόσημο / Εισφορές / Λοιπά — the split-out numbers that
 * make up the gross premium. Only fields that are non-null render; a policy
 * that only tracks the top-line stays uncluttered.
 */
function TaxBreakdown({ p }: { p: PolicyDetail }) {
  const rows: { label: string; value: number | null }[] = [
    { label: "Καθαρό ασφάλιστρο", value: p.netPremium },
    { label: "Φόρος ασφαλίστρων", value: p.vatAmount },
    { label: "Χαρτόσημο",          value: p.stampDutyAmount },
    { label: "Ασφαλιστική εισφορά", value: p.insuranceContributionAmount },
    { label: "Λοιπές επιβαρύνσεις", value: p.otherChargesAmount },
  ].filter(r => r.value !== null && r.value !== 0);
  if (rows.length === 0) return null;
  const breakdownSum = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const grossMatches = Math.abs(breakdownSum - p.premium) < 0.02;
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Ανάλυση</Typography>
        {!grossMatches && (
          <Chip size="small" color="warning" variant="outlined"
            label={`Διαφορά με μεικτό: ${(p.premium - breakdownSum).toFixed(2)} ${p.currency}`}
            sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
        )}
      </Stack>
      <Stack spacing={0.5}>
        {rows.map(r => (
          <Stack key={r.label} direction="row" justifyContent="space-between">
            <Typography sx={{ color: "text.secondary" }}>{r.label}</Typography>
            <Typography sx={{ fontFamily: "monospace" }}>{(r.value ?? 0).toFixed(2)} {p.currency}</Typography>
          </Stack>
        ))}
        <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.75, borderTop: "1px dashed", borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 700 }}>Άθροισμα ανάλυσης</Typography>
          <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{breakdownSum.toFixed(2)} {p.currency}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

/**
 * Coverage breakdown for the Financials tab. Shows every PolicyCover row
 * with its gross premium and (when set) its per-cover commission %, then a
 * totals row. When the stated policy premium doesn't match the sum of
 * covers, a red drift warning appears so the operator knows to reconcile
 * before commissions run.
 */
function CoversBreakdown({ p }: { p: PolicyDetail }) {
  const drift = Math.abs(p.premium - p.coversGrossTotal);
  const hasDrift = drift > 0.01;
  const anyProducerRate = p.covers.some(c => c.commissionPercent !== null);
  const anyAgencyRate   = p.covers.some(c => c.agencyCommissionPercent !== null);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>
          Καλύψεις ({p.covers.length})
        </Typography>
        {hasDrift && (
          <Chip size="small" color="error" variant="outlined"
            label={`Διαφορά με ασφάλιστρο: ${drift.toFixed(2)} ${p.currency}`}
            sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
        )}
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Κωδικός</TableCell>
            <TableCell>Όνομα</TableCell>
            <TableCell align="right">Μεικτό</TableCell>
            {anyProducerRate && <TableCell align="right">Προμ. συν. %</TableCell>}
            {anyAgencyRate   && <TableCell align="right">Προμ. γρ. %</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {p.covers.map(c => (
            <TableRow key={c.id}>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.coverCode}</TableCell>
              <TableCell>{c.coverName ?? "—"}</TableCell>
              <TableCell align="right">{c.grossPremium.toFixed(2)}</TableCell>
              {anyProducerRate && (
                <TableCell align="right" sx={{ color: c.commissionPercent === null ? "text.disabled" : undefined }}>
                  {c.commissionPercent === null ? "—" : `${c.commissionPercent.toFixed(2)}%`}
                </TableCell>
              )}
              {anyAgencyRate && (
                <TableCell align="right" sx={{ color: c.agencyCommissionPercent === null ? "text.disabled" : undefined }}>
                  {c.agencyCommissionPercent === null ? "—" : `${c.agencyCommissionPercent.toFixed(2)}%`}
                </TableCell>
              )}
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Σύνολο από καλύψεις</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>{p.coversGrossTotal.toFixed(2)} {p.currency}</TableCell>
            {anyProducerRate && <TableCell />}
            {anyAgencyRate   && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
      {(anyProducerRate || anyAgencyRate) && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          «—» στα ποσοστά σημαίνει ότι η κάλυψη κληρονομεί το ποσοστό από τον κανόνα προμηθειών.
        </Typography>
      )}
    </Box>
  );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Box className="policy-kv" sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(118px, .45fr) 1fr", sm: "minmax(145px, .52fr) 1fr" }, gap: 1, py: .35, alignItems: "baseline", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? "monospace" : undefined, fontWeight: 650, wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

function PolicySummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.25, bgcolor: "rgba(248,250,252,.85)", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: .7, color: "primary.dark" }}>{title}</Typography>
      {children}
    </Box>
  );
}

function PolicySummaryLine({ label, value, mono, valueColor }: { label: string; value: React.ReactNode; mono?: boolean; valueColor?: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(118px, .45fr) 1fr", sm: "minmax(135px, .5fr) 1fr" }, gap: 1, py: .35, alignItems: "baseline", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={650} sx={{ fontFamily: mono ? "monospace" : undefined, color: valueColor, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{value}</Typography>
    </Box>
  );
}

function SimpleList({ rows, cols, emptyKey }: {
  rows: any[];
  cols: {
    key: string; label: string; numeric?: boolean;
    /** Optional per-column formatter — use for enum values that need i18n. */
    format?: (value: any, row: any) => React.ReactNode;
  }[];
  emptyKey: string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>{t(emptyKey)}</Typography>;
  }
  return (
    <Table size="small">
      <TableHead><TableRow>
        {cols.map(c => <TableCell key={c.key} align={c.numeric ? "right" : "left"}>{c.label}</TableCell>)}
      </TableRow></TableHead>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={row.id ?? i} hover>
            {cols.map(c => {
              const raw = row[c.key];
              const rendered = c.format
                ? c.format(raw, row)
                : (c.numeric && typeof raw === "number" ? raw.toFixed(2) : (raw ?? "—"));
              return (
                <TableCell key={c.key} align={c.numeric ? "right" : "left"}
                  sx={{ fontFamily: c.key.toLowerCase().includes("number") || c.key.toLowerCase().includes("no") ? "monospace" : undefined }}>
                  {rendered}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ============================================================================
   Contract PDF — list, in-browser preview, print, upload (new/replace), delete.
   Backend already exposes:
     GET    /api/documents?policyId=...
     POST   /api/documents/upload   (multipart)
     GET    /api/documents/{id}/download
     DELETE /api/documents/{id}
   ============================================================================ */
interface PolicyDoc {
  id: string; policyId: string; documentType: string;
  fileName: string; mimeType: string; sizeBytes: number;
  createdAt: string;
}

function PolicyContractPdf({ policyId, readOnly = false }: { policyId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  // Cleanup blob URLs when the component unmounts.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const docsQ = useQuery({
    queryKey: ["policy-documents", policyId],
    queryFn: async () => (await api.get<PolicyDoc[]>("/documents", { params: { policyId } })).data
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("policyId", policyId);
      // Backend DocumentType enum is Policy | GreenCard | Roadside |
      // Invoice | Other. «Contract» does NOT exist and the model binder
      // rejects the whole multipart with a generic 400 — which surfaced
      // as «Something went wrong» in the drawer. The policy contract PDF
      // is tagged as «Policy».
      fd.append("type", "Policy");
      fd.append("file", file);
      return (await api.post<PolicyDoc>("/documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      })).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-documents", policyId] });
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-documents", policyId] });
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewName(null); }
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  // Authenticated blob download — returns a fresh object URL the caller owns.
  async function fetchBlobUrl(docId: string): Promise<string> {
    const res = await api.get(`/documents/${docId}/download`, { responseType: "blob" });
    return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  }

  const preview = async (d: PolicyDoc) => {
    try {
      const url = await fetchBlobUrl(d.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url); setPreviewName(d.fileName); setErr(null);
    } catch (e) { setErr(extractErrorMessage(e)); }
  };

  const download = async (d: PolicyDoc) => {
    try {
      const url = await fetchBlobUrl(d.id);
      const a = document.createElement("a");
      a.href = url; a.download = d.fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErr(extractErrorMessage(e)); }
  };

  const print = async (d: PolicyDoc) => {
    try {
      const url = await fetchBlobUrl(d.id);
      // Use a hidden iframe instead of window.open so browsers can't
      // block the action as a popup. The iframe is injected into the
      // DOM, waits for the PDF to load, triggers the print dialog from
      // its contentWindow, then removes itself. Same UX as opening a new
      // tab and printing, no popup blocker involvement.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
        catch { /* user dismissed */ }
        // Give the print dialog time to detach from the iframe before we
        // remove it, else some browsers cancel the dialog mid-print.
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 5000);
      };
    } catch (e) { setErr(extractErrorMessage(e)); }
  };

  const onPick = (file?: File | null) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setErr("Το αρχείο είναι μεγαλύτερο από 50MB."); return; }
    upload.mutate(file);
  };

  const docs = docsQ.data ?? [];

  return (
    <Stack spacing={2}>
      {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}

      {/* Upload bar */}
      <Box sx={{
        p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2,
        display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap"
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} sx={{ fontSize: 14 }}>
            {docs.length > 0 ? "Αντικατάσταση ή προσθήκη νέου αρχείου" : "Προσθέστε το PDF του συμβολαίου"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Δεκτά: PDF και εικόνες · έως 50MB · αποθηκεύεται κρυπτογραφημένα.
          </Typography>
        </Box>
        <Button component="label" variant="contained" disabled={readOnly || upload.isPending}>
          {upload.isPending ? <CircularProgress size={18} /> : "Επιλογή αρχείου"}
          <input hidden type="file" accept="application/pdf,image/*"
            onChange={(e) => onPick(e.target.files?.[0])} />
        </Button>
      </Box>

      {/* List of attached docs */}
      {docsQ.isLoading ? <CircularProgress /> : (
        <Stack spacing={1}>
          {docs.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Δεν υπάρχει συνημμένο PDF συμβολαίου ακόμα.
            </Typography>
          )}
          {docs.map(d => (
            <Box key={d.id} sx={{
              p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2,
              display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap"
            }}>
              <Box sx={{
                width: 36, height: 44, borderRadius: 0.75,
                bgcolor: "error.main", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 11, letterSpacing: "0.1em"
              }}>
                PDF
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} sx={{ fontSize: 14,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.documentType} · {(d.sizeBytes / 1024).toFixed(0)} KB ·
                  {d.createdAt ? ` ${new Date(d.createdAt).toLocaleDateString("el-GR")}` : ""}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Button size="small" onClick={() => preview(d)}>Προβολή</Button>
                <Button size="small" onClick={() => print(d)}>Εκτύπωση</Button>
                <Button size="small" onClick={() => download(d)}>Λήψη</Button>
                <Button size="small" color="error" disabled={readOnly}
                  onClick={() => { if (confirm("Διαγραφή του αρχείου;")) del.mutate(d.id); }}>
                  Διαγραφή
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* In-browser PDF preview */}
      {previewUrl && (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between"
            sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", bgcolor: "grey.50" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {previewName}
            </Typography>
            <IconButton size="small"
              onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setPreviewName(null); }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box component="iframe" src={previewUrl} title="PDF preview"
            sx={{ width: "100%", height: 520, border: 0, display: "block" }} />
        </Box>
      )}
    </Stack>
  );
}

/* ============== EXTENSION TABS ============== */

function PolicyObjectsTab({ policyId, readOnly = false }: { policyId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["policy-objects", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/objects`)).data
  });
  const [form, setForm] = useState({ objectKind: "", identifier: "", description: "", characteristic: "", fbcLinkCode: "" });
  const add = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/objects`, form)).data,
    onSuccess: () => {
      setForm({ objectKind: "", identifier: "", description: "", characteristic: "", fbcLinkCode: "" });
      void qc.invalidateQueries({ queryKey: ["policy-objects", policyId] });
    }
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/policies/${policyId}/objects/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-objects", policyId] })
  });

  return (
    <Stack spacing={2}>
      <Typography variant="overline" color="text.secondary" fontWeight={700}>Αντικείμενα</Typography>
      {q.isLoading ? <CircularProgress size={20} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Είδος</TableCell>
              <TableCell>Αναγνωριστικό</TableCell>
              <TableCell>Περιγραφή</TableCell>
              <TableCell>FBC</TableCell>
              <TableCell width={42} />
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary" }}>
                Δεν υπάρχουν καταχωρημένα αντικείμενα.
              </TableCell></TableRow>
            )}
            {(q.data ?? []).map((o: any) => (
              <TableRow key={o.id} hover>
                <TableCell>{o.objectKind}</TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>{o.identifier ?? "—"}</TableCell>
                <TableCell>{o.description ?? "—"}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{o.fbcLinkCode ?? "—"}</TableCell>
                <TableCell>
                  <IconButton size="small" color="error" disabled={readOnly} onClick={() => { if (confirm("Διαγραφή;")) del.mutate(o.id); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">Νέο αντικείμενο</Typography>
        <Stack spacing={1.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField disabled={readOnly} size="small" label="Είδος" value={form.objectKind}
              onChange={e => setForm({ ...form, objectKind: e.target.value })} sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" label="Αναγνωριστικό" value={form.identifier}
              onChange={e => setForm({ ...form, identifier: e.target.value })} sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" label="FBC" value={form.fbcLinkCode}
              onChange={e => setForm({ ...form, fbcLinkCode: e.target.value })} sx={{ width: 120 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField disabled={readOnly} size="small" label="Περιγραφή" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" label="Χαρακτηριστικό" value={form.characteristic}
              onChange={e => setForm({ ...form, characteristic: e.target.value })} sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => add.mutate()} disabled={readOnly || !form.objectKind.trim() || add.isPending}>
              {add.isPending ? <CircularProgress size={18} /> : "Προσθήκη"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}

function PolicyCoversTab({ policyId, readOnly = false }: { policyId: string; readOnly?: boolean }) {
  return <PolicyCoversTabInner policyId={policyId} readOnly={readOnly} />;
}

interface CoverRow {
  id: string;
  policyObjectId: string | null;
  coverCode: string;
  coverName: string | null;
  grossPremium: number;
  netPremium: number;
  coverageAmount: number | null;
  commissionPercent: number | null;
  agencyCommissionPercent: number | null;
}

interface CoverFormState {
  coverCode: string;
  coverName: string;
  policyObjectId: string;
  grossPremium: string;
  netPremium: string;
  coverageAmount: string;
  commissionPercent: string;
  agencyCommissionPercent: string;
}

const EMPTY_COVER_FORM: CoverFormState = {
  coverCode: "", coverName: "", policyObjectId: "",
  grossPremium: "", netPremium: "", coverageAmount: "",
  commissionPercent: "", agencyCommissionPercent: ""
};

function toBody(f: CoverFormState) {
  return {
    coverCode: f.coverCode.trim().toUpperCase(),
    coverName: f.coverName.trim() || null,
    policyObjectId: f.policyObjectId || null,
    grossPremium: Number(f.grossPremium) || 0,
    netPremium: Number(f.netPremium) || 0,
    coverageAmount: f.coverageAmount ? Number(f.coverageAmount) : null,
    commissionPercent: f.commissionPercent === "" ? null : Number(f.commissionPercent),
    agencyCommissionPercent: f.agencyCommissionPercent === "" ? null : Number(f.agencyCommissionPercent),
  };
}

function PolicyCoversTabInner({ policyId, readOnly = false }: { policyId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["policy-covers", policyId],
    queryFn: async () => (await api.get<CoverRow[]>(`/policies/${policyId}/covers`)).data
  });
  const objects = useQuery({
    queryKey: ["policy-objects", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/objects`)).data
  });
  const [form, setForm] = useState<CoverFormState>(EMPTY_COVER_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId !== null;

  // Invalidate BOTH the covers list AND the policy detail. The drawer's
  // Financials tab renders a breakdown table + drift chip pulled from
  // detail, so we need both to refetch or the two views diverge.
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["policy-covers", policyId] });
    void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
  };

  const add = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/covers`, toBody(form))).data,
    onSuccess: () => { setForm(EMPTY_COVER_FORM); invalidate(); }
  });
  const update = useMutation({
    mutationFn: async () => (await api.put(`/policies/${policyId}/covers/${editingId}`, toBody(form))).data,
    onSuccess: () => { setEditingId(null); setForm(EMPTY_COVER_FORM); invalidate(); }
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/policies/${policyId}/covers/${id}`),
    onSuccess: invalidate
  });

  const startEdit = (c: CoverRow) => {
    setEditingId(c.id);
    setForm({
      coverCode: c.coverCode,
      coverName: c.coverName ?? "",
      policyObjectId: c.policyObjectId ?? "",
      grossPremium: String(c.grossPremium),
      netPremium: String(c.netPremium),
      coverageAmount: c.coverageAmount === null ? "" : String(c.coverageAmount),
      commissionPercent: c.commissionPercent === null ? "" : String(c.commissionPercent),
      agencyCommissionPercent: c.agencyCommissionPercent === null ? "" : String(c.agencyCommissionPercent),
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_COVER_FORM); };

  const rows = q.data ?? [];
  const totalGross = rows.reduce((s, c) => s + c.grossPremium, 0);
  const totalNet   = rows.reduce((s, c) => s + c.netPremium, 0);

  const [bulkOpen, setBulkOpen] = useState(false);
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Καλύψεις</Typography>
        <Chip size="small" label={`${rows.length}`} sx={{ height: 20, fontSize: 11 }} />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="text" disabled={readOnly} onClick={() => setBulkOpen(true)}>
          Μαζική εισαγωγή CSV
        </Button>
      </Stack>
      <BulkCoversImportDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        policyId={policyId}
        onImported={() => { setBulkOpen(false); invalidate(); }}
      />
      {q.isLoading ? <CircularProgress size={20} /> : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Κωδικός</TableCell>
                <TableCell>Όνομα</TableCell>
                <TableCell align="right">Μικτά</TableCell>
                <TableCell align="right">Καθαρά</TableCell>
                <TableCell align="right">Κεφάλαιο</TableCell>
                <TableCell align="right">Προμ. συν. %</TableCell>
                <TableCell align="right">Προμ. γρ. %</TableCell>
                <TableCell width={80} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 3 }}>
                  Δεν υπάρχουν καταχωρημένες καλύψεις.
                </TableCell></TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id} hover selected={editingId === c.id}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.coverCode}</TableCell>
                  <TableCell>{c.coverName ?? "—"}</TableCell>
                  <TableCell align="right">{c.grossPremium.toFixed(2)}</TableCell>
                  <TableCell align="right">{c.netPremium.toFixed(2)}</TableCell>
                  <TableCell align="right">{c.coverageAmount === null ? "—" : c.coverageAmount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: c.commissionPercent === null ? "text.disabled" : undefined }}>
                    {c.commissionPercent === null ? "—" : `${c.commissionPercent.toFixed(2)}%`}
                  </TableCell>
                  <TableCell align="right" sx={{ color: c.agencyCommissionPercent === null ? "text.disabled" : undefined }}>
                    {c.agencyCommissionPercent === null ? "—" : `${c.agencyCommissionPercent.toFixed(2)}%`}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => startEdit(c)} disabled={readOnly || (editing && editingId !== c.id)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" disabled={readOnly}
                      onClick={() => { if (confirm(`Διαγραφή της κάλυψης ${c.coverCode};`)) del.mutate(c.id); }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow>
                  <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Σύνολο</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totalGross.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totalNet.toFixed(2)}</TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}
      <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {editing ? `Επεξεργασία κάλυψης · ${form.coverCode}` : "Νέα κάλυψη"}
        </Typography>
        <Stack spacing={1.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField disabled={readOnly || editing} size="small" label="Κωδικός" value={form.coverCode}
              onChange={e => setForm({ ...form, coverCode: e.target.value.toUpperCase() })}
              sx={{ width: 140 }} />
            <TextField disabled={readOnly} size="small" label="Όνομα" value={form.coverName}
              onChange={e => setForm({ ...form, coverName: e.target.value })} sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" select label="Αντικείμενο" value={form.policyObjectId}
              onChange={e => setForm({ ...form, policyObjectId: e.target.value })} sx={{ width: 200 }}>
              <MenuItem value="">—</MenuItem>
              {(objects.data ?? []).map((o: any) => <MenuItem key={o.id} value={o.id}>{o.objectKind}{o.identifier ? ` · ${o.identifier}` : ""}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField disabled={readOnly} size="small" type="number" label="Μικτά" value={form.grossPremium}
              onChange={e => setForm({ ...form, grossPremium: e.target.value })} sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" type="number" label="Καθαρά" value={form.netPremium}
              onChange={e => setForm({ ...form, netPremium: e.target.value })} sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" type="number" label="Κεφάλαιο" value={form.coverageAmount}
              onChange={e => setForm({ ...form, coverageAmount: e.target.value })} sx={{ flex: 1 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
            <TextField disabled={readOnly} size="small" type="number" label="Προμ. συνεργάτη %"
              value={form.commissionPercent}
              onChange={e => setForm({ ...form, commissionPercent: e.target.value })}
              helperText={(() => {
                const pct = parseFloat(form.commissionPercent);
                const net = parseFloat(form.netPremium);
                if (Number.isFinite(pct) && Number.isFinite(net) && pct > 0 && net > 0) {
                  return `≈ ${((pct * net) / 100).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
                }
                return "Κενό = από κανόνα";
              })()}
              sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" type="number" label="Ή σε €"
              value={(() => {
                const pct = parseFloat(form.commissionPercent);
                const net = parseFloat(form.netPremium);
                if (Number.isFinite(pct) && Number.isFinite(net) && net > 0) {
                  return ((pct * net) / 100).toFixed(2);
                }
                return "";
              })()}
              onChange={e => {
                const amount = parseFloat(e.target.value);
                const net = parseFloat(form.netPremium);
                if (Number.isFinite(amount) && Number.isFinite(net) && net > 0) {
                  setForm({ ...form, commissionPercent: ((amount / net) * 100).toFixed(4) });
                } else if (e.target.value === "") {
                  setForm({ ...form, commissionPercent: "" });
                }
              }}
              helperText="Ενημερώνει αυτόματα το %"
              sx={{ flex: 1 }} />
            <TextField disabled={readOnly} size="small" type="number" label="Προμ. γραφείου %"
              value={form.agencyCommissionPercent}
              onChange={e => setForm({ ...form, agencyCommissionPercent: e.target.value })}
              helperText="Κενό = από κανόνα"
              sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1}>
              {editing && (
                <Button onClick={cancelEdit} color="error" variant="contained">Άκυρο</Button>
              )}
              <Button variant="contained" disabled={readOnly || !form.coverCode.trim() || add.isPending || update.isPending}
                onClick={() => (editing ? update.mutate() : add.mutate())}
                >
                {(add.isPending || update.isPending) ? <CircularProgress size={18} /> : (editing ? "Αποθήκευση" : "Προσθήκη")}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Το ασφάλιστρο του συμβολαίου συγχρονίζεται αυτόματα με το σύνολο των Μικτών των καλύψεων.
        Ποσοστά που αφήνετε κενά κληρονομούνται από τον κανόνα προμηθειών.
      </Typography>
    </Stack>
  );
}

/**
 * CSV-paste bulk import for policy covers. Accepts the shape:
 *   coverCode,coverName,grossPremium,netPremium,coverageAmount,commissionPercent,agencyCommissionPercent
 * one row per line. Empty fields → null. First line optionally a header.
 * "Αντικατάσταση υπαρχόντων" checkbox flips the ReplaceExisting server flag
 * so existing covers with the same code get UPDATED instead of duplicated.
 */
function BulkCoversImportDialog({
  open, onClose, policyId, onImported
}: {
  open: boolean; onClose: () => void; policyId: string; onImported: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updatedExisting: number; skipped: number } | null>(null);

  const parsed = useMemo(() => {
    const lines = csv.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const rows: any[] = [];
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 3) continue;
      // Skip a header line if the first cell isn't a code-like token.
      if (rows.length === 0 && /coverCode|Κωδικός/i.test(parts[0])) continue;
      const num = (s: string): number | null => {
        if (!s) return null;
        const n = Number(s.replace(",", "."));
        return isNaN(n) ? null : n;
      };
      rows.push({
        coverCode: parts[0],
        coverName: parts[1] || null,
        grossPremium: num(parts[2]) ?? 0,
        netPremium: num(parts[3] ?? "") ?? 0,
        coverageAmount: num(parts[4] ?? ""),
        commissionPercent: num(parts[5] ?? ""),
        agencyCommissionPercent: num(parts[6] ?? ""),
      });
    }
    return rows;
  }, [csv]);

  const importMut = useMutation({
    mutationFn: async () => (await api.post<{ created: number; updatedExisting: number; skipped: number }>(
      `/policies/${policyId}/covers/bulk-import`,
      { rows: parsed, replaceExisting })).data,
    onSuccess: (r) => setResult(r),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Μαζική εισαγωγή καλύψεων</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Ολοκληρώθηκε: {result.created} νέες, {result.updatedExisting} ενημερώθηκαν,
            {" "}{result.skipped} παραλείφθηκαν.
          </Alert>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Μία κάλυψη ανά γραμμή, τιμές χωρισμένες με κόμμα:
          <br />
          <code>κωδικός,όνομα,μεικτά,καθαρά,κεφάλαιο,%συν.,%γρ.</code>
          <br />
          Παράδειγμα: <code>MTPL,Αστική ευθύνη,240.50,220.00,,15,0</code>
        </Typography>
        <TextField
          fullWidth multiline minRows={8}
          placeholder="MTPL,Αστική ευθύνη,240.50,220.00,,15,0"
          value={csv} onChange={(e) => setCsv(e.target.value)}
          sx={{ fontFamily: "monospace" }}
        />
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
            <Typography variant="body2">Αντικατάσταση υπαρχόντων με ίδιο κωδικό</Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Chip label={`${parsed.length} γραμμές έτοιμες`} size="small"
            color={parsed.length > 0 ? "primary" : "default"} sx={{ fontWeight: 700 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setCsv(""); setResult(null); onClose(); }}>Κλείσιμο</Button>
        <Button variant="contained"
          disabled={parsed.length === 0 || importMut.isPending}
          onClick={() => { setErr(null); setResult(null); importMut.mutate(); }}>
          {importMut.isPending ? <CircularProgress size={18} /> : `Εισαγωγή (${parsed.length})`}
        </Button>
        {result && (
          <Button variant="text" onClick={() => { onImported(); }}>Ανανέωση καλύψεων</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function PolicyInstallmentsTab({ policyId, readOnly = false }: { policyId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["policy-installments", policyId],
    queryFn: async () => (await api.get<any[]>(`/policies/${policyId}/installments`)).data
  });
  const generate = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/installments/generate`)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-installments", policyId] })
  });
  const markPaid = useMutation({
    mutationFn: async (id: string) => (await api.post(`/policies/${policyId}/installments/${id}/mark-paid`, {
      paidVia: "Cash", receiptReference: null
    })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-installments", policyId] })
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="overline" color="text.secondary" fontWeight={700}>Δόσεις</Typography>
        <Button size="small" variant="outlined" onClick={() => generate.mutate()} disabled={readOnly || generate.isPending}>
          {generate.isPending ? <CircularProgress size={16} /> : "Δημιουργία δόσεων"}
        </Button>
      </Stack>
      {q.isLoading ? <CircularProgress size={20} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Λήξη</TableCell>
              <TableCell align="right">Ποσό</TableCell>
              <TableCell>Πληρώθηκε</TableCell>
              <TableCell>Τρόπος</TableCell>
              <TableCell width={120} />
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                Δεν υπάρχουν δόσεις. Πατήστε «Δημιουργία δόσεων» για να δημιουργηθεί πλάνο.
              </TableCell></TableRow>
            )}
            {(q.data ?? []).map((i: any) => (
              <TableRow key={i.id} hover>
                <TableCell>{i.ordinal}</TableCell>
                <TableCell>{i.dueDate}</TableCell>
                <TableCell align="right">{i.amount.toFixed(2)} {i.currency}</TableCell>
                <TableCell>{i.paidAt ?? "—"}</TableCell>
                <TableCell>{i.paidVia ?? "—"}</TableCell>
                <TableCell>
                  {!i.paidAt && (
                    <Button size="small" onClick={() => markPaid.mutate(i.id)} disabled={readOnly || markPaid.isPending}>
                      Πληρώθηκε
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}

/* ============================================================================
   Per-policy communication log — ALIS parity item #12. Each entry captures
   a phone / email / meeting / SMS / note tied to this policy so brokers can
   track «γιατί άλλαξε αυτό το συμβόλαιο» without digging through the
   customer-level timeline.
   ============================================================================ */

interface PolicyCommunicationRow {
  id: string;
  customerId: string;
  kind: string;              // Note / Phone / Email / Meeting / Sms / WalkIn
  direction: string;         // Internal / Inbound / Outbound
  outcome: string;           // None / Resolved / FollowUpRequired / NoAnswer / Cancelled
  occurredAt: string;
  durationSeconds: number | null;
  subject: string;
  body: string | null;
  relatedPolicyNumber: string | null;
  relatedPolicyId: string | null;
}

const COMM_KIND_LABEL: Record<string, string> = {
  Note: "Σημείωση", Phone: "Τηλέφωνο", Email: "Email",
  Meeting: "Συνάντηση", Sms: "SMS", WalkIn: "Επίσκεψη"
};
const COMM_DIRECTION_LABEL: Record<string, string> = {
  Internal: "Εσωτερικά", Inbound: "Εισερχόμενο", Outbound: "Εξερχόμενο"
};
const COMM_OUTCOME_LABEL: Record<string, string> = {
  None: "—", Resolved: "Ολοκληρώθηκε", FollowUpRequired: "Χρειάζεται επανάληψη",
  NoAnswer: "Χωρίς απάντηση", Cancelled: "Ακυρώθηκε"
};

function PolicyCommunicationsTab({ policyId, loading, rows, readOnly = false, onSaved }: {
  policyId: string;
  loading: boolean;
  rows: PolicyCommunicationRow[];
  readOnly?: boolean;
  onSaved: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "Note",
    direction: "Internal",
    outcome: "None",
    subject: "",
    body: ""
  });
  useEffect(() => {
    if (readOnly) setCreating(false);
  }, [readOnly]);
  const save = useMutation({
    mutationFn: async () => (await api.post(`/policies/${policyId}/communications`, {
      kind: form.kind,
      direction: form.direction,
      outcome: form.outcome,
      subject: form.subject.trim(),
      body: form.body.trim() || null,
      occurredAt: new Date().toISOString(),
      durationSeconds: null,
      relatedPolicyId: null // server forces this to the policy id anyway
    })).data,
    onSuccess: () => {
      setCreating(false);
      setForm({ kind: "Note", direction: "Internal", outcome: "None", subject: "", body: "" });
      onSaved();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Καταγραφές επικοινωνίας για αυτό το συμβόλαιο. Οι εγγραφές εμφανίζονται και στο ενοποιημένο timeline του πελάτη.
        </Typography>
        <Button size="small" variant="contained" onClick={() => setCreating(true)} disabled={readOnly || creating}>
          Νέα καταγραφή
        </Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}

      {creating && !readOnly && (
        <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField select size="small" fullWidth label="Είδος"
                value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(COMM_KIND_LABEL).map(([k, v]) =>
                  <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField select size="small" fullWidth label="Κατεύθυνση"
                value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
                {Object.entries(COMM_DIRECTION_LABEL).map(([k, v]) =>
                  <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField select size="small" fullWidth label="Αποτέλεσμα"
                value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })}>
                {Object.entries(COMM_OUTCOME_LABEL).map(([k, v]) =>
                  <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField size="small" fullWidth required label="Θέμα"
              value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="π.χ. «Ενημέρωση για λήξη — κ. Παπαδοπούλου»" />
            <TextField size="small" fullWidth multiline rows={3} label="Λεπτομέρειες"
              value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setCreating(false)} color="error" variant="contained">Ακύρωση</Button>
              <Button variant="contained" onClick={() => save.mutate()}
                disabled={readOnly || save.isPending || !form.subject.trim()}>
                {save.isPending ? <CircularProgress size={18} /> : "Καταχώρηση"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          Δεν υπάρχει καμία καταγραφή επικοινωνίας για αυτό το συμβόλαιο ακόμα.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {rows.map(r => (
            <Box key={r.id} sx={{ p: 1.75, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Chip size="small" label={COMM_KIND_LABEL[r.kind] ?? r.kind} />
                <Chip size="small" variant="outlined" label={COMM_DIRECTION_LABEL[r.direction] ?? r.direction} />
                {r.outcome !== "None" && (
                  <Chip size="small" variant="outlined" color="info"
                    label={COMM_OUTCOME_LABEL[r.outcome] ?? r.outcome} />
                )}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(r.occurredAt).toLocaleString("el-GR")}
                </Typography>
              </Stack>
              <Typography fontWeight={700}>{r.subject}</Typography>
              {r.body && (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                  {r.body}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/* ============================================================================
   ALIS-parity commissions matrix — the F9 «Προμήθειες» view. Backend
   materialises one PolicyCommissionSplit row per hierarchy level for which
   the matched CommissionRule defines a percent; this tab renders them as
   a table with %, €, and payable net columns plus a totals row.
   Read-only in v1 — per-level overrides ship in a follow-up.
   ============================================================================ */

interface PolicyCommissionSplitRow {
  id: string;
  hierarchyLevel: string;      // Producer / Manager / Unit / Assistant / Agency
  hierarchyLevelLabel: string; // Greek label from the backend
  producerId: string | null;
  producerName: string | null;
  percent: number;
  grossAmount: number;
  taxWithholdingAmount: number;
  netAmount: number;
  currency: string;
}

interface PolicyCommissionMatrix {
  rows: PolicyCommissionSplitRow[];
  totalGross: number;
  totalTaxWithholding: number;
  totalNet: number;
  currency: string;
}

interface BridgeFallbackCommissions {
  premium: number;
  totalCommissions: number;
  currency: string;
}

function PolicyCommissionMatrixTab({ loading, matrix, currency, readOnly = false, overrideJson, onOverrideChange, onSave, saving, fallback }: {
  loading: boolean;
  matrix: PolicyCommissionMatrix | undefined;
  currency: string;
  readOnly?: boolean;
  overrideJson: string;
  onOverrideChange: (nextJson: string) => void;
  onSave: () => void;
  saving: boolean;
  // Only consulted when the calculated matrix is empty — used to surface
  // the bridge-imported agency-commission total.
  fallback?: BridgeFallbackCommissions;
}) {
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>;
  }
  if (!matrix || matrix.rows.length === 0) {
    // Fallback view — the office hasn't set up its commission rules yet
    // so the calculated matrix is empty. If the bridge brought a total
    // commission for this policy we surface it as a single "Προμήθεια
    // γραφείου (από γέφυρα)" figure so nothing is hidden. Once rules exist
    // the full ALIS-style matrix takes over.
    const bridgeTotal = fallback?.totalCommissions ?? 0;
    return (
      <Stack spacing={2}>
        {bridgeTotal !== 0 && (
          <Box sx={{
            p: 2, border: 1, borderColor: "success.light", borderRadius: 1,
            bgcolor: "success.lighter"
          }}>
            <Typography variant="overline" color="success.dark" fontWeight={700}>
              Προμήθεια Γραφείου (από γέφυρα)
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
              {bridgeTotal.toFixed(2)} {fallback?.currency ?? currency}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Το ποσό ήρθε από το αρχείο της ασφαλιστικής. Είναι το σύνολο που δικαιούται
              το γραφείο — δεν έχει διαχωριστεί σε παραγωγό / manager / unit / assistant
              γιατί δεν έχει οριστεί κατανομή.
            </Typography>
          </Box>
        )}
        <Alert severity="info">
          <Typography fontWeight={700} sx={{ mb: 0.5 }}>
            Δεν έχουν οριστεί κανόνες προμηθειών για αυτό το συμβόλαιο
          </Typography>
          <Typography variant="body2">
            Το γραφείο μπορεί να μοιράσει την προμήθεια σε επίπεδα (παραγωγός,
            manager, unit, assistant, γραφείο) — αλλά καμία τέτοια κατανομή δεν
            βρέθηκε για αυτόν τον κλάδο / κάλυψη / συνεργάτη. Δείτε πώς να
            προσθέσετε κανόνες:
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, mb: 0, mt: 1 }}>
            <Typography component="li" variant="body2">
              Παραμετροποίηση → Κανόνες Προμηθειών: ορίστε ποσοστά ανά κλάδο /
              κάλυψη ή ανά κατηγορία συνεργάτη.
            </Typography>
            <Typography component="li" variant="body2">
              Καρτέλα συνεργάτη: ορίστε ιεραρχία (π.χ. ο παραγωγός X αναφέρει
              στον manager Y) αν χρησιμοποιείτε δίκτυο υποσυνεργατών.
            </Typography>
            <Typography component="li" variant="body2">
              Αν το γραφείο δεν χρησιμοποιεί ιεραρχία, αγνοήστε το μήνυμα — η
              συνολική προμήθεια από τη γέφυρα ισχύει ως έχει.
            </Typography>
          </Box>
        </Alert>
      </Stack>
    );
  }
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Ιεραρχική κατανομή προμηθειών όπως προκύπτει από την παραμετροποίηση του γραφείου
        και το ασφάλιστρο του συμβολαίου. Ο συνεργάτης λαμβάνει ολόκληρο το ποσοστό του,
        χωρίς παρακράτηση.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Επίπεδο</TableCell>
            <TableCell>Συνεργάτης</TableCell>
            <TableCell align="right">%</TableCell>
            <TableCell align="right">Μεικτό</TableCell>
            <TableCell align="right">Καθαρή προμήθεια</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matrix.rows.map(r => (
            <TableRow key={r.id} hover>
              <TableCell>
                <Chip size="small" label={r.hierarchyLevelLabel}
                  color={r.hierarchyLevel === "Agency" ? "primary" : "default"}
                  variant={r.hierarchyLevel === "Agency" ? "filled" : "outlined"} />
              </TableCell>
              <TableCell>{r.producerName ?? <Typography color="text.secondary" component="span" fontStyle="italic">—</Typography>}</TableCell>
              <TableCell align="right"><Typography fontWeight={700}>{r.percent.toFixed(2)}%</Typography></TableCell>
              <TableCell align="right">{r.grossAmount.toFixed(2)} {r.currency}</TableCell>
              <TableCell align="right">
                <Typography fontWeight={800} color="success.main">
                  {r.netAmount.toFixed(2)} {r.currency}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell colSpan={3}><Typography fontWeight={800}>Σύνολο</Typography></TableCell>
            <TableCell align="right"><Typography fontWeight={800}>{matrix.totalGross.toFixed(2)} {matrix.currency || currency}</Typography></TableCell>
            <TableCell align="right"><Typography fontWeight={800} color="success.main">{matrix.totalNet.toFixed(2)} {matrix.currency || currency}</Typography></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <PolicyCommissionOverrideEditor
        readOnly={readOnly}
        overrideJson={overrideJson}
        onChange={onOverrideChange}
        onSave={onSave}
        saving={saving}
      />
    </Stack>
  );
}

/* Per-policy commission override — 5 editable percent inputs that get
   serialised into SpecialLevelPercentsJson and beat the rule at compute
   time. Only affects THIS specific policy. Empty inputs mean "don't
   override that level" — the rule takes over. Clear button wipes the
   whole blob. */
function PolicyCommissionOverrideEditor({ readOnly = false, overrideJson, onChange, onSave, saving }: {
  readOnly?: boolean;
  overrideJson: string;
  onChange: (nextJson: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const parsed = useMemo(() => {
    if (!overrideJson.trim()) return {} as Record<string, number>;
    try { return JSON.parse(overrideJson) as Record<string, number>; } catch { return {}; }
  }, [overrideJson]);
  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    Producer:  parsed.Producer  != null ? String(parsed.Producer)  : "",
    Manager:   parsed.Manager   != null ? String(parsed.Manager)   : "",
    Unit:      parsed.Unit      != null ? String(parsed.Unit)      : "",
    Assistant: parsed.Assistant != null ? String(parsed.Assistant) : "",
    Agency:    parsed.Agency    != null ? String(parsed.Agency)    : "",
  }));
  useEffect(() => {
    if (!editing) return;
    setDraft({
      Producer:  parsed.Producer  != null ? String(parsed.Producer)  : "",
      Manager:   parsed.Manager   != null ? String(parsed.Manager)   : "",
      Unit:      parsed.Unit      != null ? String(parsed.Unit)      : "",
      Assistant: parsed.Assistant != null ? String(parsed.Assistant) : "",
      Agency:    parsed.Agency    != null ? String(parsed.Agency)    : "",
    });
  }, [editing, parsed]);

  const commit = () => {
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(draft)) {
      const n = Number(v);
      if (v.trim() !== "" && Number.isFinite(n) && n > 0) map[k] = n;
    }
    onChange(Object.keys(map).length > 0 ? JSON.stringify(map) : "");
    onSave();
    setEditing(false);
  };
  const clearOverride = () => {
    onChange("");
    onSave();
    setEditing(false);
  };

  const hasOverride = Object.keys(parsed).length > 0;
  return (
    <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: hasOverride ? "rgba(31,123,179,0.05)" : undefined }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Box>
          <Typography fontWeight={700}>Ειδικά ποσοστά για αυτό το συμβόλαιο</Typography>
          <Typography variant="body2" color="text.secondary">
            {hasOverride
              ? "Ενεργό — τα ποσοστά κάτω αντικαθιστούν τους κανόνες του γραφείου για το συγκεκριμένο συμβόλαιο."
              : "Προαιρετικό — ορίστε ποσοστά μόνο για συμβόλαια με ειδική συμφωνία. Αλλιώς εφαρμόζονται οι κανόνες του γραφείου."}
          </Typography>
        </Box>
        {!readOnly && !editing ? (
          <Button size="small" variant={hasOverride ? "outlined" : "contained"} onClick={() => setEditing(true)}>
            {hasOverride ? "Επεξεργασία" : "Προσθήκη"}
          </Button>
        ) : !readOnly ? (
          <Button size="small" onClick={() => setEditing(false)} color="error" variant="contained">Άκυρο</Button>
        ) : null}
      </Stack>

      {editing && !readOnly && (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mt={1.5} flexWrap="wrap" useFlexGap>
            {(["Producer", "Manager", "Unit", "Assistant", "Agency"] as const).map(level => (
              <TextField key={level}
                size="small" type="number" label={`${LEVEL_LABEL[level]} %`}
                value={draft[level]}
                onChange={e => setDraft({ ...draft, [level]: e.target.value })}
                inputProps={{ step: 0.1, min: 0, max: 100 }}
                sx={{ minWidth: 130, flex: 1 }} />
            ))}
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            {hasOverride && (
              <Button color="error" onClick={clearOverride} disabled={saving}>Κατάργηση</Button>
            )}
            <Button variant="contained" onClick={commit} disabled={saving}>
              {saving ? <CircularProgress size={18} /> : "Αποθήκευση"}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}

const LEVEL_LABEL: Record<string, string> = {
  Producer: "Παραγωγός",
  Manager: "Διευθυντής",
  Unit: "Μονάδα",
  Assistant: "Βοηθός",
  Agency: "Γραφείο"
};

/**
 * Compact side-by-side card that renders at the top of the Οικονομικά tab:
 *   • Left column  — Πηγή γέφυρας: gross + net premium from the policy row.
 *   • Right column — Από παραμετροποίηση: agency + producer commissions
 *     computed on demand from the office's commission-rules matrix. Loads
 *     once when the tab opens, refetches when the operator hits "Υπολογισμός
 *     από παραμετροποίηση". A footer button jumps to the full commission
 *     matrix tab (index 14) for editing.
 */
function BridgeVsParametrizationCard({ policy, matrix, matrixLoading, onCompute }: {
  policy: {
    premium: number;
    netPremium: number | null;
    currency: string;
    producerName: string | null;
    bridgeAgencyCommissionAmount: number | null;
  };
  matrix: PolicyCommissionMatrix | undefined;
  matrixLoading: boolean;
  onCompute: () => void;
}) {
  const fmt = (n: number) => `${n.toFixed(2)} ${policy.currency}`;
  // Split matrix rows into "agency" (office cut) and "producer" (per-tier
  // producers). Sum each side so the operator sees one number per bucket
  // even when the office has a multi-level hierarchy.
  const agencyTotal = (matrix?.rows ?? [])
    .filter(r => r.hierarchyLevel === "Agency")
    .reduce((a, r) => a + r.grossAmount, 0);
  const producerTotal = (matrix?.rows ?? [])
    .filter(r => r.hierarchyLevel !== "Agency")
    .reduce((a, r) => a + r.grossAmount, 0);
  const hasMatrix = (matrix?.rows ?? []).length > 0;

  return (
    <Box sx={{
      p: 2, borderRadius: 1,
      border: 1, borderColor: "divider",
      bgcolor: "background.paper"
    }}>
      <Stack direction="row" spacing={2} sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        gap: 2,
      }}>
        {/* Bridge column */}
        <Box>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>
            Από τη γέφυρα
          </Typography>
          <Stack spacing={0.5} mt={1}>
            <Row label="Μικτά" value={fmt(policy.premium)} bold />
            <Row label="Καθαρά" value={policy.netPremium != null ? fmt(policy.netPremium) : "—"} />
            {/* Bridge-imported agency commission — shown only for policies
                that actually landed through a carrier bridge. */}
            <Row
              label="Προμήθεια Γραφείου"
              value={policy.bridgeAgencyCommissionAmount != null
                ? fmt(policy.bridgeAgencyCommissionAmount)
                : "—"}
              bold
            />
          </Stack>
        </Box>

        {/* Parametrization column */}
        <Box>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>
            Από παραμετροποίηση
          </Typography>
          {matrixLoading ? (
            <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={18} />
            </Box>
          ) : !hasMatrix ? (
            <Stack spacing={1} mt={1}>
              <Typography variant="caption" color="text.secondary">
                Δεν έχουν υπολογιστεί προμήθειες ακόμη.
              </Typography>
              <Button size="small" variant="outlined" onClick={onCompute}>
                Υπολογισμός από παραμετροποίηση
              </Button>
            </Stack>
          ) : (
            <Stack spacing={0.5} mt={1}>
              <Row label="Προμήθεια γραφείου" value={fmt(agencyTotal)} bold />
              <Row
                label={policy.producerName ? `Προμήθεια συνεργάτη · ${policy.producerName}` : "Προμήθεια συνεργάτη"}
                value={fmt(producerTotal)}
              />
            </Stack>
          )}
        </Box>
      </Stack>

      {hasMatrix && (
        <Stack direction="row" spacing={1} mt={2} justifyContent="flex-end">
          <Button size="small" onClick={onCompute}>Επανυπολογισμός</Button>
          {/* The full matrix now sits directly below on the same tab — no
              need for a jump button. */}
        </Stack>
      )}
    </Box>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: bold ? 700 : 500 }}>{value}</Typography>
    </Stack>
  );
}
