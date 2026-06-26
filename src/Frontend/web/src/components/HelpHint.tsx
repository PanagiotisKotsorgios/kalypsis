import { useState, type ReactNode } from "react";
import { Box, ClickAwayListener, Fade, IconButton, Popper, Stack, Typography } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useTranslation } from "react-i18next";

interface HelpHintProps {
  /**
   * i18n key. The component will look up `help.{id}.title` and `help.{id}.body`.
   * If only `help.{id}` exists as a flat string, that's used as the body.
   */
  id?: string;
  /** Inline title override (when `id` isn't used or isn't enough). */
  title?: ReactNode;
  /** Inline body override. */
  body?: ReactNode;
  /** Small/medium/large icon. */
  size?: "small" | "medium";
  /** Spacing class to control alignment in a row. */
  sx?: object;
}

/**
 * Phase 9.7 — Universal `?` help icon. Hover OR click reveals a small popover
 * with `title` + `body`. Drop next to any field, button, or section label.
 *
 *   <HelpHint id="policy.premium" />
 *   <HelpHint title="Πεδίο" body="Τι κάνει αυτό το πεδίο…" />
 *
 * Translations live under the `help.*` namespace in el.json / en.json.
 */
export function HelpHint({ id, title, body, size = "small", sx }: HelpHintProps) {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  // Resolve from i18n if id given. Try help.{id}.title + help.{id}.body first,
  // fall back to help.{id} as plain body.
  const resolvedTitle = title ?? (() => {
    if (!id) return undefined;
    const k = `help.${id}.title`;
    return i18n.exists(k) ? t(k) : undefined;
  })();
  const resolvedBody = body ?? (() => {
    if (!id) return undefined;
    const k1 = `help.${id}.body`;
    if (i18n.exists(k1)) return t(k1);
    const k2 = `help.${id}`;
    if (i18n.exists(k2)) return t(k2);
    return undefined;
  })();

  // No content → render nothing (silent).
  if (!resolvedTitle && !resolvedBody) return null;

  function toggle(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(anchorEl ? null : e.currentTarget);
  }

  return (
    <>
      <IconButton
        data-help-hint
        size={size}
        onClick={toggle}
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={(e) => {
          // Don't close on mouse-leave if the popover was opened by click —
          // keep it sticky until ClickAway / Escape.
          const relatedTarget = e.relatedTarget as HTMLElement | null;
          // If we're moving into the popover paper, keep it open.
          if (relatedTarget?.closest?.("[data-help-popover]")) return;
          // Auto-close only if the user came in via hover (not click)
          setTimeout(() => {
            const stillHover = document.querySelector("[data-help-popover]:hover");
            if (!stillHover) setAnchorEl(null);
          }, 100);
        }}
        aria-label="Βοήθεια"
        sx={{
          color: "#0b2545",
          bgcolor: "#e6eff8",
          border: "1.5px solid rgba(11,37,69,0.42)",
          p: size === "small" ? 0.4 : 0.55,
          "&:hover, &:focus-visible": {
            color: "#ffffff",
            bgcolor: "#0b2545",
            borderColor: "#0b2545"
          },
          ...sx
        }}
      >
        <HelpOutlineIcon sx={{ fontSize: size === "small" ? 22 : 26 }} />
      </IconButton>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="top"
        transition
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.tooltip + 1 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={180}>
            <Box
              data-help-popover
              onMouseLeave={() => setAnchorEl(null)}
              sx={{
                bgcolor: "#071d36",
                color: "#ffffff",
                border: "2px solid #0b2545",
                boxShadow: "0 18px 40px -10px rgba(2, 17, 34, 0.58)",
                p: 2.5,
                maxWidth: 390,
                position: "relative",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -8,
                  left: 16,
                  width: 14, height: 14,
                  bgcolor: "#071d36",
                  borderRight: "2px solid #0b2545",
                  borderBottom: "2px solid #0b2545",
                  transform: "rotate(45deg)"
                }
              }}
            >
              <ClickAwayListener onClickAway={() => setAnchorEl(null)}>
                <Stack spacing={0.5}>
                  {resolvedTitle && (
                    <Typography sx={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#ffffff",
                      lineHeight: 1.2
                    }}>
                      {resolvedTitle}
                    </Typography>
                  )}
                  {resolvedBody && (
                    <Typography sx={{
                      fontSize: 14,
                      color: "#e5edf6",
                      lineHeight: 1.6
                    }}>
                      {resolvedBody}
                    </Typography>
                  )}
                </Stack>
              </ClickAwayListener>
            </Box>
          </Fade>
        )}
      </Popper>
    </>
  );
}

/**
 * Convenience wrapper that places a label and a help hint inline. Use as a
 * label replacement for fields where the standard `label` prop isn't flexible
 * enough.
 *
 *   <LabelWithHelp label="Ασφάλιστρο" helpId="policy.premium" />
 *   <TextField ... />
 */
export function LabelWithHelp({ label, helpId, helpTitle, helpBody, sx }: {
  label: ReactNode;
  helpId?: string;
  helpTitle?: ReactNode;
  helpBody?: ReactNode;
  sx?: object;
}) {
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" sx={sx}>
      <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary" }}>{label}</Box>
      <HelpHint id={helpId} title={helpTitle} body={helpBody} />
    </Stack>
  );
}
