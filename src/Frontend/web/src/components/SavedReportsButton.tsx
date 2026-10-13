import { useState } from "react";
import {
  Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Menu, MenuItem, Stack, Switch, TextField, Typography
} from "@mui/material";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

interface SavedReport {
  id: string;
  entity: string;
  name: string;
  filtersJson: string;
  isShared: boolean;
  ownedByMe: boolean;
  createdAt: string;
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
export function SavedReportsButton<T>({ entity, currentFilters, onLoad }: {
  entity: string;
  currentFilters: T;
  onLoad: (filters: T) => void;
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
    mutationFn: async () => (await api.post("/saved-reports", {
      entity,
      name: form.name,
      isShared: form.isShared,
      filtersJson: JSON.stringify(currentFilters),
    })).data,
    onSuccess: () => {
      setSaveOpen(false);
      setForm({ name: "", isShared: false });
      void qc.invalidateQueries({ queryKey: ["saved-reports", entity] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/saved-reports/${id}`),
    onSuccess: (_data, id) => {
      if (activeId === id) setActiveId(null);
      void qc.invalidateQueries({ queryKey: ["saved-reports", entity] });
    },
  });

  const activeName = (q.data ?? []).find(report => report.id === activeId)?.name;

  return (
    <>
      <Button size="small" variant={activeId ? "contained" : "outlined"} startIcon={<BookmarkIcon />}
        onClick={(e) => setAnchor(e.currentTarget)} sx={{
          ml: "auto", whiteSpace: "nowrap",
          ...(activeId
            ? { bgcolor: "#0b5cad", color: "#fff", "&:hover": { bgcolor: "#084d91", color: "#fff" } }
            : { color: "#123a64", borderColor: "#9ab2ca", "&:hover": { bgcolor: "#e8f2fb", borderColor: "#5d8fbd", color: "#123a64" } })
        }}>
        {activeName ?? "Αποθηκευμένα"}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 300, maxHeight: 400 } } }}>
        <MenuItem onClick={() => { setAnchor(null); setSaveOpen(true); }}>
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

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Αποθήκευση φίλτρων</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Όνομα" value={form.name} autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <FormControlLabel
              control={<Switch checked={form.isShared}
                onChange={(e) => setForm({ ...form, isShared: e.target.checked })} />}
              label="Κοινό σε όλο το γραφείο"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveOpen(false)} color="error" variant="contained">Άκυρο</Button>
          <Button variant="contained" onClick={() => save.mutate()}
            disabled={!form.name.trim() || save.isPending}>
            {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
