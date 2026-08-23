import { useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, IconButton,
  MenuItem, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import ImageIcon from "@mui/icons-material/Image";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditNoteIcon from "@mui/icons-material/EditNote";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { RichTextEditor } from "../components/RichTextEditor";

// ──────────────────────────────────────────────────────────────────────────
// SuperAdmin editor for the public «Οδηγίες Χρήσης» documentation tree.
// Every section (parent + child) is a row in documentation_sections. This
// page CRUDs them without a code push, and uploads screenshots that get
// stored server-side under documentation_assets and served through the
// stable /api/documentation/assets/:id URL.
// ──────────────────────────────────────────────────────────────────────────

interface SectionDto {
  id: string;
  slug: string;
  parentSlug: string | null;
  title: string;
  bodyHtml: string;
  keywords: string | null;
  displayOrder: number;
  isPublished: boolean;
}
interface AssetDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}
interface SaveBody {
  slug: string;
  parentSlug: string | null;
  title: string;
  bodyHtml: string;
  keywords: string | null;
  displayOrder: number;
  isPublished: boolean;
}

const EMPTY: SectionDto = {
  id: "",
  slug: "",
  parentSlug: null,
  title: "",
  bodyHtml: "",
  keywords: null,
  displayOrder: 0,
  isPublished: true,
};

