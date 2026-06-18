import { useEffect, useState } from "react";
import {
  AppBar, Box, Container, Drawer, IconButton, List, ListItem, ListItemButton,
  Stack, Toolbar
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
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
        <Container maxWidth="lg">
          <Toolbar
            disableGutters
            sx={{
              gap: 2,
              minHeight: { xs: 76, md: 100 },
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
                <KalypsisLogo size={84} crop />
              </Box>
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Desktop nav links */}
            <Stack
              direction="row"
              spacing={4}
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
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    color: "var(--ink)",
                    textDecoration: "none",
                    position: "relative",
                    cursor: "pointer",
                    py: 1,
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      left: 0, right: 0, bottom: 4,
                      height: "1px",
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
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { xs: "none", md: "flex" }, ml: 3 }}>
              <Box sx={{
                "& .MuiButton-root": {
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  color: "var(--ink)"
                }
              }}>
                <LanguageToggle />
              </Box>
              <RouterLink to="/login" className="ghost-button" style={{ padding: "10px 18px", fontSize: 13 }}>
                <span>{t("publicNav.signIn")}</span>
              </RouterLink>
              <RouterLink to="/register" className="ink-button" style={{ padding: "11px 20px", fontSize: 13 }}>
                <span>{t("publicNav.register")}</span>
              </RouterLink>
            </Stack>

            {/* Mobile hamburger */}
            <IconButton
              onClick={() => setOpen(true)}
              sx={{ display: { xs: "inline-flex", md: "none" }, color: "var(--ink)" }}
              edge="end"
              aria-label="menu"
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 320, bgcolor: "var(--paper)" } }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
            <KalypsisLogo size={56} crop />
            <IconButton onClick={() => setOpen(false)} sx={{ color: "var(--ink)" }}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <List sx={{ borderTop: "1px solid var(--ink)" }}>
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
                    fontFamily: "var(--display)",
                    fontStyle: "italic",
                    fontSize: 22,
                    color: "var(--ink)"
                  }}
                >
                  {t(link.labelKey)}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Stack spacing={1.5} mt={4}>
            <RouterLink to="/login" className="ghost-button" onClick={() => setOpen(false)}>
              <span>{t("publicNav.signIn")}</span>
            </RouterLink>
            <RouterLink to="/register" className="ink-button" onClick={() => setOpen(false)}>
              <span>{t("publicNav.register")}</span>
            </RouterLink>
            <Box pt={2}>
              <LanguageToggle />
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
