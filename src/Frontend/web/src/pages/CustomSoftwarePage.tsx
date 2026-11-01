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
    detail:
      "Συζητήσεις με stakeholders, καταγραφή λειτουργικών απαιτήσεων, προτεραιοτήτων, χρηστών και περιορισμών.",
  },
  {
    icon: DesignServicesRoundedIcon,
    title: "Σχεδιασμός λύσης",
    body: "Ορίζουμε αρχιτεκτονική, εμπειρία χρήστη και πλάνο υλοποίησης.",
    detail:
      "Ροές χρήστη, πρωτότυπα, μοντέλο δεδομένων, τεχνική αρχιτεκτονική και συμφωνημένο πλάνο παράδοσης.",
  },
  {
    icon: CodeRoundedIcon,
    title: "Ανάπτυξη",
    body: "Υλοποιούμε το λογισμικό σταδιακά, με τακτική ανατροφοδότηση.",
    detail:
      "Ιεραρχημένες εργασίες, ορατή πρόοδος, τακτικές παρουσιάσεις και συνεργατικές αποφάσεις.",
  },
  {
    icon: FactCheckRoundedIcon,
    title: "Δοκιμές & έλεγχοι",
    body: "Ελέγχουμε λειτουργικότητα, ασφάλεια και ποιότητα πριν την παράδοση.",
    detail:
      "Έλεγχοι λειτουργιών και ροών, διορθώσεις, έλεγχος δικαιωμάτων και προετοιμασία παραγωγικής διάθεσης.",
  },
  {
    icon: RocketLaunchRoundedIcon,
    title: "Παράδοση & υποστήριξη",
    body: "Θέτουμε τη λύση σε λειτουργία και σας υποστηρίζουμε στη συνέχεια.",
    detail:
      "Παράδοση συμφωνημένων πηγαίων αρχείων και τεκμηρίωσης, εκπαίδευση, μετάβαση και συμφωνημένη υποστήριξη.",
  },
];

