import { Box, Button, Container, Stack, Typography } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

// Dependencies verified against the web and .NET projects. These are
// technology credits, not a claim of commercial partnership or endorsement.
export const PUBLIC_TECHNOLOGIES = [
  { name: "Microsoft", description: "Τεχνολογίες ανάπτυξης και εφαρμογή για Windows", logo: "microsoft.png", website: "https://www.microsoft.com/" },
  { name: ".NET", description: "Υπηρεσίες εφαρμογής και περιβάλλον υπολογιστή", logo: "dotnet.svg", website: "https://dotnet.microsoft.com/", github: "https://github.com/dotnet/runtime" },
  { name: "MySQL · Oracle", description: "Οργάνωση και αποθήκευση δεδομένων", logo: "mysql.png", website: "https://www.mysql.com/", github: "https://github.com/mysql/mysql-server" },
  { name: "React", description: "Διαδραστικό περιβάλλον στο διαδίκτυο", logo: "react.png", website: "https://react.dev/", github: "https://github.com/facebook/react" },
  { name: "TypeScript", description: "Δομημένος κώδικας για τη διαδικτυακή εφαρμογή", logo: "typescript.png", website: "https://www.typescriptlang.org/", github: "https://github.com/microsoft/TypeScript" },
  { name: "Material UI", description: "Στοιχεία διεπαφής και προσαρμοστική σχεδίαση", logo: "mui.svg", website: "https://mui.com/material-ui/", github: "https://github.com/mui/material-ui" },
  { name: "Recharts", description: "Διαδραστικά γραφήματα και απεικόνιση δεδομένων", logo: "recharts.svg", website: "https://recharts.github.io/", github: "https://github.com/recharts/recharts" },
  { name: "Vite", description: "Εργαλεία ανάπτυξης της διαδικτυακής εφαρμογής", logo: "vite.svg", website: "https://vite.dev/", github: "https://github.com/vitejs/vite" },
];

export function PublicTechnologiesSection() {
  return <Box component="section" aria-labelledby="technology-heading" sx={{ py: { xs: 6, md: 9 }, bgcolor: "#EDF3FA", borderBlock: "1px solid #D9E5F1" }}>
    <Container maxWidth="xl" sx={{ px: { xs: 2, md: 5 } }}>
      <Box sx={{ textAlign: "center", maxWidth: 780, mx: "auto", mb: 4 }}>
        <Typography sx={{ color: "#087CEB", letterSpacing: ".12em", fontWeight: 800, fontSize: 12, mb: 1 }}>Η ΤΕΧΝΟΛΟΓΙΑ ΠΙΣΩ ΑΠΟ ΤΟ KALYPSIS</Typography>
        <Typography id="technology-heading" component="h2" sx={{ color: "#0B2545", fontSize: { xs: 27, md: 38 }, fontWeight: 900, mb: 1.5 }}>Τεχνολογίες που αξιοποιούμε</Typography>
        <Typography sx={{ color: "#536B89", lineHeight: 1.7 }}>Συνδυάζουμε σύγχρονες πλατφόρμες και βιβλιοθήκες για το διαδικτυακό KALYPSIS και την εφαρμογή για Windows. Γνωρίστε τα εργαλεία πίσω από την καθημερινή σας εργασία.</Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }, gap: 2 }}>
        {PUBLIC_TECHNOLOGIES.map(technology => <Box key={technology.name} sx={{ p: 2.5, bgcolor: "#FDFEFF", border: "1px solid #D5E0EC", borderRadius: 3, display: "flex", flexDirection: "column", transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease", "&:hover, &:focus-within": { transform: "translateY(-5px)", borderColor: "#7FAEE0", boxShadow: "0 14px 32px rgba(16,44,85,.10)" }, "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover, &:focus-within": { transform: "none" } } }}>
          <Box component="a" href={technology.website} target="_blank" rel="noopener noreferrer" aria-label={`${technology.name} — επίσημος ιστότοπος (νέα καρτέλα)`} sx={{ color: "#102D55", textDecoration: "none", borderRadius: 1, "&:focus-visible": { outline: "3px solid #087CEB", outlineOffset: 4 } }}>
            <Box sx={{ height: 78, display: "flex", alignItems: "center", mb: 1.5 }}><Box component="img" src={`/images/technologies/${technology.logo}`} alt={`Λογότυπο ${technology.name}`} loading="lazy" decoding="async" sx={{ height: 64, maxWidth: "100%", width: ["Microsoft", "Recharts"].includes(technology.name) ? 160 : technology.name.startsWith("MySQL") ? 125 : 64, objectFit: "contain" }} /></Box>
            <Typography component="h3" sx={{ fontWeight: 850, fontSize: 19 }}>{technology.name}</Typography>
            <Typography sx={{ color: "#536B89", fontSize: 14, lineHeight: 1.6, mt: .75 }}>{technology.description}</Typography>
          </Box>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={.5} sx={{ mt: "auto", pt: 2 }}>
            <Button size="small" component="a" href={technology.website} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} sx={{ color: "#076CC9", textTransform: "none" }}>Ιστότοπος</Button>
            {technology.github && <Button size="small" component="a" href={technology.github} target="_blank" rel="noopener noreferrer" startIcon={<GitHubIcon />} sx={{ color: "#102D55", textTransform: "none" }} aria-label={`Πηγαίος κώδικας ${technology.name} στο GitHub`}>Πηγαίος κώδικας</Button>}
          </Stack>
        </Box>)}
      </Box>
      <Typography sx={{ mt: 3, textAlign: "center", color: "#536B89", fontSize: 12, lineHeight: 1.6 }}>Τα λογότυπα και τα εμπορικά σήματα ανήκουν στους αντίστοιχους δικαιούχους.</Typography>
    </Container>
  </Box>;
}
