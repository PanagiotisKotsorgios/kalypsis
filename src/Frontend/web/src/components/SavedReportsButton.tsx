import { useEffect, useState } from "react";
import {
  Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Menu, MenuItem, Stack, Switch, TextField, Typography
} from "@mui/material";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface SavedReport {
  id: string;
  entity: string;
  name: string;
  filtersJson: string;
  isShared: boolean;
  ownedByMe: boolean;
  createdAt: string;
}

export function savedFilterPayload(entity: string, currentFilters: unknown, name: string, isShared: boolean) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 200) throw new Error("Συμπληρώστε όνομα φίλτρου έως 200 χαρακτήρες.");
  return { entity, name: trimmed, isShared, filtersJson: JSON.stringify(currentFilters) };
}

export function SavedFilterForm({ name, isShared, onChange, pending, error, onSave, onClose }: {
  name: string; isShared: boolean; onChange: (next: { name: string; isShared: boolean }) => void;
  pending: boolean; error?: string | null; onSave: () => void; onClose: () => void;
}) {
  return <>
    <DialogContent><Stack spacing={2} mt={1}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Όνομα φίλτρου" value={name} autoFocus disabled={pending} inputProps={{ maxLength: 200 }}
        onKeyDown={event => { if (event.key === "Enter" && name.trim() && !pending) { event.preventDefault(); onSave(); } }}
        onChange={event => onChange({ name: event.target.value, isShared })} fullWidth />
      <FormControlLabel control={<Switch checked={isShared} disabled={pending} onChange={event => onChange({ name, isShared: event.target.checked })} />} label="Κοινό σε όλο το γραφείο" />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={pending} color="error" variant="contained">Άκυρο</Button>
      <Button variant="contained" startIcon={!pending ? <SaveIcon /> : undefined} onClick={onSave} disabled={!name.trim() || pending}>{pending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button>
    </DialogActions>
  </>;
}

/**
 * Small dropdown attached to any reporting page's filter bar. Lets the
 * operator save the current filter state under a name and revisit it
 * later. Shared toggle exposes it to the whole agency (read-only for
 * anyone other than the owner).
 *
 *   <SavedReportsButton entity="production-lists"
 *      currentFilters={f}
 *      onLoad={(filters) => setF(filters)} />
 */
export function SavedReportsButton<T>({ entity, currentFilters, onLoad, inline = false, compact = false, saveRequestToken = 0 }: {
  entity: string;
  currentFilters: T;
  onLoad: (filters: T) => void;
  /** Render the compact selector + name field + save action in a filter bar. */
  inline?: boolean;
  /** Keep only selector/save buttons in the toolbar; naming happens in a modal. */
  compact?: boolean;
  /** Increment from a parent actions menu to open the shared save-filter dialog. */
  saveRequestToken?: number;
}) {
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [form, setForm] = useState({ name: "", isShared: false });
  const [activeId, setActiveId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["saved-reports", entity],
    queryFn: async () => (await api.get<SavedReport[]>("/saved-reports",
      { params: { entity } })).data,
  });

  const save = useMutation({
    mutationFn: async () => (await api.post<SavedReport>("/saved-reports", savedFilterPayload(entity, currentFilters, form.name, form.isShared))).data,
    onSuccess: (result) => {
      setActiveId(result.id);
      qc.setQueryData<SavedReport[]>(["saved-reports", entity], previous => [result, ...(previous ?? []).filter(row => row.id !== result.id)]);
      setSaveOpen(false);
      setForm({ name: "", isShared: false });
      void qc.invalidateQueries({ queryKey: ["saved-reports", entity] });
    },
  });

  useEffect(() => {
    if (saveRequestToken > 0) {
      save.reset();
      setSaveOpen(true);
    }
    // The mutation object is intentionally excluded: only an explicit token
    // change from the parent toolbar may open this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequestToken]);

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/saved-reports/${id}`),
    onSuccess: (_data, id) => {
      if (activeId === id) setActiveId(null);
      void qc.invalidateQueries({ queryKey: ["saved-reports", entity] });
    },
  });

  const activeName = (q.data ?? []).find(report => report.id === activeId)?.name;

  const selectorButton = (
    <Button size="small" variant={activeId ? "contained" : "outlined"} startIcon={<BookmarkIcon />}
      onClick={(e) => setAnchor(e.currentTarget)} sx={{
        whiteSpace: "nowrap", flexShrink: compact ? 1 : 0, minWidth: 0, maxWidth: compact ? "min(260px, 100%)" : undefined,
        ...(activeId
          ? { bgcolor: "#0b5cad", color: "#fff", "&:hover": { bgcolor: "#084d91", color: "#fff" } }
          : { color: "#123a64", borderColor: "#9ab2ca", "&:hover": { bgcolor: "#e8f2fb", borderColor: "#5d8fbd", color: "#123a64" } })
      }}>
      <Typography component="span" variant="inherit" noWrap title={activeName}>{activeName ?? (compact ? "Έτοιμα φίλτρα" : inline ? "Όνομα νέου φίλτρου" : "Αποθηκευμένα")}</Typography>
    </Button>
  );

  return (
    <>
      {compact ? <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap" sx={{ minWidth: 0 }}>
        {selectorButton}
        <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={() => { save.reset(); setSaveOpen(true); }} sx={{ whiteSpace: "nowrap" }}>Αποθήκευση φίλτρου</Button>
      </Stack> : inline ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems={{ xs: "stretch", sm: "center" }}
          useFlexGap flexWrap="wrap" sx={{ ml: "auto", minWidth: 0, justifyContent: "flex-end" }}>
          {selectorButton}
          <TextField
            size="small"
            label="Όνομα νέου φίλτρου"
            placeholder="π.χ. Πελάτες Αθήνας"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && form.name.trim() && !save.isPending) save.mutate();
            }}
            sx={{ minWidth: { xs: "100%", sm: 190, md: 230 }, flex: "1 1 220px", maxWidth: { sm: 280, md: 330 } }}
          />
          <Button
            size="small"
            variant="contained"
            startIcon={save.isPending ? <CircularProgress size={15} color="inherit" /> : <SaveIcon />}
            disabled={!form.name.trim() || save.isPending}
            onClick={() => save.mutate()}
            sx={{ whiteSpace: "nowrap", minHeight: 40 }}
          >
            Αποθήκευση φίλτρου
          </Button>
        </Stack>
      ) : selectorButton}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 300, maxHeight: 400 } } }}>
        <MenuItem onClick={() => { setAnchor(null); save.reset(); setSaveOpen(true); }}>
          <BookmarkAddIcon fontSize="small" sx={{ mr: 1 }} />
          Αποθήκευση τρέχοντος φίλτρου…
        </MenuItem>
        {q.isLoading ? (
          <MenuItem disabled><CircularProgress size={14} sx={{ mr: 1 }} /> Φόρτωση…</MenuItem>
        ) : (q.data ?? []).length === 0 ? (
          <MenuItem disabled sx={{ fontSize: 13, color: "text.secondary" }}>Δεν υπάρχουν αποθηκευμένα.</MenuItem>
        ) : (q.data ?? []).map(r => (
          <MenuItem key={r.id} selected={r.id === activeId} onClick={() => {
            try {
              const parsed = JSON.parse(r.filtersJson);
              onLoad(parsed);
              setActiveId(r.id);
              setAnchor(null);
            } catch { /* ignore malformed */ }
          }} sx={{
            color: "#123a64",
            "&:hover": { bgcolor: "#e8f2fb", color: "#123a64" },
            "&.Mui-selected": { bgcolor: "#d8eafa", color: "#0b305c", fontWeight: 800 },
            "&.Mui-selected:hover": { bgcolor: "#c8e1f6", color: "#0b305c" },
          }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
              <Typography sx={{ flex: 1 }} noWrap>{r.name}</Typography>
              {r.isShared && <Chip size="small" label="κοινό" sx={{ height: 18, fontSize: 10 }} />}
              {r.ownedByMe && (
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Διαγραφή αποθηκευμένου;")) del.mutate(r.id);
                }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={saveOpen} onClose={() => { if (!save.isPending) setSaveOpen(false); }} maxWidth="xs" fullWidth>
        <DialogTitle>Αποθήκευση φίλτρων</DialogTitle>
        <SavedFilterForm name={form.name} isShared={form.isShared} onChange={setForm} pending={save.isPending}
          error={save.isError ? extractErrorMessage(save.error, "Δεν αποθηκεύτηκε το φίλτρο.") : null}
          onSave={() => save.mutate()} onClose={() => setSaveOpen(false)} />
      </Dialog>
    </>
  );
}
