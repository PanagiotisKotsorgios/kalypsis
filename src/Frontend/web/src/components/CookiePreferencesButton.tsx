import { IconButton, Tooltip } from "@mui/material";
import CookieIcon from "@mui/icons-material/Cookie";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Persistent cookie-preferences launcher for pre-login pages. Mirrors
// AccessibilityWidget's visual language (56px navy circle) and stacks
// directly above it in the bottom-right corner. Clicking dispatches
// a window event; CookieBanner listens and reopens itself in granular mode.

export const COOKIE_SETTINGS_EVENT = "kalypsis:open-cookie-settings";

export function CookiePreferencesButton() {
  const { t } = useTranslation();
  const location = useLocation();

  // Match CookieBanner's rule — authenticated app routes never show it.
  if (location.pathname.startsWith("/app")) return null;

  const openSettings = () => {
    window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_EVENT));
  };

  return (
    <Tooltip
      title={t("cookieBanner.reopenLabel", "Ρυθμίσεις cookies")}
      placement="left"
      arrow
    >
      <IconButton
        aria-label={t("cookieBanner.reopenAria", "Άνοιγμα ρυθμίσεων cookies")}
        aria-haspopup="dialog"
        onClick={openSettings}
        sx={{
          // Stacks directly above AccessibilityWidget (which is at bottom: 16,
          // height 56). 16 + 56 + 12 = 84 gives a 12px gap between the two.
          position: "fixed", right: 16, bottom: 84, zIndex: 1500,
          width: 56, height: 56, borderRadius: "50%",
          bgcolor: "#0b2545", color: "#fff",
          boxShadow: "0 10px 30px rgba(11,37,69,0.25), 0 2px 8px rgba(11,37,69,0.20)",
          "&:hover": { bgcolor: "#1f7bb3" },
          "&:focus-visible": { outline: "3px solid #6fd2ff", outlineOffset: 2 }
        }}
      >
        <CookieIcon sx={{ fontSize: 28 }} />
      </IconButton>
    </Tooltip>
  );
}
