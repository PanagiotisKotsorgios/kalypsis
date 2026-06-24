import { Alert, Box, Button, Stack, Typography, useTheme } from "@mui/material";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

/**
 * Phase 7 — Top-of-screen banner shown when a PlatformAdmin is logged in
 * as another user. Distinct from <ImpersonationBanner> which only sets a
 * tenant header; this one means the admin is fully authenticated as the
 * target user.
 */
export function UserImpersonationBanner() {
  const { t } = useTranslation();
  const { isImpersonatingUser, impersonatorEmail, user, endUserImpersonation } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  if (!isImpersonatingUser || !user) return null;

  return (
    <Box sx={{
      position: "sticky",
      top: 0,
      zIndex: theme.zIndex.appBar + 2
    }}>
      <Alert
        severity="error"
        icon={<PersonOffIcon />}
        sx={{
          borderRadius: 0,
          alignItems: "center",
          bgcolor: "#7a2a1c",
          color: "#fff5e6",
          "& .MuiAlert-icon": { color: "#ffd27a" },
          "& .MuiAlert-message": { width: "100%" }
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              {t("userImpersonation.viewingAs", { email: user.email, role: user.role })}
            </Typography>
            <Typography sx={{ fontSize: 12, opacity: 0.9 }}>
              {t("userImpersonation.startedBy", { email: impersonatorEmail ?? "—" })}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            startIcon={<LogoutIcon />}
            sx={{ bgcolor: "#fff5e6", color: "#7a2a1c", "&:hover": { bgcolor: "#ffd27a" } }}
            onClick={async () => {
              await endUserImpersonation();
              navigate("/app/all-users", { replace: true });
            }}
          >
            {t("userImpersonation.exit")}
          </Button>
        </Stack>
      </Alert>
    </Box>
  );
}
