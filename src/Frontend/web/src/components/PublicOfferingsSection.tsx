import { Box, Container, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { useState, type KeyboardEvent } from "react";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const offerings = [
  { key: "bridges", icon: LayersOutlinedIcon, area: "a" },
  {
    key: "prod",
    icon: LeaderboardOutlinedIcon,
    area: "b",
    image: "/images/feature-production-lists.jpg",
  },
  {
    key: "network",
    icon: GroupsOutlinedIcon,
    area: "c",
    image: "/images/feature-partner-network.jpg",
  },
  {
    key: "cash",
    icon: AccountBalanceWalletOutlinedIcon,
    area: "d",
    image: "/images/feature-cash-status.jpg",
  },
  {
    key: "access",
    icon: LockOutlinedIcon,
    area: "e",
    image: "/images/feature-access-control.jpg",
  },
];

const carrierMarks = [
  { name: "INTERAMERICAN", src: "/images/carriers/interamerican.svg", accent: "#e31b23" },
  { name: "AIG", src: "/images/carriers/aig.svg", accent: "#0073a8" },
  { name: "ERGO", src: "/images/carriers/ergo.svg", accent: "#d71920" },
  { name: "GENERALI", src: "/images/carriers/generali.svg", accent: "#c9152c" },
  { name: "Allianz", src: "/images/carriers/allianz.svg", accent: "#003781" },
  { name: "eurolife FFH", color: "#006f73", accent: "#65b32e" },
  { name: "GROUPAMA", color: "#4b8b2a", accent: "#f1c400" },
  { name: "ΜΙΝΕΤΤΑ", color: "#124f86", accent: "#e03a3e" },
];

function OfferingImageFlipCard({
  title,
  body,
  image,
  Icon,
  label,
}: {
  title: string;
  body: string;
  image: string;
  Icon: typeof LayersOutlinedIcon;
  label: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped(value => !value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <Box component="article" aria-label={title} sx={{ gridArea: label, minWidth: 0, minHeight: { xs: 280, md: 330, lg: 360 }, perspective: "1400px", "@media (prefers-reduced-motion: reduce)": { perspective: "none" } }}>
      <Box
        role="button"
        tabIndex={0}
        aria-label={`${title}. ${body}. ${flipped ? "Εμφάνιση εικόνας" : "Εμφάνιση περιγραφής"}`}
        aria-expanded={flipped}
        onClick={(event) => { if (event.detail > 0 && window.matchMedia("(hover: none)").matches) toggle(); }}
        onKeyDown={onKeyDown}
        className={`offering-flip-trigger${flipped ? " offering-flipped" : ""}`}
        sx={{ height: "100%", minHeight: "inherit", borderRadius: 2.5, cursor: "pointer", outline: "none", "&:focus-visible": { boxShadow: "0 0 0 3px #087CEB" }, "&:hover .offering-flip-inner, &:focus-visible .offering-flip-inner, &:focus-within .offering-flip-inner": { transform: "rotateY(180deg)" }, "@media (hover: none)": { "&:hover .offering-flip-inner": { transform: "none" } }, "@media (prefers-reduced-motion: reduce)": { "&:hover .offering-flip-inner, &:focus-visible .offering-flip-inner, &:focus-within .offering-flip-inner": { transform: "none" }, "& .offering-flip-inner": { transform: "none !important" }, "&:hover .offering-card-front, &:focus-visible .offering-card-front, &:focus-within .offering-card-front, &.offering-flipped .offering-card-front": { opacity: 0, pointerEvents: "none" }, "&:hover .offering-card-back, &:focus-visible .offering-card-back, &:focus-within .offering-card-back, &.offering-flipped .offering-card-back": { opacity: 1, transform: "none" } } }}
      >
        <Box className="offering-flip-inner" sx={{ position: "relative", height: "100%", minHeight: "inherit", transformStyle: "preserve-3d", transition: "transform 850ms cubic-bezier(.2,.72,.2,1)", borderRadius: 2.5, boxShadow: "0 16px 40px rgba(11,37,69,.2)", "@media (prefers-reduced-motion: reduce)": { transition: "opacity 180ms ease" }, ...(flipped ? { transform: "rotateY(180deg)" } : {}) }}>
          <Box className="offering-card-front" sx={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 2.5, backfaceVisibility: "hidden", bgcolor: "#0B2545", transition: "opacity 180ms ease" }}>
            <Box component="img" src={image} alt="" loading="lazy" sx={{ width: "100%", height: "100%", minHeight: "inherit", display: "block", objectFit: "cover", objectPosition: "center", transition: "transform 700ms cubic-bezier(.16,1,.3,1)", ".offering-flip-trigger:hover &": { transform: "scale(1.035)" }, "@media (prefers-reduced-motion: reduce)": { transition: "none" } }} />
          </Box>
          <Box className="offering-card-back" sx={{ position: "absolute", inset: 0, p: { xs: 2.5, md: 3.5 }, display: "flex", flexDirection: "column", justifyContent: "center", gap: 1.5, overflow: "auto", borderRadius: 2.5, bgcolor: "#0B2B54", color: "#fff", border: "1px solid rgba(124,199,255,.55)", backfaceVisibility: "hidden", transform: "rotateY(180deg)", transition: "opacity 180ms ease" }}>
            <Box aria-hidden sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 1.75, bgcolor: "rgba(255,255,255,.12)", display: "grid", placeItems: "center" }}><Icon sx={{ fontSize: 27, color: "#B9E0FF" }} /></Box>
            <Typography component="h3" sx={{ color: "#fff", fontSize: { xs: 20, md: 25 }, fontWeight: 850, lineHeight: 1.3 }}>{title}</Typography>
            <Typography sx={{ color: "#D2E1F1", fontSize: { xs: 14.5, md: 15.5 }, lineHeight: 1.8 }}>{body}</Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: "auto" }}>
              <Typography sx={{ color: "#91C9F4", fontSize: 12, fontWeight: 750 }}>Πατήστε ξανά για την εικόνα</Typography>
              <Tooltip title="Επικοινωνήστε μαζί μας">
                <IconButton component={RouterLink} to="/contact" aria-label={`Επικοινωνία για ${title}`} onClick={event => event.stopPropagation()} sx={{ color: "#fff", border: "1px solid rgba(255,255,255,.35)", bgcolor: "rgba(255,255,255,.1)", "&:hover": { bgcolor: "rgba(255,255,255,.2)" } }}>
                  <ArrowForwardIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function CarrierLogoRail() {
  const loop = [...carrierMarks, ...carrierMarks];
  return (
    <Box
      aria-label="Ενδεικτικές ασφαλιστικές εταιρείες"
      sx={{
        overflow: "hidden",
        position: "relative",
        mt: 0.5,
        py: 1,
        maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        "@keyframes publicCarrierRail": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "& .public-carrier-rail": { animation: "none", transform: "translateX(0)" },
        },
      }}
    >
      <Box
        className="public-carrier-rail"
        sx={{
          display: "flex",
          width: "max-content",
          gap: 1.25,
          animation: "publicCarrierRail 24s linear infinite",
          "&:hover": { animationPlayState: "paused" },
        }}
      >
        {loop.map((carrier, index) => (
          <Box
            key={`${carrier.name}-${index}`}
            aria-hidden={index >= carrierMarks.length}
            sx={{
              width: { xs: 136, md: 154 },
              height: 64,
              px: 2,
              borderRadius: 1.75,
              border: "1px solid #D6E3F2",
              bgcolor: "#fff",
              boxShadow: "0 8px 22px -18px rgba(11,37,69,.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              color: carrier.color,
              fontWeight: 900,
              fontSize: carrier.name.length > 11 ? 13 : 18,
              letterSpacing: carrier.name === "AIG" ? ".12em" : "-.025em",
              whiteSpace: "nowrap",
              "&::after": {
                content: '\"\"',
                position: "absolute",
                left: 18,
                right: 18,
                bottom: 7,
                height: 2,
                borderRadius: 99,
                bgcolor: carrier.accent,
                opacity: 0.8,
              },
            }}
          >
            {carrier.src ? (
              <Box
                component="img"
                src={carrier.src}
                alt={index < carrierMarks.length ? carrier.name : ""}
                sx={{ width: "100%", maxWidth: 116, height: 35, objectFit: "contain" }}
              />
            ) : (
              carrier.name
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function PublicOfferingsSection() {
  const { t, i18n } = useTranslation();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  return <Box component="section" id="features" aria-labelledby="public-offerings-title" sx={{ bgcolor: "#F3F6FA", position: "relative", overflow: "hidden", isolation: "isolate", py: { xs: 4, md: 6 },
    "&::before": { content: '""', position: "absolute", top: { xs: -40, md: -80 }, bottom: 0, left: 0, right: 0,
      backgroundImage: 'url("/images/kalypsis-hero-bg.png")', backgroundRepeat: "no-repeat", backgroundPosition: "center top", backgroundSize: "cover",
      transform: "rotate(180deg)", transformOrigin: "center", pointerEvents: "none", zIndex: -1,
      maskImage: "linear-gradient(180deg, #000 0%, #000 70%, rgba(0,0,0,0.55) 88%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 70%, rgba(0,0,0,0.55) 88%, transparent 100%)" }
  }}>
    <Box component="img" src="/kalypsis-logo.png" alt="" aria-hidden sx={{ position: "absolute", right: { md: "3%", xl: "7%" }, top: 15, width: 210, opacity: .055, display: { xs: "none", lg: "block" }, pointerEvents: "none", mixBlendMode: "multiply" }} />
    <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "94%", xl: 1600 }, px: { xs: 2, sm: 3, lg: 4 }, position: "relative" }}>
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 1.5 }}><Typography sx={{ color: "#145DA7", fontSize: 12, letterSpacing: ".17em", textTransform: "uppercase", fontWeight: 800 }}>{t("landing.v2.featuresEyebrow")}</Typography><Box aria-hidden sx={{ width: 65, height: 2, bgcolor: "#145DA7" }} /></Stack>
      <Typography component="h2" id="public-offerings-title" sx={{ fontSize: { xs: 25, sm: 29, md: 33 }, lineHeight: 1.3, color: "#0B2545", fontWeight: 800, letterSpacing: "-.025em", maxWidth: 1180, textWrap: "balance", mb: 1.5 }}>{t("landing.v2.featuresHeadline")}</Typography>
      <Typography sx={{ color: "#435A77", fontSize: { xs: 15, md: 16 }, lineHeight: 1.8, maxWidth: 1140, mb: { xs: 3, md: 3.5 } }}>{t("landing.v2.featuresSub")}</Typography>
      <Box sx={{ display: "grid", alignItems: "stretch", gap: { xs: 2, lg: 2.5 }, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gridTemplateAreas: { xs: '"a" "b" "c" "d" "e"', sm: '"a b" "c d" "e ."' } }}>
        {offerings.map(({ key, icon: Icon, area, image }, index) => {
          const title = t(`landing.v2.feat.${key}T`);
          const label = english ? `Ask us about ${title}` : `Ρωτήστε μας για: ${title}`;
          const body = t(`landing.v2.feat.${key}B`);
          if (image) return <OfferingImageFlipCard key={key} title={title} body={body} image={image} Icon={Icon} label={area} />;
          return <Box component="article" key={key} aria-labelledby={`offering-${key}-title`} sx={{ gridArea: area, minWidth: 0, minHeight: { xs: 280, md: 330, lg: 360 }, boxSizing: "border-box", p: { xs: 2.25, lg: 2.75 }, border: "3px solid #07172D", borderRadius: 2.5, bgcolor: "#F9FBFD", position: "relative", overflow: "hidden", boxShadow: "0 4px 10px rgba(11,48,92,.12)", transition: "border-color 180ms ease, box-shadow 180ms ease", "&:hover": { borderColor: "#0B2B54", boxShadow: "0 8px 22px rgba(11,48,92,.2)" }, "&:focus-within": { outline: "2px solid #087CEB", outlineOffset: 2 }, "&::after": { content: '""', position: "absolute", bottom: -38, right: -14, width: 105, height: 65, transform: "rotate(-45deg)", borderTop: "1px solid #DFE7F2", borderBottom: "10px solid #E9EFF7", pointerEvents: "none" }, "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "42px minmax(0,1fr) 30px", sm: "50px minmax(0,1fr) 30px" }, gap: { xs: 1.25, sm: 1.75 }, alignItems: "start", position: "relative", zIndex: 1 }}>
              <Box aria-hidden sx={{ width: { xs: 42, sm: 50 }, height: { xs: 46, sm: 54 }, borderRadius: 1.75, bgcolor: "#082A56", color: "#EDF5FF", display: "grid", placeItems: "center" }}><Icon sx={{ fontSize: { xs: 25, sm: 28 } }} /></Box>
              <Typography component="h3" id={`offering-${key}-title`} sx={{ color: "#102D55", fontSize: { xs: 18, xl: index === 0 ? 24 : 20 }, fontWeight: 800, lineHeight: 1.4, pt: .75, textWrap: "balance" }}>{title}</Typography>
              <Tooltip title={label}><IconButton component={RouterLink} to="/contact" aria-label={label} size="small" sx={{ width: 30, height: 30, mt: .25, border: "1px solid #7494C0", color: "#0B305C", bgcolor: "#F8FBFF", "&:hover": { bgcolor: "#E2EDFB", borderColor: "#174C8C" } }}><ArrowForwardIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "2 / -1" }, display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 2, minWidth: 0, mt: { xs: 0, sm: -.75 } }}>
                <Typography sx={{ color: "#334F72", fontSize: { xs: 14.5, md: 15 }, lineHeight: 1.8, overflowWrap: "anywhere" }}>{body}</Typography>
                {index === 0 && <CarrierLogoRail />}
              </Box>
            </Box>
          </Box>;
        })}
      </Box>
    </Container>
  </Box>;
}
