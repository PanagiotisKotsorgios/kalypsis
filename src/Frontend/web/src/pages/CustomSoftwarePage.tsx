import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Card,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoModeRoundedIcon from "@mui/icons-material/AutoModeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import DesignServicesRoundedIcon from "@mui/icons-material/DesignServicesRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import { useTranslation } from "react-i18next";
import { PublicShell } from "../components/PublicShell";
import { CustomSoftwareInquiryDialog } from "../components/CustomSoftwareInquiryDialog";

type CategoryId =
  | "all"
  | "web"
  | "desktop"
  | "crm"
  | "automation"
  | "commerce"
  | "platforms";

interface SoftwareCategory {
  id: CategoryId;
  label: string;
  icon: typeof AppsRoundedIcon;
}

interface SoftwareProject {
  id: string;
  name: string;
  url: string;
  logo: string;
  description: string;
  detail: string;
  categories: CategoryId[];
  tags: string[];
  features: string[];
}

const categories: SoftwareCategory[] = [
  { id: "all", label: "Όλα", icon: AppsRoundedIcon },
  { id: "web", label: "Web εφαρμογές", icon: ComputerRoundedIcon },
  { id: "desktop", label: "Desktop λογισμικό", icon: ComputerRoundedIcon },
  { id: "crm", label: "CRM & ERP", icon: LayersRoundedIcon },
  { id: "automation", label: "Αυτοματισμοί", icon: AutoModeRoundedIcon },
  { id: "commerce", label: "E-commerce", icon: ShoppingCartRoundedIcon },
  { id: "platforms", label: "Custom πλατφόρμες", icon: HubRoundedIcon },
];

const project: SoftwareProject = {
  id: "timologion",
  name: "Timologion",
  url: "https://timologion.gr/",
  logo: "/images/partners/timologion-logo.png",
  description:
    "Πλατφόρμα ηλεκτρονικής τιμολόγησης για την έκδοση και οργάνωση παραστατικών.",
  detail:
    "Μια σύγχρονη web εφαρμογή που βοηθά τις επιχειρήσεις να οργανώνουν πελάτες, είδη και παραστατικά σε ένα καθαρό, εύχρηστο περιβάλλον. Η ηλεκτρονική τιμολόγηση και η διαβίβαση στο myDATA υποστηρίζονται από τη WRAPP Α.Ε., πιστοποιημένο πάροχο ηλεκτρονικής τιμολόγησης.",
  categories: ["web", "crm"],
  tags: ["myDATA", "Ηλεκτρονική τιμολόγηση", "Παραστατικά"],
  features: [
    "Οργάνωση πελατών, ειδών και παραστατικών",
    "Έκδοση και διαχείριση ηλεκτρονικών παραστατικών",
    "Διαβίβαση στο myDATA μέσω πιστοποιημένου παρόχου",
    "Ενημέρωση και αναφορές για την καθημερινή λειτουργία",
  ],
};

const lifecycle = [
  {
    icon: SearchRoundedIcon,
    title: "Ανάλυση απαιτήσεων",
    body: "Καταγράφουμε τις ανάγκες, τις ροές εργασίας και τους στόχους σας.",
  },
  {
    icon: DesignServicesRoundedIcon,
    title: "Σχεδιασμός λύσης",
    body: "Ορίζουμε αρχιτεκτονική, εμπειρία χρήστη και πλάνο υλοποίησης.",
  },
  {
    icon: CodeRoundedIcon,
    title: "Ανάπτυξη",
    body: "Υλοποιούμε το λογισμικό σταδιακά, με τακτική ανατροφοδότηση.",
  },
  {
    icon: FactCheckRoundedIcon,
    title: "Δοκιμές & έλεγχοι",
    body: "Ελέγχουμε λειτουργικότητα, ασφάλεια και ποιότητα πριν την παράδοση.",
  },
  {
    icon: RocketLaunchRoundedIcon,
    title: "Παράδοση & υποστήριξη",
    body: "Θέτουμε τη λύση σε λειτουργία και σας υποστηρίζουμε στη συνέχεια.",
  },
];

