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
import ApiRoundedIcon from "@mui/icons-material/ApiRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import LanRoundedIcon from "@mui/icons-material/LanRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
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

const technologyLogos = [
  {
    name: "C#",
    category: { el: "Γλώσσα προγραμματισμού", en: "Programming language" },
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/csharp/csharp-original.svg",
  },
  {
    name: ".NET / ASP.NET Core",
    category: { el: "Backend", en: "Backend" },
    logo: "https://cdn.simpleicons.org/dotnet/512BD4",
  },
  {
    name: "React",
    category: { el: "Frontend", en: "Frontend" },
    logo: "https://cdn.simpleicons.org/react/61DAFB",
  },
  {
    name: "TypeScript",
    category: { el: "Γλώσσα προγραμματισμού", en: "Programming language" },
    logo: "https://cdn.simpleicons.org/typescript/3178C6",
  },
  {
    name: "MySQL",
    category: { el: "Σχεσιακή βάση δεδομένων", en: "Relational database" },
    logo: "https://cdn.simpleicons.org/mysql/4479A1",
  },
  {
    name: "Vite",
    category: { el: "Build εργαλείο", en: "Build tool" },
    logo: "https://cdn.simpleicons.org/vite/646CFF",
  },
  {
    name: "Material UI",
    category: { el: "UI framework", en: "UI framework" },
    logo: "https://cdn.simpleicons.org/mui/007FFF",
  },
  {
    name: "Entity Framework Core",
    category: { el: "ORM / πρόσβαση δεδομένων", en: "ORM / data access" },
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/entityframeworkcore/entityframeworkcore-original.svg",
  },
];

const serviceTechnologyLogos: Record<string, string> = {
  MySQL: "https://cdn.simpleicons.org/mysql/4479A1",
  PostgreSQL: "https://cdn.simpleicons.org/postgresql/4169E1",
  MongoDB: "https://cdn.simpleicons.org/mongodb/47A248",
  OWASP: "https://cdn.simpleicons.org/owasp/FFFFFF",
};

