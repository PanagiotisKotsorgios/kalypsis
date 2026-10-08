import { useEffect, useState } from "react";
import {
  AppBar, Box, Container, Drawer, IconButton, List, ListItem, ListItemButton,
  Stack, Toolbar
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import LoginIcon from "@mui/icons-material/LoginOutlined";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KalypsisLogo } from "./KalypsisLogo";
import { LanguageToggle } from "./LanguageToggle";

interface PublicNavProps {
  overlayHero?: boolean;
}

/**
 * Editorial public nav — paper background, hairline rule, slim type.
 */
export function PublicNav(_: PublicNavProps = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const mobileLinks = [
    { to: "/", labelKey: "publicNav.home" },
    { to: "/#features", labelKey: "publicNav.platform" },
    { to: "/pricing", labelKey: "publicNav.pricing" },
    { to: "/faq", labelKey: "footer.faq" },
    { to: "/contact", labelKey: "publicNav.contact" }
  ];
  const desktopLinks = mobileLinks.filter((l) => l.labelKey !== "publicNav.home");

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "var(--paper)",
          color: "var(--ink)",
          borderBottom: "1px solid",
          borderColor: scrolled ? "var(--rule)" : "transparent",
          transition: "border-color 360ms var(--ease-editorial)"
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, md: 5, lg: 6 } }}>
          <Toolbar
            disableGutters
            sx={{
              gap: 2,
              minHeight: { xs: 72, md: 92 },
              alignItems: "center"
            }}
          >
            <Box
              component="a"
              href="/"
              sx={{
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
                py: 0.5,
                transition: "opacity 360ms var(--ease-editorial)",
                "&:hover": { opacity: 0.88 }
              }}
            >
              <Box sx={{ display: { xs: "block", md: "none" } }}>
                <KalypsisLogo size={56} crop />
              </Box>
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <KalypsisLogo size={80} crop />
              </Box>
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Desktop nav links */}
            <Stack
              direction="row"
              spacing={{ md: 2.5, lg: 4 }}
              alignItems="center"
              sx={{ display: { xs: "none", md: "flex" } }}
            >
              {desktopLinks.map((link) => (
                <Box
                  key={link.to}
                  component="a"
                  href={link.to.startsWith("/#") ? link.to.replace("/", "") : link.to}
                  onClick={(e) => {
                    if (link.to.startsWith("/#")) {
                      e.preventDefault();
                      const id = link.to.split("#")[1];
                      const target = document.getElementById(id);
                      if (target) {
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                      } else if (location.pathname !== "/") {
                        window.location.href = link.to;
                      }
                    }
                  }}
                  sx={{
                    fontFamily: "var(--sans)",
                    fontSize: { md: 14.5, lg: 15.5 },
                    fontWeight: 500,
                    letterSpacing: "0.005em",
                    color: "var(--ink)",
                    textDecoration: "none",
                    position: "relative",
                    cursor: "pointer",
                    py: 1,
                    whiteSpace: "nowrap",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      left: 0, right: 0, bottom: 0,
                      height: "2px",
                      background: "var(--ink)",
                      transform: "scaleX(0)",
                      transformOrigin: "right",
                      transition: "transform 380ms var(--ease-editorial)"
                    },
                    "&:hover::after": {
                      transform: "scaleX(1)",
                      transformOrigin: "left"
                    }
                  }}
                >
                  {t(link.labelKey)}
                </Box>
              ))}
            </Stack>

            {/* Desktop CTAs */}
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { xs: "none", md: "flex" }, ml: { md: 2.5, lg: 4 } }}>
              <Box sx={{
                "& .MuiButton-root": {
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  color: "var(--ink)"
                }
              }}>
                <LanguageToggle />
              </Box>
              <RouterLink
                to="/login"
                className="ghost-button"
                style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap" }}
              >
                <LoginIcon style={{ fontSize: 17 }} />
                <span>{t("publicNav.signIn")}</span>
              </RouterLink>
              <RouterLink
                to="/register"
                className="ink-button"
                style={{ padding: "13px 22px", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap" }}
              >
                <span>{t("publicNav.tryFree")}</span>
                <ArrowOutwardIcon style={{ fontSize: 17 }} />
              </RouterLink>
            </Stack>

            {/* Mobile hamburger — bigger touch target */}
            <IconButton
              onClick={() => setOpen(true)}
              sx={{
                display: { xs: "inline-flex", md: "none" },
                color: "var(--ink)",
                width: 44,
                height: 44,
                border: "1px solid var(--rule)",
                borderRadius: 0,
                "& svg": { fontSize: 24 }
              }}
              edge="end"
              aria-label="menu"
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      {/*
       * The Drawer renders in a React portal OUTSIDE the <PublicShell> .editorial
       * scope, so CSS variables like var(--paper) don't resolve there. We give the
       * Paper an explicit cream background and wrap its contents in `editorial` so
       * the type variables (display, sans, ink, gold…) and the buttons read
       * correctly inside the drawer too.
       */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "min(86vw, 380px)", sm: 380 },
            backgroundColor: "#f5ede1",  // paper, literal
            borderLeft: "1px solid #d6c6ab",
            boxShadow: "0 0 0 100vmax rgba(11,37,69,0.32)"
          }
        }}
        ModalProps={{
          BackdropProps: {
            sx: { backgroundColor: "rgba(11,37,69,0.42)" }
          }
        }}
      >
        <Box className="editorial" sx={{ p: 3.5, height: "100%", backgroundColor: "#f5ede1" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={5}>
            <KalypsisLogo size={56} crop />
            <IconButton
              onClick={() => setOpen(false)}
              sx={{
                color: "var(--ink)",
                width: 44,
                height: 44,
                border: "1px solid var(--rule)",
                borderRadius: 0,
                "& svg": { fontSize: 22 }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          <List sx={{ borderTop: "1px solid var(--ink)", p: 0 }}>
            {mobileLinks.map((link) => (
              <ListItem key={link.to} disablePadding sx={{ borderBottom: "1px solid var(--rule)" }}>
                <ListItemButton
                  onClick={() => {
                    setOpen(false);
                    if (link.to.startsWith("/#")) {
                      const id = link.to.split("#")[1];
                      setTimeout(() => {
                        const target = document.getElementById(id);
                        if (target) target.scrollIntoView({ behavior: "smooth" });
                      }, 60);
                    }
                  }}
                  component={RouterLink}
                  to={link.to.startsWith("/#") ? "/" : link.to}
                  sx={{
                    py: 2.5,
                    px: 1,
                    fontFamily: "var(--display)",
                    fontStyle: "italic",
                    fontSize: 22,
                    color: "var(--ink)",
                    transition: "color 280ms var(--ease-editorial), background 280ms var(--ease-editorial)",
                    "&:hover": {
                      color: "var(--terracotta)",
                      backgroundColor: "rgba(176, 138, 62, 0.06)"
                    }
                  }}
                >
                  {t(link.labelKey)}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Stack spacing={1.5} mt={5}>
            <RouterLink
              to="/login"
              className="ghost-button"
              onClick={() => setOpen(false)}
              style={{ fontSize: 15, fontWeight: 700, padding: "16px 24px", width: "100%", boxSizing: "border-box" }}
            >
              <LoginIcon style={{ fontSize: 19 }} />
              <span>{t("publicNav.signIn")}</span>
            </RouterLink>
            <RouterLink
              to="/register"
              className="ink-button"
              onClick={() => setOpen(false)}
              style={{ fontSize: 15, fontWeight: 700, padding: "17px 26px", width: "100%", boxSizing: "border-box" }}
            >
              <span>{t("publicNav.tryFree")}</span>
              <ArrowOutwardIcon style={{ fontSize: 19 }} />
            </RouterLink>
            <Box pt={3} sx={{ borderTop: "1px solid var(--rule)", mt: 2 }}>
              <LanguageToggle />
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
