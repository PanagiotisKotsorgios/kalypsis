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
  { key: "prod", icon: LeaderboardOutlinedIcon, area: "b" },
  { key: "network", icon: GroupsOutlinedIcon, area: "c" },
  { key: "cash", icon: AccountBalanceWalletOutlinedIcon, area: "d" },
  { key: "access", icon: LockOutlinedIcon, area: "e" },
  { key: "portal", icon: SmartphoneOutlinedIcon, area: "f" },
];

/** A schematic, not a screenshot or a live insurer connection/status indicator. */
function CarrierImportDiagram({ english }: { english: boolean }) {
  return <Box component="svg" role="img" aria-label={english ? "Illustration of insurer files flowing into KALYPSIS" : "Σχηματική εισαγωγή αρχείων ασφαλιστικών στο KALYPSIS"} viewBox="0 0 420 255" sx={{ display: "block", width: "100%", maxWidth: 380, height: "auto", alignSelf: "center", justifySelf: "center", overflow: "visible" }}>
    <g fill="none" stroke="#B7D0ED" strokeWidth="1.5">{[32,76,120,164,208].map(y => <path key={y} d={`M138 ${y} C200 ${y}, 190 120, 242 120`} />)}</g>
    <g fontFamily="Segoe UI, Arial, sans-serif" fontWeight="750" fontSize="13">{["AIG", "ΕΘΝΙΚΗ", "INTERAMERICAN", "Groupama", "ΜΙΝΕΤΤΑ"].map((name,index) => <g key={name}>
      <rect x={12 + index * 2} y={16 + index * 44} width="126" height="32" rx="7" fill="#FFFFFF" stroke="#D6E3F2" />
      <text x={75 + index * 2} y={37 + index * 44} textAnchor="middle" fill={index === 2 ? "#BB3347" : index === 3 ? "#187365" : "#103A76"}>{name}</text>
    </g>)}</g>
    <rect x="238" y="48" width="172" height="180" rx="16" fill="#E7EEF8" stroke="#D0DEF0" />
    <rect x="251" y="38" width="154" height="180" rx="14" fill="#0B305C" />
    <text x="270" y="68" fontFamily="Segoe UI, Arial, sans-serif" fontSize="15" fontWeight="800" letterSpacing="2" fill="#EAF4FF">KALYPSIS</text>
    <g>{[91,129,167].map(y => <g key={y}>
      <rect x="267" y={y} width="121" height="28" rx="6" fill="#173F70" stroke="#3D6391" />
      <rect x="276" y={y + 7} width="14" height="14" rx="4" fill="#2FA575" />
      <path d={`M279 ${y + 14} l3 3 5-6`} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M300 ${y + 14} h68`} stroke="#7296C1" strokeWidth="4" strokeLinecap="round" />
    </g>)}</g>
  </Box>;
}

export function PublicOfferingsSection() {
  const { t, i18n } = useTranslation();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  return <Box component="section" id="features" aria-labelledby="public-offerings-title" sx={{ bgcolor: "#F3F6FA", position: "relative", overflow: "hidden", py: { xs: 4, md: 6 } }}>
    <Box component="img" src="/kalypsis-logo.png" alt="" aria-hidden sx={{ position: "absolute", right: { md: "3%", xl: "7%" }, top: 15, width: 210, opacity: .055, display: { xs: "none", lg: "block" }, pointerEvents: "none", mixBlendMode: "multiply" }} />
    <Container maxWidth={false} sx={{ maxWidth: { xs: "100%", md: "94%", xl: 1600 }, px: { xs: 2, sm: 3, lg: 4 }, position: "relative" }}>
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 1.5 }}><Typography sx={{ color: "#145DA7", fontSize: 12, letterSpacing: ".17em", textTransform: "uppercase", fontWeight: 800 }}>{t("landing.v2.featuresEyebrow")}</Typography><Box aria-hidden sx={{ width: 65, height: 2, bgcolor: "#145DA7" }} /></Stack>
      <Typography component="h2" id="public-offerings-title" sx={{ fontSize: { xs: 25, sm: 29, md: 33 }, lineHeight: 1.3, color: "#0B2545", fontWeight: 800, letterSpacing: "-.025em", maxWidth: 1180, textWrap: "balance", mb: 1.5 }}>{t("landing.v2.featuresHeadline")}</Typography>
      <Typography sx={{ color: "#435A77", fontSize: { xs: 15, md: 16 }, lineHeight: 1.8, maxWidth: 1140, mb: { xs: 3, md: 3.5 } }}>{t("landing.v2.featuresSub")}</Typography>
      <Box sx={{ display: "grid", gap: { xs: 2, lg: 2.5 }, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(6,minmax(0,1fr))" }, gridTemplateAreas: { xs: '"a" "b" "c" "d" "e" "f"', sm: '"a a" "b c" "d e" "f f"', lg: '"a a a a b b" "a a a a c c" "d d e e f f"' } }}>
        {offerings.map(({ key, icon: Icon, area }, index) => {
          const title = t(`landing.v2.feat.${key}T`);
          const label = english ? `Ask us about ${title}` : `Ρωτήστε μας για: ${title}`;
          return <Box component="article" key={key} aria-labelledby={`offering-${key}-title`} sx={{ gridArea: area, minWidth: 0, p: { xs: 2.25, lg: 2.75 }, border: "1px solid #5278AF", borderRadius: 2.5, bgcolor: "#F9FBFD", position: "relative", overflow: "hidden", boxShadow: "0 4px 10px rgba(11,48,92,.07)", transition: "border-color 180ms ease, box-shadow 180ms ease", "&:hover": { borderColor: "#174C8C", boxShadow: "0 6px 16px rgba(11,48,92,.11)" }, "&:focus-within": { outline: "2px solid #087CEB", outlineOffset: 2 }, "&::after": { content: '""', position: "absolute", bottom: -38, right: -14, width: 105, height: 65, transform: "rotate(-45deg)", borderTop: "1px solid #DFE7F2", borderBottom: "10px solid #E9EFF7", pointerEvents: "none" }, "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "42px minmax(0,1fr) 30px", sm: "50px minmax(0,1fr) 30px" }, gap: { xs: 1.25, sm: 1.75 }, alignItems: "start", position: "relative", zIndex: 1 }}>
              <Box aria-hidden sx={{ width: { xs: 42, sm: 50 }, height: { xs: 46, sm: 54 }, borderRadius: 1.75, bgcolor: "#082A56", color: "#EDF5FF", display: "grid", placeItems: "center" }}><Icon sx={{ fontSize: { xs: 25, sm: 28 } }} /></Box>
              <Typography component="h3" id={`offering-${key}-title`} sx={{ color: "#102D55", fontSize: { xs: 18, xl: index === 0 ? 24 : 20 }, fontWeight: 800, lineHeight: 1.4, pt: .75, textWrap: "balance" }}>{title}</Typography>
              <Tooltip title={label}><IconButton component={RouterLink} to="/contact" aria-label={label} size="small" sx={{ width: 30, height: 30, mt: .25, border: "1px solid #7494C0", color: "#0B305C", bgcolor: "#F8FBFF", "&:hover": { bgcolor: "#E2EDFB", borderColor: "#174C8C" } }}><ArrowForwardIcon sx={{ fontSize: 19 }} /></IconButton></Tooltip>
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "2 / -1" }, display: "grid", gridTemplateColumns: index === 0 ? { xs: "minmax(0,1fr)", xl: "minmax(0,1.2fr) minmax(220px,.9fr)" } : "minmax(0,1fr)", gap: 2, minWidth: 0, mt: { xs: 0, sm: -.75 } }}>
                <Typography sx={{ color: "#334F72", fontSize: { xs: 14.5, md: 15 }, lineHeight: 1.8, overflowWrap: "anywhere" }}>{t(`landing.v2.feat.${key}B`)}</Typography>
                {index === 0 && <CarrierImportDiagram english={english} />}
              </Box>
            </Box>
          </Box>;
        })}
      </Box>
    </Container>
  </Box>;
}
