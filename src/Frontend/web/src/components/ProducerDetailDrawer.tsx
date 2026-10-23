import { DetailProfileTabs } from "./profile/DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, profileFieldGridSx, useProfileFieldEditor, type ProfileFieldSession } from "./profile/ProfileFieldEditor";
import { PRODUCER_FIELDS, producerGeneralColumns, producerUpdatePayload } from "./profile/producerProfile";
import { useEffect, useState } from "react";
import {
  Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography, useMediaQuery, useTheme
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import BarChartIcon from "@mui/icons-material/BarChart";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DescriptionIcon from "@mui/icons-material/Description";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { ProducerBalancesPanel } from "./ProducerBalancesPanel";
import { ProducerStatisticsDialog } from "./ProducerStatisticsDialog";
import { ProducerContactFields, producerContactError, type ProducerContactField } from "./ProducerContactFields";
import { useProducerCategories, type ProducerCategoryOption } from "./useProducerCategories";

interface ProducerDetail {
  id: string; code: string; name: string; email: string | null; phone: string | null; notes: string | null; status: string;
  secondaryEmail?: string | null; secondaryPhone?: string | null;
  taxId?: string | null; taxOffice?: string | null; businessType?: string | null; professionalCategory?: string | null;
  hasContract?: boolean; contractNumber?: string | null; contractStartDate?: string | null; contractEndDate?: string | null;
  address?: string | null; city?: string | null; postalCode?: string | null; website?: string | null; identityNumber?: string | null;
  professionalLicenseNumber?: string | null; licenseExpiryDate?: string | null; iban?: string | null; bankName?: string | null;
  paymentMethod?: string | null; additionalInfoJson?: string | null;
  tier?: string; hierarchyLevel?: string; parentProducerId?: string | null; parentProducerName?: string | null;
  categoryId?: string | null; categoryName?: string | null;
  totalPolicies: number; activePolicies: number; renewedPolicies: number; cancelledPolicies: number;
  newPoliciesThisYear: number; renewalsDueNext60Days: number;
  totalPremiumYtd: number; totalPremiumLastYear: number; premiumGrowthPercent: number;
  totalCommissionsEarned: number; commissionsThisYear: number;
  claimCount: number; claimRatio: number;
  renewalRate: number; customerCount: number;
  byCarrier: { carrierName: string; policyCount: number; totalPremium: number; }[];
  byPolicyType: { policyType: string; policyCount: number; totalPremium: number; }[];
  performanceGrade: string;
}

const GRADE_COLOR: Record<string, string> = {
  A: "#1b873f", B: "#3aa56b", C: "#c98a1d", D: "#d65f2d", F: "#c43838"
};
const GRADE_LABEL: Record<string, string> = {
  A: "Άριστος", B: "Πολύ καλός", C: "Μέτριος", D: "Φτωχός", F: "Προβληματικός"
};

export function ProducerDetailDrawer({ producerId, open, onClose, onEdit, canEdit: explicitCanEdit, initialEditing = false }: {
  producerId: string | null; open: boolean; onClose: () => void; onEdit?: () => void; canEdit?: boolean; initialEditing?: boolean;
}) {
  const { t } = useTranslation();
  const canEdit = explicitCanEdit ?? !!onEdit;
  const q = useQuery({
    queryKey: ["producer-detail", producerId],
    enabled: open && !!producerId,
    queryFn: async () => (await api.get<ProducerDetail>(`/producers/${producerId}/detail`)).data
  });
  const contactFields = useQuery({
    queryKey: ["producer-contact-fields", producerId],
    enabled: open && !!producerId,
    queryFn: async () => (await api.get<ProducerContactField[]>(`/producers/${producerId}/contact-fields`)).data
  });

  const p = q.data;
  const categories = useProducerCategories(open);
  const [tab, setTab] = useState(0);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  useEffect(() => { if (open) { setTab(0); setStatisticsOpen(false); } }, [open, producerId]);

  const qc = useQueryClient();
  const producerOptions = useQuery({ queryKey: ["producers"], enabled: open && canEdit,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data });
  const session = useProfileFieldEditor({
    initialEditing: initialEditing && canEdit,
    sessionKey: open ? producerId ?? "" : "", values: {
      ...Object.fromEntries(PRODUCER_FIELDS.map(([key]) => [key, String(p?.[key] ?? "")])),
      ...Object.fromEntries((contactFields.data ?? []).map(row => ["contact:" + row.id, row.value])),
    }, onClose,
    refresh: () => { void qc.invalidateQueries({ queryKey: ["producer-detail", producerId] }); void qc.invalidateQueries({ queryKey: ["producers"] }); void qc.invalidateQueries({ queryKey: ["producer-contact-fields", producerId] }); void qc.invalidateQueries({ queryKey: ["producer-statistics", producerId] }); },
    write: async (changes, accept) => {
      if (!canEdit || !p) throw new Error("Δεν επιτρέπεται η επεξεργασία συνεργάτη.");
      if (!Object.keys(changes).length) return;
      const core = Object.fromEntries(Object.entries(changes).filter(([key]) => !key.startsWith("contact:")));
      if (Object.keys(core).length) {
        const current = qc.getQueryData<ProducerDetail>(["producer-detail", producerId]) ?? p;
        const saved = (await api.put("/producers/" + producerId, producerUpdatePayload({ ...current }, core))).data;
        qc.setQueryData(["producer-detail", producerId], { ...current, ...saved }); accept(Object.keys(core));
      }
      for (const [key, value] of Object.entries(changes).filter(([key]) => key.startsWith("contact:"))) {
        const row = (contactFields.data ?? []).find(field => field.id === key.slice(8));
        if (!row) throw new Error("Το πεδίο επικοινωνίας δεν βρέθηκε. Φορτώστε ξανά την καρτέλα.");
        const error = producerContactError(row.kind, value);
        if (error) throw new Error(error);
        const saved = (await api.put<ProducerContactField>(`/producers/${producerId}/contact-fields/${row.id}`, { value })).data;
        qc.setQueryData<ProducerContactField[]>(["producer-contact-fields", producerId], previous => (previous ?? []).map(field => field.id === row.id ? saved : field));
        accept([key]);
      }
    }
  });
  const statusLabel = p?.status === "Active" ? "Ενεργός" : p?.status === "Prospect" ? "Πιθανός συνεργάτης" : p?.status === "Suspended" ? "Σε αναστολή" : p?.status === "Terminated" ? "Τερματισμένος" : p?.status ?? "—";
  return (
    <Dialog open={open} onClose={session.requestClose} fullWidth maxWidth="xl" PaperProps={{ sx: profileDialogPaperSx }}>
      <DialogTitle sx={{ px: 1.5, py: 1.15, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Stack direction="row" alignItems="center" spacing={1.25} minWidth={0}>
            <Box sx={{ width: 48, height: 48, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: GRADE_COLOR[p?.performanceGrade ?? ""] ?? "#78909c", color: "#fff", flexShrink: 0 }}><Typography fontWeight={900} sx={{ fontSize: 24 }}>{p?.performanceGrade ?? "—"}</Typography></Box>
            <Box minWidth={0}><Typography variant="caption" color="text.secondary" fontWeight={800}>{t("producerDetail.header")}</Typography><Typography variant="h6" fontWeight={900} noWrap>{p?.name ?? "Συνεργάτης"}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{p?.code ?? ""}</Typography></Box>
            {p && <Chip size="small" color={p.status === "Active" ? "success" : p.status === "Prospect" ? "warning" : "default"} label={statusLabel} />}
          </Stack>
          <Stack direction="row" spacing={.75} alignItems="center" justifyContent="flex-end">

            <IconButton size="small" onClick={session.requestClose} aria-label="Κλείσιμο"><CloseIcon /></IconButton>
          </Stack>
        </Stack>
        {p && <Stack direction="row" spacing={.75} mt={.9} flexWrap="wrap" useFlexGap>
          {p.email && <Chip size="small" icon={<EmailIcon fontSize="small" />} component="a" href={`mailto:${p.email}`} clickable label={p.email} />}
          {p.phone && <Chip size="small" icon={<PhoneIcon fontSize="small" />} component="a" href={`tel:${p.phone}`} clickable label={p.phone} />}
          <Chip size="small" variant="outlined" label={`${t("producerDetail.gradeLabel")}: ${GRADE_LABEL[p.performanceGrade] ?? p.performanceGrade}`} />
        </Stack>}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 1.25, overflowY: "auto", "&::-webkit-scrollbar": { width: 12 }, "&::-webkit-scrollbar-thumb": { background: "#0b2545", borderRadius: 999, border: "3px solid #eef3f8" } }}>
        {q.isLoading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
        {q.isError && <Typography color="error">Δεν ήταν δυνατή η φόρτωση της καρτέλας συνεργάτη.</Typography>}
        {p && <>
          <DetailProfileTabs value={tab} onChange={setTab} items={[
            {label: "Γενικά", icon: <InfoOutlinedIcon />}, {label: "Παραγωγή", icon: <DescriptionIcon />},
            {label: "Οικονομικά", icon: <AccountBalanceWalletIcon />}, {label: "Επικοινωνία", icon: <ContactPhoneIcon />},
          ]} />
          <ProfileEditorFeedback session={session} />

          <Stack spacing={1.25}>
            {tab === 0 && <>
              {categories.isError && <Typography color="error">Δεν ήταν δυνατή η φόρτωση κατηγοριών συνεργατών.</Typography>}
              {canEdit && <Button component="a" href="/app/config-hub" target="_blank" rel="noopener noreferrer" size="small" sx={{ alignSelf: "flex-start", textTransform: "none" }}>Διαχείριση κατηγοριών συνεργατών</Button>}
              <ProducerProfileFields session={canEdit ? session : undefined} values={session.values} parents={(producerOptions.data ?? []).filter(row => row.id !== producerId)} categories={categories.data ?? []} currentCategoryName={p.categoryName} />
            </>}
            {tab === 1 && <Stack spacing={1.25}>
              {p.byCarrier.length > 0 && <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.byCarrier")}</Typography><Table size="small"><TableHead><TableRow><TableCell>{t("producerDetail.carrier")}</TableCell><TableCell align="right">{t("producerDetail.policies")}</TableCell><TableCell align="right">{t("producerDetail.premium")}</TableCell></TableRow></TableHead><TableBody>{p.byCarrier.map(c => <TableRow key={c.carrierName}><TableCell>{c.carrierName}</TableCell><TableCell align="right">{c.policyCount}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{c.totalPremium.toFixed(2)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
              {p.byPolicyType.length > 0 && <Card variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800} mb={.75}>{t("producerDetail.byType")}</Typography><Table size="small"><TableHead><TableRow><TableCell>{t("producerDetail.type")}</TableCell><TableCell align="right">{t("producerDetail.policies")}</TableCell><TableCell align="right">{t("producerDetail.premium")}</TableCell></TableRow></TableHead><TableBody>{p.byPolicyType.map(item => <TableRow key={item.policyType}><TableCell>{item.policyType}</TableCell><TableCell align="right">{item.policyCount}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{item.totalPremium.toFixed(2)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
              {p.byCarrier.length === 0 && p.byPolicyType.length === 0 && <Typography color="text.secondary">Δεν υπάρχουν ακόμη συμβόλαια ή στοιχεία παραγωγής.</Typography>}
            </Stack>}
            {tab === 2 && <Stack gap={1.25}>
              <ProducerBalancesPanel key={p.id} producerId={p.id} />
            </Stack>}
            {tab === 3 && <ProducerContactFields key={p.id} producerId={p.id} values={session.values} session={canEdit ? session : undefined}
              fields={contactFields.data ?? []} loading={contactFields.isLoading} error={contactFields.isError ? extractErrorMessage(contactFields.error) : undefined} retry={() => void contactFields.refetch()} />}
          </Stack>
        </>}
      </DialogContent>
      <DialogActions sx={{ px: 1.25, py: .6, gap: .75, flexWrap: "wrap" }}>
        <Button size="small" variant="contained" startIcon={<BarChartIcon />} disabled={!p} onClick={() => setStatisticsOpen(true)} sx={{ bgcolor: "#087ceb", color: "#fff", "&:hover": { bgcolor: "#0767c4" } }}>Στατιστικά</Button>
        {canEdit ? <ProfileEditorActions session={session} label="συνεργάτη" /> : <Button color="error" variant="contained" onClick={session.requestClose}>Κλείσιμο</Button>}
      </DialogActions>
      {p && <ProducerStatisticsDialog key={p.id} producerId={p.id} name={p.name} open={open && statisticsOpen} onClose={() => setStatisticsOpen(false)} />}
    </Dialog>
  );
}

export function ProducerProfileFields({ session, values, parents = [], categories = [], currentCategoryName }: { session?: ProfileFieldSession; values: Record<string, string>; parents?: {id: string; name: string}[]; categories?: ProducerCategoryOption[]; currentCategoryName?: string | null }) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("lg"));
  const medium = useMediaQuery(theme.breakpoints.up("md"));
  const columnCount = wide ? 3 : medium ? 2 : 1;
  const enums: Record<string, { value: string; label: string }[]> = {
    status: [{value:"Active",label:"Ενεργός"}, {value:"Prospect",label:"Πιθανός συνεργάτης"}, {value:"Suspended",label:"Σε αναστολή"}, {value:"Terminated",label:"Τερματισμένος"}],
    hasContract: [{value:"true",label:"Ναι"}, {value:"false",label:"Όχι"}],
    categoryId: [{value:"",label:"—"}, ...categories.filter(row => row.isActive || row.id === values.categoryId).map(row => ({value:row.id,label:row.name}))],
    tier: ["None", "A", "B", "C", "D", "E"].map(value => ({value,label: value === "None" ? "Χωρίς βαθμίδα" : "Βαθμίδα " + value})),
    hierarchyLevel: Object.entries({Producer:"Συνεργάτης", Manager:"Υπεύθυνος ομάδας", Unit:"Μονάδα", Assistant:"Βοηθός διοίκησης", Agency:"Γραφείο"}).map(([value,label]) => ({value,label})),
    parentProducerId: [{value:"",label:"Χωρίς προϊστάμενο"}, ...parents.map(row => ({value:row.id,label:row.name}))],
  };
  if (values.parentProducerId && !enums.parentProducerId.some(option => option.value === values.parentProducerId)) enums.parentProducerId.push({value: values.parentProducerId, label:"Τρέχων προϊστάμενος"});
  if (values.categoryId && !enums.categoryId.some(option => option.value === values.categoryId)) enums.categoryId.push({value: values.categoryId, label: currentCategoryName || "Τρέχουσα κατηγορία"});
  const fields = new Map(PRODUCER_FIELDS.map(([key, label]) => [key,
    <ProfileEditableField key={key} label={label} field={session ? key : undefined} session={session} value={values[key]} options={enums[key]}
      type={/Date$/.test(key) ? "date" : /email/i.test(key) ? "email" : "text"} multiline={key === "notes" || key === "additionalInfoJson"} />
  ]));
  return <Box data-producer-general-columns={columnCount} sx={{ ...profileFieldGridSx,
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, columnGap: 1, alignItems: "start" }}>
    {producerGeneralColumns(columnCount).map((keys, index) => <Stack key={index} data-producer-column={index + 1} spacing={.5} sx={{ minWidth: 0 }}>
      {keys.map(key => fields.get(key))}
    </Stack>)}
  </Box>;
}
