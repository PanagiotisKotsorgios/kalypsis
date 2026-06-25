import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box, ClickAwayListener, Fade, Paper, Popper, Stack, Typography
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import { AmericanFlag, GreekFlag } from "./Flags";

type LangCode = "el" | "en";

interface Lang {
  code: LangCode;
  short: string;
  label: string;
  flag: React.ReactNode;
}

const LANGS: Lang[] = [
  { code: "el", short: "EL", label: "Ελληνικά", flag: <GreekFlag size={18} /> },
  { code: "en", short: "EN", label: "English",  flag: <AmericanFlag size={18} /> }
];

// Brand palette — mirrors LandingPage / LegalShell.
const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";
const RULE = "#e5e9ef";

/**
 * Restrained navy/white language picker matching the redesigned pre-login
 * theme. The trigger is a compact pill (flag + short code + chevron); the
 * dropdown is a clean white card with hairline borders and an accent check.
 *
 * Uses MUI's Popper + ClickAwayListener so it survives being mounted inside
 * portals (e.g. the public mobile drawer).
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current: LangCode = i18n.resolvedLanguage?.startsWith("en") ? "en" : "el";
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const currentLang = LANGS.find((l) => l.code === current) ?? LANGS[0];

  const select = (code: LangCode) => {
    if (code !== current) void i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <>
      <Box
        component="button"
        type="button"
        ref={anchorRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Γλώσσα: ${currentLang.label}`}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          px: 1.5, py: 0.85,
          borderRadius: 999,
          background: "#ffffff",
          border: `1px solid ${RULE}`,
          color: NAVY,
          cursor: "pointer",
          fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          transition: "border-color 220ms ease, background 220ms ease, box-shadow 220ms ease",
          "&:hover": {
            borderColor: NAVY,
            background: "rgba(11,37,69,0.04)",
            boxShadow: "0 1px 6px rgba(11,37,69,0.06)"
          },
          "&:focus-visible": {
            outline: `2px solid ${ACCENT}`,
            outlineOffset: 2
          }
        }}
      >
        <Box sx={{ display: "inline-flex" }}>{currentLang.flag}</Box>
        <span>{currentLang.short}</span>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 16,
            ml: 0.15,
            transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)",
            transform: open ? "rotate(180deg)" : "rotate(0)"
          }}
        />
      </Box>

      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-end"
        transition
        disablePortal={false}
        sx={{ zIndex: 1400 }}
        modifiers={[
          { name: "offset", options: { offset: [0, 8] } },
          { name: "preventOverflow", options: { padding: 8 } }
        ]}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              elevation={0}
              sx={{
                minWidth: 220,
                background: "#ffffff",
                border: `1px solid ${RULE}`,
                borderRadius: 2,
                boxShadow: "0 18px 40px rgba(11,37,69,0.12), 0 2px 8px rgba(11,37,69,0.04)",
                overflow: "hidden"
              }}
            >
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Stack role="listbox" aria-label="Επιλέξτε γλώσσα" sx={{ py: 0.5 }}>
                  {LANGS.map((lang) => {
                    const selected = lang.code === current;
                    return (
                      <Box
                        key={lang.code}
                        role="option"
                        aria-selected={selected}
                        onClick={() => select(lang.code)}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "26px 1fr auto",
                          alignItems: "center",
                          gap: 1.5,
                          px: 2, py: 1.25,
                          cursor: "pointer",
                          color: NAVY,
                          fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                          transition: "background 180ms ease",
                          bgcolor: selected ? "rgba(31,123,179,0.06)" : "transparent",
                          "&:hover": { background: "rgba(31,123,179,0.08)" }
                        }}
                      >
                        <Box sx={{ display: "inline-flex" }}>{lang.flag}</Box>
                        <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                          <Typography sx={{
                            fontSize: 15, fontWeight: 700,
                            color: selected ? NAVY : NAVY_SOFT,
                            letterSpacing: "-0.005em"
                          }}>
                            {lang.label}
                          </Typography>
                          <Typography sx={{
                            fontSize: 10.5,
                            letterSpacing: "0.18em",
                            color: NAVY_SOFT,
                            mt: 0.15,
                            fontWeight: 600
                          }}>
                            {lang.short}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: 20, height: 20,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: ACCENT,
                            opacity: selected ? 1 : 0,
                            transition: "opacity 220ms ease"
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 18 }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
}
