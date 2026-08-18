import { Link as RouterLink } from "react-router-dom";
import { AppBar, Box, Button, IconButton, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { ErmesPage } from "./ErmesPage";
import { NotificationBell } from "../components/NotificationBell";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { useAuth } from "../auth/AuthContext";

/**
 * Standalone shell for ΕΡΜΗΣ. Renders the same ErmesPage that lives inside
 * the app (/app/ermes) but WITHOUT the main app sidebar — so operators who
 * open ΕΡΜΗΣ from the sidebar in a new browser tab get a focused messaging
 * workspace, not a duplicate copy of the whole Kalypsis chrome. Only
 * ΕΡΜΗΣ's own internal navigation (folders / teams / contacts panel from
 * ErmesPage itself) is visible in the sidebar area, which is exactly what
 * users asked for.
 *
 * The top bar keeps a minimal "back to Kalypsis" link so a user who opened
 * this in the current tab (e.g. via URL paste) isn't stranded.
 */
export function ErmesStandalonePage() {
  const { user, signOut } = useAuth();
  const openMainApp = () => {
    window.open("/app", "_blank", "noopener,noreferrer");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="default" elevation={1}
        sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
        <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 52 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <KalypsisLogo size={26} />
            <MailOutlineIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: "0.02em" }}>
              ΕΡΜΗΣ
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
              · κρυπτογραφημένη επικοινωνία
            </Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          {user && (
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
              {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email}
            </Typography>
          )}
          <NotificationBell />
          <Tooltip title="Άνοιγμα Kalypsis σε νέα καρτέλα">
            <Button size="small" startIcon={<OpenInNewIcon />}
              onClick={openMainApp} variant="outlined">
              Kalypsis
            </Button>
          </Tooltip>
          <Tooltip title="Επιστροφή στο Kalypsis σε αυτή την καρτέλα">
            <Button size="small" component={RouterLink} to="/app" color="inherit">
              /app
            </Button>
          </Tooltip>
          <Tooltip title="Αποσύνδεση">
            <IconButton size="small" onClick={() => { void signOut(); }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <ErmesPage />
      </Box>
    </Box>
  );
}