export function DocumentationEditorPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<SectionDto | null>(null);
  const [draft, setDraft] = useState<SectionDto>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [assetsOpen, setAssetsOpen] = useState(false);

  const list = useQuery({
    queryKey: ["documentation-sections", "editor"],
    queryFn: async () => (await api.get<SectionDto[]>("/documentation/sections/all")).data,
  });
  const sections = list.data ?? [];
  const topLevel = useMemo(() =>
    sections.filter(s => !s.parentSlug).sort((a, b) => a.displayOrder - b.displayOrder),
    [sections]);
  const childrenBySlug = useMemo(() => {
    const m = new Map<string, SectionDto[]>();
    for (const s of sections) {
      if (!s.parentSlug) continue;
      const arr = m.get(s.parentSlug) ?? [];
      arr.push(s);
      m.set(s.parentSlug, arr);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.displayOrder - b.displayOrder);
    return m;
  }, [sections]);

  const select = (s: SectionDto) => {
    setSelected(s); setDraft(s); setErr(null); setOk(null);
  };
  const startNew = (parentSlug: string | null = null) => {
    setSelected(null);
    setDraft({
      ...EMPTY,
      parentSlug,
      displayOrder: (parentSlug
        ? (childrenBySlug.get(parentSlug)?.length ?? 0)
        : topLevel.length),
    });
    setErr(null); setOk(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body: SaveBody = {
        slug: draft.slug, parentSlug: draft.parentSlug || null,
        title: draft.title, bodyHtml: draft.bodyHtml,
        keywords: draft.keywords || null,
        displayOrder: draft.displayOrder,
        isPublished: draft.isPublished,
      };
      if (selected?.id) return (await api.put<SectionDto>(`/documentation/sections/${selected.id}`, body)).data;
      return (await api.post<SectionDto>("/documentation/sections", body)).data;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["documentation-sections"] });
      setSelected(saved); setDraft(saved);
      setOk("Αποθηκεύτηκε.");
      setErr(null);
    },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!selected?.id) return;
      await api.delete(`/documentation/sections/${selected.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentation-sections"] });
      setSelected(null); setDraft(EMPTY);
      setOk("Διαγράφηκε.");
    },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}
        justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
            <EditNoteIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" fontWeight={800}>Επεξεργασία Οδηγιών Χρήσης</Typography>
          </Stack>
          <Typography color="text.secondary">
            Δημοσίευση / επεξεργασία των ενοτήτων που εμφανίζονται στο δημόσιο
            <strong> mykalypsis.gr/documentation</strong> και μέσα στην εφαρμογή στο
            <strong> /app/documentation</strong>.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/app/documentation" target="_blank"
            variant="outlined" startIcon={<OpenInNewIcon />}>
            Άνοιγμα σε νέα καρτέλα
          </Button>
          <Button variant="outlined" startIcon={<ImageIcon />} onClick={() => setAssetsOpen(true)}>
            Στιγμιότυπα
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => startNew(null)}>
            Νέα ενότητα
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk(null)}>{ok}</Alert>}

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "280px 1fr" } }}>
        {/* Section tree */}
        <Card variant="outlined" sx={{ p: 1.5, alignSelf: "flex-start", position: "sticky", top: 16,
          maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
          <Typography variant="overline" sx={{ display: "block", mb: 1, px: 1,
            color: "text.secondary", fontWeight: 800, letterSpacing: "0.1em" }}>
            Δομή περιεχομένου
          </Typography>
          {list.isLoading ? (
            <Box sx={{ py: 3, textAlign: "center" }}><CircularProgress size={22} /></Box>
          ) : topLevel.map(s => (
            <Box key={s.id}>
              <TreeRow section={s} active={selected?.id === s.id} onClick={() => select(s)} />
              {(childrenBySlug.get(s.slug) ?? []).map(c => (
                <TreeRow key={c.id} section={c} active={selected?.id === c.id}
                  onClick={() => select(c)} indent />
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => startNew(s.slug)}
                sx={{ ml: 3, textTransform: "none", fontSize: 12, color: "text.secondary" }}>
                υπο-ενότητα
              </Button>
            </Box>
          ))}
        </Card>

        {/* Editor form */}
        <Card variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography variant="h6" fontWeight={800}>
                {selected ? `Επεξεργασία: ${selected.title}` : "Νέα ενότητα"}
              </Typography>
              <FormControlLabel
                control={<Switch checked={draft.isPublished}
                  onChange={e => setDraft({ ...draft, isPublished: e.target.checked })} />}
                label={draft.isPublished ? "Δημοσιευμένη" : "Πρόχειρο"}
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Τίτλος" value={draft.title} fullWidth
                onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <TextField label="Slug" value={draft.slug}
                helperText="Πεζά λατινικά + παύλες. π.χ. «customers-create»"
                sx={{ minWidth: 240 }}
                onChange={e => setDraft({
                  ...draft,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                })} />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select label="Γονική ενότητα" value={draft.parentSlug ?? ""}
                onChange={e => setDraft({ ...draft, parentSlug: e.target.value || null })}
                sx={{ minWidth: 240 }}>
                <MenuItem value="">— (κύρια ενότητα) —</MenuItem>
                {topLevel.filter(t => t.slug !== draft.slug).map(t =>
                  <MenuItem key={t.slug} value={t.slug}>{t.title}</MenuItem>)}
              </TextField>
              <TextField type="number" label="Σειρά" value={draft.displayOrder} sx={{ width: 120 }}
                onChange={e => setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })} />
              <TextField label="Λέξεις-κλειδιά" fullWidth
                value={draft.keywords ?? ""}
                helperText="Comma-separated — για αναζήτηση + SEO"
                onChange={e => setDraft({ ...draft, keywords: e.target.value })} />
            </Stack>

            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                <Typography variant="body2" fontWeight={700}>Περιεχόμενο</Typography>
                <UploadImageButton onInserted={(url) => {
                  const imgHtml = `<img src="${url}" alt="Στιγμιότυπο" />`;
                  setDraft(d => ({ ...d, bodyHtml: (d.bodyHtml || "") + imgHtml }));
                }} />
              </Stack>
              <RichTextEditor
                html={draft.bodyHtml}
                onHtmlChange={(html) => setDraft({ ...draft, bodyHtml: html })}
                minHeight={340}
                placeholder="Γράψτε το περιεχόμενο της ενότητας…"
              />
            </Box>

            <Divider />
            <Stack direction="row" spacing={1.5} justifyContent="space-between">
              <Box>
                {selected && (
                  <Button color="error" startIcon={<DeleteIcon />} disabled={del.isPending}
                    onClick={() => { if (confirm(`Διαγραφή «${selected.title}»;`)) del.mutate(); }}>
                    Διαγραφή
                  </Button>
                )}
              </Box>
              <Stack direction="row" spacing={1.5}>
                <Button variant="outlined" onClick={() => { setSelected(null); setDraft(EMPTY); }}>
                  Καθαρισμός
                </Button>
                <Button variant="contained" disabled={save.isPending || !draft.title || !draft.slug}
                  onClick={() => save.mutate()}>
                  {save.isPending ? "Αποθήκευση…" : (selected ? "Αποθήκευση αλλαγών" : "Δημιουργία")}
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Card>
      </Box>

      <AssetsDialog open={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </Box>
  );
}

function TreeRow({ section, active, indent, onClick }: {
  section: SectionDto; active: boolean; indent?: boolean; onClick: () => void;
}) {
  return (
    <Box onClick={onClick} sx={{
      cursor: "pointer", px: indent ? 3 : 1, py: 0.75,
      borderRadius: 1, mx: 0.5, my: 0.15,
      display: "flex", alignItems: "center", gap: 1,
      bgcolor: active
        ? (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.20)" : "#e7f0fa"
        : "transparent",
      "&:hover": {
        bgcolor: active
          ? (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.24)" : "#dce9f6"
          : "action.hover",
      },
    }}>
      <Typography sx={{
        fontSize: indent ? 12.5 : 13.5,
        fontWeight: active ? 700 : (indent ? 500 : 600),
        color: active ? "primary.main" : (indent ? "text.secondary" : "text.primary"),
        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {section.title}
      </Typography>
      {!section.isPublished && (
        <Chip label="Πρόχειρο" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
      )}
    </Box>
  );
}

function UploadImageButton({ onInserted }: { onInserted: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  const handle = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post<AssetDto>("/documentation/assets", fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      onInserted(r.data.url);
    } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <>
      <Button size="small" variant="outlined" startIcon={<ImageIcon />}
        disabled={busy} onClick={() => ref.current?.click()}
        sx={{ ml: 1 }}>
        {busy ? "Ανέβασμα…" : "+ Στιγμιότυπο"}
      </Button>
      <input ref={ref} type="file" accept="image/*" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) void handle(f); }} />
    </>
  );
}

function AssetsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["documentation-assets"], enabled: open,
    queryFn: async () => (await api.get<AssetDto[]>("/documentation/assets")).data,
  });
  const copy = (text: string) => { void navigator.clipboard.writeText(text); };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Ανεβασμένα στιγμιότυπα</DialogTitle>
      <DialogContent dividers>
        {q.isLoading ? <CircularProgress size={22} /> : (q.data ?? []).length === 0 ? (
          <Typography color="text.secondary">Δεν υπάρχουν ανεβασμένα αρχεία.</Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" } }}>
            {(q.data ?? []).map(a => (
              <Card key={a.id} variant="outlined" sx={{ p: 1 }}>
                <Box sx={{ height: 120, bgcolor: "grey.100", borderRadius: 1, mb: 1,
                  backgroundImage: `url(${a.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                <Typography sx={{ fontSize: 11, color: "text.secondary",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.fileName}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                  <Tooltip title="Αντιγραφή HTML"><IconButton size="small"
                    onClick={() => copy(`<img src="${a.url}" alt="" />`)}>
                    <ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Άνοιγμα"><IconButton size="small"
                    onClick={() => window.open(a.url, "_blank")}>
                    <OpenInNewIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions>
    </Dialog>
  );
}

export default DocumentationEditorPage;
