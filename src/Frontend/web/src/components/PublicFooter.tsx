import { useState, type FormEvent } from "react";
import { Alert, Box, CircularProgress, Container, Divider, IconButton, Stack, TextField } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import EmailIcon from "@mui/icons-material/Email";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import FacebookIcon from "@mui/icons-material/Facebook";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
    <Box component="footer" sx={{ bgcolor: "var(--paper)", borderTop: "1px solid var(--ink)" }}>
      {/* Newsletter strip — ink band */}
      <Box className="editorial-grain" sx={{
        bgcolor: "var(--ink)",
        color: "var(--paper)",
        py: { xs: 4, md: 5 }
      }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={5}
            alignItems={{ md: "center" }}
            justifyContent="space-between"
          >
            <Box sx={{ maxWidth: 540 }}>
              <Box className="number-marker" sx={{ color: "var(--gold)", mb: 1 }}>
                — {t("footer.newsletter.title")}
              </Box>
              <Box className="display" sx={{
                fontSize: { xs: 28, md: 40 },
                color: "var(--paper)",
                lineHeight: 1.05,
                mb: 2
              }}>
                {t("footer.newsletter.title")}
              </Box>
              <Box sx={{ opacity: 0.78, fontSize: 14, lineHeight: 1.6 }}>
                {t("footer.newsletter.subtitle")}
              </Box>
            </Box>

            <Box component="form" onSubmit={subscribe} sx={{ flex: 1, maxWidth: 540 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="stretch">
                <TextField
                  fullWidth
                  type="email"
                  placeholder={t("footer.newsletter.placeholder")}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
                  disabled={submitting}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "transparent",
                      color: "var(--paper)",
                      fontFamily: "var(--sans)",
                      borderRadius: 0,
                      "& fieldset": {
                        border: "none",
                        borderBottom: "1px solid rgba(245,237,225,0.45)"
                      },
                      "&:hover fieldset": { borderBottom: "1px solid var(--paper)" },
                      "&.Mui-focused fieldset": {
                        border: "none",
                        borderBottom: "1px solid var(--gold)"
                      }
                    },
                    "& .MuiOutlinedInput-input": { padding: "16px 0", color: "var(--paper)" },
                    "& .MuiOutlinedInput-input::placeholder": { color: "rgba(245,237,225,0.55)", opacity: 1 }
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="ink-button"
                  style={{
                    background: "var(--gold)",
                    color: "var(--ink)",
                    borderColor: "var(--gold)",
                    minWidth: 160,
                    whiteSpace: "nowrap"
                  }}
                >
                  <span>{submitting ? "..." : t("footer.newsletter.cta")}</span>
                  {submitting ? <CircularProgress size={14} color="inherit" /> : <SendIcon sx={{ fontSize: 14 }} />}
                </button>
              </Stack>
              {status === "ok" && (
                <Alert
                  severity="success"
                  variant="outlined"
                  sx={{ mt: 2, color: "var(--paper)", borderColor: "var(--gold)", bgcolor: "transparent" }}
                  onClose={() => setStatus("idle")}
                >
                  {t("footer.newsletter.success")}
                </Alert>
              )}
              {status === "err" && errMsg && (
                <Alert
                  severity="error"
                  variant="outlined"
                  sx={{ mt: 2, color: "var(--paper)", borderColor: "#e67261", bgcolor: "transparent" }}
                  onClose={() => setStatus("idle")}
                >
                  {errMsg}
                </Alert>
              )}
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Masthead / colophon */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Box sx={{
          display: "grid",
          gap: { xs: 5, md: 6 },
          gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr 1fr 1.4fr" }
        }}>
          {/* Brand */}
          <Box>
            <Box sx={{
              fontFamily: "var(--display)",
              fontSize: { xs: 32, md: 38 },
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              fontWeight: 600,
              lineHeight: 1
            }}>
              Kalypsis
            </Box>
            <Box sx={{
              mt: 2.5,
              color: "var(--ink-soft)",
              fontSize: { xs: 14, md: 15 },
              lineHeight: 1.6,
              maxWidth: 420
            }}>
              {t("footer.intro")}
            </Box>
            <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
              <SocialIcon href="https://github.com/PanagiotisKotsorgios/kalypsis" icon={<GitHubIcon sx={{ fontSize: 20 }} />} />
              <SocialIcon href="#" icon={<LinkedInIcon sx={{ fontSize: 20 }} />} />
              <SocialIcon href="#" icon={<FacebookIcon sx={{ fontSize: 20 }} />} />
            </Stack>
          </Box>

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
              { to: "/register", label: t("publicNav.register") },
              { to: "/login", label: t("publicNav.signIn") },
              { to: "/terms", label: t("footer.terms") },
              { to: "/privacy", label: t("footer.privacy") }
            ]}
          />

          <Box>
            <Box sx={{
              fontFamily: "var(--display)",
              fontSize: { xs: 18, md: 20 },
              fontWeight: 600,
              color: "var(--ink)",
              mb: 2,
              letterSpacing: "-0.01em"
            }}>
              {t("footer.contact")}
            </Box>
            <Stack spacing={1.5} sx={{ fontSize: { xs: 14, md: 14.5 }, color: "var(--ink-soft)" }}>
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <LocationOnIcon sx={{ fontSize: 18, color: "var(--gold)", mt: 0.2 }} />
                <Box sx={{ lineHeight: 1.5 }}>{t("footer.address1")}<br />{t("footer.address2")}</Box>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <PhoneIcon sx={{ fontSize: 18, color: "var(--gold)" }} />
                <Box
                  component="a"
                  href="tel:+302106000000"
                  sx={{
                    color: "var(--ink)",
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" }
                  }}
                >
                  +30 210 600 0000
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <EmailIcon sx={{ fontSize: 18, color: "var(--gold)" }} />
                <Box
                  component="a"
                  href="mailto:hello@kalypsis.gr"
                  sx={{
                    color: "var(--ink)",
                    fontFamily: "var(--mono)",
                    fontSize: 13,
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" }
                  }}
                >
                  hello@kalypsis.gr
                </Box>
              </Stack>
            </Stack>
          </Box>
        </Box>

        <Divider sx={{ my: { xs: 4, md: 5 }, borderColor: "var(--rule)" }} />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          sx={{ color: "var(--ink-soft)", fontSize: { xs: 12.5, md: 13 } }}
        >
          <Box>© {new Date().getFullYear()} Kalypsis · {t("app.tagline")}</Box>
          <Stack direction="row" spacing={4}>
            <Box
              component={RouterLink}
              to="/terms"
              sx={{
                color: "var(--ink-soft)",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline", color: "var(--ink)" }
              }}
            >
              {t("footer.terms")}
            </Box>
            <Box
              component={RouterLink}
              to="/privacy"
              sx={{
                color: "var(--ink-soft)",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline", color: "var(--ink)" }
              }}
            >
              {t("footer.privacy")}
            </Box>
            <Box
              component={RouterLink}
              to="/cookies"
              sx={{
                color: "var(--ink-soft)",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline", color: "var(--ink)" }
              }}
            >
              {t("footer.cookies")}
            </Box>
          </Stack>
        </Stack>

      </Container>
    </Box>
  );
}

function FooterColumn({ heading, links }:
  { heading: string; links: { to: string; label: string }[] }) {
  return (
    <Box>
      <Box sx={{
        fontFamily: "var(--display)",
        fontSize: { xs: 18, md: 20 },
        fontWeight: 600,
        color: "var(--ink)",
        mb: 2,
        letterSpacing: "-0.01em"
      }}>
        {heading}
      </Box>
      <Stack spacing={1.2}>
        {links.map((link) => (
          <Box
            key={link.to + link.label}
            component={RouterLink}
            to={link.to}
            sx={{
              fontSize: { xs: 14, md: 14.5 },
              color: "var(--ink)",
              textDecoration: "none",
              transition: "color 200ms ease",
              "&:hover": { textDecoration: "underline", color: "var(--gold)" }
            }}
          >
            {link.label}
          </Box>
        ))}
      </Stack>
    </Box>
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
        color: "var(--ink)",
        border: "1px solid var(--rule)",
        width: 36,
        height: 36,
        borderRadius: 0,
        transition: "background 200ms ease, color 200ms ease",
        "&:hover": { bgcolor: "var(--ink)", color: "var(--paper)" }
      }}
    >
      {icon}
    </IconButton>
  );
}
