import { useEffect, useState } from "react";
import {
  Box, Button, Stack, Typography, type SxProps, type Theme
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import HistoryIcon from "@mui/icons-material/History";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

const RELEASE_REPO = "PanagiotisKotsorgios/kalypsis-desktop-releases";

export const DESKTOP_INSTALLER_URL =
  `https://github.com/${RELEASE_REPO}/releases/latest/download/kalypsis-desktop-win-Setup.exe`;
export const DESKTOP_PORTABLE_URL =
  `https://github.com/${RELEASE_REPO}/releases/latest/download/kalypsis-desktop-win-Portable.zip`;
export const DESKTOP_RELEASES_PATH = "/download/releases";
export const DESKTOP_SERVER_SETUP_URL =
  `https://github.com/${RELEASE_REPO}/releases/latest/download/Setup-KalypsisServer.ps1`;
export const DESKTOP_CLIENT_SETUP_URL =
  `https://github.com/${RELEASE_REPO}/releases/latest/download/Setup-KalypsisClient.ps1`;
export const DESKTOP_DEPLOYMENT_GUIDE_URL =
  `https://github.com/${RELEASE_REPO}/releases/latest/download/DEPLOYMENT.md`;

export interface DesktopDownloadButtonProps {
  size?: "small" | "medium" | "large";
  showAlternatives?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Stable desktop download controls. The `/latest/download/...` URLs keep the
 * web app unchanged when a new GitHub release is published.
 */
export function DesktopDownloadButton({
  size = "large",
  showAlternatives = true,
  sx
}: DesktopDownloadButtonProps) {
  const { t } = useTranslation();
  const [isWindows, setIsWindows] = useState(true);

  useEffect(() => {
    setIsWindows(/windows|win32|win64/i.test(navigator.userAgent));
  }, []);

  return (
    <Stack spacing={1.5} alignItems="flex-start" sx={sx}>
      <Button
        component="a"
        href={DESKTOP_INSTALLER_URL}
        download="kalypsis-desktop-win-Setup.exe"
        variant="contained"
        size={size}
        startIcon={<DownloadIcon />}
        sx={{
          px: 3,
          py: 1.25,
          borderRadius: 2,
          fontWeight: 800,
          textTransform: "none",
          boxShadow: "0 4px 12px rgba(31,123,179,0.25)",
          "&:hover": { boxShadow: "0 6px 16px rgba(31,123,179,0.35)" }
        }}
      >
        {t("landing.v2.desktop.cta")}
        <Box component="span" sx={{ ml: 1.5, opacity: 0.82, fontSize: 12, fontWeight: 500 }}>
          {t("landing.v2.desktop.installerMeta")}
        </Box>
      </Button>

      {showAlternatives && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ xs: "flex-start", sm: "center" }}>
          <Button
            component="a"
            href={DESKTOP_PORTABLE_URL}
            download="kalypsis-desktop-win-Portable.zip"
            size="small"
            startIcon={<FolderZipOutlinedIcon fontSize="small" />}
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            {t("landing.v2.desktop.portable")}
          </Button>
          <Button
            component={RouterLink}
            to={DESKTOP_RELEASES_PATH}
            size="small"
            startIcon={<HistoryIcon fontSize="small" />}
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            {t("landing.v2.desktop.allReleases")}
          </Button>
        </Stack>
      )}

      {!isWindows && (
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ maxWidth: 460 }}>
          <InfoOutlinedIcon sx={{ fontSize: 18, color: "text.secondary", mt: 0.2 }} />
          <Typography variant="caption" color="text.secondary">
            {t("landing.v2.desktop.windowsOnly")}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

export default DesktopDownloadButton;
