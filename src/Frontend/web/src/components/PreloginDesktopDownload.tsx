import { Button, IconButton, Paper, Tooltip } from "@mui/material";
import InstallDesktopIcon from "@mui/icons-material/InstallDesktop";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DESKTOP_INSTALLER_URL } from "./DesktopDownloadButton";

/**
 * Persistent download action for every public/pre-login route. It intentionally
 * lives at App level so auth, marketing, contact and legal page layouts cannot
 * accidentally omit the desktop installer link.
 */
export function PreloginDesktopDownload() {
  const { t } = useTranslation();

  return (
    <Paper
      component="aside"
      elevation={8}
      sx={{
        position: "fixed",
        right: { xs: 12, sm: 22 },
        top: { xs: 78, sm: 104 },
        zIndex: (theme) => theme.zIndex.drawer + 1,
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        borderRadius: 2,
        border: "1px solid rgba(31,123,179,0.28)",
        bgcolor: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(10px)"
      }}
    >
      <Button
        component="a"
        href={DESKTOP_INSTALLER_URL}
        download="kalypsis-desktop-win-Setup.exe"
        startIcon={<InstallDesktopIcon />}
        sx={{
          px: { xs: 1.75, sm: 2.25 },
          py: 1.25,
          borderRadius: 0,
          bgcolor: "#0b2545",
          color: "#ffffff",
          fontSize: { xs: 12.5, sm: 13.5 },
          fontWeight: 800,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&:hover": { bgcolor: "#1d4e89" }
        }}
      >
        {t("landing.v2.desktop.cta")}
      </Button>
      <Tooltip title={t("landing.v2.desktop.moreOptions")}>
        <IconButton
          component={RouterLink}
          to="/download"
          aria-label={t("landing.v2.desktop.moreOptions") as string}
          sx={{ width: 46, borderRadius: 0, color: "#0b2545" }}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

export default PreloginDesktopDownload;
