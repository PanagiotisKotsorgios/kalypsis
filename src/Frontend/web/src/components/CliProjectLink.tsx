import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import { useTranslation } from "react-i18next";

export const CLI_REPOSITORY = "https://github.com/PanagiotisKotsorgios/kalypsis-cli";
export const cliContributionUrl = (english: boolean) => `${CLI_REPOSITORY}/blob/main/CONTRIBUTING${english ? "" : ".el"}.md`;

/** Repository navigation only: the CLI is not an available download yet. */
export function CliProjectLink() {
  const { i18n } = useTranslation();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  return <Tooltip arrow placement="bottom" enterTouchDelay={350} title={<Box sx={{ p: .75, maxWidth: 250 }}>
    <Typography sx={{ fontWeight: 850, fontSize: 14, mb: .5 }}>KALYPSIS CLI · GitHub</Typography>
    <Typography sx={{ fontSize: 12, lineHeight: 1.6 }}>{english ? "Explore the repository for the planned Windows command-line project and its contribution guidelines. The CLI is not available yet." : "Γνωρίστε το αποθετήριο του υπό προετοιμασία έργου γραμμής εντολών για Windows και τις οδηγίες συνεισφοράς. Το CLI δεν είναι ακόμη διαθέσιμο."}</Typography>
  </Box>} slotProps={{ tooltip: { sx: { bgcolor: "#102D55", color: "#fff", border: "1px solid #456B91", borderRadius: 2, boxShadow: "0 8px 26px rgba(11,37,69,.22)" } }, arrow: { sx: { color: "#102D55" } } }}>
    <IconButton component="a" href={CLI_REPOSITORY} target="_blank" rel="noopener noreferrer" aria-label={english ? "KALYPSIS CLI repository on GitHub (new tab)" : "Αποθετήριο KALYPSIS CLI στο GitHub (νέα καρτέλα)"} sx={{ width: 36, height: 36, flexShrink: 0, color: "#0B305C", border: "1px solid #C5D7E9", borderRadius: 1.5, "&:hover": { bgcolor: "#E5EFFB", borderColor: "#456B91" } }}><GitHubIcon sx={{ fontSize: 22 }} /></IconButton>
  </Tooltip>;
}
