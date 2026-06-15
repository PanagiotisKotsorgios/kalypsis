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
  /** Use transparent background when at the top, solid after scroll. */
  overlayHero?: boolean;
}

export function PublicNav({ overlayHero = false }: PublicNavProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!overlayHero) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlayHero]);

  const navLinks = [
    { to: "/", labelKey: "publicNav.home" },
    { to: "/#features", labelKey: "publicNav.platform" },
    { to: "/#for-agencies", labelKey: "publicNav.forAgencies" },
    { to: "/#for-agents", labelKey: "publicNav.forAgents" },
    { to: "/#pricing", labelKey: "publicNav.pricing" },
    { to: "/#contact", labelKey: "publicNav.contact" }
  ];

  const transparent = overlayHero && !scrolled;
  const textColor = transparent ? "common.white" : "text.primary";

  return (
    <>
      <AppBar
        position={overlayHero ? "fixed" : "sticky"}
        elevation={transparent ? 0 : 1}
        sx={{
          bgcolor: transparent ? "transparent" : "rgba(255,255,255,0.96)",
          backdropFilter: transparent ? "none" : "saturate(180%) blur(10px)",
          color: textColor,
          transition: "background-color 250ms ease, box-shadow 250ms ease, color 250ms ease",
          borderBottom: transparent ? "none" : "1px solid",
          borderColor: "rgba(11,37,69,0.06)"
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ py: { xs: 1, md: 1.5 }, gap: 2 }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit" }}
            >
              <KalypsisLogo size={56} color={transparent ? "light" : "default"} />
            </Box>

            <Box sx={{ flex: 1 }} />

            <Stack
              direction="row"
              spacing={3}
              alignItems="center"
              sx={{ display: { xs: "none", md: "flex" } }}
            >
              {navLinks.map((link) => (
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
                    color: "inherit",
                    textDecoration: "none",
                    fontWeight: 500,
                    fontSize: 15,
                    opacity: 0.92,
                    cursor: "pointer",
                    "&:hover": { opacity: 1, color: transparent ? "common.white" : "primary.main" }
                  }}
                >
                  {t(link.labelKey)}
                </Box>
              ))}
            </Stack>

            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ display: { xs: "none", md: "flex" } }}
            >
              <LanguageToggle />
              <Button
                component={RouterLink}
                to="/login"
                variant="text"
                color="inherit"
                sx={{ fontWeight: 600 }}
              >
                {t("publicNav.signIn")}
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color={transparent ? "secondary" : "primary"}
                sx={{ fontWeight: 700, px: 2.4 }}
              >
                {t("publicNav.register")}
              </Button>
            </Stack>

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

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: 300 } }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <KalypsisLogo size={44} />
            <IconButton onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <List>
            {navLinks.map((link) => (
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