const english = {
  eyebrow: "KALYPSIS / CUSTOM SOFTWARE",
  title: "Software designed around your needs.",
  intro:
    "From the first idea through development and support, we build tailored digital solutions for businesses and organizations.",
  request: "Request a project proposal",
  explore: "Explore our work",
  projectsEyebrow: "Selected work",
  projectsTitle: "Explore our solutions",
  projectsIntro: "Examples of the projects and applications we develop.",
  all: "All",
  web: "Web Applications",
  desktop: "Desktop Software",
  crm: "CRM & ERP",
  automation: "Automation",
  commerce: "E-commerce",
  platforms: "Custom Platforms",
  details: "View details",
  external: "Visit timologion.gr",
  workTitle: "How we work",
  workIntro:
    "We follow the complete software development lifecycle, from requirements analysis through launch and ongoing support.",
  ctaEyebrow: "HAVE AN IDEA?",
  ctaTitle: "Let’s build software for your business.",
  ctaBody:
    "Tell us what you need. We’ll explore the requirements together and propose a solution tailored to your goals.",
  ctaButton: "Start a project conversation",
  close: "Close",
  comingSoon: "More projects coming soon",
  emptyTitle: "A solution designed around your business.",
  emptyBody:
    "We build web and desktop applications, business platforms, automations and e-commerce experiences. Tell us what your team needs.",
  detailEyebrow: "PROJECT OVERVIEW",
  capabilities: "Key capabilities",
};

