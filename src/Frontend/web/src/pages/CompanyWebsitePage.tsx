import { useState, type ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  Box, Button, Card, Container, Drawer, IconButton, Stack, Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import CloudQueueRoundedIcon from "@mui/icons-material/CloudQueueRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import ContactSupportRoundedIcon from "@mui/icons-material/ContactSupportRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import WebRoundedIcon from "@mui/icons-material/WebRounded";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "../components/LanguageToggle";

const NAVY = "#0b2545";
const BLUE = "#087ceB";
const INK = "#183956";
const SOFT = "#5b738b";

type CompanyNavItem = { slug: string; el: string; en: string };
const navItems: CompanyNavItem[] = [
  { slug: "", el: "Αρχική", en: "Home" },
  { slug: "about", el: "Εταιρεία", en: "Company" },
  { slug: "solutions", el: "Λύσεις", en: "Solutions" },
  { slug: "services", el: "Υπηρεσίες", en: "Services" },
  { slug: "customers", el: "Πελάτες", en: "Customers" },
  { slug: "contact", el: "Επικοινωνία", en: "Contact" },
];

function routeFor(slug: string) { return slug ? `/company/${slug}` : "/company"; }

function CompanyHeader({ english, active, onNavigate }: { english: boolean; active: string; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  return <Box component="header" sx={{ position: "sticky", top: 0, zIndex: 30, px: { xs: 1, md: 2 }, pt: { xs: 1, md: 1.5 }, pb: 1, background: "linear-gradient(180deg,rgba(239,247,255,.96),rgba(239,247,255,.72))", backdropFilter: "blur(14px)" }}>
    <Container maxWidth={false} sx={{ maxWidth: 1480, px: { xs: 1, sm: 2 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5} sx={{ minHeight: { xs: 62, md: 70 }, px: { xs: 1.25, md: 2.5 }, py: 1, border: "1px solid rgba(122,166,205,.25)", borderRadius: { xs: 2.5, md: 3 }, bgcolor: "rgba(255,255,255,.93)", boxShadow: "0 10px 32px rgba(11,43,84,.10)" }}>
        <Box component={RouterLink} to="/company" onClick={onNavigate} aria-label="KALYPSIS Software Solutions — αρχική" sx={{ display: "flex", alignItems: "center", minWidth: 120, flexShrink: 0 }}>
          <Box component="img" src="/kalypsis-logo.png" alt="KALYPSIS SOFTWARE SOLUTIONS" sx={{ width: { xs: 145, sm: 170, md: 195 }, height: { xs: 42, md: 48 }, objectFit: "contain", objectPosition: "left center" }} />
        </Box>
        <Stack component="nav" aria-label={english ? "Company navigation" : "Πλοήγηση εταιρείας"} direction="row" alignItems="center" justifyContent="center" gap={{ md: 1, lg: 2 }} sx={{ display: { xs: "none", lg: "flex" }, flex: 1, minWidth: 0 }}>
          {navItems.map(item => <Box key={item.slug || "home"} component={RouterLink} to={routeFor(item.slug)} onClick={onNavigate} aria-current={active === item.slug ? "page" : undefined} sx={{ px: 1, py: 1, whiteSpace: "nowrap", color: active === item.slug ? BLUE : NAVY, fontSize: 14, fontWeight: active === item.slug ? 850 : 700, textDecoration: "none", borderBottom: active === item.slug ? `2px solid ${BLUE}` : "2px solid transparent", transition: "color .18s ease,border-color .18s ease", "&:hover": { color: BLUE, borderColor: BLUE } }}>{english ? item.en : item.el}</Box>)}
        </Stack>
        <Stack direction="row" alignItems="center" gap={{ xs: .5, sm: 1.25 }} sx={{ flexShrink: 0 }}>
          <Box sx={{ display: { xs: "none", sm: "block" } }}><LanguageToggle /></Box>
          <Button component={RouterLink} to="/login" variant="contained" startIcon={<GroupsRoundedIcon />} sx={{ display: { xs: "none", md: "inline-flex" }, borderRadius: 2, bgcolor: NAVY, px: 2, py: 1.1, fontWeight: 850, textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#164b80", boxShadow: "none" } }}>{english ? "Sign in" : "Σύνδεση"}</Button>
          <IconButton aria-label={english ? "Open menu" : "Άνοιγμα μενού"} onClick={() => setOpen(true)} sx={{ display: { xs: "inline-flex", lg: "none" }, border: "1px solid #d6e5f1", color: NAVY, bgcolor: "#f8fbfe", borderRadius: 1.75 }}><MenuRoundedIcon /></IconButton>
        </Stack>
      </Stack>
    </Container>
    <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: 300, sm: 360 }, p: 2, bgcolor: "#f8fbfe" } }}>
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 1.25, borderBottom: "1px solid #d9e5ef" }}><Box component="img" src="/kalypsis-logo.png" alt="KALYPSIS" sx={{ width: 175, height: 48, objectFit: "contain", objectPosition: "left center" }} /><IconButton aria-label={english ? "Close menu" : "Κλείσιμο μενού"} onClick={() => setOpen(false)}><CloseRoundedIcon /></IconButton></Stack>
        <Box sx={{ py: 1 }}><LanguageToggle /></Box>
        {navItems.map(item => <Button key={item.slug || "home"} component={RouterLink} to={routeFor(item.slug)} onClick={() => setOpen(false)} variant={active === item.slug ? "contained" : "text"} sx={{ justifyContent: "flex-start", px: 1.5, py: 1.2, fontWeight: 850, textTransform: "none", color: active === item.slug ? "#fff" : NAVY, bgcolor: active === item.slug ? BLUE : "transparent", "&:hover": { bgcolor: active === item.slug ? "#0569c8" : "#eaf3fb" } }}>{english ? item.en : item.el}</Button>)}
        <Button component={RouterLink} to="/login" onClick={() => setOpen(false)} startIcon={<GroupsRoundedIcon />} variant="contained" sx={{ mt: 1, py: 1.2, bgcolor: NAVY, textTransform: "none", fontWeight: 850 }}>{english ? "Sign in" : "Σύνδεση"}</Button>
      </Stack>
    </Drawer>
  </Box>;
}

