import { useEffect, useState } from "react";
import {
  Box, Button, Container, Divider, Slide, Stack, Switch, Typography
} from "@mui/material";
import CookieIcon from "@mui/icons-material/Cookie";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

// -----------------------------------------------------------------------------
// GDPR / ePrivacy-aligned cookie consent.
//
// Now records granular category consent (`necessary` is always on, plus
// functional / analytics / marketing) alongside a version + timestamp. Older
// «all | necessary» records are automatically upgraded on next load so returning
// visitors don't get the banner re-thrown at them.
//
// UI: a two-mode strip — the summary strip surfaces first, and «Ρυθμίσεις»
// swaps it for a granular panel with per-category switches. The «Necessary»
// category has an always-on read-only switch to make the compliance line
// explicit rather than implicit.
// -----------------------------------------------------------------------------

const STORAGE_KEY = "kalypsis_cookie_consent";
const CONSENT_VERSION = 2;

export interface CookieConsent {
  version: number;
  at: string;
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const DEFAULT_CONSENT = (): CookieConsent => ({
  version: CONSENT_VERSION,
  at: new Date().toISOString(),
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false
});

type StoredLegacy = { choice: "all" | "necessary"; at: string };

function readStored(): CookieConsent | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === CONSENT_VERSION) return parsed as CookieConsent;
    // Upgrade legacy record («all» → everything on, «necessary» → only strict).
    const legacy = parsed as StoredLegacy;
    if (legacy && (legacy.choice === "all" || legacy.choice === "necessary")) {
      return {
        ...DEFAULT_CONSENT(),
        at: legacy.at ?? new Date().toISOString(),
        functional: legacy.choice === "all",
        analytics:  legacy.choice === "all",
        marketing:  legacy.choice === "all"
      };
    }
  } catch { /* corrupt — force re-prompt */ }
  return null;
}

function persist(c: CookieConsent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function CookieBanner() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState<CookieConsent>(DEFAULT_CONSENT);

  useEffect(() => {
    // Never show on authenticated app routes — user has already accepted terms
    // on registration/login.
    if (location.pathname.startsWith("/app")) { setOpen(false); return; }
    const stored = readStored();
    if (!stored) {
      const tm = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(tm);
    }
    // If we auto-upgraded a legacy record, persist the migrated shape.
    if (stored.version !== CONSENT_VERSION) persist(stored);
  }, [location.pathname]);

  const acceptAll = () => {
    const next: CookieConsent = { ...DEFAULT_CONSENT(),
      functional: true, analytics: true, marketing: true };
    persist(next); setOpen(false);
  };
  const acceptNecessary = () => {
    persist(DEFAULT_CONSENT()); setOpen(false);
  };
  const saveGranular = () => {
    persist({ ...prefs, version: CONSENT_VERSION, at: new Date().toISOString(), necessary: true });
    setOpen(false);
  };

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        role="dialog"
        aria-label={t("cookieBanner.title", "Cookies")}
        aria-modal="false"
        sx={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          zIndex: (theme) => theme.zIndex.modal + 1,
          // Cleaner enterprise chrome — solid navy with a subtle top accent
          // instead of the previous translucent panel. Reads as a formal
          // notice, not a floating card.
          bgcolor: "#0a1a36",
          color: "#ffffff",
          borderTop: "3px solid #1f7bb3",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.35)"
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 2.25, md: 2.75 }, px: { xs: 2, md: 4 } }}>
          {!expanded ? (
            <SummaryStrip
              onAcceptAll={acceptAll}
              onAcceptNecessary={acceptNecessary}
              onCustomize={() => { setPrefs(readStored() ?? DEFAULT_CONSENT()); setExpanded(true); }}
            />
          ) : (
            <GranularPanel
              prefs={prefs}
              onChange={setPrefs}
              onBack={() => setExpanded(false)}
              onSave={saveGranular}
              onAcceptAll={acceptAll}
            />
          )}
        </Container>
      </Box>
    </Slide>
  );
}

// ------------------------------ Summary strip -------------------------------