const technologyLogos = [
  {
    name: "C#",
    category: { el: "Γλώσσα προγραμματισμού", en: "Programming language" },
    details: {
      el: "Ισχυρή, τυποποιημένη γλώσσα για επιχειρησιακή λογική, APIs και desktop εφαρμογές.",
      en: "A strongly typed language for business logic, APIs and desktop applications.",
    },
    core: true,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/csharp/csharp-original.svg",
  },
  {
    name: ".NET / ASP.NET Core",
    category: { el: "Backend", en: "Backend" },
    details: {
      el: "Πλαίσιο για APIs και υπηρεσίες με έμφαση στην απόδοση, την ασφάλεια και τη συντηρησιμότητα.",
      en: "A framework for APIs and services focused on performance, security and maintainability.",
    },
    core: true,
    logo: "https://cdn.simpleicons.org/dotnet/512BD4",
  },
  {
    name: "React",
    category: { el: "Frontend", en: "Frontend" },
    details: {
      el: "Component-based ανάπτυξη σύγχρονων και διαδραστικών web εμπειριών.",
      en: "Component-based development for modern, interactive web experiences.",
    },
    core: true,
    logo: "https://cdn.simpleicons.org/react/61DAFB",
  },
  {
    name: "TypeScript",
    category: { el: "Γλώσσα προγραμματισμού", en: "Programming language" },
    details: {
      el: "Τυποποιημένη JavaScript για πιο προβλέψιμο και εύκολα συντηρήσιμο frontend.",
      en: "Typed JavaScript for more predictable and maintainable frontends.",
    },
    core: true,
    logo: "https://cdn.simpleicons.org/typescript/3178C6",
  },
  {
    name: "MySQL",
    category: { el: "Σχεσιακή βάση δεδομένων", en: "Relational database" },
    details: {
      el: "Σχεσιακή αποθήκευση με συναλλαγές, σχέσεις και συνέπεια δεδομένων.",
      en: "Relational storage with transactions, relationships and data consistency.",
    },
    core: true,
    logo: "https://cdn.simpleicons.org/mysql/4479A1",
  },
  {
    name: "Vite",
    category: { el: "Build εργαλείο", en: "Build tool" },
    details: {
      el: "Γρήγορο development server και build pipeline για σύγχρονα web projects.",
      en: "A fast development server and build pipeline for modern web projects.",
    },
    core: true,
    logo: "https://cdn.simpleicons.org/vite/646CFF",
  },
  {
    name: "Material UI",
    category: { el: "UI framework", en: "UI framework" },
    details: {
      el: "Συνεπή, προσβάσιμα UI components και responsive σχεδιασμός.",
      en: "Consistent, accessible UI components and responsive design.",
    },
    core: true,
    logo: "https://cdn.simpleicons.org/mui/007FFF",
  },
  {
    name: "Entity Framework Core",
    category: { el: "ORM / πρόσβαση δεδομένων", en: "ORM / data access" },
    details: {
      el: "Αντιστοίχιση μοντέλων εφαρμογής με σχεσιακά δεδομένα και migrations.",
      en: "Mapping application models to relational data and managing migrations.",
    },
    core: true,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/entityframeworkcore/entityframeworkcore-original.svg",
  },
  {
    name: "Java",
    category: { el: "Γλώσσα προγραμματισμού", en: "Programming language" },
    details: {
      el: "Επιλογή για backend υπηρεσίες, εταιρικές εφαρμογές και Android οικοσυστήματα.",
      en: "An option for backend services, enterprise applications and Android ecosystems.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/java/java-original.svg",
  },
  {
    name: "C++",
    category: { el: "Γλώσσα προγραμματισμού", en: "Programming language" },
    details: {
      el: "Για έργα που απαιτούν native απόδοση, συστήματα ή διαχείριση πόρων χαμηλού επιπέδου.",
      en: "For projects requiring native performance, systems work or low-level resource control.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/cplusplus/cplusplus-original.svg",
  },
  {
    name: "Python",
    category: { el: "Γλώσσα προγραμματισμού", en: "Programming language" },
    details: {
      el: "Χρήσιμη για αυτοματισμούς, data workflows και επιλεγμένες υπηρεσίες backend.",
      en: "Useful for automation, data workflows and selected backend services.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/python/python-original.svg",
  },
  {
    name: "Angular",
    category: { el: "Frontend framework", en: "Frontend framework" },
    details: {
      el: "Δομημένο framework για μεγάλα, σύνθετα web περιβάλλοντα.",
      en: "A structured framework for large, complex web applications.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/angularjs/angularjs-original.svg",
  },
  {
    name: "Vue.js",
    category: { el: "Frontend framework", en: "Frontend framework" },
    details: {
      el: "Progressive framework για ευέλικτες web εφαρμογές και interfaces.",
      en: "A progressive framework for flexible web applications and interfaces.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/vuejs/vuejs-original.svg",
  },
  {
    name: "Node.js",
    category: { el: "JavaScript runtime", en: "JavaScript runtime" },
    details: {
      el: "Runtime JavaScript για APIs, εργαλεία και event-driven υπηρεσίες.",
      en: "A JavaScript runtime for APIs, tooling and event-driven services.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/nodejs/nodejs-original.svg",
  },
  {
    name: "PostgreSQL",
    category: { el: "Σχεσιακή βάση δεδομένων", en: "Relational database" },
    details: {
      el: "Ισχυρή σχεσιακή βάση για εφαρμογές με σύνθετα queries και απαιτήσεις ακεραιότητας.",
      en: "A powerful relational database for applications with complex queries and integrity requirements.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/postgresql/postgresql-original.svg",
  },
  {
    name: "MongoDB",
    category: { el: "NoSQL βάση δεδομένων", en: "NoSQL database" },
    details: {
      el: "Document database για δεδομένα με ευέλικτη δομή όπου ταιριάζει στην αρχιτεκτονική.",
      en: "A document database for flexible data structures when they fit the architecture.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/mongodb/mongodb-original.svg",
  },
  {
    name: "Docker",
    category: { el: "Containers & deployment", en: "Containers & deployment" },
    details: {
      el: "Συσκευασία εφαρμογών σε επαναλήψιμα περιβάλλοντα ανάπτυξης και διάθεσης.",
      en: "Packaging applications into repeatable development and deployment environments.",
    },
    core: false,
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/docker/docker-original.svg",
  },
];

const serviceTechnologyLogos: Record<string, string> = {
  MySQL: "https://cdn.simpleicons.org/mysql/4479A1",
  PostgreSQL: "https://cdn.simpleicons.org/postgresql/4169E1",
  MongoDB: "https://cdn.simpleicons.org/mongodb/47A248",
  OWASP: "https://cdn.simpleicons.org/owasp/FFFFFF",
  OpenSSL: "https://cdn.simpleicons.org/openssl/721412",
  "Let's Encrypt": "https://cdn.simpleicons.org/letsencrypt/003A70",
  Docker: "https://cdn.simpleicons.org/docker/2496ED",
  NGINX: "https://cdn.simpleicons.org/nginx/009639",
  Linux: "https://cdn.simpleicons.org/linux/FCC624",
  Cloudflare: "https://cdn.simpleicons.org/cloudflare/F38020",
  Postman: "https://cdn.simpleicons.org/postman/FF6C37",
  GitHub: "https://cdn.simpleicons.org/github/FFFFFF",
  "GitHub Actions": "https://cdn.simpleicons.org/githubactions/2088FF",
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
    logos: ["MySQL", "PostgreSQL", "MongoDB"],
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
    tags: ["AES-GCM", "OpenSSL", "TLS"],
    logos: ["OpenSSL", "Let's Encrypt"],
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
    logos: ["OWASP", "OpenSSL"],
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
    tags: ["Docker", "NGINX", "Linux"],
    logos: ["Docker", "NGINX", "Linux", "Cloudflare"],
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
    tags: ["Postman", "REST APIs", "Webhooks"],
    logos: ["Postman", "GitHub"],
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
    tags: ["GitHub Actions", "Docker", "Maintenance"],
    logos: ["GitHub Actions", "Docker", "Linux"],
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
  lifecycleEyebrow: "FROM FIRST CONVERSATION TO CONTINUOUS IMPROVEMENT",
  lifecycleOutcome: "A transparent journey, with checkpoints at every stage.",
  methodEyebrow: "A CLEAR, COLLABORATIVE PROCESS",
  methodTitle: "Agile development. Shared progress. Clear decisions.",
  methodIntro:
    "Instead of waiting until the end to see the result, you stay involved throughout delivery. Every iteration produces something reviewable, with decisions and changes agreed together.",
  agileDiagramLabel: "Agile iteration diagram: plan, build, review and repeat",
  agilePlan: "PLAN",
  agileBuild: "BUILD",
  agileReview: "REVIEW",
  agileFeedback: "Your feedback shapes the next iteration",
  agileIterations: "Short, reviewable iterations",
  methodSteps: [
    ["01", "Agree on the outcome", "We define the problem, users, priorities, scope, responsibilities and acceptance criteria before implementation."],
    ["02", "Deliver in small increments", "We break work into manageable iterations, share working software and keep decisions visible."],
    ["03", "Review, learn and adapt", "We use your feedback to reprioritize. Any material change to scope, timeline or budget is discussed and approved before work changes."],
  ],
  agreementTitle: "The agreement keeps the project clear.",
  agreementBody:
    "Before work begins, the written proposal or contract records the scope, milestones, deliverables, acceptance process, payment terms, intellectual-property arrangements and support. Agile means adapting together—not making unapproved changes to cost or scope.",
  agreementTerms: [
    ["Scope", "What is included and what is not"],
    ["Milestones", "Reviews, dates and decision points"],
    ["Deliverables", "What you receive at each stage"],
    ["Change control", "How changes are assessed and approved"],
  ],
  stackEyebrow: "A FLEXIBLE TECHNOLOGY TOOLKIT",
  stackTitle: "The right tools for the job.",
  stackIntro:
    "We build on the .NET, React, TypeScript and MySQL stack behind KALYPSIS, and can select other proven languages, frameworks and data platforms when a project calls for them.",
  stackCoreLabel: "Used in the KALYPSIS platform",
  stackOptionsLabel: "Additional options by project",
  stackCarouselLabel: "Technology stack carousel. Pause by hovering or focusing.",
  stackOfferTitle: "We build more than screens.",
  stackOfferBody:
    "From responsive web products and business portals to APIs, integrations, workflow automation, data-heavy platforms and desktop software, we select the stack around your users, constraints and long-term ownership.",
  stackOfferPoints: [
    "Web apps & customer portals",
    "APIs, integrations & automation",
    "Business platforms & data systems",
    "Desktop & internal tools",
  ],
  stackNote:
    "Java, C++, Python, Angular, Vue, Node.js, PostgreSQL, MongoDB and Docker are examples of additional options—not a claim that every technology is used in every project.",
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
        lifecycleEyebrow: "ΑΠΟ ΤΗΝ ΠΡΩΤΗ ΣΥΖΗΤΗΣΗ ΕΩΣ ΤΗ ΣΥΝΕΧΗ ΒΕΛΤΙΩΣΗ",
        lifecycleOutcome: "Μια διαφανής πορεία, με σημεία ελέγχου σε κάθε στάδιο.",
        methodEyebrow: "ΜΙΑ ΣΑΦΗΣ ΚΑΙ ΣΥΝΕΡΓΑΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ",
        methodTitle: "Agile ανάπτυξη. Κοινή πρόοδος. Καθαρές αποφάσεις.",
        methodIntro:
          "Δεν περιμένετε μέχρι το τέλος για να δείτε το αποτέλεσμα. Συμμετέχετε σε όλη την πορεία: κάθε κύκλος παράγει κάτι αξιολογήσιμο και οι αποφάσεις συμφωνούνται από κοινού.",
        agileDiagramLabel: "Διάγραμμα Agile κύκλου: σχεδιασμός, υλοποίηση, αξιολόγηση και επανάληψη",
        agilePlan: "ΣΧΕΔΙΑΣΜΟΣ",
        agileBuild: "ΥΛΟΠΟΙΗΣΗ",
        agileReview: "ΑΞΙΟΛΟΓΗΣΗ",
        agileFeedback: "Η δική σας ανατροφοδότηση οδηγεί στον επόμενο κύκλο",
        agileIterations: "Σύντομοι κύκλοι με αξιολογήσιμα παραδοτέα",
        methodSteps: [
          ["01", "Συμφωνούμε το αποτέλεσμα", "Ορίζουμε το πρόβλημα, τους χρήστες, τις προτεραιότητες, το αντικείμενο, τις ευθύνες και τα κριτήρια αποδοχής πριν ξεκινήσει η υλοποίηση."],
          ["02", "Παραδίδουμε σταδιακά", "Χωρίζουμε την εργασία σε διαχειρίσιμους κύκλους, παρουσιάζουμε λειτουργικό λογισμικό και κρατάμε τις αποφάσεις ορατές."],
          ["03", "Αξιολογούμε και προσαρμοζόμαστε", "Αξιοποιούμε τα σχόλιά σας για νέες προτεραιότητες. Κάθε ουσιαστική αλλαγή σε εύρος, χρόνο ή κόστος συζητείται και εγκρίνεται πριν εφαρμοστεί."],
        ],
        agreementTitle: "Η συμφωνία κρατά το έργο ξεκάθαρο.",
        agreementBody:
          "Πριν ξεκινήσει η εργασία, η γραπτή προσφορά ή σύμβαση καταγράφει το αντικείμενο, τα ορόσημα, τα παραδοτέα, τη διαδικασία αποδοχής, τους όρους πληρωμής, τα δικαιώματα πνευματικής ιδιοκτησίας και την υποστήριξη. Agile σημαίνει ότι προσαρμοζόμαστε μαζί — όχι ότι αλλάζουν ανεξέλεγκτα το κόστος ή το αντικείμενο.",
        agreementTerms: [
          ["Αντικείμενο", "Τι περιλαμβάνεται και τι όχι"],
          ["Ορόσημα", "Έλεγχοι, ημερομηνίες και αποφάσεις"],
          ["Παραδοτέα", "Τι παραλαμβάνετε σε κάθε στάδιο"],
          ["Διαχείριση αλλαγών", "Πώς αξιολογούνται και εγκρίνονται"],
        ],
        stackEyebrow: "ΕΥΕΛΙΚΤΟ ΤΕΧΝΟΛΟΓΙΚΟ ΟΙΚΟΣΥΣΤΗΜΑ",
        stackTitle: "Τα κατάλληλα εργαλεία για κάθε έργο.",
        stackIntro:
          "Αναπτύσσουμε την πλατφόρμα KALYPSIS με .NET, React, TypeScript και MySQL. Όταν το έργο το απαιτεί, επιλέγουμε και άλλες δοκιμασμένες γλώσσες, frameworks και βάσεις δεδομένων.",
        stackCoreLabel: "Σε χρήση στην πλατφόρμα KALYPSIS",
        stackOptionsLabel: "Επιπλέον επιλογές ανά έργο",
        stackCarouselLabel: "Carousel τεχνολογιών. Παύση με hover ή εστίαση.",
        stackOfferTitle: "Δημιουργούμε κάτι περισσότερο από οθόνες.",
        stackOfferBody:
          "Από responsive web εφαρμογές και portals έως APIs, διασυνδέσεις, αυτοματισμούς, data platforms και desktop λογισμικό, επιλέγουμε τεχνολογίες με βάση τους χρήστες, τους περιορισμούς και τη μελλοντική συντήρηση.",
        stackOfferPoints: [
          "Web εφαρμογές & portals πελατών",
          "APIs, διασυνδέσεις & αυτοματισμοί",
          "Επιχειρησιακές πλατφόρμες & δεδομένα",
          "Desktop εφαρμογές & εσωτερικά εργαλεία",
        ],
        stackNote:
          "Java, C++, Python, Angular, Vue, Node.js, PostgreSQL, MongoDB και Docker είναι ενδεικτικές πρόσθετες επιλογές — δεν σημαίνει ότι κάθε τεχνολογία χρησιμοποιείται σε κάθε έργο.",
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

  const renderTechnologyGroup = (duplicate: boolean) => (
    <Box
      className="technology-group"
      aria-hidden={duplicate || undefined}
      key={duplicate ? "technology-duplicate" : "technology-primary"}
      sx={{
        display: "flex",
        flexShrink: 0,
        gap: 2,
        pr: 2,
      }}
    >
      {technologyLogos.map((technology) => (
        <Box
          key={technology.name}
          sx={{
            width: { xs: 235, md: 285 },
            minHeight: { xs: 245, md: 265 },
            p: { xs: 2.5, md: 3 },
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            border: "1px solid #dfe8f2",
            borderRadius: 3,
            bgcolor: "#fff",
            boxShadow: "0 12px 35px rgba(13,42,73,.07)",
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            sx={{ width: "100%" }}
          >
            <Box
              sx={{
                width: 82,
                height: 82,
                display: "grid",
                placeItems: "center",
                borderRadius: 2.5,
                border: "1px solid #edf1f6",
                bgcolor: "#f8fafc",
              }}
            >
              <Box
                component="img"
                src={technology.logo}
                alt={`${technology.name} logo`}
                loading={duplicate ? "lazy" : undefined}
                referrerPolicy="no-referrer"
                sx={{ width: 58, height: 58, objectFit: "contain" }}
              />
            </Box>
            <Chip
              size="small"
              label={technology.core ? labels.stackCoreLabel : labels.stackOptionsLabel}
              sx={{
                maxWidth: 150,
                height: "auto",
                py: 0.45,
                color: technology.core ? "#155b3c" : "#385575",
                bgcolor: technology.core ? "#e7f5ec" : "#edf3f9",
                fontSize: 10,
                fontWeight: 800,
                "& .MuiChip-label": { whiteSpace: "normal", px: 1 },
              }}
            />
          </Stack>
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ color: "#102d4a", fontSize: 18, fontWeight: 900 }}>
              {technology.name}
            </Typography>
            <Typography sx={{ mt: 0.35, color: "#236eaa", fontSize: 12, fontWeight: 800 }}>
              {isEnglish ? technology.category.en : technology.category.el}
            </Typography>
            <Typography sx={{ mt: 1, color: "#52647b", fontSize: 13, lineHeight: 1.65 }}>
              {isEnglish ? technology.details.en : technology.details.el}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <PublicShell modernNav>
      <Box sx={{ bgcolor: "#f5f9ff", color: "#0b2545", overflow: "hidden" }}>
        <Box
          component="section"
          sx={{
            position: "relative",
            color: "#fff",
            backgroundImage:
              "linear-gradient(110deg,rgba(4,15,29,.91) 0%,rgba(5,20,38,.82) 52%,rgba(7,26,47,.72) 100%), url(\"https://static.vecteezy.com/system/resources/previews/003/335/579/large_2x/desktop-source-code-and-wallpaper-by-coding-and-programming-free-photo.jpg\")",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            "&::before": {
              content: '""',
              position: "absolute",
              width: 520,
              height: 520,
              right: "-12%",
              top: "-55%",
              border: "1px solid rgba(190,220,255,.12)",
              borderRadius: "50%",
              pointerEvents: "none",
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
                position: "relative",
                zIndex: 1,
              }}
            >
              <Stack spacing={2.25} sx={{ position: "relative", zIndex: 1 }}>
                <Typography
                  sx={{
                    color: "#a9dcff",
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
                    color: "#fff",
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
                    color: "rgba(240,247,255,.86)",
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
                      borderColor: "rgba(218,237,255,.72)",
                      color: "#fff",
                      fontWeight: 800,
                      "&:hover": {
                        borderColor: "#fff",
                        bgcolor: "rgba(255,255,255,.12)",
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
                gridTemplateColumns: "minmax(0,1fr)",
                gap: { xs: 3, md: 4 },
              }}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoModeRoundedIcon
                    sx={{
                      color: "#83ceff",
                      fontSize: 23,
                      filter: "drop-shadow(0 0 10px rgba(88,186,255,.4))",
                    }}
                  />
                  <Typography
                    sx={{
                      color: "#7fc8ff",
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: ".16em",
                    }}
                  >
                    {labels.methodEyebrow}
                  </Typography>
                </Stack>
                <Typography
                  component="h2"
                  sx={{
                    mt: 1.25,
                    maxWidth: 920,
                    fontSize: { xs: 32, md: 48 },
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
                    maxWidth: 880,
                    color: "#b8cce0",
                    fontSize: { xs: 17, md: 20 },
                    lineHeight: 1.8,
                  }}
                >
                  {labels.methodIntro}
                </Typography>
              </Box>
              <Box
                role="img"
                aria-label={labels.agileDiagramLabel}
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  minHeight: { xs: 305, md: 390 },
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(150,198,235,.22)",
                  borderRadius: 3,
                  background:
                    "radial-gradient(ellipse at 50% 45%,rgba(38,121,194,.2),transparent 55%),rgba(255,255,255,.035)",
                }}
              >
                <Box
                  component="svg"
                  viewBox="0 0 900 390"
                  role="presentation"
                  sx={{
                    width: "100%",
                    maxWidth: 980,
                    height: "auto",
                    px: { xs: 1, md: 4 },
                    py: { xs: 2, md: 3 },
                    overflow: "visible",
                  }}
                >
                  <defs>
                    <linearGradient id="agileLoop" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0" stopColor="#52b8ff" />
                      <stop offset="1" stopColor="#a4e0ff" />
                    </linearGradient>
                    <marker
                      id="agileArrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#78caff" />
                    </marker>
                  </defs>
                  <path
                    d="M 285 104 C 370 39, 532 40, 615 105"
                    fill="none"
                    stroke="url(#agileLoop)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    markerEnd="url(#agileArrow)"
                  />
                  <path
                    d="M 656 142 C 693 220, 632 290, 555 310"
                    fill="none"
                    stroke="url(#agileLoop)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    markerEnd="url(#agileArrow)"
                  />
                  <path
                    d="M 344 310 C 266 293, 205 220, 244 142"
                    fill="none"
                    stroke="url(#agileLoop)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    markerEnd="url(#agileArrow)"
                  />
                  {[
                    { x: 225, label: labels.agilePlan, icon: "01" },
                    { x: 450, label: labels.agileBuild, icon: "02" },
                    { x: 675, label: labels.agileReview, icon: "03" },
                  ].map((node) => (
                    <g key={node.label} transform={`translate(${node.x} 185)`}>
                      <rect
                        x="-100"
                        y="-54"
                        width="200"
                        height="108"
                        rx="20"
                        fill="#102f4e"
                        stroke="#447ba7"
                        strokeWidth="2"
                      />
                      <circle cx="0" cy="-19" r="20" fill="#17486f" />
                      <text
                        x="0"
                        y="-14"
                        textAnchor="middle"
                        fill="#9ddcff"
                        fontSize="14"
                        fontWeight="800"
                        fontFamily="system-ui,sans-serif"
                      >
                        {node.icon}
                      </text>
                      <text
                        x="0"
                        y="28"
                        textAnchor="middle"
                        fill="#f3f8ff"
                        fontSize="16"
                        fontWeight="800"
                        fontFamily="system-ui,sans-serif"
                      >
                        {node.label}
                      </text>
                    </g>
                  ))}
                  <rect
                    x="260"
                    y="342"
                    width="380"
                    height="36"
                    rx="18"
                    fill="#143b5b"
                    stroke="#38678a"
                  />
                  <text
                    x="450"
                    y="365"
                    textAnchor="middle"
                    fill="#c6e8ff"
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="system-ui,sans-serif"
                  >
                    {labels.agileFeedback}
                  </text>
                </Box>
                <Chip
                  label={labels.agileIterations}
                  icon={<AutoModeRoundedIcon />}
                  sx={{
                    position: "absolute",
                    left: { xs: 1.25, md: 2.5 },
                    bottom: { xs: 1.25, md: 2 },
                    maxWidth: "calc(100% - 24px)",
                    height: "auto",
                    py: 0.6,
                    color: "#d7efff",
                    border: "1px solid rgba(143,202,243,.25)",
                    bgcolor: "#102e4b",
                    fontWeight: 800,
                    "& .MuiChip-label": { whiteSpace: "normal" },
                  }}
                />
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(3,minmax(0,1fr))",
                  },
                  gap: 1.5,
                }}
              >
                {labels.methodSteps.map(([number, title, description]) => (
                  <Box
                    key={number}
                    sx={{
                      minWidth: 0,
                      p: { xs: 2.5, md: 3 },
                      border: "1px solid rgba(150,198,235,.2)",
                      borderRadius: 2.5,
                      bgcolor: "rgba(255,255,255,.045)",
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: 46,
                          height: 46,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 1.5,
                          border: "1px solid rgba(127,200,255,.32)",
                          bgcolor: "rgba(127,200,255,.1)",
                          color: "#8bd0ff",
                          fontSize: 14,
                          fontWeight: 900,
                        }}
                      >
                        {number}
                      </Box>
                      <Typography
                        sx={{
                          color: "#f5f9ff",
                          fontSize: { xs: 17, md: 19 },
                          fontWeight: 850,
                          lineHeight: 1.35,
                        }}
                      >
                        {title}
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{
                        mt: 1.5,
                        color: "#adc2d8",
                        fontSize: { xs: 14, md: 15 },
                        lineHeight: 1.8,
                      }}
                    >
                      {description}
                    </Typography>
                  </Box>
                ))}
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
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2.5}
                  alignItems={{ md: "center" }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      component="h3"
                      sx={{
                        position: "relative",
                        fontSize: { xs: 20, md: 24 },
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
                        fontSize: { xs: 14, md: 15 },
                        lineHeight: 1.85,
                      }}
                    >
                      {labels.agreementBody}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      flex: 1,
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
                      gap: 1,
                    }}
                  >
                    {labels.agreementTerms.map(([title, detail]) => (
                      <Stack
                        key={title}
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                        sx={{
                          p: 1.5,
                          border: "1px solid rgba(143,202,243,.16)",
                          borderRadius: 1.5,
                          bgcolor: "rgba(117,178,222,.07)",
                        }}
                      >
                        <CheckCircleRoundedIcon
                          sx={{ color: "#8bd0ff", fontSize: 18, mt: 0.15 }}
                        />
                        <Box>
                          <Typography sx={{ color: "#eaf6ff", fontSize: 13, fontWeight: 850 }}>
                            {title}
                          </Typography>
                          <Typography sx={{ mt: 0.25, color: "#adc2d8", fontSize: 12, lineHeight: 1.5 }}>
                            {detail}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Container>
        </Box>

        <Box
          component="section"
          sx={{
            px: { xs: 2, sm: 3, md: 5 },
            py: { xs: 6, md: 9 },
            color: "#102d4a",
            bgcolor: "#fff",
            borderTop: "1px solid #e1e9f2",
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
                    color: "#1768aa",
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
                    fontSize: { xs: 32, md: 44 },
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
                    color: "#53667d",
                    fontSize: { xs: 16, md: 18 },
                    lineHeight: 1.75,
                  }}
                >
                  {labels.stackIntro}
                </Typography>
              </Box>
              <CodeRoundedIcon
                sx={{
                  display: { xs: "none", md: "block" },
                  color: "rgba(18,98,188,.18)",
                  fontSize: 76,
                }}
              />
            </Box>
            <Box
              role="region"
              aria-label={labels.stackCarouselLabel}
              tabIndex={0}
              sx={{
                overflow: "hidden",
                py: 1.5,
                outline: "none",
                maskImage:
                  "linear-gradient(90deg,transparent 0,#000 4%,#000 96%,transparent 100%)",
                "&:hover .technology-track, &:focus-within .technology-track, &:focus .technology-track": {
                  animationPlayState: "paused",
                },
                "@media (prefers-reduced-motion: reduce)": {
                  overflowX: "auto",
                  "& .technology-track": { animation: "none" },
                },
              }}
            >
              <Box
                className="technology-track"
                sx={{
                  display: "flex",
                  width: "max-content",
                  animation: "technology-scroll 64s linear infinite",
                  "@keyframes technology-scroll": {
                    from: { transform: "translateX(0)" },
                    to: { transform: "translateX(-50%)" },
                  },
                }}
              >
                {renderTechnologyGroup(false)}
                {renderTechnologyGroup(true)}
              </Box>
            </Box>
            <Box
              sx={{
                mt: { xs: 4, md: 5 },
                p: { xs: 2.5, md: 3.5 },
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
                gap: { xs: 2, md: 4 },
                alignItems: "center",
                border: "1px solid #dfe8f2",
                borderRadius: 3,
                bgcolor: "#fff",
                boxShadow: "0 12px 35px rgba(13,42,73,.055)",
              }}
            >
              <Box>
                <Typography
                  component="h3"
                  sx={{ color: "#102d4a", fontSize: { xs: 21, md: 26 }, fontWeight: 900 }}
                >
                  {labels.stackOfferTitle}
                </Typography>
                <Typography sx={{ mt: 1, color: "#53667d", fontSize: 15, lineHeight: 1.8 }}>
                  {labels.stackOfferBody}
                </Typography>
              </Box>
              <Stack spacing={1}>
                {labels.stackOfferPoints.map((point) => (
                  <Stack key={point} direction="row" spacing={1} alignItems="center">
                    <CheckCircleRoundedIcon sx={{ color: "#168552", fontSize: 19 }} />
                    <Typography sx={{ color: "#304a65", fontSize: 13, fontWeight: 750 }}>
                      {point}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
            <Typography
              sx={{
                mt: 1.5,
                color: "#718198",
                fontSize: 12,
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
                      minHeight: { xs: 0, md: 390 },
                      p: { xs: 2.5, md: 3.25 },
                      border: "1px solid rgba(150,198,235,.2)",
                      borderRadius: 3,
                      bgcolor: "rgba(255,255,255,.055)",
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
                        width: 58,
                        height: 58,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 1.75,
                        color: "#8bd0ff",
                        bgcolor: "rgba(91,173,232,.13)",
                        border: "1px solid rgba(143,202,243,.16)",
                      }}
                    >
                      <Icon sx={{ fontSize: 30 }} />
                    </Box>
                    <Typography
                      component="h3"
                      sx={{
                        position: "relative",
                        mt: 2,
                        fontSize: { xs: 20, md: 23 },
                        fontWeight: 900,
                        lineHeight: 1.35,
                      }}
                    >
                      {isEnglish ? service.title.en : service.title.el}
                    </Typography>
                    <Stack
                      direction="row"
                      useFlexGap
                      flexWrap="wrap"
                      gap={1}
                      sx={{ position: "relative", mt: 1.75, mb: 1.75 }}
                    >
                      {service.logos.map((name) => (
                        <Stack
                          key={name}
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          sx={{
                            minHeight: 46,
                            px: 1,
                            border: "1px solid rgba(143,202,243,.18)",
                            borderRadius: 1.25,
                            bgcolor: "rgba(117,178,222,.07)",
                          }}
                        >
                          <Box
                            component="img"
                            src={serviceTechnologyLogos[name]}
                            alt={`${name} logo`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            sx={{ width: 32, height: 32, objectFit: "contain" }}
                          />
                          <Typography
                            sx={{ color: "#c6e6ff", fontSize: 11, fontWeight: 800 }}
                          >
                            {name}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Typography
                      sx={{
                        position: "relative",
                        color: "#c0d0e0",
                        fontSize: { xs: 14, md: 15 },
                        fontWeight: 700,
                        lineHeight: 1.75,
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
                        fontSize: { xs: 13, md: 14 },
                        lineHeight: 1.8,
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

        <Box
          component="section"
          sx={{
            px: { xs: 2, sm: 3, md: 5 },
            py: { xs: 7, md: 10 },
            color: "#102d4a",
            bgcolor: "#f7faff",
            borderTop: "1px solid #e4ecf5",
          }}
        >
          <Container maxWidth="xl" disableGutters>
            <Box sx={{ maxWidth: 850 }}>
              <Typography
                sx={{
                  color: "#1768aa",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: ".15em",
                }}
              >
                {labels.lifecycleEyebrow}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1.25,
                  fontSize: { xs: 34, md: 48 },
                  fontWeight: 900,
                  lineHeight: 1.12,
                  letterSpacing: "-.035em",
                }}
              >
                {labels.workTitle}
              </Typography>
              <Typography
                sx={{
                  mt: 1.5,
                  color: "#52647c",
                  fontSize: { xs: 17, md: 20 },
                  lineHeight: 1.8,
                }}
              >
                {labels.workIntro}
              </Typography>
            </Box>
            <Box
              component="ol"
              sx={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(5,minmax(0,1fr))",
                },
                gap: { xs: 1.5, md: 2 },
                mt: { xs: 4, md: 6 },
                p: 0,
                listStyle: "none",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  zIndex: 0,
                  bgcolor: "#cfdeed",
                  left: { xs: 29, md: "10%" },
                  right: { xs: "auto", md: "10%" },
                  top: { xs: 28, md: 29 },
                  bottom: { xs: 48, md: "auto" },
                  width: { xs: 2, md: "auto" },
                  height: { xs: "auto", md: 2 },
                },
              }}
            >
              {lifecycle.map((step, index) => {
                const Icon = step.icon;
                const englishStep = lifecycleEnglish[index];
                return (
                  <Box
                    component="li"
                    key={step.title}
                    sx={{
                      position: "relative",
                      zIndex: 1,
                      display: "grid",
                      gridTemplateColumns: { xs: "60px minmax(0,1fr)", md: "1fr" },
                      gridTemplateRows: { md: "60px minmax(0,1fr)" },
                      alignItems: "start",
                      gap: { xs: 1.5, md: 2 },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: { xs: "flex-start", md: "center" },
                      }}
                    >
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          display: "grid",
                          placeItems: "center",
                          border: "5px solid #f7faff",
                          borderRadius: "50%",
                          color: "#fff",
                          bgcolor: "#1262a3",
                          boxShadow: "0 0 0 1px #b8cce0, 0 8px 22px rgba(18,75,125,.18)",
                        }}
                      >
                        <Icon sx={{ fontSize: 27 }} />
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        minWidth: 0,
                        minHeight: { md: 300 },
                        p: { xs: 2.25, md: 2.5 },
                        border: "1px solid #dfe8f2",
                        borderRadius: 2.5,
                        bgcolor: "#fff",
                        boxShadow: "0 10px 28px rgba(13,42,73,.055)",
                      }}
                    >
                      <Typography
                        sx={{
                          color: "#2778b6",
                          fontSize: 12,
                          fontWeight: 900,
                          letterSpacing: ".12em",
                        }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </Typography>
                      <Typography
                        component="h3"
                        sx={{
                          mt: 0.75,
                          color: "#102d4a",
                          fontSize: { xs: 19, md: 20 },
                          fontWeight: 900,
                          lineHeight: 1.35,
                        }}
                      >
                        {isEnglish ? englishStep.title : step.title}
                      </Typography>
                      <Typography
                        sx={{
                          mt: 1,
                          color: "#344f6d",
                          fontSize: { xs: 14, md: 15 },
                          fontWeight: 700,
                          lineHeight: 1.7,
                        }}
                      >
                        {isEnglish ? englishStep.body : step.body}
                      </Typography>
                      <Typography
                        sx={{
                          mt: 1,
                          color: "#687b91",
                          fontSize: 13,
                          lineHeight: 1.7,
                        }}
                      >
                        {isEnglish ? englishStep.detail : step.detail}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Box
              sx={{
                mt: 3,
                p: { xs: 2, md: 2.5 },
                display: "flex",
                gap: 1.5,
                alignItems: "center",
                borderLeft: "4px solid #2585c4",
                borderRadius: 1.5,
                bgcolor: "#eaf3fb",
              }}
            >
              <AutoModeRoundedIcon sx={{ color: "#1768aa", fontSize: 26 }} />
              <Typography
                sx={{
                  color: "#294866",
                  fontSize: { xs: 14, md: 16 },
                  fontWeight: 800,
                }}
              >
                {labels.lifecycleOutcome}
              </Typography>
            </Box>
          </Container>
        </Box>

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
    title: "Requirements analysis",
    body: "We map your requirements, workflows and goals.",
    detail:
      "Stakeholder conversations, functional requirements, user needs, priorities and project constraints.",
  },
  {
    title: "Solution design",
    body: "We define architecture, user experience and delivery plan.",
    detail:
      "User journeys, prototypes, data model, technical architecture and an agreed delivery plan.",
  },
  {
    title: "Development",
    body: "We build iteratively and incorporate regular feedback.",
    detail:
      "Prioritized work, visible progress, regular demonstrations and collaborative decisions.",
  },
  {
    title: "Testing & assurance",
    body: "We verify functionality, security and quality before release.",
    detail:
      "Feature and workflow checks, fixes, access-control review and production-readiness preparation.",
  },
  {
    title: "Delivery & support",
    body: "We launch the solution and support you after delivery.",
    detail:
      "Agreed source files and documentation, handover, training and the agreed support arrangement.",
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
      component="img"
      src="/images/custom-software-collections.jpg"
      alt={
        isEnglish
          ? "KALYPSIS Desktop BackOffice collections screen"
          : "Οθόνη εισπράξεων του KALYPSIS Desktop BackOffice"
      }
      loading="eager"
      fetchPriority="high"
      sx={{
        display: "block",
        minWidth: 0,
        width: "100%",
        height: "auto",
        maxHeight: { xs: 320, sm: 390, md: 450 },
        objectFit: "contain",
        border: "1px solid rgba(210,230,250,.55)",
        borderRadius: 2.5,
        boxShadow: "0 28px 65px rgba(0,0,0,.4)",
      }}
    />
  );
}
