import { DetailProfileTabs } from "./profile/DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileFieldGridSx, useProfileFieldEditor, type ProfileFieldSession } from "./profile/ProfileFieldEditor";
import { POLICY_CORE_KEYS, policyCorePayload, policyPreservedAmounts } from "./profile/policyProfile";
import { createContext, useContext, Children, isValidElement, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField as MuiTextField, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { EntityAuditTimeline } from "./EntityAuditTimeline";
import { PropagateChangesDialog, type PropagatableChanges } from "./PropagateChangesDialog";
import { SearchableSelect as OriginalSearchableSelect } from "./SearchableSelect";
import { VehicleDetailDialog } from "../pages/CustomerVehiclesPage";
import { contractDurationLabel } from "../utils/contractDuration";
import EditIcon from "@mui/icons-material/Edit";

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
  carrierDue: number; carrierPaid: number; carrierOutstanding: number;
  producerDue: number; producerPaid: number; producerOutstanding: number;
  agencyCommissionExpected: number; agencyCommissionReceived: number; agencyCommissionOutstanding: number;
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
  vehicleUseCategory?: string | null;
  carrierUseCode?: string | null;
  characteristic?: string | null;
  deductible?: number | null;
  position?: string | null;
  policyNotes?: string | null;
  // Per-policy commission override (JSON blob {"Producer":15,"Manager":3,...})
  specialLevelPercentsJson: string | null;
  // Bridge-supplied Προμήθεια Γραφείου — summed from FinancialMovements
  // created at import time. Null on policies that never touched a bridge.
  bridgeAgencyCommissionAmount: number | null;
  carrierBranchCode?: string | null;
  carrierPackageCode?: string | null;
  carrierCoverageCode?: string | null;
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

type PolicySettlementMode = "receipt" | "carrierPayment" | "producerPayment";

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

interface StoredVehiclePolicy {
  id: string;
  policyNumber: string;
  customerId: string;
  customerDisplay: string;
  insuranceCompanyName: string;
  startDate: string;
  endDate: string;
  premium: number;
  status: string;
  vehicleRegistrationPlate: string | null;
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
  const [modalTab, setModalTab] = useState(0);
  const [changeProducerOpen, setChangeProducerOpen] = useState(false);
  const [customerPreviewOpen, setCustomerPreviewOpen] = useState(false);
  const [vehiclePreviewOpen, setVehiclePreviewOpen] = useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [commissionDetailsOpen, setCommissionDetailsOpen] = useState(false);
  const [settlementMode, setSettlementMode] = useState<PolicySettlementMode | null>(null);
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
      setCommissionDetailsOpen(false);
      setModalTab(0);
      setTab(0);
    }
  }, [open, policyId]);

  // Detail values stay readable and copyable with one click. A double click
  // asks the already-existing policy editor to open, so no second edit form or
  // duplicate API flow is introduced.
  useEffect(() => {
    if (!open || readOnly) return;
    const openEditor = () => session.begin();
    window.addEventListener("kalypsis:policy-edit-request", openEditor);
    return () => window.removeEventListener("kalypsis:policy-edit-request", openEditor);
  }, [open, readOnly]);

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

  const storedVehiclesQuery = useQuery({
    queryKey: ["policy-stored-vehicles", vehiclePickerOpen],
    enabled: open && vehiclePickerOpen,
    queryFn: async () => (await api.get<StoredVehiclePolicy[]>("/policies", { params: { type: "Auto" } })).data,
  });

  const storedVehicles = useMemo(() => {
    const rows = storedVehiclesQuery.data ?? [];
    const needle = vehicleSearch.trim().toLocaleLowerCase("el-GR");
    const unique = new Map<string, StoredVehiclePolicy>();
    for (const row of rows) {
      const plate = row.vehicleRegistrationPlate?.trim().toUpperCase();
      if (!plate || row.id === policyId) continue;
      if (!unique.has(plate)) unique.set(plate, { ...row, vehicleRegistrationPlate: plate });
    }
    return [...unique.values()]
      .filter(row => !needle || [row.vehicleRegistrationPlate, row.policyNumber, row.customerDisplay, row.insuranceCompanyName]
        .some(value => String(value ?? "").toLocaleLowerCase("el-GR").includes(needle)))
      .sort((a, b) => (a.customerId === q.data?.customerId ? -1 : 0) - (b.customerId === q.data?.customerId ? -1 : 0));
  }, [policyId, q.data?.customerId, storedVehiclesQuery.data, vehicleSearch]);

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
    mutationFn: async (override?: Partial<typeof form>) => {
      const next = { ...form, ...override };
      const before = {
        paymentFrequency: q.data?.paymentFrequency,
        specialCommissionPercent: q.data?.specialCommissionPercent,
        renewalTransferToProducerId: q.data?.renewalTransferToProducerId,
        renewalTransferToCarrierId: q.data?.renewalTransferToCarrierId,
        paymentCollectionMethod: q.data?.paymentCollectionMethod,
      };
      const saved = (await api.put<PolicyDetail>(`/policies/${policyId}/extended`, {
        ...policyPreservedAmounts({ ...(qc.getQueryData<PolicyDetail>(["policy-detail", policyId]) ?? q.data) }),
        paymentFrequency: next.paymentFrequency,
        premiumIncludesVat: next.premiumIncludesVat,
        specialCommissionPercent: next.specialCommissionPercent ? Number(next.specialCommissionPercent) : null,
        specsJson: next.specsJson || null,
        nextRenewalDate: next.nextRenewalDate || null,
        renewalTransferToProducerId: next.renewalTransferToProducerId || null,
        renewalTransferToCarrierId: next.renewalTransferToCarrierId || null,
        retainCommissionsOnRenewal: next.retainCommissionsOnRenewal,
        retainDocumentNumberOnRenewal: next.retainDocumentNumberOnRenewal,
        retainSpecialCommissionsOnRenewal: next.retainSpecialCommissionsOnRenewal,
        renewalInstructions: next.renewalInstructions || null,
        deliveredAt: next.deliveredAt || null,
        deliveredTo: next.deliveredTo || null,
        deliveryMethod: next.deliveryMethod || null,
        paymentCollectionMethod: next.paymentCollectionMethod || null,
        paidDirectlyToCarrier: next.paidDirectlyToCarrier,
        applicationNumber: next.applicationNumber.trim() || null,
        contractPartyCustomerId: next.contractPartyCustomerId || null,
        previousInsuranceCompanyId: next.previousInsuranceCompanyId || null,
        issuedAt: next.issuedAt || null,
        vehicleRegistrationPlate: next.vehicleRegistrationPlate.trim() || null,
        driverVatNumber: next.driverVatNumber.trim() || null,
        reasonForCirculation: next.reasonForCirculation.trim() || null,
        specialLevelPercentsJson: next.specialLevelPercentsJson.trim() || null
      })).data;
      qc.setQueryData(["policy-detail", policyId], saved);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Trigger the propagation prompt only when at least one propagatable
      // field actually moved. Dialog auto-dismisses silently if the
      // customer has no other contracts.
      if (Object.keys(diff).length > 0) setPropagateChanges(diff);
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const linkVehicle = useMutation({
    mutationFn: async (vehicle: StoredVehiclePolicy) => {
      // Copy the vehicle-specific fields from the selected stored policy so
      // the new contract immediately has the same vehicle card details,
      // rather than only displaying the registration plate.
      const source = await api.get<PolicyDetail>(`/policies/${vehicle.id}/detail`).then(response => response.data);
      return api.patch(`/policies/${policyId}/vehicle`, {
        vehicleRegistrationPlate: vehicle.vehicleRegistrationPlate,
        vehicleUseCategory: source.vehicleUseCategory ?? source.carrierUseCode ?? null,
        driverVatNumber: source.driverVatNumber ?? null,
        reasonForCirculation: source.reasonForCirculation ?? null,
        characteristic: source.characteristic ?? null,
        deductible: source.deductible ?? null,
        position: source.position ?? null,
        specsJson: source.specsJson ?? null,
        notes: source.policyNotes ?? null,
        replaceDetails: true,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
      void qc.invalidateQueries({ queryKey: ["customer-vehicles-all"] });
      setVehiclePickerOpen(false);
      setVehicleSearch("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setErr(extractErrorMessage(e)),
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

  const session = useProfileFieldEditor({
    sessionKey: open ? policyId ?? "" : "", values: {
      ...Object.fromEntries(Object.keys(form).map(key => [key, String(q.data?.[key as keyof PolicyDetail] ?? "")])),
      ...Object.fromEntries(POLICY_CORE_KEYS.map(key => [key, String(q.data?.[key as keyof PolicyDetail] ?? "")])),
      policyType: q.data?.carrierBranchCode || q.data?.policyType || "",
    }, onClose, refresh: () => { void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] }); void qc.invalidateQueries({ queryKey: ["policies"] }); },
    write: async (changes, accept) => {
      if (readOnly || !q.data) throw new Error("Δεν επιτρέπεται η επεξεργασία συμβολαίου.");
      if (!Object.keys(changes).length) return;
      const core = Object.fromEntries(Object.entries(changes).filter(([key]) => POLICY_CORE_KEYS.some(field => field === key)));
      if (Object.keys(core).length) {
        const current = (await api.get<PolicyDetail>("/policies/" + policyId + "/detail")).data;
        // The list DTO omits taxes and carrier mappings; only the full detail is lossless.
        await api.put("/policies/" + policyId, policyCorePayload({ ...current,
          policyType: current.carrierBranchCode || current.policyType,
          vehicleUseCategory: current.vehicleUseCategory || current.carrierUseCode,
          coverCode: current.carrierCoverageCode, packageCode: current.carrierPackageCode,
        }, core));
        // Cache the full detail, not a partial list DTO, before the next independent write.
        qc.setQueryData(["policy-detail", policyId], (await api.get<PolicyDetail>("/policies/" + policyId + "/detail")).data);
        accept(Object.keys(core));
      }
      const extended = Object.fromEntries(Object.entries(changes).filter(([key]) => !POLICY_CORE_KEYS.some(field => field === key)));
      if (Object.keys(extended).length) {
        const override: Record<string, string | boolean> = {};
        for (const [key, value] of Object.entries(extended)) {
          if (!(key in form)) throw new Error("Μη υποστηριζόμενο πεδίο συμβολαίου.");
          if (typeof form[key as keyof typeof form] === "boolean") {
            if (!["true", "false"].includes(value)) throw new Error("Επιλέξτε Ναι ή Όχι.");
            override[key] = value === "true";
          } else override[key] = value;
          if (["specsJson", "specialLevelPercentsJson"].includes(key) && value.trim()) {
            try { JSON.parse(value); } catch { throw new Error("Συμπληρώστε έγκυρα δομημένα στοιχεία JSON."); }
          }
        }
        // Merge against fresh detail after a core save so untouched values cannot be overwritten by a stale form.
        const current = qc.getQueryData<PolicyDetail>(["policy-detail", policyId]) ?? q.data;
        const baseline = Object.fromEntries(Object.keys(form).map(key => [key, typeof form[key as keyof typeof form] === "boolean" ? Boolean(current[key as keyof PolicyDetail]) : String(current[key as keyof PolicyDetail] ?? "")]));
        await save.mutateAsync({ ...baseline, ...override } as Partial<typeof form>); accept(Object.keys(extended));
      }
    }
  });
  const editing = session.editAll;

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
    <PolicyFieldsContext.Provider value={{session, readOnly}}><Drawer anchor="right" open={open} onClose={session.requestClose}
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
        <Box sx={{ px: 1.25, py: .9, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#edf3f9" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={modalPresentation ? .75 : 1}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>
              {t("policyDetail.header")}
            </Typography>
            <Stack direction="row" spacing={.75} alignItems="center">
              <IconButton size="small" onClick={session.requestClose}><CloseIcon /></IconButton>
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
        <DetailProfileTabs value={modalPresentation ? modalTab : tab} onChange={value => modalPresentation ? selectTab(value) : setTab(value)} items={modalPresentation ? [
          {label:"Γενικά",icon:<InfoOutlinedIcon />}, {label:"Οικονομικά",icon:<AccountBalanceWalletOutlinedIcon />},
          {label:"Στοιχεία συμβολαίου",icon:<DescriptionOutlinedIcon />}, {label:"Κινήσεις",icon:<ReceiptLongOutlinedIcon />},
          {label:"Έγγραφα & ιστορικό",icon:<HistoryOutlinedIcon />},
        ] : [
          {label:"Γενικά",icon:<InfoOutlinedIcon />}, {label:t("policyDetail.tab.financials"),icon:<AccountBalanceWalletOutlinedIcon />},
          {label:t("policyDetail.tab.parties"),icon:<PersonOutlineIcon />}, {label:t("policyDetail.tab.renewal"),icon:<DescriptionOutlinedIcon />},
          {label:t("policyDetail.tab.delivery"),icon:<DescriptionOutlinedIcon />}, {label:t("policyDetail.tab.endorsements"),icon:<DescriptionOutlinedIcon />},
          {label:t("policyDetail.tab.claims"),icon:<DescriptionOutlinedIcon />}, {label:t("policyDetail.tab.receipts"),icon:<ReceiptLongOutlinedIcon />},
          {label:"PDF Συμβολαίου",icon:<DescriptionOutlinedIcon />}, {label:"Δεδομένα συμβολαίου",icon:<DescriptionOutlinedIcon />},
          {label:"Δόσεις",icon:<ReceiptLongOutlinedIcon />}, {label:"Δραστηριότητα",icon:<HistoryOutlinedIcon />},
        ]} />

        {/* Scrollable content */}
        <Box sx={{
          flex: 1, overflowY: "auto", p: modalPresentation ? { xs: 1, md: 1.5 } : 3,
          ...(modalPresentation ? {
            "& .policy-kv": { py: .3, minHeight: 28 },
            "& .MuiDivider-root": { my: .75 },
          } : {}),
        }}>
          <ProfileEditorFeedback session={session} />
          {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
          {saved && <Alert severity="success" sx={{ mb: 2 }}>{t("common.savedOk")}</Alert>}

          {!p ? <CircularProgress /> : (
            <>
              {/* SUMMARY */}
              {showSummary && <Stack spacing={.75}>
                <PolicyProfileFields session={readOnly ? undefined : session} values={session.values} policy={p}
                  companies={carriersLookup.data ?? []} customers={customersLookup.data ?? []} />
                <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap">
                  <Button size="small" variant="outlined" onClick={() => setCustomerPreviewOpen(true)}>Καρτέλα πελάτη</Button>
                  <Button size="small" variant="outlined" onClick={() => setVehiclePreviewOpen(true)}>Καρτέλα οχήματος</Button>
                  {!readOnly && <Button size="small" variant="outlined" onClick={() => setVehiclePickerOpen(true)}>Σύνδεση οχήματος</Button>}
                  {!readOnly && <Button size="small" variant="outlined" onClick={() => setChangeProducerOpen(true)}>Αλλαγή συνεργάτη</Button>}
                </Stack>
                <Box sx={profileFieldGridSx}>
                  <ProfileEditableField label="Δημιουργήθηκε" value={new Date(p.createdAt).toLocaleString("el-GR")} />
                  <ProfileEditableField label="Ενημερώθηκε" value={p.updatedAt ? new Date(p.updatedAt).toLocaleString("el-GR") : ""} />
                  <ProfileEditableField label="Δημιουργήθηκε από" value={p.createdByName} />
                  <ProfileEditableField label="Προηγούμενο συμβόλαιο" value={p.renewedFromPolicyNumber} />
                </Box>
              </Stack>}

              {showContract && <Box sx={profileFieldGridSx}>
                <ProfileEditableField label="Σημειώσεις συμβολαίου" value={p.policyNotes} />
                <TextField profileKey="specsJson" label="Παραμετρικά στοιχεία (JSON)" value={form.specsJson} multiline />
              </Box>}

              {showFinancials && (readOnly ? (
                <Alert severity="info">
                  Η παραμετροποίηση και ο πίνακας προμηθειών ανήκουν στο γραφείο. Η δική σας ανάλυση ανά συμβόλαιο και μήνα είναι διαθέσιμη στον Πίνακα ελέγχου.
                </Alert>
              ) : (
                <Stack spacing={1}>
                  <PolicySummarySection title={`Ασφάλιστρα & ανάλυση · ${p.currency}`}>
                    <PolicyPremiumFields policy={p} matrix={commissionMatrix.data} matrixLoading={commissionMatrix.isLoading} session={session} />
                    <Stack direction="row" gap={.75} flexWrap="wrap" sx={{ mt: .75 }}>
                      <Button size="small" variant="outlined" startIcon={<AccountBalanceWalletOutlinedIcon />} onClick={() => setCommissionDetailsOpen(true)}>Κατανομή & ειδικά ποσοστά</Button>
                      <Button size="small" disabled={commissionMatrix.isFetching} onClick={() => void commissionMatrix.refetch()}>Επανυπολογισμός προμηθειών</Button>
                    </Stack>
                  </PolicySummarySection>
                  <PolicySummarySection title="Είσπραξη & ρυθμίσεις">
                    <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
                      <PolicySummaryLine label={t("policyDetail.totalReceived")} value={settlementAmount(p.totalReceived, p.currency)} mono />
                      <PolicySummaryLine label={t("policyDetail.outstanding")} value={settlementAmount(p.outstanding, p.currency)} mono />
                      <TextField profileKey="paymentFrequency" select label={t("policyDetail.paymentFrequency")} value={form.paymentFrequency}>{FREQUENCIES.map(f => <MenuItem key={f} value={f}>{FREQUENCY_LABELS[f] ?? f}</MenuItem>)}</TextField>
                      <TextField profileKey="paymentCollectionMethod" select label="Τρόπος είσπραξης" value={form.paymentCollectionMethod}><MenuItem value="">Δεν έχει οριστεί</MenuItem>{COLLECTION_METHODS.map(m => <MenuItem key={m} value={m}>{COLLECTION_METHODS_LABEL[m]}</MenuItem>)}</TextField>
                      <PolicyBooleanField profileKey="paidDirectlyToCarrier" label="Πληρωμή απευθείας στην ασφαλιστική" />
                      <TextField profileKey="specialCommissionPercent" type="number" label={t("policyDetail.specialCommission")} value={form.specialCommissionPercent} />
                    </Box>
                  </PolicySummarySection>
                  <PolicySettlementPanel policy={p} readOnly={readOnly} onSettle={setSettlementMode} />
                  {p.covers.length > 0 && <PolicySummarySection title="Αναλυτικές καλύψεις"><CoversBreakdown p={p} /></PolicySummarySection>}
                  <Dialog open={commissionDetailsOpen} onClose={() => setCommissionDetailsOpen(false)} fullWidth maxWidth="lg">
                    <DialogTitle>Κατανομή προμηθειών & ειδικά ποσοστά</DialogTitle>
                    <DialogContent dividers sx={{ overflowX: "auto" }}>
                      {session.error && <Alert severity="error">{session.error}</Alert>}
                      {commissionMatrix.isError && <Alert severity="error">Δεν φορτώθηκε η κατανομή προμηθειών. Δοκιμάστε επανυπολογισμό.</Alert>}
                      <PolicyCommissionMatrixTab loading={commissionMatrix.isLoading} matrix={commissionMatrix.data} currency={p.currency}
                        readOnly={readOnly} overrideJson={form.specialLevelPercentsJson}
                        onOverrideChange={next => { setForm({ ...form, specialLevelPercentsJson: next }); session.change("specialLevelPercentsJson", next); }}
                        onSave={next => session.commit("specialLevelPercentsJson", next)}
                        saving={session.busy || save.isPending} fallback={{ premium: p.premium, totalCommissions: p.totalCommissions, currency: p.currency }} />
                    </DialogContent>
                    <DialogActions><Button startIcon={<CloseIcon />} color="error" variant="contained" onClick={() => setCommissionDetailsOpen(false)}>Κλείσιμο</Button></DialogActions>
                  </Dialog>
                </Stack>
              ))}

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
                    {(
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                        <TextField profileKey="nextRenewalDate" size="small" type="date" label={t("policyDetail.nextRenewal")} InputLabelProps={{ shrink: true }} value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                        <TextField profileKey="deliveredAt" size="small" type="date" label={t("policyDetail.deliveredAt")} InputLabelProps={{ shrink: true }} value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                        <TextField profileKey="deliveredTo" size="small" label={t("policyDetail.deliveredTo")} value={form.deliveredTo} onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                        <TextField profileKey="deliveryMethod" select size="small" label={t("policyDetail.deliveryMethod")} value={form.deliveryMethod} onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}><MenuItem value="">—</MenuItem>{DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{DELIVERY_METHOD_LABELS[m] ?? m}</MenuItem>)}</TextField>
                        <TextField profileKey="renewalInstructions" size="small" label={t("policyDetail.renewalInstructions")} value={form.renewalInstructions} onChange={e => setForm({ ...form, renewalInstructions: e.target.value })} sx={{ gridColumn: { sm: "1 / -1" } }} />
                        <PolicyBooleanField profileKey="retainCommissionsOnRenewal" label={t("policyDetail.retainCommissions")} />
                        <PolicyBooleanField profileKey="retainDocumentNumberOnRenewal" label={t("policyDetail.retainDocNumber")} />
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
                        <TextField profileKey="nextRenewalDate" size="small" type="date" label={t("policyDetail.nextRenewal")} InputLabelProps={{ shrink: true }}
                          disabled={!canEdit}
                          value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                        <TextField profileKey="deliveredAt" size="small" type="date" label={t("policyDetail.deliveredAt")} InputLabelProps={{ shrink: true }}
                          disabled={!canEdit}
                          value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                        <TextField profileKey="deliveredTo" size="small" label={t("policyDetail.deliveredTo")} value={form.deliveredTo}
                          disabled={!canEdit}
                          onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                        <TextField profileKey="deliveryMethod" select size="small" label={t("policyDetail.deliveryMethod")} value={form.deliveryMethod}
                          disabled={!canEdit}
                          onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}>
                          <MenuItem value="">—</MenuItem>
                          {DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{DELIVERY_METHOD_LABELS[m] ?? m}</MenuItem>)}
                        </TextField>
                      </Box>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                        <PolicyBooleanField profileKey="retainCommissionsOnRenewal" label={t("policyDetail.retainCommissions")} />
                        <PolicyBooleanField profileKey="retainDocumentNumberOnRenewal" label={t("policyDetail.retainDocNumber")} />
                      </Stack>
                      <TextField profileKey="renewalInstructions" size="small" fullWidth multiline minRows={2} label={t("policyDetail.renewalInstructions")}
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
                  <TextField profileKey="nextRenewalDate" type="date" fullWidth label={t("policyDetail.nextRenewal")} InputLabelProps={{ shrink: true }}
                    value={form.nextRenewalDate} onChange={e => setForm({ ...form, nextRenewalDate: e.target.value })} />
                  <PolicyBooleanField profileKey="retainCommissionsOnRenewal" label={t("policyDetail.retainCommissions")} />
                  <PolicyBooleanField profileKey="retainDocumentNumberOnRenewal" label={t("policyDetail.retainDocNumber")} />
                  <PolicyBooleanField profileKey="retainSpecialCommissionsOnRenewal" label={t("policyDetail.retainSpecialCommissions")} />
                  <TextField profileKey="renewalInstructions" fullWidth multiline rows={3} label={t("policyDetail.renewalInstructions")}
                    value={form.renewalInstructions} onChange={e => setForm({ ...form, renewalInstructions: e.target.value })}
                    placeholder={t("policyDetail.renewalInstructionsPlaceholder")} />
                </Stack>
              )}

              {/* DELIVERY */}
              {tab === 4 && (
                <Stack spacing={2.5}>
                  <TextField profileKey="deliveredAt" type="date" fullWidth label={t("policyDetail.deliveredAt")} InputLabelProps={{ shrink: true }}
                    value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} />
                  <TextField profileKey="deliveredTo" fullWidth label={t("policyDetail.deliveredTo")} value={form.deliveredTo}
                    onChange={e => setForm({ ...form, deliveredTo: e.target.value })} />
                  <TextField profileKey="deliveryMethod" select fullWidth label={t("policyDetail.deliveryMethod")} value={form.deliveryMethod}
                    onChange={e => setForm({ ...form, deliveryMethod: e.target.value })}>
                    <MenuItem value="">—</MenuItem>
                    {DELIVERY_METHODS.map(m => <MenuItem key={m} value={m}>{DELIVERY_METHOD_LABELS[m] ?? m}</MenuItem>)}
                  </TextField>
                  <TextField profileKey="paymentCollectionMethod" select fullWidth label="Τρόπος πληρωμής" value={form.paymentCollectionMethod}
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
              {tab === 8 && !modalPresentation && <PolicyContractPdf policyId={p.id} readOnly={readOnly} />}
              {showDocumentsHistory && (
                <Stack spacing={1.5}>
                  <Typography variant="overline" color="text.secondary" fontWeight={800}>Έγγραφο συμβολαίου</Typography>
                  <PolicyContractPdf policyId={p.id} readOnly={readOnly} />
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
                      readOnly={readOnly}
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

        <Box sx={{ px: 1.25, py: .6, borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "flex-end" }}>
          {!readOnly && p ? <ProfileEditorActions session={session} label="συμβολαίου" /> : <Button variant="contained" color="error" onClick={session.requestClose}>Κλείσιμο</Button>}
        </Box>
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
      {p && (
        <VehicleDetailDialog
          open={vehiclePreviewOpen}
          plate={form.vehicleRegistrationPlate || p.vehicleRegistrationPlate || ""}
          policyIds={[p.id]}
          onClose={() => setVehiclePreviewOpen(false)}
          zIndex={1700}
        />
      )}
      {p && !readOnly && (
        <VehicleAssociationDialog
          open={vehiclePickerOpen}
          currentPlate={form.vehicleRegistrationPlate || p.vehicleRegistrationPlate}
          options={storedVehicles}
          loading={storedVehiclesQuery.isLoading}
          error={storedVehiclesQuery.isError ? extractErrorMessage(storedVehiclesQuery.error) : null}
          search={vehicleSearch}
          onSearch={setVehicleSearch}
          pending={linkVehicle.isPending}
          onSelect={(vehicle) => linkVehicle.mutate(vehicle)}
          onClose={() => { if (!linkVehicle.isPending) { setVehiclePickerOpen(false); setVehicleSearch(""); } }}
        />
      )}
      {p && !readOnly && settlementMode && (
        <PolicySettlementDialog
          open
          mode={settlementMode}
          policy={p}
          onClose={() => setSettlementMode(null)}
          onSaved={() => {
            setSettlementMode(null);
            setSaved(true);
            void qc.invalidateQueries({ queryKey: ["policy-detail", policyId] });
            void qc.invalidateQueries({ queryKey: ["policy-receipts", policyId] });
            void qc.invalidateQueries({ queryKey: ["receipts"] });
            void qc.invalidateQueries({ queryKey: ["payments"] });
            void qc.invalidateQueries({ queryKey: ["financial-movements"] });
          }}
        />
      )}
    </Drawer></PolicyFieldsContext.Provider>
  );
}

function VehicleAssociationDialog({ open, currentPlate, options, loading, error, search, onSearch, pending, onSelect, onClose }: {
  open: boolean;
  currentPlate: string | null | undefined;
  options: StoredVehiclePolicy[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (value: string) => void;
  pending: boolean;
  onSelect: (vehicle: StoredVehiclePolicy) => void;
  onClose: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const statusOptions = useMemo(() => [...new Set(options.map(vehicle => vehicle.status).filter(Boolean))], [options]);
  const visibleOptions = useMemo(
    () => statusFilter === "all" ? options : options.filter(vehicle => vehicle.status === statusFilter),
    [options, statusFilter],
  );
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" sx={{ zIndex: 1750 }}>
      <DialogTitle>Σύνδεση αποθηκευμένου οχήματος</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25}>
          <Typography variant="body2" color="text.secondary">
            Επιλέξτε όχημα που υπάρχει ήδη σε άλλο συμβόλαιο του γραφείου. Η σύνδεση αντιγράφει και τα διαθέσιμα στοιχεία του οχήματος στο τρέχον συμβόλαιο.
          </Typography>
          <TextField
            size="small"
            fullWidth
            label="Αναζήτηση πινακίδας, πελάτη, συμβολαίου ή ασφαλιστικής"
            value={search}
            onChange={event => onSearch(event.target.value)}
            autoFocus
          />
          <TextField select size="small" label="Φίλτρο κατάστασης" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} SelectProps={{ native: true }}>
            <option value="all">Όλες οι καταστάσεις</option>
            {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
          </TextField>
          {currentPlate && <Chip size="small" variant="outlined" color="info" label={`Τρέχουσα πινακίδα: ${currentPlate}`} sx={{ alignSelf: "flex-start" }} />}
          {error && <Alert severity="error">{error}</Alert>}
          {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box> : visibleOptions.length === 0 ? (
            <Alert severity="info">Δεν βρέθηκαν αποθηκευμένα οχήματα με αυτά τα κριτήρια.</Alert>
          ) : (
            <Box sx={{ maxHeight: 430, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow>
                  <TableCell>Πινακίδα</TableCell>
                  <TableCell>Πελάτης</TableCell>
                  <TableCell>Συμβόλαιο</TableCell>
                  <TableCell>Ασφαλιστική</TableCell>
                  <TableCell>Περίοδος</TableCell>
                  <TableCell align="right">Ενέργεια</TableCell>
                </TableRow></TableHead>
                <TableBody>{visibleOptions.map(vehicle => (
                  <TableRow key={`${vehicle.id}-${vehicle.vehicleRegistrationPlate}`} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{vehicle.vehicleRegistrationPlate}</TableCell>
                    <TableCell>{vehicle.customerDisplay || "—"}</TableCell>
                    <TableCell>{vehicle.policyNumber || "—"}</TableCell>
                    <TableCell>{vehicle.insuranceCompanyName || "—"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{vehicle.startDate} → {vehicle.endDate}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="primary" onClick={() => onSelect(vehicle)} disabled={pending || vehicle.vehicleRegistrationPlate === currentPlate}>
                        {pending ? <CircularProgress size={16} color="inherit" /> : vehicle.vehicleRegistrationPlate === currentPlate ? "Συνδεδεμένο" : "Σύνδεση"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions><Button color="error" onClick={onClose} disabled={pending}>Κλείσιμο</Button></DialogActions>
    </Dialog>
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
        <Button variant="contained" disabled={!newProducerId || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
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

function nodeCopyText(value: React.ReactNode): string {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(nodeCopyText).filter(Boolean).join(" ");
  if (isValidElement(value)) {
    const props = value.props as { children?: React.ReactNode; label?: React.ReactNode };
    return nodeCopyText(props.label ?? props.children);
  }
  return "";
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const link = isValidElement<{ href?: string }>(value) ? value.props.href : undefined;
  return <ProfileEditableField label={label} value={nodeCopyText(value)} mono={mono} link={link} />;
}
function PolicySummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Box sx={{ p: .75, bgcolor: "#edf3f9", border: "1px solid #d6e3f0", borderRadius: 1.25 }}><Typography variant="subtitle2" fontWeight={800} sx={{ mb: .5 }}>{title}</Typography>{children}</Box>;
}
function PolicySummaryLine({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean; valueColor?: string }) {
  const link = isValidElement<{ href?: string }>(value) ? value.props.href : undefined;
  return <ProfileEditableField label={label} value={nodeCopyText(value)} mono={mono} link={link} />;
}
function settlementAmount(value: number | undefined, currency: string) {
  return `${(value ?? 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function PolicySettlementPanel({ policy, readOnly, onSettle }: {
  policy: PolicyDetail;
  readOnly: boolean;
  onSettle: (mode: PolicySettlementMode) => void;
}) {
  const rows = [
    {
      title: "Πελάτης προς γραφείο",
      due: policy.premium,
      paid: policy.totalReceived,
      outstanding: policy.outstanding,
      action: "receipt" as const,
      actionLabel: "Καταχώρηση είσπραξης",
      color: "success" as const,
    },
    {
      title: "Γραφείο προς ασφαλιστική",
      due: policy.carrierDue,
      paid: policy.carrierPaid,
      outstanding: policy.carrierOutstanding,
      action: "carrierPayment" as const,
      actionLabel: "Πληρωμή ασφαλιστικής",
      color: "warning" as const,
    },
    {
      title: "Γραφείο προς συνεργάτη",
      due: policy.producerDue,
      paid: policy.producerPaid,
      outstanding: policy.producerOutstanding,
      action: "producerPayment" as const,
      actionLabel: "Πληρωμή συνεργάτη",
      color: "info" as const,
    },
    {
      title: "Αναμενόμενη προμήθεια έδρας",
      due: policy.agencyCommissionExpected,
      paid: policy.agencyCommissionReceived,
      outstanding: policy.agencyCommissionOutstanding,
      action: null,
      actionLabel: "",
      color: "primary" as const,
    },
  ];
  return (
    <Box sx={{ p: 1.25, borderRadius: 1.25, border: "1px solid", borderColor: "rgba(11,92,173,.25)", bgcolor: "rgba(239,246,255,.72)" }}>
      <Typography variant="subtitle2" fontWeight={850} color="primary.dark" sx={{ mb: .9 }}>
        Οικονομική εικόνα ανά συμβόλαιο
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: .9 }}>
        {rows.map(row => (
          <Box key={row.title} sx={{ p: .9, borderRadius: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" fontWeight={800} display="block" color={`${row.color}.dark`}>{row.title}</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: .45 }}>
              <Typography variant="body2"><strong>Υποχρέωση:</strong> {settlementAmount(row.due, policy.currency)}</Typography>
              <Typography variant="body2" color="success.dark"><strong>Πληρωμένο:</strong> {settlementAmount(row.paid, policy.currency)}</Typography>
              <Typography variant="body2" color={row.outstanding > 0 ? "error.dark" : "success.dark"}><strong>Υπόλοιπο:</strong> {settlementAmount(row.outstanding, policy.currency)}</Typography>
            </Stack>
            {!readOnly && row.action && row.outstanding > 0 && (
              <Button size="small" variant="outlined" color={row.color} sx={{ mt: .75, fontWeight: 750 }} onClick={() => onSettle(row.action!)}>
                {row.actionLabel}
              </Button>
            )}
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: .9 }}>
        Οι «Πληρωμές» ενημερώνονται μόνο μετά από πραγματική καταχώρηση. Η δημιουργία συμβολαίου δημιουργεί υποχρέωση, όχι αυτόματη εξόφληση.
      </Typography>
    </Box>
  );
}

function PolicySettlementDialog({ open, mode, policy, onClose, onSaved }: {
  open: boolean;
  mode: PolicySettlementMode;
  policy: PolicyDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isReceipt = mode === "receipt";
  const isCarrierPayment = mode === "carrierPayment";
  const [number, setNumber] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState(isReceipt ? "Cash" : "BankTransfer");
  const [commissionsNetted, setCommissionsNetted] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    const base = isReceipt ? policy.outstanding : isCarrierPayment ? policy.carrierOutstanding : policy.producerOutstanding;
    setNumber(`${isReceipt ? "R" : "P"}-${Date.now().toString().slice(-8)}`);
    setDateValue(today);
    setAmount(Math.max(0, base ?? 0).toFixed(2));
    setMethod(isReceipt ? "Cash" : "BankTransfer");
    setCommissionsNetted("0");
    setNotes("");
    setError(null);
  }, [open, mode, policy.id]);

  const save = useMutation({
    mutationFn: async () => {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error("Το ποσό πρέπει να είναι μεγαλύτερο από μηδέν.");
      if (mode === "producerPayment" && !policy.producerId) {
        throw new Error("Δεν έχει οριστεί συνεργάτης στο συμβόλαιο.");
      }
      if (isReceipt) {
        return (await api.post("/receipts", {
          number: number.trim(), receivedOn: dateValue, customerId: policy.customerId,
          policyId: policy.id, method, amount: numericAmount, currency: policy.currency,
          notes: notes.trim() || null, transactionReference: null,
        })).data;
      }
      return (await api.post("/payments", {
        number: number.trim(), paidOn: dateValue,
        beneficiaryType: isCarrierPayment ? "InsuranceCompany" : "Producer",
        beneficiaryInsuranceCompanyId: isCarrierPayment ? policy.insuranceCompanyId : null,
        beneficiaryProducerId: isCarrierPayment ? null : policy.producerId,
        beneficiaryName: null, method, amount: numericAmount,
        commissionsNetted: Number(commissionsNetted) || 0, currency: policy.currency,
        notes: notes.trim() || null, transactionReference: null, policyId: policy.id,
      })).data;
    },
    onSuccess: onSaved,
    onError: error => setError(extractErrorMessage(error)),
  });

  const title = isReceipt ? "Καταχώρηση είσπραξης πελάτη" : isCarrierPayment ? "Καταχώρηση πληρωμής ασφαλιστικής" : "Καταχώρηση πληρωμής συνεργάτη";
  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm" sx={{ zIndex: 1900 }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={1.5} mt={.5}>
          <Alert severity="info" sx={{ py: .25 }}>
            Συμβόλαιο <strong>{policy.policyNumber}</strong> · {isReceipt ? policy.customerDisplay : isCarrierPayment ? policy.insuranceCompanyName : (policy.producerName ?? "Δεν έχει οριστεί συνεργάτης")}
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField label="Αριθμός εγγραφής" value={number} onChange={e => setNumber(e.target.value)} fullWidth required />
            <TextField type="date" label="Ημερομηνία" value={dateValue} onChange={e => setDateValue(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth required />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField type="number" label="Ποσό" value={amount} onChange={e => setAmount(e.target.value)} fullWidth required inputProps={{ min: 0, step: "0.01" }} />
            <TextField select label="Μέθοδος" value={method} onChange={e => setMethod(e.target.value)} fullWidth>
              {(["Cash", "BankTransfer", "Card", "Cheque", "PromissoryNote", "Other"] as const).map(value => (
                <MenuItem key={value} value={value}>{({ Cash: "Μετρητά", BankTransfer: "Τραπεζική μεταφορά", Card: "Κάρτα", Cheque: "Επιταγή", PromissoryNote: "Γραμμάτιο", Other: "Άλλο" } as Record<string, string>)[value]}</MenuItem>
              ))}
            </TextField>
          </Stack>
          {!isReceipt && <TextField type="number" label="Συμψηφισμός προμηθειών" value={commissionsNetted} onChange={e => setCommissionsNetted(e.target.value)} inputProps={{ min: 0, step: "0.01" }} helperText="Προαιρετικά· δεν μειώνει την υποχρέωση που εμφανίζεται στο συμβόλαιο." fullWidth />}
          <TextField label="Σημειώσεις" value={notes} onChange={e => setNotes(e.target.value)} multiline minRows={2} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" variant="contained" onClick={onClose} disabled={save.isPending}>Ακύρωση</Button>
        <Button variant="contained" color="success" onClick={() => save.mutate(undefined)} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
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

interface GreenCard {
  id: string;
  policyId: string;
  policyNumber: string;
  customerId: string;
  customerName: string;
  cardNumber: string;
  status: string;
  validFrom: string;
  validTo: string;
  holderName: string;
  insuredName: string;
  vehicleRegistrationPlate: string;
  vehicleMakeModel: string | null;
  vehicleVin: string | null;
  territories: string | null;
  issuingOffice: string | null;
  deliveryMethod: string | null;
  notes: string | null;
  issuedAt: string | null;
  deliveredAt: string | null;
  policyDocumentId: string | null;
}

interface GreenCardFormState {
  cardNumber: string; status: string; validFrom: string; validTo: string;
  holderName: string; insuredName: string; vehicleRegistrationPlate: string;
  vehicleMakeModel: string; vehicleVin: string; territories: string;
  issuingOffice: string; deliveryMethod: string; notes: string;
}

const GREEN_CARD_EMPTY: GreenCardFormState = {
  cardNumber: "", status: "Draft", validFrom: "", validTo: "", holderName: "", insuredName: "",
  vehicleRegistrationPlate: "", vehicleMakeModel: "", vehicleVin: "", territories: "",
  issuingOffice: "", deliveryMethod: "", notes: ""
};

const GREEN_CARD_STATUS_LABELS: Record<string, string> = {
  Draft: "Πρόχειρη", Issued: "Εκδόθηκε", Delivered: "Παραδόθηκε", Expired: "Έληξε", Cancelled: "Ακυρώθηκε"
};

function PolicyContractPdf({ policyId, readOnly = false }: { policyId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [greenCardDialog, setGreenCardDialog] = useState(false);
  const [greenCardEditingId, setGreenCardEditingId] = useState<string | null>(null);
  const [greenCardForm, setGreenCardForm] = useState<GreenCardFormState>(GREEN_CARD_EMPTY);
  const [greenCardError, setGreenCardError] = useState<string | null>(null);

  // Cleanup blob URLs when the component unmounts.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const docsQ = useQuery({
    queryKey: ["policy-documents", policyId],
    queryFn: async () => (await api.get<PolicyDoc[]>("/documents", { params: { policyId } })).data
  });

  const policyQ = useQuery({
    queryKey: ["policy-detail", policyId],
    queryFn: async () => (await api.get<PolicyDetail>(`/policies/${policyId}/detail`)).data,
    staleTime: 60_000
  });

  const greenCardsQ = useQuery({
    queryKey: ["policy-green-cards", policyId],
    queryFn: async () => (await api.get<GreenCard[]>(`/policies/${policyId}/green-cards`)).data
  });

  const openGreenCard = (card?: GreenCard) => {
    const p = policyQ.data;
    if (card) {
      setGreenCardEditingId(card.id);
      setGreenCardForm({
        cardNumber: card.cardNumber, status: card.status,
        validFrom: card.validFrom?.slice(0, 10) ?? "", validTo: card.validTo?.slice(0, 10) ?? "",
        holderName: card.holderName ?? "", insuredName: card.insuredName ?? "",
        vehicleRegistrationPlate: card.vehicleRegistrationPlate ?? "",
        vehicleMakeModel: card.vehicleMakeModel ?? "", vehicleVin: card.vehicleVin ?? "",
        territories: card.territories ?? "", issuingOffice: card.issuingOffice ?? "",
        deliveryMethod: card.deliveryMethod ?? "", notes: card.notes ?? ""
      });
    } else {
      const customerName = p?.customerDisplay ?? "";
      setGreenCardEditingId(null);
      setGreenCardForm({
        ...GREEN_CARD_EMPTY, validFrom: p?.startDate?.slice(0, 10) ?? "",
        validTo: p?.endDate?.slice(0, 10) ?? "", holderName: customerName,
        insuredName: customerName, vehicleRegistrationPlate: p?.vehicleRegistrationPlate ?? ""
      });
    }
    setGreenCardError(null);
    setGreenCardDialog(true);
  };

  const issue = useMutation({
    mutationFn: async (id: string) => (await api.post<GreenCard>(`/policies/${policyId}/green-cards/${id}/issue`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-green-cards", policyId] });
      void qc.invalidateQueries({ queryKey: ["policy-documents", policyId] });
      setGreenCardDialog(false);
    },
    onError: e => setGreenCardError(extractErrorMessage(e))
  });

  const saveGreenCard = useMutation({
    mutationFn: async ({ body, issueAfterSave }: { body: GreenCardFormState; issueAfterSave: boolean }) => {
      const payload = {
        ...body,
        cardNumber: body.cardNumber.trim() || null,
        holderName: body.holderName.trim() || null,
        insuredName: body.insuredName.trim() || null,
        vehicleRegistrationPlate: body.vehicleRegistrationPlate.trim() || null,
        vehicleMakeModel: body.vehicleMakeModel.trim() || null,
        vehicleVin: body.vehicleVin.trim() || null,
        territories: body.territories.trim() || null,
        issuingOffice: body.issuingOffice.trim() || null,
        deliveryMethod: body.deliveryMethod.trim() || null,
        notes: body.notes.trim() || null
      };
      const card = greenCardEditingId
        ? (await api.put<GreenCard>(`/policies/${policyId}/green-cards/${greenCardEditingId}`, payload)).data
        : (await api.post<GreenCard>(`/policies/${policyId}/green-cards`, payload)).data;
      return issueAfterSave ? issue.mutateAsync(card.id) : card;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-green-cards", policyId] });
      void qc.invalidateQueries({ queryKey: ["policy-documents", policyId] });
      setGreenCardDialog(false);
    },
    onError: e => setGreenCardError(extractErrorMessage(e))
  });

  const deliver = useMutation({
    mutationFn: async (card: GreenCard) => (await api.post<GreenCard>(`/policies/${policyId}/green-cards/${card.id}/deliver`, { deliveryMethod: card.deliveryMethod || "Email" })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-green-cards", policyId] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const cancelGreenCard = useMutation({
    mutationFn: async (id: string) => api.delete(`/policies/${policyId}/green-cards/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policy-green-cards", policyId] }),
    onError: e => setErr(extractErrorMessage(e))
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
  const greenCards = greenCardsQ.data ?? [];

  return (
    <Stack spacing={2}>
      {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}

      <Box sx={{ p: 1.5, border: "1px solid", borderColor: "success.light", borderRadius: 2, bgcolor: "success.50" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
          <Box>
            <Typography fontWeight={800} sx={{ fontSize: 14 }}>Πράσινες κάρτες</Typography>
            <Typography variant="caption" color="text.secondary">Δημιουργήστε χειροκίνητα, εκδώστε PDF και καταγράψτε την παράδοση.</Typography>
          </Box>
          {!readOnly && <Button size="small" variant="contained" color="success" onClick={() => openGreenCard()}>Νέα πράσινη κάρτα</Button>}
        </Stack>
        {greenCardsQ.isLoading ? <CircularProgress size={20} sx={{ mt: 1 }} /> : greenCards.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Δεν έχει καταχωρηθεί πράσινη κάρτα για το συμβόλαιο.</Typography>
        ) : <Stack spacing={1} sx={{ mt: 1 }}>
          {greenCards.map(card => <Box key={card.id} sx={{ p: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} sx={{ fontSize: 13 }}>{card.cardNumber} <Chip size="small" label={GREEN_CARD_STATUS_LABELS[card.status] ?? card.status} color={card.status === "Delivered" ? "success" : card.status === "Cancelled" ? "error" : "info"} sx={{ ml: .5, height: 22 }} /></Typography>
                <Typography variant="caption" color="text.secondary">{card.validFrom} → {card.validTo} · {card.vehicleRegistrationPlate || "Χωρίς πινακίδα"} · {card.territories || "Χώρες δεν ορίστηκαν"}</Typography>
              </Box>
              <Stack direction="row" spacing={.5} flexWrap="wrap">
                <Button size="small" onClick={() => openGreenCard(card)}>Προβολή / επεξεργασία</Button>
                {!readOnly && card.status !== "Issued" && card.status !== "Delivered" && card.status !== "Cancelled" && <Button size="small" color="success" onClick={() => issue.mutate(card.id)} disabled={issue.isPending}>Έκδοση PDF</Button>}
                {!readOnly && card.status === "Issued" && <Button size="small" color="success" onClick={() => deliver.mutate(card)} disabled={deliver.isPending}>Παραδόθηκε</Button>}
                {!readOnly && card.status !== "Cancelled" && <Button size="small" color="error" onClick={() => { if (confirm("Ακύρωση της πράσινης κάρτας;")) cancelGreenCard.mutate(card.id); }}>Ακύρωση</Button>}
              </Stack>
            </Stack>
          </Box>)}
        </Stack>}
      </Box>

      <Dialog open={greenCardDialog} onClose={() => saveGreenCard.isPending ? undefined : setGreenCardDialog(false)} fullWidth maxWidth="md">
        <DialogTitle>{greenCardEditingId ? "Επεξεργασία πράσινης κάρτας" : "Νέα πράσινη κάρτα"}</DialogTitle>
        <DialogContent dividers>
          {greenCardError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setGreenCardError(null)}>{greenCardError}</Alert>}
          <Stack spacing={1.25} sx={{ pt: .5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <TextField size="small" label="Αριθμός κάρτας" value={greenCardForm.cardNumber} onChange={e => setGreenCardForm({ ...greenCardForm, cardNumber: e.target.value })} fullWidth />
              <TextField select size="small" label="Κατάσταση" value={greenCardForm.status} onChange={e => setGreenCardForm({ ...greenCardForm, status: e.target.value })} sx={{ minWidth: 170 }}>
                {Object.entries(GREEN_CARD_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <TextField size="small" type="date" label="Έναρξη ισχύος" value={greenCardForm.validFrom} onChange={e => setGreenCardForm({ ...greenCardForm, validFrom: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth required />
              <TextField size="small" type="date" label="Λήξη ισχύος" value={greenCardForm.validTo} onChange={e => setGreenCardForm({ ...greenCardForm, validTo: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth required />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <TextField size="small" label="Κάτοχος" value={greenCardForm.holderName} onChange={e => setGreenCardForm({ ...greenCardForm, holderName: e.target.value })} fullWidth required />
              <TextField size="small" label="Ασφαλισμένος" value={greenCardForm.insuredName} onChange={e => setGreenCardForm({ ...greenCardForm, insuredName: e.target.value })} fullWidth required />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <TextField size="small" label="Αριθμός κυκλοφορίας" value={greenCardForm.vehicleRegistrationPlate} onChange={e => setGreenCardForm({ ...greenCardForm, vehicleRegistrationPlate: e.target.value })} fullWidth />
              <TextField size="small" label="Μάρκα / μοντέλο" value={greenCardForm.vehicleMakeModel} onChange={e => setGreenCardForm({ ...greenCardForm, vehicleMakeModel: e.target.value })} fullWidth />
              <TextField size="small" label="VIN" value={greenCardForm.vehicleVin} onChange={e => setGreenCardForm({ ...greenCardForm, vehicleVin: e.target.value })} fullWidth />
            </Stack>
            <TextField size="small" label="Χώρες ισχύος" placeholder="π.χ. GR, AL, BG, IT" value={greenCardForm.territories} onChange={e => setGreenCardForm({ ...greenCardForm, territories: e.target.value })} fullWidth helperText="Χωρίστε τις χώρες με κόμμα." />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <TextField size="small" label="Γραφείο έκδοσης" value={greenCardForm.issuingOffice} onChange={e => setGreenCardForm({ ...greenCardForm, issuingOffice: e.target.value })} fullWidth />
              <TextField size="small" label="Τρόπος παράδοσης" placeholder="Email, έντυπη παράδοση..." value={greenCardForm.deliveryMethod} onChange={e => setGreenCardForm({ ...greenCardForm, deliveryMethod: e.target.value })} fullWidth />
            </Stack>
            <TextField size="small" label="Παρατηρήσεις" value={greenCardForm.notes} onChange={e => setGreenCardForm({ ...greenCardForm, notes: e.target.value })} multiline minRows={2} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="contained" onClick={() => setGreenCardDialog(false)} disabled={saveGreenCard.isPending || issue.isPending}>Ακύρωση</Button>
          {!readOnly && <>
            <Button variant="outlined" onClick={() => saveGreenCard.mutate({ body: greenCardForm, issueAfterSave: false })} disabled={saveGreenCard.isPending || issue.isPending || !greenCardForm.validFrom || !greenCardForm.validTo}>Αποθήκευση</Button>
            <Button variant="contained" color="success" onClick={() => saveGreenCard.mutate({ body: greenCardForm, issueAfterSave: true })} disabled={saveGreenCard.isPending || issue.isPending || !greenCardForm.validFrom || !greenCardForm.validTo}>{saveGreenCard.isPending || issue.isPending ? <CircularProgress size={18} /> : "Αποθήκευση & έκδοση PDF"}</Button>
          </>}
        </DialogActions>
      </Dialog>

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
                <TableCell sx={{ color: o.objectKind?.trim() ? "success.dark" : "error.dark", fontWeight: 650 }}>{o.objectKind || "Δεν έχει καταχωρηθεί"}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", color: o.identifier?.trim() ? "success.dark" : "error.dark" }}>{o.identifier || "Δεν έχει καταχωρηθεί"}</TableCell>
                <TableCell sx={{ color: o.description?.trim() ? "success.dark" : "error.dark" }}>{o.description || "Δεν έχει καταχωρηθεί"}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 11, color: o.fbcLinkCode?.trim() ? "success.dark" : "error.dark" }}>{o.fbcLinkCode || "Δεν έχει καταχωρηθεί"}</TableCell>
                <TableCell>
                  {!readOnly && <IconButton size="small" color="error" onClick={() => { if (confirm("Διαγραφή;")) del.mutate(o.id); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!readOnly && <Box sx={{ p: 1.25, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
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
      </Box>}
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
        {!readOnly && <Button size="small" variant="text" onClick={() => setBulkOpen(true)}>
          Μαζική εισαγωγή CSV
        </Button>}
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
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "error.dark", fontWeight: 650, py: 2 }}>
                  Δεν υπάρχουν καταχωρημένες καλύψεις.
                </TableCell></TableRow>
              )}
              {rows.map((c) => (
                <TableRow key={c.id} hover selected={editingId === c.id}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: c.coverCode?.trim() ? "success.dark" : "error.dark" }}>{c.coverCode || "Δεν έχει καταχωρηθεί"}</TableCell>
                  <TableCell sx={{ color: c.coverName?.trim() ? "success.dark" : "error.dark" }}>{c.coverName || "Δεν έχει καταχωρηθεί"}</TableCell>
                  <TableCell align="right" sx={{ color: c.grossPremium > 0 ? "success.dark" : "error.dark" }}>{c.grossPremium.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: c.netPremium > 0 ? "success.dark" : "error.dark" }}>{c.netPremium.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: c.coverageAmount === null ? "error.dark" : "success.dark" }}>{c.coverageAmount === null ? "Δεν έχει καταχωρηθεί" : c.coverageAmount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: c.commissionPercent === null ? "error.dark" : "success.dark" }}>
                    {c.commissionPercent === null ? "—" : `${c.commissionPercent.toFixed(2)}%`}
                  </TableCell>
                  <TableCell align="right" sx={{ color: c.agencyCommissionPercent === null ? "error.dark" : "success.dark" }}>
                    {c.agencyCommissionPercent === null ? "—" : `${c.agencyCommissionPercent.toFixed(2)}%`}
                  </TableCell>
                  <TableCell align="right">
                    {!readOnly && <>
                      <IconButton size="small" onClick={() => startEdit(c)} disabled={editing && editingId !== c.id}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => { if (confirm(`Διαγραφή της κάλυψης ${c.coverCode};`)) del.mutate(c.id); }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </>}
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
      {!readOnly && <Box sx={{ p: 1.25, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
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
      </Box>}
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
              <Button variant="contained" onClick={() => save.mutate(undefined)}
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
  onSave: (nextJson: string) => Promise<void>;
  saving: boolean;
  // Only consulted when the calculated matrix is empty — used to surface
  // the bridge-imported agency-commission total.
  fallback?: BridgeFallbackCommissions;
}) {
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>;
  }
  if (!matrix || matrix.rows.length === 0) {
    // Fallback view — the office hasn't set up its commission rules yet.
    // Keep the display focused on the final amount, without exposing the
    // technical source of the imported value to the office user.
    const bridgeTotal = fallback?.totalCommissions ?? 0;
    return (
      <Stack spacing={2}>
        {bridgeTotal !== 0 && (
          <Box sx={{
            p: 2, border: 1, borderColor: "success.light", borderRadius: 1,
            bgcolor: "success.lighter"
          }}>
            <Typography variant="overline" color="success.dark" fontWeight={700}>
              Προμήθεια Γραφείου
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
              {bridgeTotal.toFixed(2)} {fallback?.currency ?? currency}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Το ποσό είναι το σύνολο που δικαιούται το γραφείο. Δεν έχει διαχωριστεί
              σε παραγωγό / διευθυντή / μονάδα / βοηθό, επειδή δεν έχει οριστεί κατανομή.
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
  onSave: (nextJson: string) => Promise<void>;
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

  const commit = async () => {
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(draft)) {
      const n = Number(v);
      if (v.trim() !== "" && Number.isFinite(n) && n > 0) map[k] = n;
    }
    const next = Object.keys(map).length > 0 ? JSON.stringify(map) : "";
    onChange(next);
    try { await onSave(next); setEditing(false); } catch { /* Keep the failed draft editable. */ }
  };
  const clearOverride = async () => {
    onChange("");
    try { await onSave(""); setEditing(false); } catch { /* Keep the failed draft editable. */ }
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

/** Compact premiums and calculated commissions; unavailable totals are never fabricated. */
export function PolicyPremiumFields({ policy, matrix, matrixLoading, session }: {
  policy: Pick<PolicyDetail, "premium" | "netPremium" | "currency" | "producerName">;
  matrix?: PolicyCommissionMatrix;
  matrixLoading: boolean;
  session?: ProfileFieldSession;
}) {
  const hasMatrix = Boolean(matrix?.rows.length);
  const total = (agency: boolean) => matrix?.rows.filter(row => (row.hierarchyLevel === "Agency") === agency).reduce((sum, row) => sum + row.grossAmount, 0) ?? 0;
  const pending = matrixLoading ? "Υπολογισμός…" : "Δεν έχει υπολογιστεί";
  return <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
    <ProfileEditableField label="Μικτά" field={session ? "premium" : undefined} session={session} value={session?.values.premium ?? String(policy.premium)} type="number" />
    <ProfileEditableField label="Καθαρά" field={session ? "netPremium" : undefined} session={session} value={session?.values.netPremium ?? (policy.netPremium == null ? "" : String(policy.netPremium))} type="number" />
    <ProfileEditableField label="Προμήθεια γραφείου" value={hasMatrix ? settlementAmount(total(true), policy.currency) : pending} mono />
    <ProfileEditableField label="Προμήθεια συνεργάτη" value={hasMatrix ? settlementAmount(total(false), policy.currency) : pending} mono />
  </Box>;
}

const PolicyFieldsContext = createContext<{ session: ProfileFieldSession; readOnly: boolean } | null>(null);
function TextField(props: React.ComponentProps<typeof MuiTextField> & { profileKey?: string }) {
  const context = useContext(PolicyFieldsContext);
  const { profileKey, ...original } = props;
  if (!context || !profileKey) return <MuiTextField {...original} />;
  const options = props.select ? Children.toArray(props.children).flatMap(child => isValidElement<{ value?: unknown; children?: React.ReactNode }>(child) ? [{value: String(child.props.value ?? ""), label: nodeCopyText(child.props.children)}] : []) : undefined;
  return <ProfileEditableField label={nodeCopyText(props.label)} field={context.readOnly ? undefined : profileKey} session={context.readOnly ? undefined : context.session}
    value={context.session.values[profileKey]} options={options} multiline={props.multiline} type={["date","number","email"].includes(String(props.type)) ? props.type as "date"|"number"|"email" : "text"} />;
}
function SearchableSelect(props: React.ComponentProps<typeof OriginalSearchableSelect<string>> & { profileKey?: string }) {
  const context = useContext(PolicyFieldsContext);
  const { profileKey, ...original } = props;
  if (!context || !profileKey) return <OriginalSearchableSelect {...original} />;
  return <ProfileEditableField label={props.label} field={context.readOnly ? undefined : profileKey} session={context.readOnly ? undefined : context.session} value={context.session.values[profileKey]}
    options={[{value:"", label: props.emptyLabel ?? "Δεν έχει οριστεί"}, ...props.options]} />;
}
function PolicyBooleanField({profileKey, label}: {profileKey: string; label: string}) {
  const context = useContext(PolicyFieldsContext);
  return <ProfileEditableField label={label} field={context && !context.readOnly ? profileKey : undefined} session={context && !context.readOnly ? context.session : undefined}
    value={context?.session.values[profileKey]} options={[{value:"true",label:"Ναι"}, {value:"false",label:"Όχι"}]} />;
}

export function PolicyProfileFields({session, values, policy, companies, customers}: {
  session?: ProfileFieldSession; values: Record<string,string>; policy: PolicyDetail;
  companies: {id:string; name:string}[]; customers: {id:string; firstName?:string|null; lastName?:string|null; companyName?:string|null}[];
}) {
  const field = (key:string,label:string,extra: Partial<React.ComponentProps<typeof ProfileEditableField>> = {}) =>
    <ProfileEditableField key={key} label={label} field={session ? key : undefined} session={session} value={values[key]} {...extra} />;
  const carrierOptions = companies.map(row => ({value:row.id,label:row.name}));
  if (!carrierOptions.some(option => option.value === policy.insuranceCompanyId)) carrierOptions.push({value:policy.insuranceCompanyId,label:policy.insuranceCompanyName});
  const types = ["Auto","Home","Health","Life","Business","Travel","Other"].map(value => ({value,label:policyTypeLabel(value)}));
  if (values.policyType && !types.some(option => option.value === values.policyType)) types.push({value:values.policyType,label:values.policyType});
  const statuses = Object.keys(POLICY_STATUS_LABELS).map(value => ({value,label:policyStatusLabel(value)}));
  return <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
    <ProfileEditableField label="Αριθμός συμβολαίου" value={policy.policyNumber} mono />
    {field("applicationNumber","Αριθμός αίτησης")}
    {field("insuranceCompanyId","Ασφαλιστική", {options:carrierOptions})}
    {field("policyType","Κλάδος",{options:types})}
    {field("status","Κατάσταση",{options:statuses})}
    {field("previousInsuranceCompanyId","Προηγούμενη ασφαλιστική",{options:[{value:"",label:"Δεν έχει οριστεί"}, ...carrierOptions]})}
    <ProfileEditableField label="Πελάτης / ασφαλισμένος" value={policy.customerDisplay} />
    <ProfileEditableField label="ΑΦΜ πελάτη" value={policy.customerVat} mono />
    {field("contractPartyCustomerId","Συμβαλλόμενος",{options:[{value:"",label:"Ίδιος με τον ασφαλιζόμενο"}, ...customers.map(row=>({value:row.id,label:row.companyName || [row.firstName,row.lastName].filter(Boolean).join(" ")}))]})}
    <ProfileEditableField label="Συνεργάτης" value={policy.producerName} />
    {field("issuedAt","Ημερομηνία έκδοσης",{type:"date"})}
    {field("startDate","Έναρξη",{type:"date"})}
    {field("endDate","Λήξη",{type:"date"})}
    <ProfileEditableField label="Διάρκεια" value={contractDurationLabel(policy.startDate,policy.endDate)} />
    {field("vehicleRegistrationPlate","Πινακίδα",{mono:true})}
    {field("driverVatNumber","ΑΦΜ οδηγού",{mono:true})}
    {field("reasonForCirculation","Λόγος κυκλοφορίας")}
    {field("premium","Μεικτό ασφάλιστρο",{type:"number"})}
    {field("netPremium","Καθαρό ασφάλιστρο",{type:"number"})}
    {field("currency","Νόμισμα")}
  </Box>;
}