function SectionTitle({ eyebrow, title, body, light = false }: { eyebrow: string; title: string; body?: string; light?: boolean }) {
  return <Box sx={{ maxWidth: 820, mb: 3.5 }}><Typography sx={{ color: light ? "#8bdcff" : BLUE, textTransform: "uppercase", letterSpacing: ".16em", fontWeight: 850, fontSize: 12, mb: 1 }}>{eyebrow}</Typography><Typography component="h2" sx={{ color: light ? "#fff" : NAVY, fontWeight: 900, fontSize: { xs: 28, md: 39 }, lineHeight: 1.16, letterSpacing: "-.025em" }}>{title}</Typography>{body && <Typography sx={{ mt: 1.25, color: light ? "rgba(255,255,255,.78)" : SOFT, fontSize: { xs: 15, md: 17 }, lineHeight: 1.75 }}>{body}</Typography>}</Box>;
}

function FeatureCard({ icon, title, body, to, linkLabel, logo }: { icon: ReactNode; title: string; body: string; to: string; linkLabel: string; logo?: string }) {
  return <Card component={RouterLink} to={to} sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 350, p: { xs: 2, md: 2.5 }, border: "1px solid #dce8f2", borderRadius: 3, textDecoration: "none", color: "inherit", bgcolor: "#fff", boxShadow: "0 8px 25px rgba(17,57,93,.055)", transition: "transform .22s ease,box-shadow .22s ease,border-color .22s ease", "&:hover": { transform: "translateY(-5px)", borderColor: "#96c9ea", boxShadow: "0 18px 38px rgba(17,57,93,.12)" }, "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } } }}>
    <Box sx={{ minHeight: { xs: 142, md: 168 }, mb: 2, mx: -1, mt: -0.5, px: 1, display: "grid", placeItems: "center", borderRadius: 2.25, background: "linear-gradient(145deg,#f5faff,#eaf4fc)", border: "1px solid #edf3f8", position: "relative" }}>
      {logo ? <Box component="img" src={logo} alt={`${title} logo`} sx={{ maxWidth: "94%", width: "88%", height: { xs: 116, md: 142 }, objectFit: "contain", objectPosition: "center", filter: "drop-shadow(0 8px 14px rgba(11,43,84,.12))" }} /> : <Box sx={{ width: 88, height: 88, display: "grid", placeItems: "center", borderRadius: 3, color: BLUE, bgcolor: "#dceefa", "& svg": { fontSize: 48 } }}>{icon}</Box>}
      <ArrowForwardRoundedIcon sx={{ position: "absolute", right: 12, top: 12, color: BLUE, fontSize: 22 }} />
    </Box>
    <Typography component="h3" sx={{ color: NAVY, fontWeight: 900, fontSize: 20, mb: 1 }}>{title}</Typography>
    <Typography sx={{ color: SOFT, fontSize: 14.5, lineHeight: 1.72, flex: 1 }}>{body}</Typography>
    <Typography sx={{ color: BLUE, fontWeight: 850, fontSize: 14, mt: 2 }}>{linkLabel} <Box component="span" aria-hidden>→</Box></Typography>
  </Card>;
}