const serviceAreas = [
  {
    icon: StorageRoundedIcon,
    title: { el: "Σχεδιασμός βάσεων δεδομένων", en: "Database engineering" },
    description: {
      el: "Μοντελοποιούμε οντότητες, σχέσεις και ροές δεδομένων για αξιόπιστη λειτουργία και μελλοντική επέκταση.",
      en: "We model entities, relationships and data flows for reliable operation and future growth.",
    },
    detail: {
      el: "Σχεσιακές βάσεις με σαφές σχήμα και ακεραιότητα δεδομένων, αλλά και μη σχεσιακές επιλογές όταν ταιριάζουν καλύτερα στον τύπο και τον όγκο των δεδομένων.",
      en: "Relational databases with clear schemas and data integrity, as well as non-relational options when they better fit the data shape and scale.",
    },
    tags: ["MySQL", "PostgreSQL", "MongoDB"],
  },
  {
    icon: KeyRoundedIcon,
    title: { el: "Κρυπτογράφηση & προστασία δεδομένων", en: "Encryption & data protection" },
    description: {
      el: "Προστατεύουμε ευαίσθητα δεδομένα με σύγχρονες πρακτικές κρυπτογράφησης και ελεγχόμενη πρόσβαση.",
      en: "We protect sensitive data with modern encryption practices and controlled access.",
    },
    detail: {
      el: "Εφαρμόζουμε δοκιμασμένους αλγορίθμους και ασφαλή διαχείριση κλειδιών, χωρίς να επινοούμε ιδιόκρυπτα σχήματα.",
      en: "We use established algorithms and secure key management rather than inventing custom cryptographic schemes.",
    },
    tags: ["AES-GCM", "TLS", "Key management"],
  },
  {
    icon: SecurityRoundedIcon,
    title: { el: "Κυβερνοασφάλεια εφαρμογών", en: "Application cybersecurity" },
    description: {
      el: "Ενσωματώνουμε την ασφάλεια από τον σχεδιασμό έως τον έλεγχο και την παραγωγική λειτουργία.",
      en: "We build security into the design, testing and production operation of applications.",
    },
    detail: {
      el: "Έλεγχος ταυτότητας και δικαιωμάτων, ασφαλής διαχείριση μυστικών, καταγραφή ενεργειών, περιορισμός αιτημάτων και έλεγχοι ευπαθειών.",
      en: "Identity and access controls, secure secret handling, audit trails, request throttling and vulnerability checks.",
    },
    tags: ["OWASP", "Access control", "Security testing"],
  },
  {
    icon: LanRoundedIcon,
    title: { el: "Υποδομές & δίκτυα", en: "Infrastructure & networks" },
    description: {
      el: "Σχεδιάζουμε και υποστηρίζουμε το περιβάλλον που χρειάζεται η εφαρμογή σας για ασφαλή και σταθερή λειτουργία.",
      en: "We design and support the environment your application needs to run securely and reliably.",
    },
    detail: {
      el: "Περιλαμβάνει περιβάλλοντα ανάπτυξης και παραγωγής, δικτυακή πρόσβαση, αντίγραφα ασφαλείας, παρακολούθηση και διαδικασίες διάθεσης.",
      en: "This can include development and production environments, network access, backups, monitoring and release processes.",
    },
    tags: ["HTTPS / TLS", "Backups", "Monitoring"],
  },
  {
    icon: ApiRoundedIcon,
    title: { el: "APIs & διασυνδέσεις", en: "APIs & integrations" },
    description: {
      el: "Συνδέουμε την εφαρμογή με υπηρεσίες, παρόχους και εσωτερικά συστήματα με σαφή και ελεγχόμενα interfaces.",
      en: "We connect applications to services, providers and internal systems through clear, controlled interfaces.",
    },
    detail: {
      el: "Σχεδιάζουμε APIs, ανταλλαγή δεδομένων, webhooks και ασφαλή διαχείριση διαπιστευτηρίων σύμφωνα με τις ανάγκες του έργου.",
      en: "We design APIs, data exchange, webhooks and secure credential handling to fit project requirements.",
    },
    tags: ["REST APIs", "Webhooks", "OAuth / API keys"],
  },
  {
    icon: CloudRoundedIcon,
    title: { el: "Διάθεση & λειτουργία λογισμικού", en: "Software delivery & operations" },
    description: {
      el: "Προετοιμάζουμε την εφαρμογή για ομαλή διάθεση, ενημερώσεις και υποστήριξη μετά την παράδοση.",
      en: "We prepare applications for smooth release, updates and post-launch support.",
    },
    detail: {
      el: "Ανάλογα με το έργο, οργανώνουμε περιβάλλοντα, αυτοματοποιημένα builds, παρακολούθηση σφαλμάτων και πλάνο συντήρησης.",
      en: "Depending on the project, we set up environments, automated builds, error monitoring and a maintenance plan.",
    },
    tags: ["CI / CD", "Release planning", "Maintenance"],
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
  methodEyebrow: "A CLEAR, COLLABORATIVE PROCESS",
  methodTitle: "Agile delivery, with clear agreements.",
  methodIntro:
    "We work in short, reviewable iterations so you can see progress and give feedback throughout the project.",
  methodSteps: [
    ["01", "Agree on scope", "We document goals, deliverables, responsibilities and acceptance criteria before work begins."],
    ["02", "Build in iterations", "We prioritize a backlog, share progress and review working software together."],
    ["03", "Review and adapt", "We capture feedback and agree on any changes to scope, timing or cost before proceeding."],
  ],
  agreementTitle: "A written agreement before delivery",
  agreementBody:
    "The project agreement sets expectations for scope, milestones, deliverables, payment terms, ownership and support. Changes are reviewed and agreed in writing.",
  stackEyebrow: "OUR CURRENT TOOLKIT",
  stackTitle: "Languages, frameworks & technologies.",
  stackIntro:
    "These technologies are part of the KALYPSIS platform we build and maintain. The right stack for each new project is selected around its requirements.",
  stackNote:
    "Logos are loaded from public technology-icon CDNs. Individual projects may use a different combination.",
  servicesEyebrow: "FROM DATA TO DEPLOYMENT",
  servicesTitle: "Engineering for the whole product.",
  servicesIntro:
    "We can support the connected parts of a software project, choosing the appropriate approach for each requirement.",
  requestService: "Discuss your project",
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
        methodEyebrow: "ΜΙΑ ΣΑΦΗΣ ΚΑΙ ΣΥΝΕΡΓΑΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ",
        methodTitle: "Agile υλοποίηση, με ξεκάθαρη συμφωνία.",
        methodIntro:
          "Εργαζόμαστε σε σύντομους κύκλους, ώστε να βλέπετε την πρόοδο και να δίνετε ανατροφοδότηση σε όλη τη διάρκεια του έργου.",
        methodSteps: [
          ["01", "Συμφωνούμε το πλαίσιο", "Καταγράφουμε στόχους, παραδοτέα, ευθύνες και κριτήρια αποδοχής πριν ξεκινήσει η υλοποίηση."],
          ["02", "Υλοποιούμε σταδιακά", "Ιεραρχούμε τις εργασίες, παρουσιάζουμε την πρόοδο και αξιολογούμε μαζί λειτουργικό λογισμικό."],
          ["03", "Αξιολογούμε και προσαρμοζόμαστε", "Καταγράφουμε σχόλια και συμφωνούμε τυχόν αλλαγές σε εύρος, χρονοδιάγραμμα ή κόστος πριν προχωρήσουμε."],
        ],
        agreementTitle: "Γραπτή συμφωνία πριν την υλοποίηση",
        agreementBody:
          "Η σύμβαση έργου ορίζει το αντικείμενο, τα ορόσημα, τα παραδοτέα, τους όρους πληρωμής, τα δικαιώματα χρήσης και την υποστήριξη. Κάθε αλλαγή εξετάζεται και συμφωνείται γραπτώς.",
        stackEyebrow: "ΤΟ ΤΕΧΝΟΛΟΓΙΚΟ ΜΑΣ ΥΠΟΒΑΘΡΟ",
        stackTitle: "Γλώσσες, frameworks & τεχνολογίες.",
        stackIntro:
          "Οι τεχνολογίες αυτές αποτελούν μέρος της πλατφόρμας KALYPSIS που αναπτύσσουμε και συντηρούμε. Για κάθε νέο έργο επιλέγουμε στοίβα με βάση τις απαιτήσεις του.",
        stackNote:
          "Τα λογότυπα φορτώνονται από δημόσια CDN εικονιδίων τεχνολογιών. Κάθε έργο μπορεί να αξιοποιεί διαφορετικό συνδυασμό.",
        servicesEyebrow: "ΑΠΟ ΤΑ ΔΕΔΟΜΕΝΑ ΕΩΣ ΤΗΝ ΠΑΡΑΔΟΣΗ",
        servicesTitle: "Τεχνογνωσία για ολόκληρο το προϊόν.",
        servicesIntro:
          "Υποστηρίζουμε τα επιμέρους μέρη ενός έργου λογισμικού, επιλέγοντας την κατάλληλη προσέγγιση για κάθε ανάγκη.",
        requestService: "Συζητήστε το έργο σας",
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

        <Box
          component="section"
          sx={{
            px: { xs: 2, sm: 3, md: 5 },
            py: { xs: 6, md: 9 },
            color: "#f4f8ff",
            background:
              "radial-gradient(ellipse at 85% 0%,rgba(27,113,196,.24),transparent 40%),linear-gradient(135deg,#07182a 0%,#0b2540 58%,#102d4b 100%)",
          }}
        >
          <Container maxWidth="xl" disableGutters>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.05fr) minmax(300px,.95fr)" },
                gap: { xs: 4, md: 7 },
                alignItems: "center",
              }}
            >
              <Box>
                <Typography
                  sx={{
                    color: "#7fc8ff",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: ".16em",
                  }}
                >
                  {labels.methodEyebrow}
                </Typography>
                <Typography
                  component="h2"
                  sx={{
                    mt: 1.25,
                    maxWidth: 650,
                    fontSize: { xs: 30, md: 43 },
                    fontWeight: 900,
                    lineHeight: 1.12,
                    letterSpacing: "-.035em",
                  }}
                >
                  {labels.methodTitle}
                </Typography>
                <Typography
                  sx={{
                    mt: 1.75,
                    maxWidth: 660,
                    color: "#b8cce0",
                    fontSize: { xs: 15, md: 17 },
                    lineHeight: 1.8,
                  }}
                >
                  {labels.methodIntro}
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 3.5 }}>
                  {labels.methodSteps.map(([number, title, description]) => (
                    <Stack
                      key={number}
                      direction="row"
                      spacing={2}
                      alignItems="flex-start"
                    >
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: 42,
                          height: 42,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 1.5,
                          border: "1px solid rgba(127,200,255,.32)",
                          bgcolor: "rgba(127,200,255,.1)",
                          color: "#8bd0ff",
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        {number}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 850, color: "#f5f9ff" }}>
                          {title}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.4,
                            color: "#adc2d8",
                            fontSize: 13,
                            lineHeight: 1.7,
                          }}
                        >
                          {description}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
              <Box
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  p: { xs: 2.5, md: 3.5 },
                  border: "1px solid rgba(150,198,235,.24)",
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,.055)",
                  boxShadow: "0 24px 70px rgba(0,0,0,.2)",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    width: 180,
                    height: 180,
                    right: -80,
                    top: -90,
                    borderRadius: "50%",
                    bgcolor: "rgba(48,143,224,.13)",
                    filter: "blur(2px)",
                  }}
                />
                <Box
                  sx={{
                    position: "relative",
                    width: 52,
                    height: 52,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2,
                    color: "#90d3ff",
                    bgcolor: "rgba(91,173,232,.14)",
                  }}
                >
                  <FactCheckRoundedIcon />
                </Box>
                <Typography
                  component="h3"
                  sx={{
                    position: "relative",
                    mt: 2,
                    fontSize: { xs: 21, md: 24 },
                    fontWeight: 900,
                    lineHeight: 1.3,
                  }}
                >
                  {labels.agreementTitle}
                </Typography>
                <Typography
                  sx={{
                    position: "relative",
                    mt: 1.25,
                    color: "#b8cce0",
                    fontSize: 14,
                    lineHeight: 1.85,
                  }}
                >
                  {labels.agreementBody}
                </Typography>
                <Stack
                  direction="row"
                  useFlexGap
                  flexWrap="wrap"
                  gap={1}
                  sx={{ position: "relative", mt: 2.5 }}
                >
                  {(isEnglish
                    ? ["Scope", "Milestones", "Deliverables", "Change control"]
                    : ["Αντικείμενο", "Ορόσημα", "Παραδοτέα", "Διαχείριση αλλαγών"]
                  ).map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      size="small"
                      sx={{
                        color: "#d8efff",
                        border: "1px solid rgba(143,202,243,.25)",
                        bgcolor: "rgba(117,178,222,.1)",
                        fontWeight: 700,
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Box>
          </Container>
        </Box>

        <Box
          component="section"
          sx={{
            px: { xs: 2, sm: 3, md: 5 },
            py: { xs: 6, md: 8 },
            color: "#f4f8ff",
            bgcolor: "#0b2035",
            borderTop: "1px solid rgba(150,198,235,.1)",
          }}
        >
          <Container maxWidth="xl" disableGutters>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                alignItems: { md: "flex-end" },
                justifyContent: "space-between",
                gap: 2,
                mb: 3.5,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    color: "#7fc8ff",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: ".16em",
                  }}
                >
                  {labels.stackEyebrow}
                </Typography>
                <Typography
                  component="h2"
                  sx={{
                    mt: 1,
                    fontSize: { xs: 28, md: 38 },
                    fontWeight: 900,
                    letterSpacing: "-.03em",
                  }}
                >
                  {labels.stackTitle}
                </Typography>
                <Typography
                  sx={{
                    mt: 1,
                    maxWidth: 780,
                    color: "#b8cce0",
                    lineHeight: 1.75,
                  }}
                >
                  {labels.stackIntro}
                </Typography>
              </Box>
              <CodeRoundedIcon
                sx={{
                  display: { xs: "none", md: "block" },
                  color: "rgba(127,200,255,.25)",
                  fontSize: 76,
                }}
              />
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2,minmax(0,1fr))",
                  sm: "repeat(4,minmax(0,1fr))",
                  lg: "repeat(8,minmax(0,1fr))",
                },
                gap: { xs: 1, md: 1.5 },
              }}
            >
              {technologyLogos.map((technology) => (
                <Box
                  key={technology.name}
                  sx={{
                    minWidth: 0,
                    minHeight: { xs: 130, md: 150 },
                    p: { xs: 1.5, md: 2 },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 1.25,
                    border: "1px solid rgba(150,198,235,.16)",
                    borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,.045)",
                    transition: "transform .2s ease, border-color .2s ease, background .2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: "rgba(127,200,255,.48)",
                      bgcolor: "rgba(255,255,255,.075)",
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={technology.logo}
                    alt={`${technology.name} logo`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    sx={{
                      width: 42,
                      height: 42,
                      objectFit: "contain",
                      p: technology.name === "React" ? 0.25 : 0,
                      filter:
                        technology.name === "C#" ||
                        technology.name === ".NET / ASP.NET Core" ||
                        technology.name === "Material UI"
                          ? "drop-shadow(0 3px 12px rgba(255,255,255,.15))"
                          : "none",
                    }}
                  />
                  <Box>
                    <Typography
                      sx={{
                        color: "#f4f8ff",
                        fontSize: { xs: 12, md: 13 },
                        fontWeight: 850,
                        lineHeight: 1.35,
                      }}
                    >
                      {technology.name}
                    </Typography>
                    <Typography
                      sx={{
                        mt: 0.5,
                        color: "#99b2ca",
                        fontSize: 10,
                        lineHeight: 1.4,
                      }}
                    >
                      {isEnglish
                        ? technology.category.en
                        : technology.category.el}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Typography
              sx={{
                mt: 1.5,
                color: "#829bb4",
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              {labels.stackNote}
            </Typography>
          </Container>
        </Box>

        <Box
          component="section"
          sx={{
            px: { xs: 2, sm: 3, md: 5 },
            py: { xs: 6, md: 9 },
            color: "#f4f8ff",
            background:
              "radial-gradient(ellipse at 10% 12%,rgba(18,98,188,.18),transparent 32%),linear-gradient(145deg,#07182a 0%,#0c243b 55%,#102a43 100%)",
          }}
        >
          <Container maxWidth="xl" disableGutters>
            <Box sx={{ maxWidth: 790, mb: 4 }}>
              <Typography
                sx={{
                  color: "#7fc8ff",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: ".16em",
                }}
              >
                {labels.servicesEyebrow}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontSize: { xs: 29, md: 40 },
                  fontWeight: 900,
                  letterSpacing: "-.03em",
                }}
              >
                {labels.servicesTitle}
              </Typography>
              <Typography sx={{ mt: 1.25, color: "#b8cce0", lineHeight: 1.8 }}>
                {labels.servicesIntro}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2,minmax(0,1fr))",
                  lg: "repeat(3,minmax(0,1fr))",
                },
                gap: 1.5,
              }}
            >
              {serviceAreas.map((service) => {
                const Icon = service.icon;
                return (
                  <Box
                    key={service.title.el}
                    sx={{
                      position: "relative",
                      overflow: "hidden",
                      minWidth: 0,
                      minHeight: { xs: 0, md: 310 },
                      p: { xs: 2.5, md: 3 },
                      border: "1px solid rgba(150,198,235,.17)",
                      borderRadius: 2.5,
                      bgcolor: "rgba(255,255,255,.045)",
                      transition:
                        "transform .2s ease, border-color .2s ease, background .2s ease",
                      "&:hover": {
                        transform: { md: "translateY(-4px)" },
                        borderColor: "rgba(127,200,255,.42)",
                        bgcolor: "rgba(255,255,255,.07)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        width: 150,
                        height: 150,
                        right: -65,
                        top: -65,
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle,rgba(55,145,214,.16),transparent 70%)",
                        pointerEvents: "none",
                      }}
                    />
                    <Box
                      sx={{
                        position: "relative",
                        width: 48,
                        height: 48,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 1.75,
                        color: "#8bd0ff",
                        bgcolor: "rgba(91,173,232,.13)",
                        border: "1px solid rgba(143,202,243,.16)",
                      }}
                    >
                      <Icon />
                    </Box>
                    <Typography
                      component="h3"
                      sx={{
                        position: "relative",
                        mt: 2,
                        fontSize: 18,
                        fontWeight: 900,
                        lineHeight: 1.35,
                      }}
                    >
                      {isEnglish ? service.title.en : service.title.el}
                    </Typography>
                    <Typography
                      sx={{
                        position: "relative",
                        mt: 1,
                        color: "#c0d0e0",
                        fontSize: 13,
                        fontWeight: 700,
                        lineHeight: 1.65,
                      }}
                    >
                      {isEnglish
                        ? service.description.en
                        : service.description.el}
                    </Typography>
                    <Typography
                      sx={{
                        position: "relative",
                        mt: 1,
                        color: "#9cb2c9",
                        fontSize: 12,
                        lineHeight: 1.75,
                      }}
                    >
                      {isEnglish ? service.detail.en : service.detail.el}
                    </Typography>
                    <Stack
                      direction="row"
                      useFlexGap
                      flexWrap="wrap"
                      gap={0.75}
                      sx={{ position: "relative", mt: 2 }}
                    >
                      {service.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          icon={
                            serviceTechnologyLogos[tag] ? (
                              <Box
                                component="img"
                                src={serviceTechnologyLogos[tag]}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                sx={{ width: 14, height: 14, objectFit: "contain" }}
                              />
                            ) : undefined
                          }
                          sx={{
                            height: 24,
                            color: "#c6e6ff",
                            border: "1px solid rgba(143,202,243,.2)",
                            bgcolor: "rgba(117,178,222,.08)",
                            "& .MuiChip-label": { px: 1, fontSize: 10, fontWeight: 750 },
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
            <Stack alignItems="center" sx={{ mt: 4 }}>
              <Button
                onClick={() => setInquiryOpen(true)}
                variant="contained"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{
                  minHeight: 48,
                  px: 2.5,
                  borderRadius: 2,
                  color: "#092744",
                  bgcolor: "#a6dcff",
                  fontWeight: 900,
                  textTransform: "none",
                  "&:hover": { bgcolor: "#c5eaff" },
                }}
              >
                {labels.requestService}
              </Button>
            </Stack>
          </Container>
        </Box>

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
