import { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ContactPhoneOutlinedIcon from "@mui/icons-material/ContactPhoneOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { DetailProfileTabs } from "./profile/DetailProfileTabs";
import { PolicyFieldColumns } from "./profile/PolicyFieldColumns";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, useProfileFieldEditor, type ProfileFieldSession } from "./profile/ProfileFieldEditor";
import { CLAIM_SUPPORT_SECTIONS, claimSupportUpdate, type ClaimSupportKind } from "./profile/claimSupportProfile";

export function ClaimSupportFields({ kind, section = 0, values, session }: { kind: ClaimSupportKind; section?: number; values: Record<string, string>; session?: ProfileFieldSession }) {
  const fields = CLAIM_SUPPORT_SECTIONS[kind][section]?.fields ?? [];
  const groups = [fields.slice(0, Math.ceil(fields.length / 2)), fields.slice(Math.ceil(fields.length / 2))].filter(group => group.length);
  return <PolicyFieldColumns section={kind} groups={groups.map(group => group.map(field => <ProfileEditableField key={field.key} label={field.label} field={field.readonly || !session ? undefined : field.key}
    session={field.readonly ? undefined : session} value={values[field.key]} options={field.options} type={field.type} multiline={field.multiline} />))} />;
}

/** One card for preview and edit; existing create forms and API business rules stay unchanged. */
export function ClaimSupportDetailDialog<T extends { id: string }>({ kind, record, initialEditing = false, canEdit = false, onClose }: {
  kind: ClaimSupportKind; record: T; initialEditing?: boolean; canEdit?: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [snapshot, setSnapshot] = useState<Record<string, unknown>>(() => Object.fromEntries(Object.entries(record)));
  const [tab, setTab] = useState(0);
  const editable = canEdit && kind !== "indemnities";
  const values = Object.fromEntries(CLAIM_SUPPORT_SECTIONS[kind].flatMap(section => section.fields).map(field => [field.key, String(snapshot[field.key] ?? "")]));
  const session = useProfileFieldEditor({ sessionKey: `${kind}:${record.id}`, values, initialEditing: initialEditing && editable, onClose,
    refresh: () => { void qc.invalidateQueries({ queryKey: [kind] }); },
    write: async (changes, accept) => {
      if (!editable) throw new Error("Δεν επιτρέπεται η επεξεργασία.");
      if (!Object.keys(changes).length) return;
      const latest = qc.getQueryData<Record<string, unknown>[]>([kind])?.find(row => row.id === record.id) ?? snapshot;
      const updated = (await api.put<Record<string, unknown>>(`/${kind}/${record.id}`, claimSupportUpdate(kind, latest, changes))).data;
      const next = { ...latest, ...updated };
      setSnapshot(next);
      qc.setQueryData<Record<string, unknown>[]>([kind], previous => previous?.map(row => row.id === record.id ? next : row));
      accept(Object.keys(changes));
    },
  });
  const title = kind === "garages" ? "Καρτέλα συνεργείου" : kind === "friendly-settlements" ? "Καρτέλα φιλικού διακανονισμού" : "Καρτέλα αποζημίωσης";
  const label = kind === "garages" ? "συνεργείου" : "διακανονισμού";
  const subtitle = String(snapshot.name ?? snapshot.settlementFileNumber ?? snapshot.paymentNumber ?? "");
  return <Dialog open onClose={session.requestClose} fullWidth maxWidth="xl" PaperProps={{ sx: profileDialogPaperSx }}>
    <DialogTitle sx={{ py: 1, px: 1.5, borderBottom: "1px solid", borderColor: "divider", fontWeight: 800, overflowWrap: "anywhere" }}>{title}{subtitle ? ` · ${subtitle}` : ""}</DialogTitle>
    <DialogContent dividers sx={{ p: 1.25, bgcolor: "#EDF3F9", minWidth: 0 }}>
      <DetailProfileTabs value={tab} onChange={setTab} items={CLAIM_SUPPORT_SECTIONS[kind].map((section, index) => ({ label: section.label, icon: index === 0 ? <InfoOutlinedIcon /> : section.label === "Επικοινωνία" ? <ContactPhoneOutlinedIcon /> : <DescriptionOutlinedIcon /> }))} />
      <ProfileEditorFeedback session={session} />
      <Box sx={{ mt: .75 }}><ClaimSupportFields kind={kind} section={tab} values={values} session={editable ? session : undefined} /></Box>
    </DialogContent>
    <DialogActions sx={{ px: 1.25, py: .6, flexWrap: "wrap", gap: .75 }}>{editable ? <ProfileEditorActions session={session} label={label} />
      : <Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={session.requestClose}>Κλείσιμο</Button>}</DialogActions>
  </Dialog>;
}
