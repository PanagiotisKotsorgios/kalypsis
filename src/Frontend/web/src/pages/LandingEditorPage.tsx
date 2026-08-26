import { useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Divider, IconButton, Stack,
  TextField, Tooltip, Typography,
} from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import LinkIcon from "@mui/icons-material/Link";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import {
  ERMES_SHOWCASE_DEFAULTS, type ErmesShowcaseContent,
} from "./LandingPage";

// ──────────────────────────────────────────────────────────────────────────
// SuperAdmin editor for the public landing page's editable sections. Right
// now the ΕΡΜΗΣ showcase is the only wired-up block — the layout is built
// so more sections (hero, pricing CTA, testimonials, etc.) can be added by
// dropping another <SectionEditor /> below.
//
// Every change is a PUT to /api/landing/content/:key with a JSON payload.
// Image uploads reuse /api/documentation/assets — the returned URL goes
// straight into the payload's image fields.
// ──────────────────────────────────────────────────────────────────────────

const ERMES_KEY = "ermes-showcase";

export function LandingEditorPage() {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}
        justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
            <EditNoteIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" fontWeight={800}>Επεξεργασία Landing Page</Typography>
          </Stack>
          <Typography color="text.secondary">
            Δημοσίευση κειμένων και εικόνων για το δημόσιο <strong>mykalypsis.gr</strong> — αλλαγές γίνονται live μέσα σε λίγα δευτερόλεπτα.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/" target="_blank"
            variant="outlined" startIcon={<OpenInNewIcon />}>
            Άνοιγμα landing σε νέα καρτέλα
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk(null)}>{ok}</Alert>}

      <ErmesEditor onError={setErr} onSuccess={setOk} />
    </Box>
  );
}

