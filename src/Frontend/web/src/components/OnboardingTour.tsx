import { useEffect, useLayoutEffect, useState } from "react";
import { Box, Button, IconButton, Paper, Popper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useTranslation } from "react-i18next";

export interface TourStep {
  /** CSS selector for the element to point at. Use `data-tour="key"` attributes on target UI. */
  selector: string;
  /** i18n key for the headline (Greek + English). */
  titleKey: string;
  /** i18n key for the body explanation. */
  bodyKey: string;
  /** Optional Popper placement override. */
  placement?: "bottom" | "right" | "left" | "top" | "bottom-start" | "right-start";
}

interface OnboardingTourProps {
  tourId: string;
  steps: TourStep[];
  /** When true, the tour runs even if previously dismissed (used by "Restart tour" buttons). */
  forceOpen?: boolean;
  onDismiss?: () => void;
}

/**
 * Lightweight guided tour. Marks itself "seen" in localStorage per tourId so
 * it only runs once per user/role/browser. Call with `forceOpen` from the
 * Profile page to let the user replay it.
 *
 * Targets are located via a CSS selector — typically a `data-tour="X"`
 * attribute on a button, table header, or sidebar item.
 */
export function OnboardingTour({ tourId, steps, forceOpen, onDismiss }: OnboardingTourProps) {
  const { t } = useTranslation();
  const [stepIdx, setStepIdx] = useState(0);
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const [active, setActive] = useState(false);

  const storageKey = `kalypsis.tour.${tourId}.completed`;

  // Decide whether to run on mount.
  useEffect(() => {
    if (forceOpen) { setActive(true); setStepIdx(0); return; }
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(storageKey);
    if (!seen) setActive(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);

  // Locate the anchor for the current step. Re-run when step changes or after a
  // short delay (in case the target hasn't mounted yet on route change).
  useLayoutEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;

    setAnchorEl(null); // clear stale anchor so the scrim doesn't render orphaned

    let attempts = 0;
    let cancelled = false;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector);
      if (el) {
        setAnchorEl(el);
        // Scroll into view if off-screen, then highlight by adding a class.
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        el.classList.add("tour-target");
      } else if (attempts++ < 8) {
        setTimeout(find, 100); // ~800ms total before giving up on this step
      } else {
        // Target never appeared — advance, or auto-dismiss when nothing in the
        // tour can find an anchor (prevents an orphan scrim that traps the user).
        setStepIdx(s => {
          const next = s + 1;
          if (next >= steps.length) {
            // Last step also missing; dismiss the tour and mark seen so we don't
            // come back next time.
            if (typeof window !== "undefined") {
              localStorage.setItem(storageKey, new Date().toISOString());
            }
            setActive(false);
            return 0;
          }
          return next;
        });
      }
    };
    find();

    return () => {
      cancelled = true;
      document.querySelectorAll(".tour-target").forEach(n => n.classList.remove("tour-target"));
    };
  }, [active, stepIdx, steps, storageKey]);

  if (!active || steps.length === 0) return null;

  const step = steps[stepIdx];
  if (!step) return null;
  // Don't render the scrim while we're still searching for an anchor — otherwise
  // the user sees only a dark overlay with no tooltip if the page is slow to mount.
  if (!anchorEl) return null;

  const complete = (markSeen: boolean) => {
    if (markSeen && typeof window !== "undefined") {
      localStorage.setItem(storageKey, new Date().toISOString());
    }
    document.querySelectorAll(".tour-target").forEach(n => n.classList.remove("tour-target"));
    setActive(false);
    setStepIdx(0);
    setAnchorEl(null);
    onDismiss?.();
  };

  const isLast = stepIdx === steps.length - 1;

  return (
    <>
      {/* Subtle scrim that DOES NOT block clicks (so the user can interact with the target). */}
      <Box sx={{
        position: "fixed", inset: 0, zIndex: 1200, pointerEvents: "none",
        background: "rgba(11,37,69,0.35)"
      }} />
      <style>{`
        .tour-target {
          position: relative;
          z-index: 1201;
          box-shadow: 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 8px rgba(11,37,69,0.85), 0 6px 30px rgba(0,0,0,0.25) !important;
          border-radius: 6px;
          animation: tourPulse 1600ms ease-in-out infinite;
        }
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 8px rgba(11,37,69,0.85), 0 6px 30px rgba(0,0,0,0.25); }
          50%      { box-shadow: 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 12px rgba(11,37,69,0.55), 0 8px 36px rgba(0,0,0,0.30); }
        }
      `}</style>
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement={step.placement ?? "bottom"}
        modifiers={[
          { name: "offset", options: { offset: [0, 16] } },
          { name: "preventOverflow", options: { padding: 16 } },
          { name: "flip", enabled: true }
        ]}
        sx={{ zIndex: 1300 }}
      >
        <Paper elevation={8} sx={{
          maxWidth: 360, p: 2.5, borderRadius: 2,
          border: "1px solid", borderColor: "primary.main"
        }}>
          <Stack direction="row" alignItems="flex-start" spacing={1} mb={1}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="primary" fontWeight={700}>
                {t("tour.stepCounter", { current: stepIdx + 1, total: steps.length })}
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5 }}>
                {t(step.titleKey)}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => complete(true)} title={t("tour.skip")}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary", lineHeight: 1.6 }}>
            {t(step.bodyKey)}
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
            <Button
              size="small" startIcon={<ArrowBackIcon />}
              disabled={stepIdx === 0}
              onClick={() => setStepIdx(s => Math.max(0, s - 1))}
            >
              {t("tour.back")}
            </Button>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {steps.map((_, i) => (
                <Box key={i} sx={{
                  width: 8, height: 8, borderRadius: "50%",
                  bgcolor: i === stepIdx ? "primary.main" : "grey.300"
                }} />
              ))}
            </Box>
            <Button
              size="small" variant="contained"
              endIcon={!isLast ? <ArrowForwardIcon /> : undefined}
              onClick={() => isLast ? complete(true) : setStepIdx(s => s + 1)}
            >
              {isLast ? t("tour.finish") : t("tour.next")}
            </Button>
          </Stack>
        </Paper>
      </Popper>
    </>
  );
}

/** Helper to wipe the "seen" flag — used by the Profile "Restart tour" button. */
export function resetTour(tourId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`kalypsis.tour.${tourId}.completed`);
}