function SummaryStrip({ onAcceptAll, onAcceptNecessary, onCustomize }: {
  onAcceptAll: () => void;
  onAcceptNecessary: () => void;
  onCustomize: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={{ xs: 2, md: 3 }}
      alignItems={{ xs: "stretch", md: "center" }}
    >
      <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 1.5, flexShrink: 0,
          bgcolor: "rgba(31,123,179,0.16)", color: "#6fd2ff",
          display: "grid", placeItems: "center",
          border: "1px solid rgba(111,210,255,0.28)"
        }}>
          <CookieIcon />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase",
            fontWeight: 700, color: "rgba(255,255,255,0.6)", mb: 0.4
          }}>
            {t("cookieBanner.eyebrow", "Απόρρητο & Cookies")}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 15.5, mb: 0.4 }}>
            {t("cookieBanner.title", "Σεβόμαστε τα δεδομένα σας")}
          </Typography>
          <Typography sx={{ opacity: 0.8, lineHeight: 1.55, fontSize: 13.5 }}>
            {t("cookieBanner.body",
              "Χρησιμοποιούμε αυστηρώς απαραίτητα cookies για τη λειτουργία του Kalypsis. Προαιρετικά, μπορείτε να ενεργοποιήσετε αναλυτικά cookies για να βελτιώνουμε την εμπειρία σας.")}
            {" "}
            <Box component={RouterLink} to="/cookies"
              sx={{
                color: "#6fd2ff", textDecoration: "underline",
                textDecorationColor: "rgba(111,210,255,0.5)",
                fontWeight: 600, "&:hover": { color: "#a2e0ff" }
              }}>
              {t("cookieBanner.learnMore", "Περισσότερα")}
            </Box>
          </Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}
        sx={{ flexShrink: 0, "& button": { fontWeight: 700, textTransform: "none" } }}>
        <Button
          onClick={onCustomize}
          variant="text"
          sx={{
            color: "rgba(255,255,255,0.85)",
            borderRadius: 1.5, px: 2.25, py: 1,
            "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "#fff" }
          }}
        >
          {t("cookieBanner.customize", "Ρυθμίσεις")}
        </Button>
        <Button
          onClick={onAcceptNecessary}
          variant="outlined"
          sx={{
            color: "#fff", borderColor: "rgba(255,255,255,0.35)",
            borderRadius: 1.5, px: 2.5, py: 1,
            "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.06)" }
          }}
        >
          {t("cookieBanner.rejectAll", "Μόνο απαραίτητα")}
        </Button>
        <Button
          onClick={onAcceptAll}
          variant="contained"
          sx={{
            bgcolor: "#1f7bb3", color: "#fff",
            borderRadius: 1.5, px: 3, py: 1,
            boxShadow: "0 6px 16px rgba(31,123,179,0.45)",
            "&:hover": { bgcolor: "#2c8dc7" }
          }}
        >
          {t("cookieBanner.acceptAll", "Αποδοχή όλων")}
        </Button>
      </Stack>
    </Stack>
  );
}

// ----------------------------- Granular panel ------------------------------

