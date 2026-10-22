import { useState } from "react";
import { Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Link as RouterLink } from "react-router-dom";

type Feature = { el: string; en: string; detailEl: string; detailEn: string; values: readonly boolean[] };
type Package = { key: string; name: string };
const icons = [DesktopWindowsOutlinedIcon, GroupsOutlinedIcon, BarChartRoundedIcon, LinkRoundedIcon, ShieldOutlinedIcon];
const descriptions = ["Διαχείριση & λειτουργία γραφείου", "Πελάτες & εξυπηρέτηση", "Αναφορές & έξυπνες διαδικασίες", "Συνδέσεις & κανονιστική κάλυψη", "Εσωτερική επικοινωνία ομάδας"];
const groups = [
  { title: "Πελατολόγιο & Συμβόλαια", en: "Customers & policies", icon: GroupsOutlinedIcon, indices: [0,7] },
  { title: "Οικονομικά & Παραγωγή", en: "Finance & production", icon: StorageRoundedIcon, indices: [6,4] },
  { title: "Επικοινωνία & Εξυπηρέτηση", en: "Communication & service", icon: ChatBubbleOutlineRoundedIcon, indices: [10,11] },
  { title: "Αναφορές, AI & Αυτοματισμοί", en: "Reports, AI & automation", icon: BarChartRoundedIcon, indices: [13,14] },
  { title: "Διασυνδέσεις & Εργαλεία", en: "Integrations & tools", icon: LinkRoundedIcon, indices: [16,17] },
];

/** Compact overview modelled on the supplied reference. Feature availability
 * still comes from the existing catalogue, not from decorative sample checks. */
