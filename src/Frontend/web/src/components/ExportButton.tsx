import { Button, Tooltip } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { useTranslation } from "react-i18next";

/**
 * Renders a "Λήψη Excel" anchor that hits a CSV endpoint. The backend returns
 * UTF-8 BOM CSV which Excel opens natively in Greek without the import wizard.
 */
export function ExportButton({ href, label }: { href: string; label?: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip title={t("common.exportToExcel")}>
      <Button
        component="a"
        href={href}
        startIcon={<DownloadIcon />}
        variant="outlined"
        size="small"
      >
        {label ?? t("common.exportToExcel")}
      </Button>
    </Tooltip>
  );
}