function GranularPanel({ prefs, onChange, onBack, onSave, onAcceptAll }: {
  prefs: CookieConsent;
  onChange: (p: CookieConsent) => void;
  onBack: () => void;
  onSave: () => void;
  onAcceptAll: () => void;
}) {
  const { t } = useTranslation();
  const flip = <K extends "functional" | "analytics" | "marketing">(k: K, v: boolean) =>
    onChange({ ...prefs, [k]: v });

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
        <ShieldOutlinedIcon sx={{ color: "#6fd2ff", fontSize: 22 }} />
        <Box>
          <Typography sx={{
            fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase",
            fontWeight: 700, color: "rgba(255,255,255,0.6)"
          }}>
            {t("cookieBanner.granular.eyebrow", "Λεπτομερείς Ρυθμίσεις Cookies")}
          </Typography>
          <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>
            {t("cookieBanner.granular.title", "Ελέγξτε ποιες κατηγορίες θέλετε να επιτρέψετε")}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 1.5 }} />

      <Stack divider={<Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />}
        sx={{ mb: 2 }}>
        <CategoryRow
          label={t("cookieBanner.cat.necessary", "Απαραίτητα")}
          detail={t("cookieBanner.cat.necessaryDetail",
            "Sessions, αυθεντικοποίηση, ασφάλεια CSRF. Δεν μπορούν να απενεργοποιηθούν — απαιτούνται για τη λειτουργία του Kalypsis.")}
          always
          checked
        />
        <CategoryRow
          label={t("cookieBanner.cat.functional", "Λειτουργικά")}
          detail={t("cookieBanner.cat.functionalDetail",
            "Προτιμήσεις γλώσσας, ζουμ, προσβασιμότητας — αποθηκεύονται τοπικά στον φυλλομετρητή σας.")}
          checked={prefs.functional}
          onChange={(v) => flip("functional", v)}
        />
        <CategoryRow
          label={t("cookieBanner.cat.analytics", "Αναλυτικά")}
          detail={t("cookieBanner.cat.analyticsDetail",
            "Ανώνυμα στατιστικά χρήσης (σελίδες, χρόνος παραμονής) — μας βοηθούν να βελτιώσουμε το Kalypsis.")}
          checked={prefs.analytics}
          onChange={(v) => flip("analytics", v)}
        />
        <CategoryRow
          label={t("cookieBanner.cat.marketing", "Marketing")}
          detail={t("cookieBanner.cat.marketingDetail",
            "Στοχευμένη επικοινωνία και re-marketing σε τρίτες πλατφόρμες.")}
          checked={prefs.marketing}
          onChange={(v) => flip("marketing", v)}
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}
        justifyContent="flex-end">
        <Button
          onClick={onBack}
          variant="text"
          sx={{
            color: "rgba(255,255,255,0.85)",
            borderRadius: 1.5, textTransform: "none", fontWeight: 700,
            "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "#fff" }
          }}
        >
          {t("cookieBanner.granular.back", "Πίσω")}
        </Button>
        <Button
          onClick={onSave}
          variant="outlined"
          startIcon={<CheckOutlinedIcon />}
          sx={{
            color: "#fff", borderColor: "rgba(255,255,255,0.35)",
            borderRadius: 1.5, textTransform: "none", fontWeight: 700,
            "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.06)" }
          }}
        >
          {t("cookieBanner.granular.save", "Αποθήκευση επιλογών")}
        </Button>
        <Button
          onClick={onAcceptAll}
          variant="contained"
          sx={{
            bgcolor: "#1f7bb3", color: "#fff",
            borderRadius: 1.5, textTransform: "none", fontWeight: 700,
            boxShadow: "0 6px 16px rgba(31,123,179,0.45)",
            "&:hover": { bgcolor: "#2c8dc7" }
          }}
        >
          {t("cookieBanner.acceptAll", "Αποδοχή όλων")}
        </Button>
      </Stack>
    </Box>
  );
}

function CategoryRow({ label, detail, checked, onChange, always }: {
  label: string; detail: string; checked: boolean;
  onChange?: (v: boolean) => void; always?: boolean;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
      sx={{ py: 1.5 }} alignItems={{ sm: "flex-start" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={0.4}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{label}</Typography>
          {always && (
            <Box sx={{
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              fontWeight: 700, color: "#6fd2ff",
              px: 1, py: 0.25, borderRadius: 0.75,
              border: "1px solid rgba(111,210,255,0.28)"
            }}>
              Πάντα ενεργά
            </Box>
          )}
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.55 }}>
          {detail}
        </Typography>
      </Box>
      <Switch
        checked={checked}
        onChange={(_, v) => onChange?.(v)}
        disabled={always}
        sx={{
          "& .MuiSwitch-thumb": { bgcolor: checked ? "#fff" : "rgba(255,255,255,0.7)" },
          "& .MuiSwitch-track":  { bgcolor: checked ? "#1f7bb3 !important" : "rgba(255,255,255,0.22)", opacity: "1 !important" },
          "&.Mui-disabled .MuiSwitch-track": { opacity: 0.4 }
        }}
      />
    </Stack>
  );
}
