import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  ClickAwayListener,
  Fade,
  Paper,
  Popper,
  Stack
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

/**
 * Editorial-style language picker. The trigger pill shows the current
 * flag + short code; clicking opens a Popper-anchored dropdown that lists
 * each language with its native name + short code + a gold check on the
 * active one. Uses MUI's Popper + ClickAwayListener so it works correctly
 * even when the trigger is mounted inside a portal (e.g. the public mobile
 * drawer).
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
        aria-label={`Language: ${currentLang.label}`}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.5,
          py: 0.875,
          background: "transparent",
          border: "1px solid rgba(11,37,69,0.22)",
          color: "#0b2545",
          cursor: "pointer",
          fontFamily: "var(--sans, system-ui)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          transition: "border-color 240ms cubic-bezier(0.16,1,0.3,1), background 240ms cubic-bezier(0.16,1,0.3,1)",
          "&:hover": {
            borderColor: "#0b2545",
            background: "rgba(11,37,69,0.05)"
          },
          "&:focus-visible": {
            outline: "2px solid rgba(176,138,62,0.6)",
            outlineOffset: 2
          }
        }}
      >
        <Box sx={{ display: "inline-flex" }}>{currentLang.flag}</Box>
        <span>{currentLang.short}</span>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 16,
            ml: 0.25,
            transition: "transform 320ms cubic-bezier(0.16,1,0.3,1)",
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
          <Fade {...TransitionProps} timeout={220}>
            <Paper
              elevation={0}
              sx={{
                minWidth: 220,
                background: "#fcf8f1",
                border: "1px solid #d6c6ab",
                borderRadius: 0,
                boxShadow: "0 18px 48px -16px rgba(11,37,69,0.32)",
                overflow: "hidden"
              }}
            >
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Stack role="listbox" aria-label="Select language" sx={{ py: 0.5 }}>
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
                          px: 2,
                          py: 1.5,
                          cursor: "pointer",
                          color: "#0b2545",
                          fontFamily: "var(--sans, system-ui)",
                          transition: "background 200ms ease",
                          "&:hover": { background: "rgba(176,138,62,0.08)" }
                        }}
                      >
                        <Box sx={{ display: "inline-flex" }}>{lang.flag}</Box>
                        <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                          <Box
                            sx={{
                              fontFamily: "var(--display, Georgia, serif)",
                              fontStyle: "italic",
                              fontSize: 17,
                              color: selected ? "#0b2545" : "#1f3a64"
                            }}
                          >
                            {lang.label}
                          </Box>
                          <Box
                            sx={{
                              fontSize: 10,
                              letterSpacing: "0.16em",
                              color: "rgba(11,37,69,0.55)",
                              mt: 0.25
                            }}
                          >
                            {lang.short}
                          </Box>
                        </Box>
                        <Box
                          sx={{
                            width: 18,
                            height: 18,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#b08a3e",
                            opacity: selected ? 1 : 0,
                            transition: "opacity 240ms ease"
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
