import { useTranslation } from "react-i18next";
import { Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { AmericanFlag, GreekFlag } from "./Flags";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage?.startsWith("en") ? "en" : "el";

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={current}
      onChange={(_, next: string | null) => {
        if (next) void i18n.changeLanguage(next);
      }}
      aria-label="language"
      sx={{
        "& .MuiToggleButton-root": {
          px: 1.25,
          py: 0.65,
          textTransform: "none",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: 0.5,
          color: "text.secondary",
          borderColor: "rgba(11,37,69,0.18)",
          gap: 0.75,
          transition: "background-color 180ms ease, color 180ms ease"
        },
        "& .MuiToggleButton-root:hover": {
          bgcolor: "rgba(11,37,69,0.06)"
        },
        "& .MuiToggleButton-root.Mui-selected": {
          bgcolor: "primary.main",
          color: "common.white",
          borderColor: "primary.main",
          "&:hover": { bgcolor: "primary.dark" }
        }
      }}
    >
      <ToggleButton value="el" aria-label="Ελληνικά">
        <Stack direction="row" spacing={0.75} alignItems="center">
          <GreekFlag size={18} />
          <span>EL</span>
        </Stack>
      </ToggleButton>
      <ToggleButton value="en" aria-label="English">
        <Stack direction="row" spacing={0.75} alignItems="center">
          <AmericanFlag size={18} />
          <span>EN</span>
        </Stack>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
