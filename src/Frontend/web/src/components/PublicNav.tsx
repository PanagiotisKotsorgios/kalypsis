import { useEffect, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KalypsisLogo } from "./KalypsisLogo";
import { LanguageToggle } from "./LanguageToggle";

interface PublicNavProps {
  /** Deprecated — kept for backwards compatibility; nav is always solid white now. */
  overlayHero?: boolean;
}

export function PublicNav(_: PublicNavProps = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Deepen the shadow once the user scrolls a few pixels so the nav has a clear lift.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Shared link set (no Για Γραφεία / Για Ασφαλιστές on either platform).
  const mobileLinks = [
    { to: "/", labelKey: "publicNav.home" },
    { to: "/#features", labelKey: "publicNav.platform" },
    { to: "/#pricing", labelKey: "publicNav.pricing" },
    { to: "/contact", labelKey: "publicNav.contact" }
  ];
  // Desktop additionally drops Αρχική (the logo already routes home).
  const desktopLinks = mobileLinks.filter((l) => l.labelKey !== "publicNav.home");

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "common.white",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: scrolled ? "transparent" : "rgba(11,37,69,0.08)",
          boxShadow: scrolled
            ? "0 10px 30px -16px rgba(11,37,69,0.25)"
            : "none",
          transition: "box-shadow 250ms ease, border-color 250ms ease"
        }}
      >
        <Container maxWidth="lg">
          <Toolbar
            disableGutters
            sx={{
              gap: 2,
              minHeight: { xs: 72, md: 92 },
              alignItems: "center"
            }}
          >
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
                py: 1
              }}
            >
              <KalypsisLogo size={64} />
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Desktop nav links */}
            <Stack
              direction="row"
              spacing={0.5}
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
                    position: "relative",
                    px: 2.25,
                    py: 1.25,
                    mx: 0.4,
                    borderRadius: 1.5,
                    color: "text.primary",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 17,
                    letterSpacing: 0.2,
                    cursor: "pointer",
                    transition: "color 200ms ease, background-color 200ms ease",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      left: "50%",
                      bottom: 4,
                      width: 0,
                      height: 2,
                      bgcolor: "primary.main",
                      borderRadius: 1,
                      transform: "translateX(-50%)",
                      transition: "width 240ms ease"
                    },
                    "&:hover": {
                      color: "primary.main",
                      bgcolor: "rgba(11,37,69,0.05)",
                      "&::after": { width: "60%" }
                    }
                  }}
                >
                  {t(link.labelKey)}
                </Box>
              ))}
            </Stack>

            {/* Desktop CTAs */}
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ display: { xs: "none", md: "flex" }, ml: 2 }}
            >
              <LanguageToggle />
              <Button
                component={RouterLink}
                to="/login"
                variant="text"
                color="primary"
                sx={{
                  fontWeight: 700,
                  fontSize: 17,
                  px: 3,
                  py: 1.4,
                  borderRadius: 1.5,
                  "&:hover": { bgcolor: "rgba(11,37,69,0.05)" }
                }}
              >
                {t("publicNav.signIn")}
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color="primary"
                disableElevation
                sx={{
                  fontWeight: 700,
                  fontSize: 17,
                  px: 4.25,
                  py: 1.5,
                  borderRadius: 1.5,
                  boxShadow: "0 8px 20px -10px rgba(11,37,69,0.45)",
                  "&:hover": {
                    boxShadow: "0 14px 28px -12px rgba(11,37,69,0.55)",
                    transform: "translateY(-1px)"
                  },
                  transition: "transform 200ms ease, box-shadow 200ms ease"
                }}
              >
                {t("publicNav.register")}
              </Button>
            </Stack>

            {/* Mobile hamburger (unchanged) */}
            <IconButton
              onClick={() => setOpen(true)}
              sx={{ display: { xs: "inline-flex", md: "none" }, color: "inherit" }}
              edge="end"
              aria-label="menu"
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile drawer (unchanged) */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: 300 } }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <KalypsisLogo size={44} />
            <IconButton onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <List>
            {mobileLinks.map((link) => (
              <ListItem key={link.to} disablePadding>
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
                >
                  <ListItemText primary={t(link.labelKey)} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1}>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              fullWidth
              onClick={() => setOpen(false)}
            >
              {t("publicNav.signIn")}
            </Button>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              fullWidth
              onClick={() => setOpen(false)}
            >
              {t("publicNav.register")}
            </Button>
            <Box pt={1}>
              <LanguageToggle />
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
