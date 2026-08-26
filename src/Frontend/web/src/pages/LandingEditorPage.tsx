import { useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Divider, IconButton, Stack,
  Tab, Tabs, TextField, Tooltip, Typography,
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

  // ── Bilingual editor state ────────────────────────────────────────
  // The base draft holds Greek fields. When lang="en" every text input
  // reads from / writes to draft.en instead — so the operator can
  // type an English translation without a second dialog. Screenshot
  // URLs + CTA link are shared across languages (see the
  // ErmesShowcaseContent.en Omit list). Feature cards mirror the
  // count of the Greek ones so the display order stays aligned.
  const [lang, setLang] = useState<"el" | "en">("el");
  type ElField =
    | "eyebrow" | "chip" | "title" | "subtitle"
    | "screenshot1Caption" | "screenshot2Caption"
    | "footerNote" | "ctaLabel";
  const getStr = (key: ElField): string => {
    if (lang === "en") return draft.en?.[key] ?? "";
    return draft[key] ?? "";
  };
  const setStr = (key: ElField, value: string) => {
    if (lang === "en") {
      setDraft({ ...draft, en: { ...(draft.en ?? {}), [key]: value } });
    } else {
      setDraft({ ...draft, [key]: value });
    }
  };
  const getFeature = (i: number): { chip: string; title: string; body: string } => {
    if (lang === "en") {
      const enFeatures = draft.en?.features ?? [];
      return enFeatures[i] ?? { chip: "", title: "", body: "" };
    }
    return draft.features[i] ?? { chip: "", title: "", body: "" };
  };
  const setFeature = (i: number, patch: Partial<{ chip: string; title: string; body: string }>) => {
    if (lang === "en") {
      const base = draft.en?.features ?? draft.features.map(() => ({ chip: "", title: "", body: "" }));
      const next = [...base];
      // Pad up to the requested index so a sparse EN array stays aligned with EL.
      while (next.length <= i) next.push({ chip: "", title: "", body: "" });
      next[i] = { ...next[i], ...patch };
      setDraft({ ...draft, en: { ...(draft.en ?? {}), features: next } });
    } else {
      const next = [...draft.features];
      next[i] = { ...next[i], ...patch };
      setDraft({ ...draft, features: next });
    }
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

      {/* Language tab — swaps every text field between EL (default) and
          EN (Αγγλικά). Screenshots + CTA link stay shared across langs.
          Blank fields in EN fall back to EL at render time (see
          LandingPage → ErmesShowcaseSection merge logic). */}
      <Tabs value={lang} onChange={(_, v) => setLang(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab value="el" label="🇬🇷 Ελληνικά (κύρια γλώσσα)" />
        <Tab value="en" label="🇬🇧 English (translation)" />
      </Tabs>
      {lang === "en" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Συμπληρώστε τα Αγγλικά για κάθε πεδίο. Ό,τι αφήσετε κενό εμφανίζεται
          στα Ελληνικά όταν ο επισκέπτης επιλέξει EN.
        </Alert>
      )}

      <Stack spacing={2.5}>
        <Section title={lang === "en" ? "Top (English)" : "Επάνω μέρος"}>
          <TextField label={lang === "en" ? "Eyebrow" : "Ετικέτα πάνω"} fullWidth size="small"
            value={getStr("eyebrow")} onChange={e => setStr("eyebrow", e.target.value)}
            placeholder={lang === "en" ? draft.eyebrow : ""}
            helperText={lang === "en" ? `EL: «${draft.eyebrow}»` : "Πχ «ΕΡΜΗΣ · Kalypsis-native επικοινωνία»"} />
          <TextField label="Chip" size="small" sx={{ maxWidth: 260 }}
            value={getStr("chip")} onChange={e => setStr("chip", e.target.value)}
            placeholder={lang === "en" ? draft.chip : ""}
            helperText={lang === "en" ? `EL: «${draft.chip}»` : "Πχ «ΔΩΡΕΑΝ ΓΙΑ ΠΑΝΤΑ»"} />
          <TextField label={lang === "en" ? "Title" : "Τίτλος"} fullWidth
            value={getStr("title")} onChange={e => setStr("title", e.target.value)}
            placeholder={lang === "en" ? draft.title : ""}
            helperText={lang === "en" ? `EL: «${draft.title}»` : "Ο κύριος τίτλος της ενότητας"} />
          <TextField label={lang === "en" ? "Subtitle" : "Υπότιτλος"} multiline minRows={3} fullWidth
            value={getStr("subtitle")} onChange={e => setStr("subtitle", e.target.value)}
            placeholder={lang === "en" ? draft.subtitle : ""}
            helperText={lang === "en" ? `EL: «${draft.subtitle.slice(0, 80)}…»` : "1-2 φράσεις κάτω από τον τίτλο"} />
        </Section>

        <Section title={lang === "en" ? "Screenshots (captions in English)" : "Στιγμιότυπα (2 εικόνες)"}>
          {lang === "el" && (
            <>
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
            </>
          )}
          {lang === "en" && (
            <Stack spacing={1.5}>
              <Alert severity="info" icon={false}>
                Οι εικόνες είναι κοινές για EL/EN — μόνο οι λεζάντες αλλάζουν.
              </Alert>
              <TextField label="Caption 1 (Inbox)" size="small" fullWidth
                value={getStr("screenshot1Caption")}
                onChange={e => setStr("screenshot1Caption", e.target.value)}
                placeholder={draft.screenshot1Caption}
                helperText={`EL: «${draft.screenshot1Caption}»`} />
              <TextField label="Caption 2 (Reception)" size="small" fullWidth
                value={getStr("screenshot2Caption")}
                onChange={e => setStr("screenshot2Caption", e.target.value)}
                placeholder={draft.screenshot2Caption}
                helperText={`EL: «${draft.screenshot2Caption}»`} />
            </Stack>
          )}
        </Section>

        <Section title={lang === "en" ? "Feature cards (English)" : "Κάρτες χαρακτηριστικών"}>
          {draft.features.map((elCard, i) => {
            const shown = getFeature(i);
            return (
              <Card key={i} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    {lang === "en" ? `Card ${i + 1}` : `Κάρτα ${i + 1}`}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {lang === "el" && (
                    <Tooltip title="Διαγραφή κάρτας">
                      <IconButton size="small" color="error" onClick={() => {
                        const next = [...draft.features]; next.splice(i, 1);
                        const enFeatures = draft.en?.features ? [...draft.en.features] : undefined;
                        if (enFeatures) enFeatures.splice(i, 1);
                        setDraft({ ...draft, features: next,
                          en: enFeatures ? { ...draft.en, features: enFeatures } : draft.en });
                      }}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField label="Chip" size="small" sx={{ width: 180 }}
                      value={shown.chip} onChange={e => setFeature(i, { chip: e.target.value })}
                      placeholder={lang === "en" ? elCard.chip : ""}
                      helperText={lang === "en" ? `EL: «${elCard.chip}»` : undefined} />
                    <TextField label={lang === "en" ? "Title" : "Τίτλος"} size="small" fullWidth
                      value={shown.title} onChange={e => setFeature(i, { title: e.target.value })}
                      placeholder={lang === "en" ? elCard.title : ""}
                      helperText={lang === "en" ? `EL: «${elCard.title}»` : undefined} />
                  </Stack>
                  <TextField label={lang === "en" ? "Description" : "Περιγραφή"} size="small" multiline minRows={2} fullWidth
                    value={shown.body} onChange={e => setFeature(i, { body: e.target.value })}
                    placeholder={lang === "en" ? elCard.body : ""}
                    helperText={lang === "en" ? `EL: «${elCard.body.slice(0, 80)}…»` : undefined} />
                </Stack>
              </Card>
            );
          })}
          {lang === "el" && (
            <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }}
              onClick={() => setDraft({
                ...draft,
                features: [...draft.features, { chip: "New", title: "Νέο χαρακτηριστικό", body: "Περιγραφή…" }],
              })}>
              Νέα κάρτα
            </Button>
          )}
        </Section>

        <Section title={lang === "en" ? "Bottom / call-to-action (English)" : "Κάτω μέρος (call-to-action)"}>
          <TextField label={lang === "en" ? "Footer note under cards" : "Σημείωση κάτω από τις κάρτες"} fullWidth
            value={getStr("footerNote")} onChange={e => setStr("footerNote", e.target.value)}
            placeholder={lang === "en" ? draft.footerNote : ""}
            helperText={lang === "en" ? `EL: «${draft.footerNote}»` : undefined} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField label={lang === "en" ? "Button label" : "Κείμενο κουμπιού"} size="small" fullWidth
              value={getStr("ctaLabel")} onChange={e => setStr("ctaLabel", e.target.value)}
              placeholder={lang === "en" ? draft.ctaLabel : ""}
              helperText={lang === "en" ? `EL: «${draft.ctaLabel}»` : undefined} />
            {lang === "el" && (
              <TextField label="Link κουμπιού" size="small" sx={{ minWidth: 240 }}
                value={draft.ctaTo} onChange={e => setDraft({ ...draft, ctaTo: e.target.value })}
                helperText="Πχ /register" />
            )}
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
    // eslint-disable-next-line no-console
    console.log("[LandingImageUpload] selected:", { name: file.name, size: file.size, type: file.type });
    // Client-side pre-flight — surface every failure mode with a
    // specific message BEFORE hitting the network, so the user never
    // sees the old «flicker + nothing happens» silence again.
    if (file.size === 0) {
      setError(`Το αρχείο «${file.name}» έχει μέγεθος 0 bytes. Ίσως δεν έχει τελειώσει το κατέβασμα του original;`);
      if (ref.current) ref.current.value = "";
      return;
    }
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
      // Deliberately do NOT set Content-Type. When axios sees a FormData
      // body it lets the browser add the header WITH boundary — setting
      // "multipart/form-data" without a boundary can break ASP.NET Core
      // multipart parsing on some proxies. Nothing enforces the header
      // for other endpoints in the codebase that DO set it because
      // axios 1.x is smart enough to preserve the boundary in most
      // cases, but here we play it safe.
      const r = await api.post<{ url: string }>("/documentation/assets", fd);
      // eslint-disable-next-line no-console
      console.log("[LandingImageUpload] success:", r.status, r.data);
      if (!r.data?.url) {
        setError(`Ο server επέστρεψε επιτυχία αλλά χωρίς URL. Ελέγξτε τη μορφή απόκρισης (data: ${JSON.stringify(r.data)}).`);
        return;
      }
      onChange(r.data.url);
    } catch (e) {
      const msg = extractErrorMessage(e);
      setError(msg);
      // eslint-disable-next-line no-console
      console.error("[LandingImageUpload] failed:", e);
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
            {/* Switched from ref.click() → component="label" + child input.
                The previous approach used a hidden <input> triggered via
                a ref.current?.click() call from the button's onClick. That
                pattern is intermittent in browsers where the input is
                marked `hidden` — click doesn't bubble as a user gesture
                and the file picker never opens. Same input never fires
                onChange → no request → no server log → «τρεμοπαιγμα».
                The MUI-idiomatic pattern is a button rendered AS a
                <label> with the <input> nested inside. Clicking anywhere
                on the label focuses the input's file picker natively —
                works everywhere. Copied from BookkeepingPage upload. */}
            <Button size="small" variant="outlined" component="label"
              startIcon={<ImageIcon />} disabled={busy}>
              {busy ? "Ανέβασμα…" : url ? "Αντικατάσταση" : "Ανέβασμα εικόνας"}
              <input ref={ref} type="file" accept="image/*" hidden
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }} />
            </Button>
            {url && (
              <Button size="small" color="error" startIcon={<DeleteIcon />}
                onClick={() => onChange(null)}>
                Αφαίρεση (fallback στο default SVG)
              </Button>
            )}
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
