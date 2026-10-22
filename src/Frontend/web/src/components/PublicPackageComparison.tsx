import { Box, Button, Container, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from "@mui/material";
import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Link as RouterLink } from "react-router-dom";

type Feature = { el: string; en: string; detailEl: string; detailEn: string; values: readonly boolean[] };
type Package = { key: string; name: string };
const icons = [DesktopWindowsOutlinedIcon, GroupsOutlinedIcon, BarChartRoundedIcon, LinkRoundedIcon, ShieldOutlinedIcon];
const groups = [
  { title: "Πελατολόγιο & Συμβόλαια", en: "Customers & policies", icon: GroupsOutlinedIcon, indices: [0,7] },
  { title: "Οικονομικά & Παραγωγή", en: "Finance & production", icon: StorageRoundedIcon, indices: [6,4] },
  { title: "Επικοινωνία & Εξυπηρέτηση", en: "Communication & service", icon: ChatBubbleOutlineRoundedIcon, indices: [10,11] },
  { title: "Αναφορές, AI & Αυτοματισμοί", en: "Reports, AI & automation", icon: BarChartRoundedIcon, indices: [13,14] },
  { title: "Διασυνδέσεις & Εργαλεία", en: "Integrations & tools", icon: LinkRoundedIcon, indices: [16,17] },
];

/** Only the existing comparison table and pricing link; no promotional wrapper. */
export function PublicPackageComparison({ packages, features, isEn = false }: {
  packages: readonly Package[]; features: readonly Feature[]; isEn?: boolean;
}) {
  const label = isEn ? "Package comparison table" : "Πίνακας σύγκρισης πακέτων";
  const cell = { borderColor: "#E0EAF5", color: "#425F85", fontSize: { xs: 12, md: 14 }, py: 1.3, px: 2, borderRight: "1px solid #E0EAF5", whiteSpace: "normal", overflowWrap: "anywhere" } as const;
  return <Box component="section" aria-label={label} sx={{ py: { xs: 3, md: 4 } }}>
    <Container maxWidth="lg">
      <TableContainer role="region" tabIndex={0} aria-label={label} sx={{ border: "1px solid #E0EAF5", borderRadius: 2, overflowX: "auto", "&:focus-visible": { outline: "3px solid #087CEB", outlineOffset: 2 } }}>
        <Table size="small" aria-label={label} sx={{ minWidth: 1020, tableLayout: "fixed", "& th, & td": { verticalAlign: "middle" } }}>
          <colgroup><col style={{ width: "17%" }} /><col style={{ width: "22%" }} />{packages.map(pkg => <col key={pkg.key} style={{ width: "12.2%" }} />)}</colgroup>
          <TableHead><TableRow sx={{ bgcolor: "#F1F6FC" }}>
            <TableCell colSpan={2} sx={{ ...cell, fontSize: 12, fontWeight: 850, letterSpacing: ".08em", py: 2.5 }}>{isEn ? "CATEGORY / CAPABILITY" : "ΚΑΤΗΓΟΡΙΑ / ΔΥΝΑΤΟΤΗΤΑ"}</TableCell>
            {packages.map((pkg,index) => { const Icon = icons[index]; return <TableCell key={pkg.key} align="center" sx={{ ...cell, color: "#0B2851", fontWeight: 850, lineHeight: 1.35, px: 1, py: 2 }}>
              <Icon sx={{ display: "block", color: "#0057CA", mx: "auto", mb: .8, fontSize: 25 }} />{pkg.name}
            </TableCell>; })}
          </TableRow></TableHead>
          <TableBody>
            {groups.flatMap(group => {
              const entries = group.indices.map(index => ({ index, feature: features[index] })).filter(entry => !!entry.feature);
              return entries.map(({ index, feature }, offset) => {
                const Icon = group.icon;
                return <TableRow key={index} sx={{ bgcolor: offset % 2 ? "#F7FAFE" : "#FFFFFF", "&:hover": { bgcolor: "#EDF5FF" } }}>
                  {offset === 0 && <TableCell component="th" scope="rowgroup" rowSpan={entries.length} sx={{ ...cell, color: "#0B2851", fontWeight: 850, bgcolor: "#F8FAFE" }}>
                    <Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: "#EAF3FF", color: "#0057CA", borderRadius: "50%", display: "grid", placeItems: "center" }}><Icon /></Box><Box>{isEn ? group.en : group.title}</Box></Stack>
                  </TableCell>}
                  <TableCell component="th" scope="row" sx={cell}>{isEn ? feature.en : feature.el} <Tooltip title={isEn ? feature.detailEn : feature.detailEl} arrow><Box component="button" type="button" aria-label={`${isEn ? "Details" : "Πληροφορίες"}: ${isEn ? feature.en : feature.el}`} sx={{ display: "inline-flex", verticalAlign: "middle", p: 0, ml: .5, color: "#8FABD1", bgcolor: "transparent", border: 0, cursor: "help" }}><InfoOutlinedIcon sx={{ fontSize: 17 }} /></Box></Tooltip></TableCell>
                  {feature.values.map((value,column) => <TableCell key={column} align="center" sx={cell}>
                    {value ? <Box component="span" aria-label={isEn ? "Included" : "Περιλαμβάνεται"} sx={{ width: 28, height: 28, display: "inline-grid", placeItems: "center", bgcolor: "#CBF0DB", borderRadius: "50%" }}><CheckCircleRoundedIcon sx={{ color: "#009648", fontSize: 24 }} /></Box> : <Box component="span" aria-label={isEn ? "Not included" : "Δεν περιλαμβάνεται"} sx={{ color: "#7E9BC1" }}>–</Box>}
                  </TableCell>)}
                </TableRow>;
              });
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" }, mt: 2 }}>
        <Button component={RouterLink} to="/pricing" variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ width: { xs: "100%", sm: "auto" }, bgcolor: "#061F43", color: "#FFFFFF", px: 3, py: 1.3, borderRadius: 2, fontWeight: 800, textTransform: "none", "&:hover": { bgcolor: "#123E6D" } }}>{isEn ? "See prices" : "Δείτε τις τιμές"}</Button>
      </Box>
    </Container>
  </Box>;
}
