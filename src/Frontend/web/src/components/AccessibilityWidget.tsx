import { useEffect, useState } from "react";
import {
  Box, Drawer, IconButton, Stack, Switch, Tooltip, Typography
} from "@mui/material";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import CloseIcon from "@mui/icons-material/Close";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

// =============================================================================
// EU-aligned accessibility widget (EAA / EN 301 549 / WCAG 2.1 AA).
// A floating button on the bottom-right opens a right-side drawer with the
// most-requested user-side adjustments. Every toggle persists in localStorage
// (`kalypsis.a11y.v1`) and is applied as data-* attributes on <html>, which
// global CSS in `index.css` reads.
//
// Why client-side, not OS-level? EAA Article 12 requires the service itself
// to provide controls that users can engage from inside the product — this
// covers public-sector + key private-sector services from June 2025.
// =============================================================================

const STORAGE_KEY = "kalypsis.a11y.v1";

interface A11yState {
  fontScale: number;          // multiplier 0.85 / 1 / 1.15 / 1.3 / 1.5
  contrast: boolean;          // high-contrast theme
  underlineLinks: boolean;    // force underline on every anchor
  reduceMotion: boolean;      // pause animations / transitions
  dyslexiaFont: boolean;      // swap to dyslexia-friendly font stack
  bigCursor: boolean;         // enlarged cursor for motor-impaired users
  highlightFocus: boolean;    // thick visible focus rings for keyboard nav
}

const DEFAULT: A11yState = {
  fontScale: 1,
  contrast: false,
  underlineLinks: false,
  reduceMotion: false,
  dyslexiaFont: false,
  bigCursor: false,
  highlightFocus: false
};

function loadState(): A11yState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { return DEFAULT; }
}

