import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Snackbar, Stack, Tooltip, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation } from "@tanstack/react-query";
import { extractErrorMessage } from "../../api/client";
import { InlineValueField, type InlineValueOption } from "../InlineValueField";
import { acceptProfileDrafts } from "./profileDrafts";

export type ProfileDrafts = Record<string, string>;
export const profileDialogPaperSx = {
  width: { xs: "100vw", sm: "min(1120px, calc(100vw - 20px))", lg: "min(1500px, calc(100vw - 32px))" },
  height: { xs: "100dvh", sm: "min(820px, calc(100dvh - 20px))", lg: "min(900px, calc(100dvh - 32px))" },
  maxHeight: "calc(100dvh - 12px)", m: { xs: 0, sm: 1, lg: 2 }, borderRadius: { xs: 0, sm: 2 }, overflow: "hidden", bgcolor: "#edf3f9",
};
export const profileFieldGridSx = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" }, gap: .5, p: .75, borderRadius: 1.25, bgcolor: "#edf3f9", border: "1px solid #d6e3f0", minWidth: 0 };

/** Parent-owned drafts survive tab switches. Successful subsets are accepted
 * immediately; a failed multi-endpoint save retains only outstanding edits. */
export function useProfileFieldEditor({ sessionKey, values, initialEditing = false, write, refresh, onClose }: {
  sessionKey: string; values: ProfileDrafts; initialEditing?: boolean;
  write: (changes: ProfileDrafts, accept: (keys: string[]) => void) => Promise<void>;
  refresh: () => void; onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<ProfileDrafts>({});
  const [editAll, setEditAll] = useState(initialEditing);
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState<"close" | "cancel" | null>(null);
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => { setDrafts({}); setEditAll(initialEditing); setConfirm(null); setToast(""); mutation.reset(); }, [sessionKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const mutation = useMutation({
    mutationFn: async ({ changes }: { changes: ProfileDrafts; finish?: boolean }) => {
      await write(changes, keys => setDrafts(previous => acceptProfileDrafts(previous, changes, keys)));
    },
    onSuccess: (_, { finish, changes }) => { if (finish) setEditAll(false); setToast(Object.keys(changes).length ? "Οι αλλαγές αποθηκεύτηκαν επιτυχώς." : "Δεν υπάρχουν μη αποθηκευμένες αλλαγές."); },
    onSettled: refresh,
  });
  const change = (key: string, value: string) => setDrafts(previous => {
    const next = { ...previous };
    if (value === (values[key] ?? "")) delete next[key]; else next[key] = value;
    return next;
  });
  const requestClose = () => { if (!mutation.isPending) { if (dirty) setConfirm("close"); else onClose(); } };
  const cancel = () => { if (dirty) setConfirm("cancel"); else setEditAll(false); };
  return {
    values, drafts, dirty, editAll, busy: mutation.isPending, change, requestClose, cancel,
    begin: () => { mutation.reset(); setEditAll(true); },
    commit: async (key: string, value: string) => { await mutation.mutateAsync({ changes: { [key]: value } }); },
    saveAll: () => mutation.mutate({ changes: { ...drafts }, finish: true }),
    error: mutation.isError ? extractErrorMessage(mutation.error, mutation.error instanceof Error ? mutation.error.message : "Η αποθήκευση απέτυχε.") : null,
    toast, clearToast: () => setToast(""), confirm, dismissConfirm: () => setConfirm(null),
    discard: () => { const action = confirm; setDrafts({}); setEditAll(false); setConfirm(null); mutation.reset(); if (action === "close") onClose(); },
  };
}
export type ProfileFieldSession = ReturnType<typeof useProfileFieldEditor>;

export function ProfileEditableField({ label, field, session, value, options, type = "text", mono = false, multiline = false, validate, onRequestEdit, link, readOnly = false }: {
  label: string; field?: string; session?: ProfileFieldSession; value?: string | null;
  options?: InlineValueOption[]; type?: "text" | "date" | "email" | "number"; mono?: boolean; multiline?: boolean;
  validate?: (value: string) => string | undefined;
  onRequestEdit?: () => void;
  link?: string;
  readOnly?: boolean;
}) {
  const raw = value ?? (field ? session?.values[field] : "") ?? "";
  const display = options?.find(option => option.value === raw)?.label ?? raw;
  return <Box data-profile-field={field ?? label} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(104px,.36fr) minmax(0,1fr)", sm: "132px minmax(0,1fr)" }, alignItems: "center", gap: .5, minWidth: 0 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: .25, minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: "#506783", fontWeight: 700, lineHeight: 1.15 }}>{label}</Typography>
      {link && /^(https?:\/\/|mailto:|tel:)/i.test(link) && <Tooltip title="Άνοιγμα συνδέσμου"><IconButton component="a" href={link} target={/^https?:/i.test(link) ? "_blank" : undefined} rel="noreferrer" size="small" aria-label={"Άνοιγμα " + label} sx={{ flexShrink: 0, width: 24, height: 24 }}><OpenInNewIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>}
    </Box>
    <InlineValueField label={label} value={raw} displayValue={display || "—"} copyValue={display} options={options} type={type} mono={mono} multiline={multiline}
      compact hideLabel showActions readOnly={readOnly} valueColor="#193653" disabled={session?.busy} validate={validate}
      editMode={session?.editAll} draftValue={field ? session?.drafts[field] : undefined}
      onDraftChange={field && session ? next => session.change(field, next) : undefined}
      onRequestEdit={onRequestEdit}
      onCommit={field && session ? next => session.commit(field, next) : undefined} />
  </Box>;
}

export function ProfileEditorActions({ session, label = "στοιχείων" }: { session: ProfileFieldSession; label?: string }) {
  return <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap" sx={{ "& .MuiButton-root": { minHeight: 32, px: { xs: .9, md: 1.1 }, fontSize: { xs: ".72rem", md: ".78rem" }, fontWeight: 800 }, "& .MuiButton-contained": { color: "#fff" } }}>
    {session.editAll ? <>
      <Button size="small" variant="contained" color="success" startIcon={<SaveIcon />} disabled={session.busy} onClick={session.saveAll}>{session.busy ? "Αποθήκευση…" : "Αποθήκευση επεξεργασίας"}</Button>
      <Button size="small" variant="contained" color="error" startIcon={<CloseIcon />} disabled={session.busy} onClick={session.cancel}>Ακύρωση επεξεργασίας</Button>
    </> : <Button size="small" variant="contained" color="success" startIcon={<EditIcon />} disabled={session.busy} onClick={session.begin}>Επεξεργασία {label}</Button>}
    <Button size="small" variant="contained" color="error" startIcon={<CloseIcon />} disabled={session.busy} onClick={session.requestClose}>Κλείσιμο</Button>
  </Stack>;
}

export function ProfileEditorFeedback({ session }: { session: ProfileFieldSession }) {
  return <>
    {session.error && <Alert severity="error" sx={{ mb: .75 }}>{session.error} Οι μη αποθηκευμένες αλλαγές παραμένουν διαθέσιμες.</Alert>}
    <Dialog open={session.confirm !== null} onClose={session.dismissConfirm} maxWidth="xs" fullWidth>
      <DialogTitle>Μη αποθηκευμένες αλλαγές</DialogTitle><DialogContent>Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί. Θέλετε να τις απορρίψετε;</DialogContent>
      <DialogActions><Button onClick={session.dismissConfirm}>Επιστροφή στην καρτέλα</Button><Button variant="contained" color="error" onClick={session.discard}>Απόρριψη αλλαγών</Button></DialogActions>
    </Dialog>
    <Snackbar open={!!session.toast} onClose={session.clearToast} autoHideDuration={3500} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><Alert severity="success" onClose={session.clearToast}>{session.toast}</Alert></Snackbar>
  </>;
}
