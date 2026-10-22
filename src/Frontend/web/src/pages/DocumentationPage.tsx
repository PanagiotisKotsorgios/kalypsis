import { useRef, useState } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { printGuidePdf } from "../components/printGuidePdf";

export const GUIDE_PDF_URL = "/docs/kalypsis-backoffice-guide.pdf#toolbar=1&navpanes=0&view=FitH";

/** The office guide is just the existing PDF in the browser's native viewer. */
export function DocumentationPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  return <Box data-documentation-pdf-only sx={{ minWidth: 0 }}>
    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
      <Button variant="contained" startIcon={<PrintIcon />} disabled={!ready} onClick={() => {
        const printed = printGuidePdf(frame.current, () => window.open(GUIDE_PDF_URL, "_blank", "noopener,noreferrer"));
        setFallback(!printed);
      }}>Εκτύπωση PDF</Button>
    </Stack>
    {fallback && <Alert severity="info" onClose={() => setFallback(false)} sx={{ mb: 1 }}>Χρησιμοποιήστε το εικονίδιο εκτύπωσης του PDF στη νέα καρτέλα. Αν δεν άνοιξε, <a href={GUIDE_PDF_URL} target="_blank" rel="noopener noreferrer">ανοίξτε τον οδηγό εδώ</a>.</Alert>}
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden", bgcolor: "background.paper" }}>
      <iframe ref={frame} src={GUIDE_PDF_URL} title="Οδηγίες χρήσης Kalypsis — PDF" onLoad={() => setReady(true)}
        style={{ display: "block", width: "100%", height: "calc(100dvh - 250px)", minHeight: 360, border: 0 }} />
    </Box>
  </Box>;
}

export default DocumentationPage;
