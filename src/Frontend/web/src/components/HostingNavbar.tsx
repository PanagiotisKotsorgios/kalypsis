import { useState } from "react";
import { Box, Button, Container, Divider, Drawer, IconButton, Stack } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import { Link as RouterLink } from "react-router-dom";

const links = [
  { label: "Αρχική", href: "#hosting-home" },
  { label: "Πακέτα", href: "#hosting-plans" },
  { label: "Domain", to: "/hosting/register?topic=domain" },
  { label: "Χαρακτηριστικά", href: "/hosting#hosting-features" },
  { label: "Υποστήριξη", to: "/contact" },
  { label: "Επικοινωνία", to: "/contact" },
];

function HostingBrand() {
  return (
    <Box component={RouterLink} to="/hosting" aria-label="KALYPSIS Hosting — Αρχική" sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      <Box component="img" src="/images/hosting/kalypsis-hosting-logo.png" alt="KALYPSIS Hosting" sx={{ display: "block", width: { xs: 132, lg: 164 }, height: 48, objectFit: "contain" }} />
    </Box>
  );
}

export function HostingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <Box component="header" id="hosting-home" sx={{ position: "relative", zIndex: 30, bgcolor: "rgba(255,255,255,.97)", borderBottom: "1px solid #DCE8F4", boxShadow: "0 6px 22px rgba(8,42,91,.06)" }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 4 }, minHeight: { xs: 68, md: 76 }, display: "flex", alignItems: "center", gap: { md: 2, lg: 4 } }}>
        <HostingBrand />
        <Stack component="nav" direction="row" alignItems="center" justifyContent="center" gap={{ md: 1.4, lg: 2.8 }} sx={{ display: { xs: "none", md: "flex" }, flex: 1 }}>
          {links.map((link, index) => (
            <Box key={link.label} component={link.to ? RouterLink : "a"} {...(link.to ? { to: link.to } : { href: link.href })} sx={{ position: "relative", py: 2.8, color: index === 0 ? "#1166DF" : "#102C54", textDecoration: "none", fontSize: { md: 13, lg: 14.5 }, fontWeight: index === 0 ? 850 : 700, whiteSpace: "nowrap", "&:after": index === 0 ? { content: '""', position: "absolute", height: 3, left: 0, right: 0, bottom: 13, borderRadius: 2, bgcolor: "#1166DF" } : undefined, "&:hover": { color: "#1166DF" } }}>{link.label}</Box>
          ))}
        </Stack>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ display: { xs: "none", md: "flex" }, flexShrink: 0 }}>
          <IconButton component={RouterLink} to="/hosting#hosting-plans" aria-label="Πακέτα φιλοξενίας" sx={{ color: "#082A5B" }}><ShoppingCartOutlinedIcon /></IconButton>
          <Button component={RouterLink} to="/hosting/dashboard" startIcon={<DashboardOutlinedIcon />} sx={{ color: "#16416B", textTransform: "none", fontWeight: 800, whiteSpace: "nowrap" }}>Το αίτημά μου</Button>
          <Button component={RouterLink} to="/hosting/login" variant="outlined" sx={{ minWidth: 108, borderWidth: 1.5, borderColor: "#1766E8", color: "#1766E8", borderRadius: 2, py: 1.05, textTransform: "none", fontWeight: 850, "&:hover": { borderWidth: 1.5, borderColor: "#0F52C1", bgcolor: "#F0F6FF" } }}>Σύνδεση</Button>
          <Button component={RouterLink} to="/hosting/register" variant="contained" sx={{ minWidth: 110, bgcolor: "#1766E8", color: "#fff", borderRadius: 2, py: 1.1, textTransform: "none", fontWeight: 850, boxShadow: "none", "&:hover": { bgcolor: "#0F52C1", boxShadow: "none" } }}>Αίτημα</Button>
        </Stack>
        <IconButton aria-label="Άνοιγμα μενού φιλοξενίας" onClick={() => setOpen(true)} sx={{ display: { xs: "inline-flex", md: "none" }, ml: "auto", color: "#082A5B", border: "1px solid #D4E2F0", borderRadius: 2 }}><MenuIcon /></IconButton>
      </Container>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: "min(88vw, 360px)", bgcolor: "#F8FBFF" } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}><HostingBrand /><IconButton aria-label="Κλείσιμο μενού" onClick={() => setOpen(false)}><CloseIcon /></IconButton></Stack>
        <Divider />
        <Stack component="nav" spacing={.5} sx={{ p: 2 }}>
          {links.map(link => <Button key={link.label} component={link.to ? RouterLink : "a"} {...(link.to ? { to: link.to } : { href: link.href })} onClick={() => setOpen(false)} sx={{ justifyContent: "flex-start", py: 1.3, px: 1.5, color: "#102C54", textTransform: "none", fontWeight: 800 }}>{link.label}</Button>)}
        </Stack>
        <Divider sx={{ mx: 2 }} />
        <Stack spacing={1.25} sx={{ p: 2 }}><Button component={RouterLink} to="/hosting/dashboard" onClick={() => setOpen(false)} startIcon={<DashboardOutlinedIcon />} sx={{ textTransform: "none", fontWeight: 850 }}>Πίνακας αιτήματος</Button><Button component={RouterLink} to="/hosting/login" onClick={() => setOpen(false)} variant="outlined" sx={{ textTransform: "none", fontWeight: 850 }}>Σύνδεση</Button><Button component={RouterLink} to="/hosting/register" onClick={() => setOpen(false)} variant="contained" sx={{ bgcolor: "#1766E8", textTransform: "none", fontWeight: 850 }}>Αίτημα φιλοξενίας</Button></Stack>
      </Drawer>
    </Box>
  );
}
