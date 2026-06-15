import { useEffect, useState } from "react";
import { Box, Button, Container, Slide, Stack, Typography } from "@mui/material";
import CookieIcon from "@mui/icons-material/Cookie";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "kalypsis_cookie_consent";

type Choice = "all" | "necessary";

export function CookieBanner() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // hide on authenticated app routes
    if (location.pathname.startsWith("/app")) {
      setOpen(false);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // tiny delay so it doesn't fight the page reveal
      const tm = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(tm);
    }
  }, [location.pathname]);

  const choose = (choice: Choice) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ choice, at: new Date().toISOString() })
    );
    setOpen(false);
  };

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        role="dialog"
        aria-label="Cookie consent"
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.modal + 1,
          bgcolor: "rgba(11, 26, 54, 0.97)",
          backdropFilter: "blur(10px)",
          color: "common.white",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 -16px 40px rgba(0,0,0,0.25)"
        }}
      >
        <Container maxWidth="lg" sx={{ py: 2.5 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 2, md: 3 }}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  bgcolor: "secondary.main",
                  color: "common.white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <CookieIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, mb: 0.3 }}>
                  {t("cookieBanner.title")}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, lineHeight: 1.55 }}>
                  {t("cookieBanner.body")}{" "}
                  <Box
                    component={RouterLink}
                    to="/cookies"
                    sx={{
                      color: "secondary.light",
                      textDecoration: "underline",
                      fontWeight: 600
                    }}
                  >
                    {t("cookieBanner.learnMore")}
                  </Box>
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexShrink: 0 }}>
              <Button
                onClick={() => choose("necessary")}
                variant="outlined"
                sx={{
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.4)",
                  "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.05)" }
                }}
              >
                {t("cookieBanner.rejectAll")}
              </Button>
              <Button
                onClick={() => choose("all")}
                variant="contained"
                color="secondary"
                sx={{ fontWeight: 700 }}
              >
                {t("cookieBanner.acceptAll")}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Slide>
  );
}
