import { Button, Paper } from "@mui/material";
import InstallDesktopIcon from "@mui/icons-material/InstallDesktop";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DESKTOP_INSTALLER_URL } from "./DesktopDownloadButton";

/**
 * In-flow public download actions. Render below the contact/navigation row so
 * they scroll away with the header and never cover page content.
 */
export function PreloginDesktopDownload() {
  const { t } = useTranslation();

  return (
    <Paper
      component="aside"
      elevation={0}
      sx={{
        position: "static",
        display: "inline-flex",
        flexDirection: { xs: "column", sm: "row" },
        width: { xs: "100%", sm: "auto" },
        maxWidth: "100%",
        alignItems: "stretch",
        overflow: "hidden",
        borderRadius: 2,
        border: "1px solid rgba(31,123,179,0.28)",
        bgcolor: "#ffffff",
        boxShadow: "0 5px 16px rgba(11,37,69,0.10)"
      }}
    >
      <Button
        data-desktop-download-action
        component="a"
        href={DESKTOP_INSTALLER_URL}
        download="kalypsis-desktop-win-Setup.exe"
        startIcon={<InstallDesktopIcon />}
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.75,
          minHeight: 60,
          borderRadius: 0,
          bgcolor: "#0b2545",
          color: "#ffffff",
          fontSize: { xs: 17, sm: 19 },
          fontWeight: 800,
          textTransform: "none",
          whiteSpace: "nowrap",
          "& .MuiButton-startIcon svg": { fontSize: 27 },
          "&:hover": { bgcolor: "#1d4e89" }
        }}
      >
        {t("landing.v2.desktop.cta")}
      </Button>
      <Button
        data-desktop-download-action
        component={RouterLink}
        to="/download"
        startIcon={<InfoOutlinedIcon />}
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.5,
          minHeight: 56,
          borderRadius: 0,
          color: "#0b2545",
          bgcolor: "#e1effd",
          fontSize: { xs: 15, sm: 16 },
          fontWeight: 700,
          textTransform: "none",
          lineHeight: 1.4,
          "&:hover": { bgcolor: "#d0e4fa" }
        }}
      >
        {t("landing.v2.desktop.moreInformation")}
      </Button>
    </Paper>
  );
}

export default PreloginDesktopDownload;
