import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import EmailIcon from "@mui/icons-material/Email";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import VerifiedIcon from "@mui/icons-material/Verified";
import ShieldIcon from "@mui/icons-material/Shield";
import LanguageIcon from "@mui/icons-material/Language";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import FacebookIcon from "@mui/icons-material/Facebook";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KalypsisLogo } from "./KalypsisLogo";
import { api } from "../api/client";

export function PublicFooter() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus("err");
      setErrMsg(t("footer.newsletter.invalidEmail"));
      return;
    }
    setSubmitting(true);
    setStatus("idle");
    setErrMsg(null);
    try {
      await api.post("/public/newsletter", { email: email.trim() });
      setStatus("ok");
      setEmail("");
    } catch {
      setStatus("err");
      setErrMsg(t("footer.newsletter.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="footer" sx={{ bgcolor: "#061a36", color: "rgba(255,255,255,0.85)" }}>
      {/* Newsletter strip */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #0b2545 0%, #13315c 100%)",
          py: { xs: 5, md: 6 },
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gap: 4,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1.2fr" },
              alignItems: "center"
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <EmailIcon sx={{ color: "secondary.main", fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: "common.white" }}>
                  {t("footer.newsletter.title")}
                </Typography>
              </Stack>
              <Typography sx={{ opacity: 0.78, fontSize: 14, maxWidth: 460 }}>
                {t("footer.newsletter.subtitle")}
              </Typography>
            </Stack>
            <Box component="form" onSubmit={subscribe}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  fullWidth
                  type="email"
                  placeholder={t("footer.newsletter.placeholder")}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
                  disabled={submitting}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "rgba(255,255,255,0.92)",
                      borderRadius: 2,
                      "& fieldset": { border: "none" }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="secondary"
                  disabled={submitting}
                  endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  sx={{ px: 4, py: 1.5, fontWeight: 700, whiteSpace: "nowrap" }}
                >
                  {t("footer.newsletter.cta")}
                </Button>
              </Stack>
              {status === "ok" && (
                <Alert severity="success" variant="filled" sx={{ mt: 2 }} onClose={() => setStatus("idle")}>
                  {t("footer.newsletter.success")}
                </Alert>
              )}
              {status === "err" && errMsg && (
                <Alert severity="error" variant="filled" sx={{ mt: 2 }} onClose={() => setStatus("idle")}>
                  {errMsg}
                </Alert>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Main grid */}
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 8 }, pb: 4 }}>
        <Box
          sx={{
            display: "grid",
            gap: 5,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1.6fr 1fr 1fr 1fr 1fr" }
          }}
        >
          {/* Brand column */}
          <Stack spacing={2}>
            <KalypsisLogo size={64} color="light" />
            <Typography variant="body2" sx={{ opacity: 0.78, maxWidth: 360, lineHeight: 1.7 }}>
              {t("footer.intro")}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <SocialIcon href="https://github.com/PanagiotisKotsorgios/kalypsis" icon={<GitHubIcon fontSize="small" />} />
              <SocialIcon href="#" icon={<LinkedInIcon fontSize="small" />} />
              <SocialIcon href="#" icon={<FacebookIcon fontSize="small" />} />
            </Stack>
            <Stack direction="row" spacing={2} mt={2} alignItems="center" sx={{ opacity: 0.85 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <VerifiedIcon sx={{ color: "#7be295", fontSize: 18 }} />
                <Typography variant="caption">GDPR Ready</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ShieldIcon sx={{ color: "#7be295", fontSize: 18 }} />
                <Typography variant="caption">ISO 27001</Typography>
              </Stack>
            </Stack>
          </Stack>

          <FooterColumn
            heading={t("footer.product")}
            links={[
              { to: "/#features", label: t("publicNav.platform") },
              { to: "/pricing", label: t("publicNav.pricing") },
              { to: "/faq", label: t("footer.faq") },
              { to: "/#for-agencies", label: t("publicNav.forAgencies") },
              { to: "/#for-agents", label: t("publicNav.forAgents") }
            ]}
          />

          <FooterColumn
            heading={t("footer.company")}
            links={[
              { to: "/contact", label: t("publicNav.contact") },
              { to: "/contact?type=press", label: t("footer.press") },
              { to: "/contact?type=careers", label: t("footer.careers") },
              { to: "/register", label: t("publicNav.register") },
              { to: "/login", label: t("publicNav.signIn") }
            ]}
          />

          <FooterColumn
            heading={t("footer.legal")}
            links={[
              { to: "/terms", label: t("footer.terms") },
              { to: "/privacy", label: t("footer.privacy") },
              { to: "/cookies", label: t("footer.cookies") },
              { to: "/contact?type=privacy", label: t("footer.dpo") }
            ]}
          />

          <Stack spacing={1.5}>
            <Typography sx={{ color: "common.white", fontWeight: 700, letterSpacing: 0.5, mb: 1 }}>
              {t("footer.contact")}
            </Typography>
            <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ opacity: 0.85, fontSize: 14 }}>
              <LocationOnIcon fontSize="small" sx={{ mt: 0.3, color: "rgba(255,255,255,0.6)" }} />
              <Box>Λ. Κηφισίας 268<br />152 32 Χαλάνδρι, Αθήνα</Box>
            </Stack>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ opacity: 0.85, fontSize: 14 }}>
              <PhoneIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.6)" }} />
              <Link href="tel:+302106000000" color="inherit" underline="hover">+30 210 600 0000</Link>
            </Stack>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ opacity: 0.85, fontSize: 14 }}>
              <EmailIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.6)" }} />
              <Link href="mailto:hello@kalypsis.gr" color="inherit" underline="hover">hello@kalypsis.gr</Link>
            </Stack>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ opacity: 0.85, fontSize: 14 }}>
              <LanguageIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.6)" }} />
              <Link href="https://www.kalypsis.gr" color="inherit" underline="hover" target="_blank">www.kalypsis.gr</Link>
            </Stack>
          </Stack>
        </Box>

        <Divider sx={{ my: 4, borderColor: "rgba(255,255,255,0.12)" }} />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          sx={{ opacity: 0.7, fontSize: 13 }}
        >
          <Box>© {new Date().getFullYear()} Kalypsis Insurance Platform — {t("app.tagline")}</Box>
          <Stack direction="row" spacing={3}>
            <Link component={RouterLink} to="/terms" color="inherit" underline="hover">
              {t("footer.terms")}
            </Link>
            <Link component={RouterLink} to="/privacy" color="inherit" underline="hover">
              {t("footer.privacy")}
            </Link>
            <Link component={RouterLink} to="/cookies" color="inherit" underline="hover">
              {t("footer.cookies")}
            </Link>
          </Stack>
        </Stack>

        <Typography variant="caption" sx={{ opacity: 0.45, display: "block", mt: 2 }}>
          {t("footer.compliance")}
        </Typography>
      </Container>
    </Box>
  );
}

function FooterColumn({
  heading,
  links
}: {
  heading: string;
  links: { to: string; label: string }[];
}) {
  return (
    <Stack spacing={1.4}>
      <Typography sx={{ color: "common.white", fontWeight: 700, letterSpacing: 0.5, mb: 1 }}>
        {heading}
      </Typography>
      {links.map((link) => (
        <Link
          key={link.to + link.label}
          component={RouterLink}
          to={link.to}
          underline="none"
          sx={{ color: "rgba(255,255,255,0.78)", fontSize: 14, "&:hover": { color: "common.white" } }}
        >
          {link.label}
        </Link>
      ))}
    </Stack>
  );
}

function SocialIcon({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <IconButton
      component="a"
      href={href}
      target="_blank"
      rel="noopener"
      sx={{
        color: "rgba(255,255,255,0.75)",
        bgcolor: "rgba(255,255,255,0.06)",
        "&:hover": { color: "common.white", bgcolor: "rgba(255,255,255,0.15)" }
      }}
    >
      {icon}
    </IconButton>
  );
}
