import { useTranslation } from "react-i18next";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

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
    >
      <ToggleButton value="el" aria-label="Greek">
        EL
      </ToggleButton>
      <ToggleButton value="en" aria-label="English">
        EN
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