export function PublicPackageComparison({ packages, features, isEn = false, onPackageDetails }: {
  packages: readonly Package[]; features: readonly Feature[]; isEn?: boolean; onPackageDetails: (index: number) => void;
}) {
  const [active, setActive] = useState(0);
  const [detailed, setDetailed] = useState(false);
  const heading = isEn ? "Compare the capabilities" : "Συγκρίνετε τις δυνατότητες";
  const cell = { borderColor: "#E0EAF5", color: "#425F85", fontSize: { xs: 12, md: 14 }, py: 1.3, px: 2, borderRight: "1px solid #E0EAF5", whiteSpace: "normal", overflowWrap: "anywhere" } as const;
  const matrix = (full: boolean) => <TableContainer role="region" tabIndex={0} aria-label={heading} sx={{ border: "1px solid #E0EAF5", borderRadius: 2, overflowX: "auto", "&:focus-visible": { outline: "3px solid #087CEB", outlineOffset: 2 } }}>
    <Table size="small" aria-label={heading} sx={{ minWidth: 1020, tableLayout: "fixed", "& th, & td": { verticalAlign: "middle" } }}>
      <colgroup><col style={{ width: "17%" }} /><col style={{ width: "22%" }} />{packages.map(pkg => <col key={pkg.key} style={{ width: "12.2%" }} />)}</colgroup>
      <TableHead><TableRow sx={{ bgcolor: "#F1F6FC" }}>
        <TableCell colSpan={2} sx={{ ...cell, fontSize: 12, fontWeight: 850, letterSpacing: ".08em", py: 2.5 }}>{isEn ? "CATEGORY / CAPABILITY" : "ΚΑΤΗΓΟΡΙΑ / ΔΥΝΑΤΟΤΗΤΑ"}</TableCell>
        {packages.map((pkg,index) => { const Icon = icons[index]; return <TableCell key={pkg.key} align="center" sx={{ ...cell, color: "#0B2851", fontWeight: 850, lineHeight: 1.35, px: 1, py: 2 }}>
          <Icon sx={{ display: "block", color: "#0057CA", mx: "auto", mb: .8, fontSize: 25 }} />{pkg.name}
        </TableCell>; })}
      </TableRow></TableHead>
      <TableBody>
        {(full ? [{ title: isEn ? "All capabilities" : "Όλες οι δυνατότητες", en: "All capabilities", icon: GridViewRoundedIcon, indices: features.map((_,index)=>index) }] : groups).flatMap(group => group.indices.map((index, offset) => {
          const feature = features[index]; if (!feature) return null;
          const Icon = group.icon;
          return <TableRow key={index} sx={{ bgcolor: offset % 2 ? "#F7FAFE" : "#FFFFFF", "&:hover": { bgcolor: "#EDF5FF" } }}>
            {offset === 0 && <TableCell component="th" scope="rowgroup" rowSpan={group.indices.length} sx={{ ...cell, color: "#0B2851", fontWeight: 850, bgcolor: "#F8FAFE" }}>
              <Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: "#EAF3FF", color: "#0057CA", borderRadius: "50%", display: "grid", placeItems: "center" }}><Icon /></Box><Box>{isEn ? group.en : group.title}</Box></Stack>
            </TableCell>}
            <TableCell component="th" scope="row" sx={cell}>{isEn ? feature.en : feature.el} <Tooltip title={isEn ? feature.detailEn : feature.detailEl} arrow><Box component="button" type="button" aria-label={`${isEn ? "Details" : "Πληροφορίες"}: ${isEn ? feature.en : feature.el}`} sx={{ display: "inline-flex", verticalAlign: "middle", p: 0, ml: .5, color: "#8FABD1", bgcolor: "transparent", border: 0, cursor: "help" }}><InfoOutlinedIcon sx={{ fontSize: 17 }} /></Box></Tooltip></TableCell>
            {feature.values.map((value,column) => <TableCell key={column} align="center" sx={{ ...cell, bgcolor: column === active ? "rgba(8,124,235,.025)" : undefined }}>
              {value ? <Box component="span" aria-label={isEn ? "Included" : "Περιλαμβάνεται"} sx={{ width: 28, height: 28, display: "inline-grid", placeItems: "center", bgcolor: "#CBF0DB", borderRadius: "50%" }}><CheckCircleRoundedIcon sx={{ color: "#009648", fontSize: 24 }} /></Box> : <Box component="span" aria-label={isEn ? "Not included" : "Δεν περιλαμβάνεται"} sx={{ color: "#7E9BC1" }}>–</Box>}
            </TableCell>)}
          </TableRow>;
        }))}
      </TableBody>
    </Table>
  </TableContainer>;
  return <Box component="section" aria-labelledby="package-comparison-heading" sx={{ py: { xs: 6, md: 9 }, position: "relative", overflow: "hidden", background: "radial-gradient(ellipse at 0% 40%, #E5F2FF 0%, transparent 45%), radial-gradient(ellipse at 100% 90%, #EAF4FF 0%, transparent 50%), #F7FBFF", borderBlock: "1px solid #E5EFF8" }}>
    <Box aria-hidden sx={{ position: "absolute", width: 170, height: 120, left: -20, top: 50, opacity: .3, backgroundImage: "radial-gradient(#9DC6F2 2px, transparent 2px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
    <Container maxWidth="xl" sx={{ position: "relative", px: { xs: 2, md: 5 } }}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: "#E6F1FF", color: "#0057CA", borderRadius: 20, px: 2.5, py: .8, fontSize: 12, fontWeight: 850, letterSpacing: ".035em", mb: 2 }}><GridViewRoundedIcon sx={{ fontSize: 18 }} />{isEn ? "PACKAGES & CAPABILITIES" : "ΠΑΚΕΤΑ & ΔΥΝΑΤΟΤΗΤΕΣ"}</Box>
        <Typography id="package-comparison-heading" component="h2" sx={{ color: "#071F43", fontSize: { xs: 29, sm: 38, md: 48 }, fontWeight: 950, letterSpacing: "-.025em", lineHeight: 1.16, mb: 1.5 }}>{heading}</Typography>
        <Typography sx={{ color: "#6984AB", fontSize: { xs: 15, md: 20 } }}>{isEn ? "A concise view of what each workspace adds to your daily operation." : "Μια συνοπτική εικόνα για το τι προσφέρει κάθε περιβάλλον στην καθημερινή λειτουργία σας."}</Typography>
      </Box>
      <Box role="group" aria-label={isEn ? "Choose package" : "Επιλογή πακέτου"} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(5,minmax(0,1fr))" }, gap: 1.25, mb: 2.5 }}>
        {packages.map((pkg,index) => { const Icon = icons[index]; const selected = active === index; return <Button key={pkg.key} aria-pressed={selected} onClick={() => setActive(index)} sx={{ textTransform: "none", textAlign: "left", justifyContent: "flex-start", alignItems: "center", gap: 1.5, p: { xs: 2, lg: 2.25 }, minHeight: 112, minWidth: 0, borderRadius: 2, border: "1px solid", borderColor: selected ? "#087CEB" : "#D7E6F9", outline: selected ? "2px solid #85B5E9" : "none", outlineOffset: -4, background: selected ? "linear-gradient(125deg,#08264C,#164874)" : "#FFFFFF", color: selected ? "#FFFFFF" : "#0B2851", boxShadow: selected ? "0 8px 22px rgba(8,50,95,.12)" : "none", transition: "background-color 180ms, transform 180ms", "&:hover": { bgcolor: selected ? "#123D66" : "#EDF5FF", transform: "translateY(-2px)" }, "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } } }}>
          <Box sx={{ width: 54, height: 54, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: selected ? "rgba(17,126,235,.28)" : "#EFF6FF", color: selected ? "#FFFFFF" : "#0057CA" }}><Icon sx={{ fontSize: 29 }} /></Box>
          <Box sx={{ minWidth: 0 }}><Typography component="span" sx={{ display: "block", fontSize: 15, fontWeight: 900, lineHeight: 1.35 }}>{pkg.name}</Typography><Typography component="span" sx={{ display: "block", mt: .7, fontSize: 13, lineHeight: 1.4, color: selected ? "#D9E8FA" : "#6A83A9" }}>{isEn ? ["Office management", "Customers & service", "Reports & smart workflows", "Connections & compliance", "Internal team communication"][index] : descriptions[index]}</Typography></Box>
        </Button>; })}
      </Box>
      <Box sx={{ bgcolor: "rgba(255,255,255,.93)", p: { xs: 1.5, sm: 2.25 }, border: "1px solid #E0ECFB", borderRadius: 3, boxShadow: "0 16px 42px rgba(21,77,139,.06)" }}>
        <Stack direction="row" useFlexGap flexWrap="wrap" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
          <GridViewRoundedIcon sx={{ color: "#0057CA" }} /><Typography component="h3" sx={{ color: "#0B2851", fontWeight: 900, fontSize: { xs: 18, md: 21 } }}>{isEn ? "Capability comparison" : "Σύγκριση Δυνατοτήτων"}</Typography>
          <Typography sx={{ color: "#6B88B1", fontSize: 12, flex: "1 1 220px" }}><InfoOutlinedIcon sx={{ fontSize: 16, verticalAlign: "middle", mr: .5 }} />{isEn ? "Selected capabilities. Open the detailed view for the complete list." : "Επιλεγμένες δυνατότητες ανά περιβάλλον. Δείτε την πλήρη λίστα στην αναλυτική προβολή."}</Typography>
          <Button variant="outlined" onClick={() => setDetailed(true)} startIcon={<FormatListBulletedRoundedIcon />} endIcon={<ArrowForwardRoundedIcon />} sx={{ color: "#0B2851", borderColor: "#C8DDF8", textTransform: "none", borderRadius: 1.5, whiteSpace: "nowrap" }}>{isEn ? "Detailed view" : "Αναλυτική προβολή"}</Button>
        </Stack>
        {matrix(false)}
        <Stack direction={{ xs: "column", md: "row" }} gap={2} alignItems={{ xs: "stretch", md: "center" }} sx={{ pt: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}><ShieldOutlinedIcon sx={{ color: "#0057CA", fontSize: 30 }} /><Typography sx={{ color: "#6B88B1", fontSize: 12, lineHeight: 1.7 }}>{isEn ? "Packages are enabled per office by the platform administrator. Available capabilities may vary with configuration." : "Τα πακέτα ενεργοποιούνται ανά γραφείο από τον διαχειριστή της πλατφόρμας. Η τελική εικόνα των δυνατοτήτων ενδέχεται να διαφέρει ανάλογα με τη διαμόρφωση."}</Typography></Stack>
          <Button onClick={() => onPackageDetails(active)} sx={{ textTransform: "none", color: "#0057CA" }}>{isEn ? "Package details" : "Δείτε το πακέτο"}</Button>
          <Button component={RouterLink} to="/pricing" variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ bgcolor: "#061F43", color: "#FFFFFF", px: 3, py: 1.6, borderRadius: 2, fontWeight: 850, textTransform: "none", "&:hover": { bgcolor: "#123E6D" } }}>{isEn ? "See prices and combinations" : "Δείτε τιμές και συνδυασμούς"}</Button>
        </Stack>
      </Box>
    </Container>
    <Dialog open={detailed} onClose={() => setDetailed(false)} fullWidth maxWidth="xl" aria-labelledby="package-matrix-title" PaperProps={{ sx: { m: 1, width: "calc(100% - 16px)", maxHeight: "calc(100dvh - 16px)", borderRadius: 3 } }}>
      <DialogTitle id="package-matrix-title" sx={{ color: "#0B2851", fontWeight: 850 }}>{isEn ? "All capabilities" : "Αναλυτική σύγκριση δυνατοτήτων"}</DialogTitle>
      <DialogContent dividers>{matrix(true)}</DialogContent>
      <DialogActions><Button onClick={() => setDetailed(false)} color="error" variant="contained" startIcon={<CloseRoundedIcon />}>{isEn ? "Close" : "Κλείσιμο"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