function CompanyHome({ english }: { english: boolean }) {
  const products = english ? [
    { title: "KALYPSIS Web", body: "Browser-based backoffice for insurance offices: customer and policy records, production, commissions and finances.", to: "/pricing", logo: "/kalypsis-logo.png", icon: <WebRoundedIcon /> },
    { title: "KALYPSIS Desktop", body: "A Windows application for everyday office work, with customer, policy, vehicle and financial records.", to: "/download", logo: "/kalypsis-logo.png", icon: <DesktopWindowsIcon /> },
    { title: "InsureOne", body: "A multi-insurer quotation workspace connected with the KALYPSIS FrontOffice offering.", to: "/company/insureone", logo: "/assets/insureone-plugin-logo.png", icon: <ShieldRoundedIcon /> },
    { title: "KALYPSIS Hosting", body: "Website and application hosting services presented with their current availability and request options.", to: "/hosting", logo: "/images/hosting/kalypsis-hosting-logo.png", icon: <CloudQueueRoundedIcon /> },
  ] : [
    { title: "KALYPSIS Web", body: "Web backoffice για ασφαλιστικά γραφεία: καρτέλες πελατών και συμβολαίων, παραγωγή, προμήθειες και οικονομικά.", to: "/pricing", logo: "/kalypsis-logo.png", icon: <WebRoundedIcon /> },
    { title: "KALYPSIS Desktop", body: "Εφαρμογή Windows για την καθημερινή εργασία του γραφείου, με καρτέλες πελατών, συμβολαίων, οχημάτων και οικονομικών.", to: "/download", logo: "/kalypsis-logo.png", icon: <DesktopWindowsIcon /> },
    { title: "InsureOne", body: "Περιβάλλον πολυτιμολόγησης ασφαλιστικών προϊόντων, συνδεδεμένο με τις υπηρεσίες FrontOffice της KALYPSIS.", to: "/company/insureone", logo: "/assets/insureone-plugin-logo.png", icon: <ShieldRoundedIcon /> },
    { title: "KALYPSIS Hosting", body: "Υπηρεσίες φιλοξενίας ιστοσελίδων και εφαρμογών, με ενημέρωση για τη διαθεσιμότητα και τον τρόπο υποβολής αιτήματος.", to: "/hosting", logo: "/images/hosting/kalypsis-hosting-logo.png", icon: <CloudQueueRoundedIcon /> },
  ];
  const ecosystemPoints: [ReactNode, string, string][] = english ? [
    [<HubRoundedIcon />, "Connected records", "Customers, policies, vehicles, partners, claims and financial activity are organised in the backoffice."],
    [<QueryStatsRoundedIcon />, "Production and reporting", "Production lists, commissions, interactive statistics and table-based exports support office oversight."],
    [<ShieldRoundedIcon />, "Insurance workflows", "FrontOffice offers quotation tools and request workflows for insurance offices."],
  ] : [
    [<HubRoundedIcon />, "Συνδεδεμένες καρτέλες", "Πελάτες, συμβόλαια, οχήματα, συνεργάτες, ζημιές και οικονομικές κινήσεις οργανώνονται στο backoffice."],
    [<QueryStatsRoundedIcon />, "Παραγωγή και αναφορές", "Λίστες παραγωγής, προμήθειες, διαδραστικά στατιστικά και εξαγωγές βοηθούν στην παρακολούθηση του γραφείου."],
    [<ShieldRoundedIcon />, "Ασφαλιστικές ροές", "Το FrontOffice προσφέρει εργαλεία τιμολόγησης και διαχείρισης αιτημάτων για ασφαλιστικά γραφεία."],
  ];
  return <>
    <Box component="section" sx={{ position: "relative", overflow: "hidden", color: "#fff", backgroundImage: "linear-gradient(105deg,rgba(5,25,49,.90) 0%,rgba(7,38,70,.78) 48%,rgba(7,41,72,.36) 100%),url('/images/company/kalypsis-company-hero.png')", backgroundSize: "cover", backgroundPosition: "center 55%", backgroundRepeat: "no-repeat", "&::before": { content: '""', pointerEvents: "none", position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(5,25,49,.08),rgba(5,25,49,.30))" } }}>
      <Container maxWidth={false} sx={{ maxWidth: 1440, px: { xs: 2.5, md: 5 }, py: { xs: 6, md: 9 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.03fr .97fr" }, gap: { xs: 4, md: 5 }, alignItems: "center", position: "relative", zIndex: 1 }}>
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Typography sx={{ color: "#a9e1ff", fontWeight: 900, letterSpacing: ".18em", fontSize: 12, mb: 2, textShadow: "0 2px 12px rgba(0,0,0,.3)" }}>{english ? "DIGITAL SOLUTIONS FOR BUSINESS" : "ΨΗΦΙΑΚΕΣ ΛΥΣΕΙΣ ΓΙΑ ΕΠΙΧΕΙΡΗΣΕΙΣ"}</Typography>
            <Typography component="h1" sx={{ color: "#fff", fontWeight: 950, letterSpacing: "-.045em", lineHeight: 1.03, fontSize: { xs: 42, sm: 54, lg: 68 }, maxWidth: 730, textShadow: "0 4px 24px rgba(0,0,0,.28)" }}>{english ? <>We support your business’s <Box component="span" sx={{ color: "#7dd3fc" }}>digital future.</Box></> : <>Στηρίζουμε το αύριο της <Box component="span" sx={{ color: "#7dd3fc" }}>επιχείρησής σας.</Box></>}</Typography>
            <Typography sx={{ color: "rgba(255,255,255,.88)", fontSize: { xs: 16, md: 18 }, lineHeight: 1.75, maxWidth: 650, mt: 2.5, textShadow: "0 2px 12px rgba(0,0,0,.35)" }}>{english ? "KALYPSIS SOFTWARE SOLUTIONS builds connected digital tools for insurance offices: web and desktop backoffice, quotation workflows and hosting services." : "Η KALYPSIS SOFTWARE SOLUTIONS αναπτύσσει συνδεδεμένα ψηφιακά εργαλεία για ασφαλιστικά γραφεία: web και desktop backoffice, ροές τιμολόγησης και υπηρεσίες φιλοξενίας."}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.25} sx={{ mt: 3.5 }}>
              <Button component={RouterLink} to="/company/solutions" variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ bgcolor: "#087ceb", color: "#fff", borderRadius: 1.75, px: 3, py: 1.35, fontWeight: 850, textTransform: "none", boxShadow: "0 9px 24px rgba(0,0,0,.25)", "&:hover": { bgcolor: "#0569c8" } }}>{english ? "Explore our solutions" : "Δείτε τις λύσεις μας"}</Button>
              <Button component={RouterLink} to="/company/contact" variant="outlined" startIcon={<ContactSupportRoundedIcon />} sx={{ borderRadius: 1.75, px: 2.5, py: 1.25, fontWeight: 850, textTransform: "none", borderWidth: 1.5, color: "#fff", borderColor: "rgba(255,255,255,.75)", bgcolor: "rgba(8,30,52,.32)", backdropFilter: "blur(8px)", "&:hover": { borderWidth: 1.5, bgcolor: "rgba(255,255,255,.14)", borderColor: "#fff" } }}>{english ? "Contact our team" : "Επικοινωνήστε μαζί μας"}</Button>
            </Stack>
          </Box>
          <Box aria-hidden sx={{ display: { xs: "none", md: "flex" }, minHeight: 340, alignItems: "flex-end", justifyContent: "flex-end", position: "relative" }}>
            <Box sx={{ width: "min(100%,390px)", p: 2.25, border: "1px solid rgba(255,255,255,.36)", borderRadius: 3, bgcolor: "rgba(7,27,48,.42)", backdropFilter: "blur(12px)", boxShadow: "0 24px 60px rgba(0,0,0,.24)", animation: "company-float 5s ease-in-out infinite", "@keyframes company-float": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } }, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
              <Box component="img" src="/kalypsis-logo.png" alt="" sx={{ width: "100%", height: 66, objectFit: "contain", objectPosition: "left center", filter: "brightness(0) invert(1)" }} />
              <Typography sx={{ color: "#a9e1ff", fontWeight: 850, fontSize: 11, letterSpacing: ".15em", mt: 1 }}>{english ? "CONNECTED SOFTWARE ECOSYSTEM" : "ΣΥΝΔΕΔΕΜΕΝΟ ΟΙΚΟΣΥΣΤΗΜΑ ΛΟΓΙΣΜΙΚΟΥ"}</Typography>
              <Typography sx={{ color: "rgba(255,255,255,.9)", fontWeight: 800, fontSize: 15, mt: 1.1 }}>{english ? "Web · Desktop · InsureOne" : "Web · Desktop · InsureOne"}</Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
    <Container maxWidth={false} sx={{ maxWidth: 1440, px: { xs: 2.5, md: 5 }, py: { xs: 6, md: 8 } }}>
      <SectionTitle eyebrow={english ? "OUR SOLUTIONS" : "ΟΙ ΛΥΣΕΙΣ ΜΑΣ"} title={english ? "Products for connected insurance work." : "Λογισμικό για μια συνδεδεμένη ασφαλιστική εργασία."} body={english ? "Explore KALYPSIS products and services, each with a clear route to its own information and next step." : "Γνωρίστε τα προϊόντα και τις υπηρεσίες της KALYPSIS, με ξεκάθαρη πρόσβαση στις πληροφορίες και στα επόμενα βήματα για το καθένα."} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", xl: "repeat(4,minmax(0,1fr))" }, gap: 1.75 }}>{products.map(product => <FeatureCard key={product.title} {...product} linkLabel={english ? "More information" : "Περισσότερα"} />)}</Box>
    </Container>
    <Box sx={{ bgcolor: NAVY, color: "#fff" }}><Container maxWidth={false} sx={{ maxWidth: 1440, px: { xs: 2.5, md: 5 }, py: { xs: 5, md: 6 } }}>
      <SectionTitle light eyebrow={english ? "ONE ECOSYSTEM" : "ΕΝΑ ΟΙΚΟΣΥΣΤΗΜΑ"} title={english ? "The tools work together around the office." : "Τα εργαλεία συνεργάζονται γύρω από τις ανάγκες του γραφείου."} body={english ? "Backoffice records, quotation workflows and hosting services are presented as parts of one software ecosystem." : "Οι καρτέλες του backoffice, οι ροές τιμολόγησης και οι υπηρεσίες φιλοξενίας παρουσιάζονται ως μέρη ενός ενιαίου οικοσυστήματος λογισμικού."} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,minmax(0,1fr))" }, gap: 1.5 }}>{ecosystemPoints.map(([icon, title, body]) => <Box key={title} sx={{ p: 2.25, border: "1px solid rgba(176,214,241,.22)", borderRadius: 2.5, bgcolor: "rgba(255,255,255,.065)" }}><Box sx={{ color: "#59c5ed", mb: 1, "& svg": { fontSize: 30 } }}>{icon}</Box><Typography fontWeight={900} sx={{ fontSize: 18 }}>{title}</Typography><Typography sx={{ color: "rgba(255,255,255,.74)", lineHeight: 1.7, mt: .75 }}>{body}</Typography></Box>)}</Box>
    </Container></Box>
    <CompanyContactCallout english={english} />
  </>;
}

function CompanyContactCallout({ english }: { english: boolean }) {
  return <Container maxWidth={false} sx={{ maxWidth: 1440, px: { xs: 2.5, md: 5 }, py: { xs: 5, md: 7 } }}><Box sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, color: "#fff", background: "linear-gradient(110deg,#092d58,#075d9f 62%,#0781aa)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 2 }}><Box><Typography component="h2" sx={{ fontSize: { xs: 24, md: 31 }, fontWeight: 900 }}>{english ? "Let’s talk about your business." : "Ας συζητήσουμε για την επιχείρησή σας."}</Typography><Typography sx={{ color: "rgba(255,255,255,.8)", mt: .75 }}>{english ? "Contact the KALYPSIS team for information about our products." : "Επικοινωνήστε με την ομάδα KALYPSIS για πληροφορίες σχετικά με τα προϊόντα μας."}</Typography></Box><Button component={RouterLink} to="/company/contact" variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ bgcolor: "#fff", color: NAVY, px: 2.5, py: 1.2, fontWeight: 900, textTransform: "none", "&:hover": { bgcolor: "#eaf5fc" } }}>{english ? "Contact us" : "Επικοινωνήστε μαζί μας"}</Button></Box></Container>;
}

type CompanyDetailPoint = [ReactNode, string, string];
type CompanyDetailContent = { eyebrow: string; title: string; body: string; points: CompanyDetailPoint[] };

function CompanyDetail({ english, slug }: { english: boolean; slug: string }) {
  const data: Record<string, CompanyDetailContent> = english ? {
    about: { eyebrow: "ABOUT KALYPSIS", title: "Software built around the daily work of insurance offices.", body: "KALYPSIS SOFTWARE SOLUTIONS develops a connected digital ecosystem for insurance-office management, quotation and hosting.", points: [[<BusinessRoundedIcon />, "A connected ecosystem", "Web and Windows backoffice products, FrontOffice quotation workflows and hosting services."], [<CodeRoundedIcon />, "Software for real workflows", "Customer, policy, vehicle, claims, production and financial records are represented in the product experience."], [<GroupsRoundedIcon />, "For insurance professionals", "Tools designed for agencies, producers and teams that coordinate office work."]] },
    solutions: { eyebrow: "OUR SOLUTIONS", title: "Choose the product that fits the work you need to do.", body: "Each product has its own information page and a direct path to the relevant KALYPSIS service.", points: [[<WebRoundedIcon />, "KALYPSIS Web", "Browser-based backoffice for customers, policies, production, commissions and finances."], [<DesktopWindowsIcon />, "KALYPSIS Desktop", "Windows application for office records, workflows and local data entry."], [<ShieldRoundedIcon />, "InsureOne", "A public product overview for the KALYPSIS multi-insurer quotation workspace."], [<CloudQueueRoundedIcon />, "KALYPSIS Hosting", "Website and application hosting information and request options."]] },
    services: { eyebrow: "SERVICES", title: "Digital services for insurance-office operations.", body: "KALYPSIS brings backoffice management, insurance quotation workflows, integrations and hosting into a clear product ecosystem.", points: [[<HubRoundedIcon />, "Backoffice management", "Manage linked customer, policy, partner, vehicle, claims and financial information."], [<QueryStatsRoundedIcon />, "Reporting and oversight", "Use production lists, commission views, statistics, filters and exports."], [<CodeRoundedIcon />, "Insurance integrations", "Company-bridge workflows support data exchange and policy imports where configured."], [<CloudQueueRoundedIcon />, "Web hosting", "Review hosting information and submit an enquiry through the hosting page."]] },
    customers: { eyebrow: "WHO WE SERVE", title: "Tools for insurance teams and the people they serve.", body: "The KALYPSIS product ecosystem is shaped around the work of insurance offices and their day-to-day connections.", points: [[<BusinessRoundedIcon />, "Insurance offices", "Coordinate customer records, policies, production, receipts and office finances."], [<GroupsRoundedIcon />, "Producers and teams", "Organise partner information, production and commission statements."], [<ShieldRoundedIcon />, "Insurance customers", "Support quotation requests and customer-facing workflows through FrontOffice services."], [<WebRoundedIcon />, "Businesses online", "Review KALYPSIS Hosting information for websites and applications."]] },
    contact: { eyebrow: "CONTACT", title: "Talk with the KALYPSIS team.", body: "Ask about KALYPSIS software, FrontOffice, desktop installation or hosting. Use the contact form for a message with the right context.", points: [[<ContactSupportRoundedIcon />, "Contact form", "Send a request through the KALYPSIS contact page."], [<CodeRoundedIcon />, "Product information", "Tell us which product or workflow you would like to discuss."], [<CloudQueueRoundedIcon />, "Hosting enquiries", "For hosting information, visit the dedicated KALYPSIS Hosting page."]] },
    insureone: { eyebrow: "KALYPSIS FRONTOFFICE", title: "InsureOne brings insurance quotation work into one workspace.", body: "A KALYPSIS quotation workspace for insurance professionals, with supported product branches and a dedicated authenticated environment.", points: [[<ShieldRoundedIcon />, "Multi-insurer quotation", "Compare available insurance products through the configured FrontOffice workflows."], [<DevicesRoundedIcon />, "Dedicated workspace", "Access the quotation dashboard separately from the main backoffice shell."], [<HubRoundedIcon />, "Connected to KALYPSIS", "Use the FrontOffice package and its authenticated tools as enabled for your office."]] },
  } : {
    about: { eyebrow: "ΣΧΕΤΙΚΑ ΜΕ ΤΗΝ KALYPSIS", title: "Λογισμικό σχεδιασμένο γύρω από την καθημερινή εργασία του ασφαλιστικού γραφείου.", body: "Η KALYPSIS SOFTWARE SOLUTIONS αναπτύσσει ένα συνδεδεμένο ψηφιακό οικοσύστημα για διαχείριση ασφαλιστικού γραφείου, τιμολόγηση και φιλοξενία.", points: [[<BusinessRoundedIcon />, "Συνδεδεμένο οικοσύστημα", "Προϊόντα backoffice για web και Windows, ροές τιμολόγησης FrontOffice και υπηρεσίες φιλοξενίας."], [<CodeRoundedIcon />, "Λογισμικό για πραγματικές ροές", "Πελάτες, συμβόλαια, οχήματα, ζημιές, παραγωγή και οικονομικά αποτυπώνονται στο περιβάλλον του προϊόντος."], [<GroupsRoundedIcon />, "Για ασφαλιστικούς επαγγελματίες", "Εργαλεία σχεδιασμένα για πρακτορεία, παραγωγούς και ομάδες ασφαλιστικών γραφείων."]] },
    solutions: { eyebrow: "ΟΙ ΛΥΣΕΙΣ ΜΑΣ", title: "Επιλέξτε το προϊόν που ταιριάζει στην εργασία σας.", body: "Κάθε προϊόν έχει δική του ενημερωτική σελίδα και άμεση διαδρομή προς τη σχετική υπηρεσία της KALYPSIS.", points: [[<WebRoundedIcon />, "KALYPSIS Web", "Web backoffice για πελάτες, συμβόλαια, παραγωγή, προμήθειες και οικονομικά."], [<DesktopWindowsIcon />, "KALYPSIS Desktop", "Εφαρμογή Windows για εγγραφές γραφείου, ροές εργασίας και τοπική καταχώρηση δεδομένων."], [<ShieldRoundedIcon />, "InsureOne", "Δημόσια παρουσίαση του περιβάλλοντος πολυτιμολόγησης της KALYPSIS."], [<CloudQueueRoundedIcon />, "KALYPSIS Hosting", "Πληροφορίες και επιλογές αιτήματος για φιλοξενία ιστοσελίδων και εφαρμογών."]] },
    services: { eyebrow: "ΥΠΗΡΕΣΙΕΣ", title: "Ψηφιακές υπηρεσίες για τη λειτουργία ασφαλιστικών γραφείων.", body: "Η KALYPSIS συνδυάζει διαχείριση backoffice, ροές ασφαλιστικής τιμολόγησης, διασυνδέσεις και φιλοξενία σε ένα σαφές οικοσύστημα προϊόντων.", points: [[<HubRoundedIcon />, "Διαχείριση backoffice", "Διαχειριστείτε συνδεδεμένες πληροφορίες πελατών, συμβολαίων, συνεργατών, οχημάτων, ζημιών και οικονομικών."], [<QueryStatsRoundedIcon />, "Αναφορές και έλεγχος", "Χρησιμοποιήστε λίστες παραγωγής, εικόνα προμηθειών, στατιστικά, φίλτρα και εξαγωγές."], [<CodeRoundedIcon />, "Διασυνδέσεις ασφαλιστικών", "Οι ροές γεφυρών εταιρειών υποστηρίζουν ανταλλαγή δεδομένων και εισαγωγή συμβολαίων όπου έχουν ρυθμιστεί."], [<CloudQueueRoundedIcon />, "Φιλοξενία ιστοσελίδων", "Δείτε τις πληροφορίες φιλοξενίας και υποβάλετε αίτημα από την ειδική σελίδα."]] },
    customers: { eyebrow: "ΣΕ ΠΟΙΟΥΣ ΑΠΕΥΘΥΝΟΜΑΣΤΕ", title: "Εργαλεία για ασφαλιστικές ομάδες και τους ανθρώπους που εξυπηρετούν.", body: "Το οικοσύστημα KALYPSIS οργανώνεται γύρω από την εργασία των ασφαλιστικών γραφείων και τις καθημερινές συνεργασίες τους.", points: [[<BusinessRoundedIcon />, "Ασφαλιστικά γραφεία", "Οργανώστε πελατολόγιο, συμβόλαια, παραγωγή, εισπράξεις και οικονομικά γραφείου."], [<GroupsRoundedIcon />, "Συνεργάτες και ομάδες", "Διαχειριστείτε πληροφορίες συνεργατών, παραγωγή και εκκαθαρίσεις προμηθειών."], [<ShieldRoundedIcon />, "Ασφαλισμένοι πελάτες", "Υποστηρίξτε αιτήματα τιμολόγησης και ροές επικοινωνίας μέσω υπηρεσιών FrontOffice."], [<WebRoundedIcon />, "Επιχειρήσεις online", "Δείτε τις πληροφορίες φιλοξενίας ιστοσελίδων και εφαρμογών της KALYPSIS."]] },
    contact: { eyebrow: "ΕΠΙΚΟΙΝΩΝΙΑ", title: "Μιλήστε με την ομάδα KALYPSIS.", body: "Ρωτήστε μας για το λογισμικό KALYPSIS, το FrontOffice, την desktop εγκατάσταση ή τη φιλοξενία. Χρησιμοποιήστε τη φόρμα επικοινωνίας για να μας στείλετε το αίτημά σας.", points: [[<ContactSupportRoundedIcon />, "Φόρμα επικοινωνίας", "Στείλτε μήνυμα από την επίσημη σελίδα επικοινωνίας της KALYPSIS."], [<CodeRoundedIcon />, "Πληροφορίες προϊόντος", "Αναφέρετε ποιο προϊόν ή ποια ροή εργασίας θέλετε να συζητήσουμε."], [<CloudQueueRoundedIcon />, "Ερωτήσεις φιλοξενίας", "Για πληροφορίες hosting, επισκεφθείτε την ξεχωριστή σελίδα KALYPSIS Hosting."]] },
    insureone: { eyebrow: "KALYPSIS FRONTOFFICE", title: "Το InsureOne συγκεντρώνει την εργασία ασφαλιστικής τιμολόγησης σε ένα περιβάλλον.", body: "Περιβάλλον τιμολόγησης της KALYPSIS για ασφαλιστικούς επαγγελματίες, με διαθέσιμους κλάδους προϊόντων και ξεχωριστό προστατευμένο χώρο εργασίας.", points: [[<ShieldRoundedIcon />, "Πολυτιμολόγηση", "Σύγκριση διαθέσιμων ασφαλιστικών προϊόντων μέσα από τις ρυθμισμένες ροές FrontOffice."], [<DevicesRoundedIcon />, "Αυτόνομο περιβάλλον", "Πρόσβαση στο dashboard τιμολόγησης ξεχωριστά από το βασικό περιβάλλον backoffice."], [<HubRoundedIcon />, "Σύνδεση με KALYPSIS", "Χρήση των εργαλείων FrontOffice που έχουν ενεργοποιηθεί για το ασφαλιστικό σας γραφείο."]] },
  };
  const page = data[slug as keyof typeof data] ?? data.about;
  const action = slug === "contact" ? "/contact" : slug === "insureone" ? "/frontoffice-quoting?view=dashboard" : slug === "solutions" ? "/pricing" : slug === "services" ? "/hosting" : slug === "customers" ? "/register" : "/company/solutions";
  const actionText = slug === "contact" ? (english ? "Open contact form" : "Άνοιγμα φόρμας επικοινωνίας") : slug === "insureone" ? (english ? "Open quotation workspace" : "Άνοιγμα περιβάλλοντος τιμολόγησης") : slug === "solutions" ? (english ? "View packages" : "Δείτε τα πακέτα") : slug === "services" ? (english ? "Explore hosting" : "Δείτε το Hosting") : slug === "customers" ? (english ? "Get started" : "Ξεκινήστε") : (english ? "Explore our products" : "Δείτε τα προϊόντα μας");
  return <>
    <Box sx={{ background: "linear-gradient(130deg,#f2f8fd,#e4f1fa)" }}><Container maxWidth={false} sx={{ maxWidth: 1300, px: { xs: 2.5, md: 5 }, py: { xs: 6, md: 9 } }}>
      <Typography sx={{ color: BLUE, letterSpacing: ".17em", fontSize: 12, fontWeight: 900, mb: 1.5 }}>{page.eyebrow}</Typography><Typography component="h1" sx={{ color: NAVY, fontSize: { xs: 36, md: 55 }, lineHeight: 1.08, letterSpacing: "-.035em", fontWeight: 950, maxWidth: 980 }}>{page.title}</Typography><Typography sx={{ color: SOFT, fontSize: { xs: 16, md: 19 }, lineHeight: 1.75, maxWidth: 900, mt: 2 }}>{page.body}</Typography>
      {slug === "insureone" && <Box component="img" src="/assets/insureone-plugin-logo.png" alt="InsureOne KALYPSIS Plugin" sx={{ display: "block", mt: 3, width: { xs: 230, md: 320 }, maxHeight: 140, objectFit: "contain", objectPosition: "left center", borderRadius: 2, bgcolor: "#fff", border: "1px solid #e0ebf4" }} />}
      <Button component={RouterLink} to={action} variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 3, bgcolor: NAVY, color: "#fff", borderRadius: 1.75, px: 2.5, py: 1.25, fontWeight: 850, textTransform: "none", "&:hover": { bgcolor: "#164b80" } }}>{actionText}</Button>
    </Container></Box>
    <Container maxWidth={false} sx={{ maxWidth: 1300, px: { xs: 2.5, md: 5 }, py: { xs: 5, md: 7 } }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))" }, gap: 1.75 }}>{page.points.map(([icon, title, body]) => <Box key={title} sx={{ p: { xs: 2, md: 2.5 }, minHeight: 170, border: "1px solid #dce8f2", borderRadius: 2.5, bgcolor: "#fff", boxShadow: "0 7px 23px rgba(17,57,93,.045)" }}><Box sx={{ color: BLUE, mb: 1, "& svg": { fontSize: 30 } }}>{icon}</Box><Typography component="h2" sx={{ color: NAVY, fontWeight: 900, fontSize: 19 }}>{title}</Typography><Typography sx={{ color: SOFT, lineHeight: 1.7, mt: .75 }}>{body}</Typography></Box>)}</Box>
    </Container>
    <CompanyContactCallout english={english} />
  </>;
}