function ErmesEditor({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["landing-content-edit", ERMES_KEY],
    queryFn: async () => {
      try {
        const r = await api.get<{ payloadJson: string; updatedAt: string | null }>(`/landing/content/${ERMES_KEY}`);
        return { payload: JSON.parse(r.data.payloadJson) as Partial<ErmesShowcaseContent>, updatedAt: r.data.updatedAt };
      } catch {
        return { payload: {} as Partial<ErmesShowcaseContent>, updatedAt: null };
      }
    },
  });

  const [draft, setDraft] = useState<ErmesShowcaseContent>(ERMES_SHOWCASE_DEFAULTS);

  useEffect(() => {
    if (!q.data) return;
    setDraft({
      ...ERMES_SHOWCASE_DEFAULTS,
      ...q.data.payload,
      features: (q.data.payload.features && q.data.payload.features.length > 0)
        ? q.data.payload.features
        : ERMES_SHOWCASE_DEFAULTS.features,
    });
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/landing/content/${ERMES_KEY}`, { payloadJson: JSON.stringify(draft) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-content"] });
      qc.invalidateQueries({ queryKey: ["landing-content-edit"] });
      onSuccess("Οι αλλαγές αποθηκεύτηκαν και είναι live.");
    },
    onError: (e) => onError(extractErrorMessage(e)),
  });

  const resetToDefaults = () => {
    if (!confirm("Επαναφορά όλων των πεδίων στις προεπιλογές; Οι εικόνες που ανεβάσατε θα διαγραφούν από την ενότητα.")) return;
    setDraft(ERMES_SHOWCASE_DEFAULTS);
  };

  if (q.isLoading) return (
    <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Box>
  );

  return (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={800}>Ενότητα ΕΡΜΗΣ</Typography>
        <Typography variant="caption" color="text.secondary">
          Δημόσια ενότητα «Ο ΕΡΜΗΣ ενώνει το γραφείο σας» στο mykalypsis.gr
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<RestartAltIcon />} onClick={resetToDefaults} color="warning">
          Επαναφορά προεπιλογών
        </Button>
      </Stack>

      <Stack spacing={2.5}>
        <Section title="Επάνω μέρος">
          <TextField label="Ετικέτα πάνω" fullWidth size="small"
            value={draft.eyebrow} onChange={e => setDraft({ ...draft, eyebrow: e.target.value })}
            helperText="Πχ «ΕΡΜΗΣ · Kalypsis-native επικοινωνία»" />
          <TextField label="Chip" size="small" sx={{ maxWidth: 260 }}
            value={draft.chip} onChange={e => setDraft({ ...draft, chip: e.target.value })}
            helperText="Πχ «ΔΩΡΕΑΝ ΓΙΑ ΠΑΝΤΑ»" />
          <TextField label="Τίτλος" fullWidth
            value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
            helperText="Ο κύριος τίτλος της ενότητας" />
          <TextField label="Υπότιτλος" multiline minRows={3} fullWidth
            value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })}
            helperText="1-2 φράσεις κάτω από τον τίτλο" />
        </Section>

        <Section title="Στιγμιότυπα (2 εικόνες)">
          <ImagePickerRow
            label="Εικόνα 1 (Εισερχόμενα)"
            url={draft.screenshot1Url}
            onChange={u => setDraft({ ...draft, screenshot1Url: u })}
            captionValue={draft.screenshot1Caption}
            onCaptionChange={c => setDraft({ ...draft, screenshot1Caption: c })}
          />
          <ImagePickerRow
            label="Εικόνα 2 (Υποδοχή)"
            url={draft.screenshot2Url}
            onChange={u => setDraft({ ...draft, screenshot2Url: u })}
            captionValue={draft.screenshot2Caption}
            onCaptionChange={c => setDraft({ ...draft, screenshot2Caption: c })}
          />
        </Section>

        <Section title="Κάρτες χαρακτηριστικών">
          {draft.features.map((f, i) => (
            <Card key={i} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Κάρτα {i + 1}</Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Διαγραφή κάρτας">
                  <IconButton size="small" color="error" onClick={() => {
                    const next = [...draft.features]; next.splice(i, 1);
                    setDraft({ ...draft, features: next });
                  }}><DeleteIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField label="Chip" size="small" sx={{ width: 180 }}
                    value={f.chip} onChange={e => {
                      const next = [...draft.features];
                      next[i] = { ...next[i], chip: e.target.value };
                      setDraft({ ...draft, features: next });
                    }} />
                  <TextField label="Τίτλος" size="small" fullWidth
                    value={f.title} onChange={e => {
                      const next = [...draft.features];
                      next[i] = { ...next[i], title: e.target.value };
                      setDraft({ ...draft, features: next });
                    }} />
                </Stack>
                <TextField label="Περιγραφή" size="small" multiline minRows={2} fullWidth
                  value={f.body} onChange={e => {
                    const next = [...draft.features];
                    next[i] = { ...next[i], body: e.target.value };
                    setDraft({ ...draft, features: next });
                  }} />
              </Stack>
            </Card>
          ))}
          <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }}
            onClick={() => setDraft({
              ...draft,
              features: [...draft.features, { chip: "New", title: "Νέο χαρακτηριστικό", body: "Περιγραφή…" }],
            })}>
            Νέα κάρτα
          </Button>
        </Section>

        <Section title="Κάτω μέρος (call-to-action)">
          <TextField label="Σημείωση κάτω από τις κάρτες" fullWidth
            value={draft.footerNote} onChange={e => setDraft({ ...draft, footerNote: e.target.value })} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField label="Κείμενο κουμπιού" size="small" fullWidth
              value={draft.ctaLabel} onChange={e => setDraft({ ...draft, ctaLabel: e.target.value })} />
            <TextField label="Link κουμπιού" size="small" sx={{ minWidth: 240 }}
              value={draft.ctaTo} onChange={e => setDraft({ ...draft, ctaTo: e.target.value })}
              helperText="Πχ /register" />
          </Stack>
        </Section>

        <Divider />
        <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
          <Button variant="outlined"
            onClick={() => q.data && setDraft({ ...ERMES_SHOWCASE_DEFAULTS, ...q.data.payload,
              features: (q.data.payload.features && q.data.payload.features.length > 0)
                ? q.data.payload.features : ERMES_SHOWCASE_DEFAULTS.features })}>
            Ακύρωση
          </Button>
          <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Αποθήκευση…" : "Αποθήκευση & Δημοσίευση"}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" sx={{
        display: "block", color: "text.secondary",
        letterSpacing: "0.1em", fontWeight: 800, mb: 1,
      }}>{title}</Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  );
}

function ImagePickerRow({ label, url, onChange, captionValue, onCaptionChange }: {
  label: string; url: string | null; onChange: (u: string | null) => void;
  captionValue: string; onCaptionChange: (c: string) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  // Inline error surface — the previous try/finally swallowed upload
  // failures with zero user feedback («δεν αβνεβάζει τίποτα ούτε δείχνει
  // κάτι να φορτώνει»). We now catch, translate the error, and render
  // it inside the picker card so the operator sees exactly why the
  // upload didn't take.
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setError(null);
    // Client-side gate against the server's 10 MB cap. Firing an
    // upload that will 400 is worse than telling the user upfront.
    if (file.size > 10 * 1024 * 1024) {
      setError(`Το αρχείο «${file.name}» είναι ${(file.size / 1024 / 1024).toFixed(1)} MB · μέγιστο 10 MB.`);
      if (ref.current) ref.current.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError(`Δεκτά μόνο αρχεία εικόνας (jpg / png / webp / svg). Το «${file.name}» είναι ${file.type || "άγνωστο"}.`);
      if (ref.current) ref.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api.post<{ url: string }>("/documentation/assets", fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      onChange(r.data.url);
    } catch (e) {
      // Route through extractErrorMessage so backend AppException codes
      // (file_too_large / image_only / etc.) surface with their Greek text.
      const msg = extractErrorMessage(e);
      setError(msg);
      // Also log so ops can see the raw axios error in devtools.
      // eslint-disable-next-line no-console
      console.error("Landing image upload failed:", e);
    } finally {
      setBusy(false); if (ref.current) ref.current.value = "";
    }
  };
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.25 }}>{label}</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Box sx={{
          width: { xs: "100%", md: 200 }, height: 120,
          bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f4f6fa",
          borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center",
          backgroundImage: url ? `url(${url})` : "none",
          backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0,
          border: "1px dashed", borderColor: "divider",
        }}>
          {!url && <ImageIcon sx={{ fontSize: 40, color: "text.disabled" }} />}
        </Box>
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<ImageIcon />}
              disabled={busy} onClick={() => ref.current?.click()}>
              {busy ? "Ανέβασμα…" : url ? "Αντικατάσταση" : "Ανέβασμα εικόνας"}
            </Button>
            {url && (
              <Button size="small" color="error" startIcon={<DeleteIcon />}
                onClick={() => onChange(null)}>
                Αφαίρεση (fallback στο default SVG)
              </Button>
            )}
            <input ref={ref} type="file" accept="image/*" hidden
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }} />
          </Stack>
          {busy && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Ανέβασμα εικόνας…
              </Typography>
            </Stack>
          )}
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ py: 0.25 }}>
              {error}
            </Alert>
          )}
          {url && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LinkIcon fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography variant="caption" sx={{
                fontFamily: "monospace", color: "text.secondary",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{url}</Typography>
            </Stack>
          )}
          <TextField label="Λεζάντα κάτω από την εικόνα" size="small" fullWidth
            value={captionValue} onChange={e => onCaptionChange(e.target.value)} />
        </Stack>
      </Stack>
    </Card>
  );
}

export default LandingEditorPage;