export function CustomSoftwarePage() {
  const { i18n } = useTranslation();
  const isEnglish = i18n.resolvedLanguage?.startsWith("en") ?? false;
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [selectedProject, setSelectedProject] =
    useState<SoftwareProject | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const labels = isEnglish
    ? english
    : {
        eyebrow: "KALYPSIS / CUSTOM SOFTWARE",
        title: "Λογισμικό σχεδιασμένο για τις ανάγκες σας.",
        intro:
          "Από την αρχική ιδέα μέχρι την ανάπτυξη και την υποστήριξη, δημιουργούμε εξειδικευμένες ψηφιακές λύσεις για επιχειρήσεις και οργανισμούς.",
        request: "Ζητήστε προσφορά έργου",
        explore: "Δείτε τα έργα μας",
        projectsEyebrow: "Ενδεικτικά έργα",
        projectsTitle: "Εξερευνήστε τις λύσεις μας",
        projectsIntro:
          "Παραδείγματα έργων και εφαρμογών που αναπτύσσουμε.",
        all: "Όλα",
        web: "Web εφαρμογές",
        desktop: "Desktop λογισμικό",
        crm: "CRM & ERP",
        automation: "Αυτοματισμοί",
        commerce: "E-commerce",
        platforms: "Custom πλατφόρμες",
        details: "Δείτε λεπτομέρειες",
        external: "Επισκεφθείτε το timologion.gr",
        workTitle: "Πώς εργαζόμαστε",
        workIntro:
          "Τηρούμε πλήρως τον κύκλο ζωής ανάπτυξης λογισμικού: από την ανάλυση απαιτήσεων έως την παράδοση και τη συνεχή υποστήριξη.",
        ctaEyebrow: "ΕΧΕΤΕ ΜΙΑ ΙΔΕΑ;",
        ctaTitle: "Υλοποιούμε το δικό σας λογισμικό.",
        ctaBody:
          "Περιγράψτε μας τις ανάγκες της επιχείρησής σας. Θα μελετήσουμε μαζί τις απαιτήσεις και θα προτείνουμε μια λύση προσαρμοσμένη στους στόχους σας.",
        ctaButton: "Υποβολή αιτήματος έργου",
        close: "Κλείσιμο",
        comingSoon: "Σύντομα θα προστεθούν περισσότερα έργα",
        emptyTitle: "Μια λύση σχεδιασμένη για τη δική σας επιχείρηση.",
        emptyBody:
          "Δημιουργούμε web και desktop εφαρμογές, επιχειρησιακές πλατφόρμες, αυτοματισμούς και λύσεις e-commerce. Πείτε μας τι χρειάζεται η ομάδα σας.",
        detailEyebrow: "ΠΑΡΟΥΣΙΑΣΗ ΕΡΓΟΥ",
        capabilities: "Βασικές δυνατότητες",
      };

  const categoryLabels: Record<CategoryId, string> = {
    all: labels.all,
    web: labels.web,
    desktop: labels.desktop,
    crm: labels.crm,
    automation: labels.automation,
    commerce: labels.commerce,
    platforms: labels.platforms,
  };
  const visibleProject =
    activeCategory === "all" || project.categories.includes(activeCategory)
      ? project
      : null;

  return (
    <PublicShell modernNav>
      <Box sx={{ bgcolor: "#f5f9ff", color: "#0b2545", overflow: "hidden" }}>
        <Box
          component="section"
          sx={{
            position: "relative",
            background:
              "radial-gradient(ellipse at 82% 35%, rgba(116,190,255,.28), transparent 37%), linear-gradient(115deg,#f5f9ff 0%,#eaf4ff 60%,#f8fbff 100%)",
            "&::before": {
              content: '""',
              position: "absolute",
              width: 520,
              height: 520,
              right: "-12%",
              top: "-55%",
              border: "1px solid rgba(47,107,214,.12)",
              borderRadius: "50%",
            },
          }}
        >
          <Container
            maxWidth="xl"
            sx={{ px: { xs: 2.5, sm: 3, md: 5 }, py: { xs: 6, md: 9 } }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.02fr .98fr" },
                alignItems: "center",
                gap: { xs: 4, md: 5 },
              }}
            >
              <Stack spacing={2.25} sx={{ position: "relative", zIndex: 1 }}>
                <Typography
                  sx={{
                    color: "#1262bc",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: ".18em",
                  }}
                >
                  {labels.eyebrow}
                </Typography>
                <Typography
                  component="h1"
                  sx={{
                    maxWidth: 700,
                    fontSize: { xs: 36, sm: 44, md: 54 },
                    fontWeight: 900,
                    lineHeight: 1.08,
                    letterSpacing: "-.04em",
                  }}
                >
                  {labels.title}
                </Typography>
                <Typography
                  sx={{
                    maxWidth: 640,
                    color: "#3d4f6b",
                    fontSize: { xs: 16, md: 18 },
                    lineHeight: 1.75,
                  }}
                >
                  {labels.intro}
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ pt: 1 }}
                >
                  <Button
                    onClick={() => setInquiryOpen(true)}
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{
                      minHeight: 48,
                      borderRadius: 2,
                      px: 2.5,
                      bgcolor: "#0b356c",
                      fontWeight: 800,
                      boxShadow: "0 9px 20px rgba(11,53,108,.2)",
                      "&:hover": { bgcolor: "#124c91" },
                    }}
                  >
                    {labels.request}
                  </Button>
                  <Button
                    href="#projects"
                    variant="outlined"
                    startIcon={<AppsRoundedIcon />}
                    sx={{
                      minHeight: 48,
                      borderRadius: 2,
                      px: 2.5,
                      borderColor: "#2f6bd6",
                      color: "#0b356c",
                      fontWeight: 800,
                      "&:hover": {
                        borderColor: "#0b356c",
                        bgcolor: "rgba(47,107,214,.06)",
                      },
                    }}
                  >
                    {labels.explore}
                  </Button>
                </Stack>
              </Stack>
              <ProductPreview isEnglish={isEnglish} />
            </Box>
          </Container>
        </Box>

        <Container
          id="projects"
          component="section"
          maxWidth="xl"
          sx={{
            px: { xs: 2.5, sm: 3, md: 5 },
            py: { xs: 5, md: 7 },
            scrollMarginTop: 88,
          }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            alignItems={{ xs: "stretch", lg: "center" }}
            justifyContent="space-between"
            gap={2.5}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography
                sx={{
                  color: "#1262bc",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                }}
              >
                {labels.projectsEyebrow}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 0.5,
                  fontSize: { xs: 27, md: 34 },
                  fontWeight: 900,
                  letterSpacing: "-.03em",
                }}
              >
                {labels.projectsTitle}
              </Typography>
              <Typography sx={{ mt: 0.5, color: "#52647c", lineHeight: 1.7 }}>
                {labels.projectsIntro}
              </Typography>
            </Box>
            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              gap={0.8}
              aria-label={labels.projectsTitle}
            >
              {categories.map((category) => {
                const Icon = category.icon;
                const selected = activeCategory === category.id;
                return (
                  <Chip
                    key={category.id}
                    clickable
                    onClick={() => setActiveCategory(category.id)}
                    icon={<Icon sx={{ fontSize: 17 }} />}
                    label={categoryLabels[category.id]}
                    aria-pressed={selected}
                    sx={{
                      height: 38,
                      px: 0.35,
                      border: "1px solid",
                      borderColor: selected ? "#0b4a91" : "#cbd8e8",
                      bgcolor: selected ? "#0b4a91" : "rgba(255,255,255,.78)",
                      color: selected ? "#fff" : "#28415f",
                      fontSize: 12,
                      fontWeight: 800,
                      "& .MuiChip-icon": {
                        color: selected ? "#fff" : "#37618e",
                      },
                      "&:hover": {
                        bgcolor: selected ? "#0b356c" : "#eaf3ff",
                      },
                    }}
                  />
                );
              })}
            </Stack>
          </Stack>

          {visibleProject ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1.08fr .92fr" },
                gap: 2,
              }}
            >
              <ProjectCard
                labels={labels}
                categoryLabels={categoryLabels}
                onClick={() => setSelectedProject(project)}
              />
              <Card
                elevation={0}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  p: { xs: 3, md: 4 },
                  minHeight: { lg: 300 },
                  border: "1px solid #dce7f3",
                  borderRadius: 3,
                  background:
                    "radial-gradient(circle at 100% 0%,rgba(97,177,255,.13),transparent 40%),#fff",
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2,
                    color: "#1262bc",
                    bgcolor: "#eaf4ff",
                    mb: 2,
                  }}
                >
                  <CodeRoundedIcon />
                </Box>
                <Typography
                  component="h3"
                  sx={{ fontSize: { xs: 21, md: 25 }, fontWeight: 900 }}
                >
                  {labels.emptyTitle}
                </Typography>
                <Typography
                  sx={{ mt: 1, color: "#52647c", lineHeight: 1.8, maxWidth: 570 }}
                >
                  {labels.emptyBody}
                </Typography>
                <Button
                  onClick={() => setInquiryOpen(true)}
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{
                    alignSelf: "flex-start",
                    mt: 2,
                    px: 0,
                    color: "#0756ad",
                    fontWeight: 900,
                  }}
                >
                  {labels.request}
                </Button>
              </Card>
            </Box>
          ) : (
            <Card
              elevation={0}
              sx={{
                p: { xs: 3, md: 5 },
                border: "1px solid #dce7f3",
                borderRadius: 3,
                textAlign: "center",
                bgcolor: "#fff",
              }}
            >
              <Typography sx={{ fontSize: 19, fontWeight: 850 }}>
                {labels.comingSoon}
              </Typography>
              <Typography sx={{ mt: 0.75, color: "#52647c" }}>
                {labels.emptyBody}
              </Typography>
              <Button
                onClick={() => setInquiryOpen(true)}
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{ mt: 1.5, fontWeight: 850 }}
              >
                {labels.request}
              </Button>
            </Card>
          )}
        </Container>

        <Container
          component="section"
          maxWidth="xl"
          sx={{ px: { xs: 2.5, sm: 3, md: 5 }, pb: { xs: 6, md: 8 } }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "230px 1fr" },
              gap: { xs: 2, lg: 3 },
              alignItems: "center",
            }}
          >
            <Box>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: 27, md: 32 },
                  fontWeight: 900,
                  letterSpacing: "-.03em",
                }}
              >
                {labels.workTitle}
              </Typography>
              <Typography sx={{ mt: 0.75, color: "#52647c", lineHeight: 1.7 }}>
                {labels.workIntro}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,minmax(0,1fr))",
                  lg: "repeat(5,minmax(0,1fr))",
                },
                gap: 1,
                p: { xs: 1.5, md: 2 },
                border: "1px solid #deebf8",
                borderRadius: 3,
                bgcolor: "rgba(255,255,255,.75)",
              }}
            >
              {lifecycle.map((step, index) => {
                const Icon = step.icon;
                const englishStep = lifecycleEnglish[index];
                return (
                  <Stack
                    key={step.title}
                    alignItems={{ xs: "flex-start", lg: "center" }}
                    textAlign={{ xs: "left", lg: "center" }}
                    spacing={0.8}
                    sx={{ p: { xs: 1.5, lg: 1 } }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 2,
                        color: "#1262bc",
                        bgcolor: "#e9f4ff",
                      }}
                    >
                      <Icon />
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 900 }}>
                      {isEnglish ? englishStep.title : step.title}
                    </Typography>
                    <Typography
                      sx={{ color: "#52647c", fontSize: 12, lineHeight: 1.6 }}
                    >
                      {isEnglish ? englishStep.body : step.body}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>
          </Box>
        </Container>

        <Container
          component="section"
          maxWidth="xl"
          sx={{ px: { xs: 2.5, sm: 3, md: 5 }, pb: { xs: 5, md: 8 } }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "auto 1fr auto" },
              alignItems: "center",
              gap: { xs: 2, md: 3 },
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              color: "#fff",
              background:
                "linear-gradient(115deg,#0b356c 0%,#0d4c91 58%,#1262bc 100%)",
              boxShadow: "0 20px 48px rgba(11,53,108,.2)",
            }}
          >
            <Box
              sx={{
                width: { xs: 52, md: 72 },
                height: { xs: 52, md: 72 },
                display: "grid",
                placeItems: "center",
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,.12)",
                color: "#b9e3ff",
              }}
            >
              <CodeRoundedIcon sx={{ fontSize: { xs: 32, md: 42 } }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: ".16em",
                  color: "#c5e7ff",
                }}
              >
                {labels.ctaEyebrow}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 0.4,
                  fontSize: { xs: 23, md: 30 },
                  fontWeight: 900,
                  lineHeight: 1.2,
                }}
              >
                {labels.ctaTitle}
              </Typography>
              <Typography
                sx={{
                  mt: 0.75,
                  maxWidth: 720,
                  color: "#d7e9fa",
                  fontSize: { xs: 14, md: 15 },
                  lineHeight: 1.7,
                }}
              >
                {labels.ctaBody}
              </Typography>
            </Box>
            <Button
              onClick={() => setInquiryOpen(true)}
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                minHeight: 50,
                px: 2.5,
                borderRadius: 2,
                bgcolor: "#fff",
                color: "#0b356c",
                fontWeight: 900,
                whiteSpace: "nowrap",
                boxShadow: "0 8px 20px rgba(0,0,0,.14)",
                "&:hover": { bgcolor: "#eaf4ff" },
              }}
            >
              {labels.ctaButton}
            </Button>
          </Box>
        </Container>
      </Box>

      <Dialog
        open={selectedProject !== null}
        onClose={() => setSelectedProject(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="software-project-title"
      >
        {selectedProject && (
          <>
            <DialogTitle
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 2,
                pt: 3,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    color: "#1262bc",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: ".14em",
                  }}
                >
                  {labels.detailEyebrow}
                </Typography>
                <Typography
                  component="h2"
                  id="software-project-title"
                  sx={{ mt: 0.5, fontSize: 27, fontWeight: 900 }}
                >
                  {selectedProject.name}
                </Typography>
              </Box>
              <IconButton
                aria-label={labels.close}
                onClick={() => setSelectedProject(null)}
                size="small"
              >
                <CloseRoundedIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pb: 3 }}>
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  minHeight: 150,
                  mb: 2.5,
                  p: 2,
                  borderRadius: 2.5,
                  border: "1px solid #e4edf7",
                  bgcolor: "#f8fbff",
                }}
              >
                <Box
                  component="img"
                  src={selectedProject.logo}
                  alt={selectedProject.name}
                  sx={{
                    width: "100%",
                    maxWidth: 340,
                    height: 120,
                    objectFit: "contain",
                  }}
                />
              </Box>
              <Typography sx={{ color: "#43566f", lineHeight: 1.8 }}>
                {isEnglish
                  ? "An electronic invoicing web platform for organizing customers, products and documents in one clear workspace. E-invoicing and myDATA transmission are supported by WRAPP S.A., a certified e-invoicing provider."
                  : selectedProject.detail}
              </Typography>
              <Typography sx={{ mt: 2.5, mb: 1, fontWeight: 900 }}>
                {labels.capabilities}
              </Typography>
              <Stack spacing={1}>
                {(isEnglish
                  ? [
                      "Organize customers, products and documents",
                      "Issue and manage electronic invoices",
                      "Transmit to myDATA through a certified provider",
                      "Keep day-to-day operations and reporting organized",
                    ]
                  : selectedProject.features
                ).map((feature) => (
                  <Stack key={feature} direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleRoundedIcon
                      sx={{ mt: "2px", color: "#168552", fontSize: 19 }}
                    />
                    <Typography sx={{ color: "#43566f", lineHeight: 1.6 }}>
                      {feature}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                gap={1}
                sx={{ mt: 3 }}
              >
                <Button
                  component="a"
                  href={selectedProject.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                  endIcon={<OpenInNewRoundedIcon />}
                  sx={{
                    bgcolor: "#0b356c",
                    fontWeight: 850,
                    "&:hover": { bgcolor: "#124c91" },
                  }}
                >
                  {labels.external}
                </Button>
                <Button
                  onClick={() => setSelectedProject(null)}
                  sx={{ color: "#40536b", fontWeight: 800 }}
                >
                  {labels.close}
                </Button>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
      <CustomSoftwareInquiryDialog
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
      />
    </PublicShell>
  );
}

const lifecycleEnglish = [
  {
    title: "1. Requirements analysis",
    body: "We map your requirements, workflows and goals.",
  },
  {
    title: "2. Solution design",
    body: "We define architecture, user experience and delivery plan.",
  },
  {
    title: "3. Development",
    body: "We build iteratively and incorporate regular feedback.",
  },
  {
    title: "4. Testing",
    body: "We verify functionality, security and quality before release.",
  },
  {
    title: "5. Delivery & support",
    body: "We launch the solution and support you after delivery.",
  },
];

function ProjectCard({
  labels,
  categoryLabels,
  onClick,
}: {
  labels: typeof english;
  categoryLabels: Record<CategoryId, string>;
  onClick: () => void;
}) {
  const { i18n } = useTranslation();
  const isEnglish = i18n.resolvedLanguage?.startsWith("en") ?? false;

  return (
    <Card
      component="article"
      elevation={0}
      sx={{
        minWidth: 0,
        overflow: "hidden",
        border: "1px solid #d9e6f4",
        borderRadius: 3,
        bgcolor: "#fff",
        boxShadow: "0 12px 32px rgba(18,55,96,.08)",
        transition: "transform .2s ease, box-shadow .2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 18px 38px rgba(18,55,96,.14)",
        },
      }}
    >
      <ButtonBase
        onClick={onClick}
        aria-label={`${labels.details}: ${project.name}`}
        sx={{
          display: "block",
          width: "100%",
          height: "100%",
          textAlign: "left",
          "&:focus-visible": {
            outline: "3px solid #2780d5",
            outlineOffset: -3,
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            minHeight: { xs: 190, md: 220 },
            p: { xs: 2, md: 3 },
            background:
              "radial-gradient(ellipse at 50% 100%,rgba(47,130,220,.2),transparent 58%),linear-gradient(145deg,#edf6ff,#e2f0ff)",
          }}
        >
          <Chip
            size="small"
            icon={<ComputerRoundedIcon />}
            label={categoryLabels.web}
            sx={{
              position: "absolute",
              top: 14,
              right: 14,
              bgcolor: "#0c8b69",
              color: "#fff",
              fontWeight: 850,
              "& .MuiChip-icon": { color: "#fff" },
            }}
          />
          <Box
            sx={{
              width: "100%",
              minHeight: 154,
              display: "grid",
              placeItems: "center",
              px: 2,
              border: "1px solid rgba(255,255,255,.9)",
              borderRadius: 2.5,
              bgcolor: "#fff",
              boxShadow: "0 12px 30px rgba(21,62,107,.1)",
            }}
          >
            <Box
              component="img"
              src={project.logo}
              alt={`${project.name} logo`}
              loading="lazy"
              sx={{
                width: "100%",
                maxWidth: 390,
                height: { xs: 130, md: 150 },
                objectFit: "contain",
              }}
            />
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
          >
            <Typography
              component="h3"
              sx={{ color: "#0b2545", fontSize: 21, fontWeight: 900 }}
            >
              {project.name}
            </Typography>
            <ArrowForwardRoundedIcon sx={{ color: "#1262bc" }} />
          </Stack>
          <Typography
            sx={{ mt: 0.75, color: "#52647c", fontSize: 14, lineHeight: 1.75 }}
          >
            {isEnglish
              ? "Web platform for electronic invoicing, document management and myDATA."
              : project.description}
          </Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
            {project.tags.map((tag, index) => (
              <Chip
                key={tag}
                size="small"
                icon={index === 0 ? <HubRoundedIcon /> : undefined}
                label={isEnglish ? ["myDATA", "E-invoicing", "Documents"][index] : tag}
                sx={{
                  bgcolor: "#edf4fb",
                  color: "#35516f",
                  fontSize: 11,
                  fontWeight: 750,
                  "& .MuiChip-icon": { color: "#1d68b2", fontSize: 15 },
                }}
              />
            ))}
          </Stack>
          <Typography
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mt: 1.5,
              color: "#0756ad",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {labels.details}
            <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
          </Typography>
        </Box>
      </ButtonBase>
    </Card>
  );
}

function ProductPreview({ isEnglish }: { isEnglish: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        minWidth: 0,
        py: { xs: 1, md: 2 },
        perspective: 1200,
      }}
    >
      <Card
        elevation={0}
        sx={{
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(147,181,218,.65)",
          borderRadius: 3,
          bgcolor: "#fff",
          boxShadow: "0 28px 65px rgba(19,63,112,.18)",
          transform: { md: "rotateY(-5deg) rotateX(2deg)" },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{ height: 44, px: 1.75, borderBottom: "1px solid #e7eef6" }}
        >
          <Stack direction="row" gap={0.5}>
            {["#ff8178", "#ffc867", "#51c992"].map((color) => (
              <Box
                key={color}
                sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color }}
              />
            ))}
          </Stack>
          <Typography sx={{ ml: 1, color: "#708198", fontSize: 10, fontWeight: 800 }}>
            KALYPSIS · BUSINESS SOFTWARE
          </Typography>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "82px 1fr",
            minHeight: { xs: 240, sm: 300 },
          }}
        >
          <Stack sx={{ p: 1.25, gap: 1, bgcolor: "#0c2d55" }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                display: "grid",
                placeItems: "center",
                borderRadius: 1,
                bgcolor: "#1684dd",
                color: "#fff",
              }}
            >
              <LayersRoundedIcon sx={{ fontSize: 16 }} />
            </Box>
            {[0, 1, 2, 3, 4].map((item) => (
              <Box
                key={item}
                sx={{
                  height: 6,
                  width: item === 0 ? "90%" : `${52 + item * 7}%`,
                  borderRadius: 5,
                  bgcolor: item === 0 ? "#65baff" : "rgba(217,235,255,.25)",
                }}
              />
            ))}
          </Stack>
          <Stack spacing={1.25} sx={{ minWidth: 0, p: { xs: 1.5, sm: 2.25 } }}>
            <Box>
              <Typography sx={{ color: "#0b2545", fontSize: 14, fontWeight: 900 }}>
                {isEnglish ? "Business overview" : "Επισκόπηση επιχείρησης"}
              </Typography>
              <Typography sx={{ color: "#8190a3", fontSize: 9 }}>
                {isEnglish
                  ? "Your data, connected in one place"
                  : "Τα δεδομένα σας, συνδεδεμένα σε ένα σημείο"}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                gap: 0.75,
              }}
            >
              {(isEnglish
                ? [
                    ["PROJECTS", "24"],
                    ["WORKFLOWS", "18"],
                    ["REPORTS", "96"],
                  ]
                : [
                    ["ΕΡΓΑ", "24"],
                    ["ΡΟΕΣ", "18"],
                    ["ΑΝΑΦΟΡΕΣ", "96"],
                  ]
              ).map(([label, value], index) => (
                <Box
                  key={label}
                  sx={{
                    minWidth: 0,
                    p: 1,
                    border: "1px solid #e5edf6",
                    borderRadius: 1.5,
                    bgcolor: "#fbfdff",
                  }}
                >
                  <Typography
                    sx={{
                      overflow: "hidden",
                      color: "#788ba2",
                      fontSize: 8,
                      fontWeight: 850,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography sx={{ mt: 0.25, color: "#123d6a", fontSize: 17, fontWeight: 900 }}>
                    {value}
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      width: `${58 + index * 12}%`,
                      height: 3,
                      borderRadius: 3,
                      bgcolor: ["#14a99a", "#2878d1", "#8d6ce0"][index],
                    }}
                  />
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                flex: 1,
                minHeight: 112,
                p: 1.25,
                border: "1px solid #e5edf6",
                borderRadius: 1.5,
                background:
                  "linear-gradient(180deg,rgba(45,133,223,.1),rgba(45,133,223,0)),#fff",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 0.5 }}
              >
                <Typography sx={{ color: "#314e6f", fontSize: 9, fontWeight: 850 }}>
                  {isEnglish ? "Activity" : "Δραστηριότητα"}
                </Typography>
                <Typography sx={{ color: "#8190a3", fontSize: 8 }}>
                  2025—2026
                </Typography>
              </Stack>
              <Box
                component="svg"
                viewBox="0 0 360 95"
                preserveAspectRatio="none"
                sx={{ display: "block", width: "100%", height: 76, overflow: "visible" }}
              >
                <defs>
                  <linearGradient id="custom-software-chart-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2785de" stopOpacity=".28" />
                    <stop offset="100%" stopColor="#2785de" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 45, 70].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="360"
                    y1={y}
                    y2={y}
                    stroke="#e8eff7"
                    strokeWidth="1"
                  />
                ))}
                <path
                  d="M0,72 C30,64 40,68 66,51 S106,61 132,42 S173,49 203,31 S242,42 266,25 S321,33 360,7 L360,95 L0,95 Z"
                  fill="url(#custom-software-chart-fill)"
                />
                <path
                  d="M0,72 C30,64 40,68 66,51 S106,61 132,42 S173,49 203,31 S242,42 266,25 S321,33 360,7"
                  fill="none"
                  stroke="#247bd0"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              </Box>
            </Box>
          </Stack>
        </Box>
      </Card>
      <Chip
        icon={<CheckCircleRoundedIcon />}
        label={isEnglish ? "Built around your workflow" : "Σχεδιασμένο για τη ροή σας"}
        sx={{
          position: "absolute",
          right: { xs: 0, md: -12 },
          bottom: { xs: 0, md: 4 },
          height: 38,
          bgcolor: "#fff",
          color: "#24425f",
          fontWeight: 850,
          boxShadow: "0 8px 24px rgba(11,53,108,.14)",
          "& .MuiChip-icon": { color: "#15845b" },
        }}
      />
    </Box>
  );
}