export function CompanyWebsitePage() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const english = (i18n.resolvedLanguage ?? i18n.language).startsWith("en");
  const slug = location.pathname.replace(/^\/company\/?/, "").replace(/\/$/, "");
  const active = slug === "" || slug === "insureone" ? (slug === "" ? "" : "solutions") : slug.split("/")[0];
  const valid = ["", "about", "solutions", "services", "customers", "contact", "insureone"];
  return <Box sx={{ minHeight: "100vh", color: INK, bgcolor: "#fff", fontFamily: '"Inter","Segoe UI",system-ui,sans-serif' }}>
    <CompanyHeader english={english} active={active} onNavigate={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
    <Box component="main">{slug === "" ? <CompanyHome english={english} /> : <CompanyDetail english={english} slug={valid.includes(slug) ? slug : "about"} />}</Box>
    <Box component="footer" sx={{ bgcolor: "#f2f7fb", borderTop: "1px solid #dbe7f0" }}><Container maxWidth={false} sx={{ maxWidth: 1440, px: { xs: 2.5, md: 5 }, py: 3 }}><Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" gap={2}><Stack direction="row" alignItems="center" gap={1.25}><Box component="img" src="/kalypsis-logo.png" alt="KALYPSIS" sx={{ width: 150, height: 38, objectFit: "contain", objectPosition: "left center" }} /><Typography variant="caption" sx={{ color: SOFT }}>Software Solutions</Typography></Stack><Stack direction="row" useFlexGap flexWrap="wrap" gap={{ xs: 1.5, md: 2.5 }}>{navItems.slice(1).map(item => <Box key={item.slug} component={RouterLink} to={routeFor(item.slug)} sx={{ textDecoration: "none", color: SOFT, fontSize: 13, fontWeight: 750, "&:hover": { color: BLUE } }}>{english ? item.en : item.el}</Box>)}</Stack><Typography variant="caption" sx={{ color: SOFT }}>© {new Date().getFullYear()} KALYPSIS SOFTWARE SOLUTIONS</Typography></Stack></Container></Box>
  </Box>;
}
