import { Box, Container, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
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
  { key: "portal", icon: SmartphoneOutlinedIcon, area: "f" },
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
      <Box sx={{ display: "grid", gap: { xs: 2, lg: 2.5 }, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(12,minmax(0,1fr))" }, gridTemplateAreas: { xs: '"a" "b" "c" "d" "e" "f"', sm: '"a a" "b c" "d e" "f f"', lg: '"a a a a a a a a b b b b" "c c c d d d e e e f f f"' } }}>
        {offerings.map(({ key, icon: Icon, area, image }, index) => {
          const title = t(`landing.v2.feat.${key}T`);
          const label = english ? `Ask us about ${title}` : `Ρωτήστε μας για: ${title}`;
          return <Box component="article" key={key} aria-labelledby={`offering-${key}-title`} sx={{ gridArea: area, minWidth: 0, p: { xs: 2.25, lg: 2.75 }, border: "1px solid #5278AF", borderRadius: 2.5, bgcolor: "#F9FBFD", position: "relative", overflow: "hidden", boxShadow: "0 4px 10px rgba(11,48,92,.07)", transition: "border-color 180ms ease, box-shadow 180ms ease", "&:hover": { borderColor: "#174C8C", boxShadow: "0 6px 16px rgba(11,48,92,.11)" }, "&:hover .offering-preview-image": { transform: "scale(1.02)" }, "&:focus-within": { outline: "2px solid #087CEB", outlineOffset: 2 }, "&::after": { content: '""', position: "absolute", bottom: -38, right: -14, width: 105, height: 65, transform: "rotate(-45deg)", borderTop: "1px solid #DFE7F2", borderBottom: "10px solid #E9EFF7", pointerEvents: "none" }, "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "42px minmax(0,1fr) 30px", sm: "50px minmax(0,1fr) 30px" }, gap: { xs: 1.25, sm: 1.75 }, alignItems: "start", position: "relative", zIndex: 1 }}>
              <Box aria-hidden sx={{ width: { xs: 42, sm: 50 }, height: { xs: 46, sm: 54 }, borderRadius: 1.75, bgcolor: "#082A56", color: "#EDF5FF", display: "grid", placeItems: "center" }}><Icon sx={{ fontSize: { xs: 25, sm: 28 } }} /></Box>
              <Typography component="h3" id={`offering-${key}-title`} sx={{ color: "#102D55", fontSize: { xs: 18, xl: index === 0 ? 24 : 20 }, fontWeight: 800, lineHeight: 1.4, pt: .75, textWrap: "balance" }}>{title}</Typography>
              <Tooltip title={label}><IconButton component={RouterLink} to="/contact" aria-label={label} size="small" sx={{ width: 30, height: 30, mt: .25, border: "1px solid #7494C0", color: "#0B305C", bgcolor: "#F8FBFF", "&:hover": { bgcolor: "#E2EDFB", borderColor: "#174C8C" } }}><ArrowForwardIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "2 / -1" }, display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 2, minWidth: 0, mt: { xs: 0, sm: -.75 } }}>
                <Typography sx={{ color: "#334F72", fontSize: { xs: 14.5, md: 15 }, lineHeight: 1.8, overflowWrap: "anywhere" }}>{t(`landing.v2.feat.${key}B`)}</Typography>
                {index === 0 && <CarrierLogoRail />}
                {image && (
                  <Box
                    sx={{
                      overflow: "hidden",
                      borderRadius: 1.75,
                      border: "1px solid #D6E3F2",
                      bgcolor: "#EAF0F6",
                      boxShadow: "0 10px 24px -20px rgba(11,37,69,.6)",
                    }}
                  >
                    <Box
                      component="img"
                      className="offering-preview-image"
                      src={image}
                      alt=""
                      loading="lazy"
                      sx={{
                        display: "block",
                        width: "100%",
                        height: { xs: 190, lg: index < 3 ? 145 : 170 },
                        objectFit: "cover",
                        objectPosition: "top center",
                        transition: "transform 400ms cubic-bezier(.16,1,.3,1)",
                        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </Box>;
        })}
      </Box>
    </Container>
  </Box>;
}