function applyState(s: A11yState) {
  const html = document.documentElement;
  html.style.setProperty("--a11y-font-scale", String(s.fontScale));
  // Toggle data-attrs so global CSS can react.
  html.dataset.a11yContrast       = s.contrast       ? "1" : "0";
  html.dataset.a11yUnderlineLinks = s.underlineLinks ? "1" : "0";
  html.dataset.a11yReduceMotion   = s.reduceMotion   ? "1" : "0";
  html.dataset.a11yDyslexia       = s.dyslexiaFont   ? "1" : "0";
  html.dataset.a11yBigCursor      = s.bigCursor      ? "1" : "0";
  html.dataset.a11yFocus          = s.highlightFocus ? "1" : "0";
}

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<A11yState>(loadState);

  // Sync to DOM + storage whenever state changes.
  useEffect(() => {
    applyState(state);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state]);

  // Apply on mount even if drawer never opens.
  useEffect(() => { applyState(state); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof A11yState>(k: K, v: A11yState[K]) =>
    setState(prev => ({ ...prev, [k]: v }));

  const reset = () => setState(DEFAULT);

  const FONT_STEPS = [0.85, 1, 1.15, 1.3, 1.5];
  const fontIdx = Math.max(0, FONT_STEPS.indexOf(state.fontScale));
  const bumpFont = (dir: 1 | -1) => {
    const next = FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, fontIdx + dir))];
    set("fontScale", next);
  };

  return (
    <>
      {/* Floating launcher — fixed bottom-right, visible across all pre-login pages. */}
      <Tooltip title="Επιλογές προσβασιμότητας" placement="left" arrow>
        <IconButton
          aria-label="Άνοιγμα επιλογών προσβασιμότητας"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          sx={{
            position: "fixed", right: 16, bottom: 16, zIndex: 1500,
            width: 56, height: 56, borderRadius: "50%",
            bgcolor: "#0b2545", color: "#fff",
            boxShadow: "0 10px 30px rgba(11,37,69,0.25), 0 2px 8px rgba(11,37,69,0.20)",
            "&:hover": { bgcolor: "#1f7bb3" },
            "&:focus-visible": { outline: "3px solid #6fd2ff", outlineOffset: 2 }
          }}>
          <AccessibilityNewIcon sx={{ fontSize: 28 }} />
        </IconButton>
      </Tooltip>

      <Drawer
        anchor="right" open={open} onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 380 },
            bgcolor: "#fff", color: "#0b2545",
            fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif'
          }
        }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ p: 2.5, borderBottom: "1px solid #e5e9ef" }}>
          <Box>
            <Typography sx={{
              fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
              color: "#1f7bb3", fontWeight: 600, mb: 0.25
            }}>
              EAA · WCAG 2.1 AA
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
              Επιλογές προσβασιμότητας
            </Typography>
          </Box>
          <IconButton aria-label="Κλείσιμο" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* Body */}
        <Box sx={{ p: 2.5, overflowY: "auto" }}>
          {/* Font scale */}
          <SectionHeader title="Μέγεθος κειμένου" />
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton aria-label="Μείωση μεγέθους κειμένου"
              onClick={() => bumpFont(-1)} disabled={fontIdx <= 0}
              sx={a11yIconBtn}>
              <TextDecreaseIcon />
            </IconButton>
            <Box sx={{
              flex: 1, textAlign: "center",
              border: "1px solid #e5e9ef", borderRadius: 1.5, py: 1.25,
              fontWeight: 700, fontSize: 15
            }}>
              {Math.round(state.fontScale * 100)}%
            </Box>
            <IconButton aria-label="Αύξηση μεγέθους κειμένου"
              onClick={() => bumpFont(1)} disabled={fontIdx >= FONT_STEPS.length - 1}
              sx={a11yIconBtn}>
              <TextIncreaseIcon />
            </IconButton>
          </Stack>

          <SectionHeader title="Εμφάνιση" />
          <ToggleRow
            label="Υψηλή αντίθεση"
            hint="Μαύρο κείμενο σε λευκό φόντο, χωρίς διαφάνειες."
            checked={state.contrast}
            onChange={(v) => set("contrast", v)} />
          <ToggleRow
            label="Φιλική γραμματοσειρά για δυσλεξία"
            hint="Atkinson Hyperlegible / σύστημα — καλύτερη αναγνωσιμότητα."
            checked={state.dyslexiaFont}
            onChange={(v) => set("dyslexiaFont", v)} />
          <ToggleRow
            label="Υπογράμμιση συνδέσμων"
            hint="Όλοι οι σύνδεσμοι εμφανίζονται υπογραμμισμένοι."
            checked={state.underlineLinks}
            onChange={(v) => set("underlineLinks", v)} />

          <SectionHeader title="Κίνηση & εστίαση" />
          <ToggleRow
            label="Παύση κινήσεων"
            hint="Σταματάει animations και ομαλές μεταβάσεις."
            checked={state.reduceMotion}
            onChange={(v) => set("reduceMotion", v)} />
          <ToggleRow
            label="Έντονο πλαίσιο εστίασης"
            hint="Χοντρή κίτρινη γραμμή για πλοήγηση με πληκτρολόγιο."
            checked={state.highlightFocus}
            onChange={(v) => set("highlightFocus", v)} />
          <ToggleRow
            label="Μεγαλύτερος δείκτης ποντικιού"
            hint="Διπλάσιο μέγεθος cursor για χρήστες με κινητικές δυσκολίες."
            checked={state.bigCursor}
            onChange={(v) => set("bigCursor", v)} />

          {/* Reset */}
          <Box sx={{ mt: 4, pt: 3, borderTop: "1px solid #e5e9ef" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 13, color: "#3d4f6b" }}>
                Οι ρυθμίσεις αποθηκεύονται μόνο στον φυλλομετρητή σας.
              </Typography>
              <IconButton aria-label="Επαναφορά προεπιλογών" onClick={reset} sx={a11yIconBtn}>
                <RestartAltIcon />
              </IconButton>
            </Stack>
          </Box>

          {/* EU compliance line */}
          <Typography sx={{
            mt: 3, fontSize: 11, lineHeight: 1.6, color: "#6b7a91", letterSpacing: "0.02em"
          }}>
            Συμμόρφωση με την Οδηγία (ΕΕ) 2019/882 (European Accessibility Act),
            το πρότυπο EN 301 549 και τις οδηγίες WCAG 2.1 σε επίπεδο AA.
          </Typography>
        </Box>
      </Drawer>
    </>
  );
}

const a11yIconBtn = {
  border: "1px solid #e5e9ef",
  borderRadius: 1.5,
  color: "#0b2545",
  "&:hover": { bgcolor: "rgba(31,123,179,0.08)", borderColor: "#1f7bb3" },
  "&.Mui-disabled": { opacity: 0.4 }
} as const;

function SectionHeader({ title }: { title: string }) {
  return (
    <Typography sx={{
      fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
      color: "#6b7a91", fontWeight: 600,
      mt: 3, mb: 1.25
    }}>
      {title}
    </Typography>
  );
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between"
      sx={{ py: 1.25, borderBottom: "1px solid #e5e9ef", "&:last-of-type": { borderBottom: 0 } }}>
      <Box sx={{ pr: 2 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: "#0b2545", mb: 0.25 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12.5, color: "#6b7a91", lineHeight: 1.5 }}>{hint}</Typography>
      </Box>
      <Switch checked={checked} onChange={(_, v) => onChange(v)}
        inputProps={{ "aria-label": label }} />
    </Stack>
  );
}
