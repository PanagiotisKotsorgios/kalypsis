import { useEffect, useMemo, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, Chip,
  CircularProgress, Divider, Stack, TextField, Tooltip, Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PrintIcon from "@mui/icons-material/Print";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GavelIcon from "@mui/icons-material/Gavel";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { WysiwygEditor } from "../components/WysiwygEditor";

interface CustomerFormTemplate {
  formCode: string;
  code: string;
  name: string;
  kind: string;
  headerHtml: string | null;
  bodyHtml: string | null;
  footerHtml: string | null;
  isCustomized: boolean;
  fields: Array<{ key: string; label: string; description: string }>;
}

// Νομικά templates ανά γραφείο. Κάθε γραφείο-controller έχει την υποχρέωση
// να δώσει στους πελάτες του συγκεκριμένα έντυπα ενημέρωσης + να συλλέξει
// ρητές συγκαταθέσεις όπου απαιτείται. Η σελίδα αυτή τα παρέχει έτοιμα με
// pre-fill από τα Ρυθμίσεις Γραφείου· ο operator μπορεί να τα προσαρμόσει,
// να τα σώσει τοπικά στο γραφείο του, να τα εκτυπώσει, να τα αποθηκεύσει ως
// PDF (μέσω του native print dialog) ή να τα επαναφέρει στην προεπιλογή.

interface AgencyProfile {
  name: string;
  logoUrl: string | null;
  vatNumber: string | null;
  addressLine: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  tteRegistrationNumber: string | null;
  tteRegistrationYear: number | null;
}

const AGENCY_PLACEHOLDER: AgencyProfile = {
  name: "[Επωνυμία Γραφείου]",
  logoUrl: null,
  vatNumber: null,
  addressLine: null,
  contactEmail: null,
  contactPhone: null,
  tteRegistrationNumber: null,
  tteRegistrationYear: null,
};

type TemplateKey = "gdpr13" | "gdpr9" | "idd" | "aml";
const STORAGE_PREFIX = "kalypsis.legalTemplate.";

interface TemplateMeta {
  key: TemplateKey;
  title: string;
  legalBase: string;
  when: string;
  build: (p: AgencyProfile) => string;
}

const TEMPLATES: TemplateMeta[] = [
  { key: "gdpr13", title: "1. Ενημέρωση Υποκειμένου Δεδομένων",
    legalBase: "Άρθρο 13 GDPR",
    when: "Δίδεται σε ΚΑΘΕ πελάτη κατά τη στιγμή συλλογής των στοιχείων του.",
    build: buildGdpr13Text },
  { key: "gdpr9", title: "2. Ρητή Συγκατάθεση Επεξεργασίας Δεδομένων Υγείας",
    legalBase: "Άρθρο 9 GDPR",
    when: "Απαιτείται ΜΟΝΟ για συμβόλαια Ζωής, Υγείας, Ατυχημάτων ή όπου συλλέγονται ιατρικά δεδομένα.",
    build: buildGdpr9Text },
  { key: "idd", title: "3. Ανάλυση Απαιτήσεων και Αναγκών Πελάτη (Demands & Needs)",
    legalBase: "Ν. 4583/2018, Άρθρο 27 (IDD)",
    when: "Υποχρεωτικό για ΚΑΘΕ πρόταση ασφαλιστικού προϊόντος πριν την υπογραφή.",
    build: buildIddText },
  { key: "aml", title: "4. Δήλωση Πραγματικού Δικαιούχου & Πηγής Χρημάτων (KYC/AML)",
    legalBase: "Ν. 4557/2018 (Anti-Money Laundering)",
    when: "Υποχρεωτικό για συμβόλαια Ζωής/Επενδυτικά ή συμβόλαια αξίας ≥15.000€ ετησίως.",
    build: buildAmlText },
];

// The legacy local preview builders remain available for backwards-compatible
// imports, but the page now renders only the server-saved office templates.
void TEMPLATES;

export function LegalTemplatesPage() {
  const { t } = useTranslation();

  const q = useQuery({
    queryKey: ["agency-profile"],
    queryFn: async () => (await api.get<AgencyProfile>("/agency-profile")).data
  });

  const p = q.data ?? AGENCY_PLACEHOLDER;

  const missingFields: string[] = [];
  if (!p.vatNumber) missingFields.push("ΑΦΜ");
  if (!p.addressLine) missingFields.push("Διεύθυνση");
  if (!p.tteRegistrationNumber) missingFields.push("Αρ. Μητρώου ΤτΕ");
  if (!p.contactEmail) missingFields.push("Email");

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <GavelIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("legalTemplates.title", "Νομικά Έντυπα Πελατών")}
          </Typography>
          <Typography color="text.secondary">
            {t("legalTemplates.subtitle",
              "Πρότυπα εντύπων που πρέπει να δίνει το γραφείο στους πελάτες του βάσει GDPR & Ν. 4583/2018.")}
          </Typography>
        </Box>
      </Stack>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {missingFields.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("legalTemplates.missingFields",
                "Λείπουν στοιχεία γραφείου: {{list}}. Συμπληρώστε τα στις Ρυθμίσεις Γραφείου για πλήρη προ-γέμιση.", {
                list: missingFields.join(", ")
              })}
            </Alert>
          )}

          <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Γρήγορη επεξεργασία:</strong> Επιλέξτε έντυπο, αλλάξτε το κύριο κείμενο
              και χρησιμοποιήστε τα πεδία ως chips για αυτόματη συμπλήρωση. Η δεξιά προεπισκόπηση
              είναι το τελικό εκτυπώσιμο A4 PDF και ενημερώνεται αυτόματα. Αποθηκεύστε όταν είστε έτοιμοι.
            </Typography>
          </Card>

          <OfficeFormTemplatesPanel agency={p} />
        </>
      )}
    </Box>
  );
}

function OfficeFormTemplatesPanel({ agency }: { agency: AgencyProfile }) {
  const qc = useQueryClient();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [draft, setDraft] = useState({ headerHtml: "", bodyHtml: "", footerHtml: "" });
  const [showLayoutParts, setShowLayoutParts] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const templates = useQuery({
    queryKey: ["customer-form-templates"],
    queryFn: async () => (await api.get<CustomerFormTemplate[]>("/customer-form-templates")).data
  });
  const current = (templates.data ?? []).find(x => x.formCode === selectedCode) ?? templates.data?.[0];
  const sampleCustomer = useQuery({
    queryKey: ["legal-template-preview-customer"],
    queryFn: async () => {
      const response = await api.get<Array<{ id: string; firstName?: string; lastName?: string; companyName?: string }>>("/customers", { params: { limit: 1 } });
      return response.data[0] ?? null;
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (current && current.formCode !== selectedCode) setSelectedCode(current.formCode);
    if (current) setDraft({
      headerHtml: current.headerHtml ?? "",
      bodyHtml: current.bodyHtml ?? "",
      footerHtml: current.footerHtml ?? ""
    });
  }, [current?.formCode, current?.headerHtml, current?.bodyHtml, current?.footerHtml]);

  // Render the exact server-side A4 PDF with the current unsaved draft. A
  // short debounce keeps typing smooth while the preview stays printable.
  useEffect(() => {
    const customerId = sampleCustomer.data?.id;
    if (!current) {
      setPdfUrl(null);
      setPdfError(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        const previewEndpoint = customerId
          ? `/customers/${customerId}/form-preview`
          : `/customer-form-templates/${current.formCode}/preview`;
        const response = await api.post<Blob>(previewEndpoint, {
          formCode: current.formCode,
          headerHtml: draft.headerHtml,
          bodyHtml: draft.bodyHtml,
          footerHtml: draft.footerHtml,
        }, { responseType: "blob" });
        const nextUrl = URL.createObjectURL(response.data);
        if (!active) { URL.revokeObjectURL(nextUrl); return; }
        setPdfUrl(previous => {
          if (previous) URL.revokeObjectURL(previous);
          return nextUrl;
        });
      } catch {
        if (active) setPdfError("Δεν ήταν δυνατή η δημιουργία του PDF. Ελέγξτε ότι υπάρχει τουλάχιστον ένας πελάτης.");
      } finally {
        if (active) setPdfLoading(false);
      }
    }, 650);
    return () => { active = false; window.clearTimeout(timer); };
  }, [current?.formCode, draft.headerHtml, draft.bodyHtml, draft.footerHtml, sampleCustomer.data?.id]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const save = useMutation({
    mutationFn: async (resetToDefault: boolean) => (await api.put(`/customer-form-templates/${current!.formCode}`, {
      name: current!.name,
      headerHtml: draft.headerHtml,
      bodyHtml: draft.bodyHtml,
      footerHtml: draft.footerHtml,
      resetToDefault
    })).data as CustomerFormTemplate,
    onSuccess: (_, resetToDefault) => {
      setNotice(resetToDefault ? "Το πρότυπο επανήλθε στο αρχικό έντυπο." : "Το πρότυπο αποθηκεύτηκε για το γραφείο.");
      void qc.invalidateQueries({ queryKey: ["customer-form-templates"] });
      setTimeout(() => setNotice(null), 3500);
    },
    onError: () => setNotice("Δεν ήταν δυνατή η αποθήκευση του προτύπου.")
  });

  const labelFor = (code: string) => ({
    "gdpr-consent": "GDPR — Ενημέρωση Υποκειμένου",
    "customer-needs": "Έντυπο Αναγκών Πελάτη (IDD)",
    "intermediary-information": "Πληροφορίες Ασφαλιστικού Διαμεσολαβητή",
    "document-receipt": "Απόδειξη Παραλαβής Εντύπων"
  } as Record<string, string>)[code] ?? code;

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
        <Box sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0 }}>
          <Typography variant="h6" fontWeight={800}>Πρότυπα εντύπων γραφείου</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Αποθηκεύονται στο γραφείο και χρησιμοποιούνται σε νέες προεπισκοπήσεις και αποστολές υπογραφής.
          </Typography>
          <Stack spacing={0.75}>
            {(templates.data ?? []).map(item => (
              <Button key={item.formCode} variant={current?.formCode === item.formCode ? "contained" : "outlined"}
                onClick={() => setSelectedCode(item.formCode)} sx={{ justifyContent: "flex-start", textAlign: "left" }}>
                {labelFor(item.formCode)}
              </Button>
            ))}
          </Stack>
        </Box>
        <Box sx={{ flex: 1, width: "100%" }}>
          {templates.isLoading || !current ? <CircularProgress size={24} /> : (
            <>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1} mb={1}>
                <Box>
                  <Typography fontWeight={800}>{labelFor(current.formCode)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Κάντε κλικ σε πεδίο ή σύρετέ το μέσα στο κείμενο. Τα στοιχεία συμπληρώνονται από την καρτέλα πελάτη/συμβολαίου.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" color="warning" disabled={save.isPending}
                    onClick={() => save.mutate(true)}>Επαναφορά</Button>
                  <Button size="small" variant="contained" color="success" disabled={save.isPending}
                    onClick={() => save.mutate(false)} startIcon={<SaveIcon />}>Αποθήκευση</Button>
                </Stack>
              </Stack>
              {notice && <Alert severity="info" sx={{ mb: 1 }}>{notice}</Alert>}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.12fr) minmax(360px, .88fr)" }, gap: 2, alignItems: "start" }}>
                <Box>
                  <WysiwygEditor
                    label="Κύριο κείμενο"
                    minRows={14}
                    value={draft.bodyHtml}
                    onChange={bodyHtml => setDraft(prev => ({ ...prev, bodyHtml }))}
                    fieldOptions={current.fields}
                    placeholder="Γράψτε εδώ το κείμενο του εντύπου…"
                  />
                  <Button size="small" sx={{ mt: 1.25 }} onClick={() => setShowLayoutParts(v => !v)}>
                    {showLayoutParts ? "Απόκρυψη κεφαλίδας / υποσέλιδου" : "Ρυθμίσεις κεφαλίδας / υποσέλιδου"}
                  </Button>
                  {showLayoutParts && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <WysiwygEditor label="Κεφαλίδα" minRows={4} value={draft.headerHtml}
                        onChange={headerHtml => setDraft(prev => ({ ...prev, headerHtml }))}
                        fieldOptions={current.fields} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <WysiwygEditor label="Υποσέλιδο" minRows={4} value={draft.footerHtml}
                        onChange={footerHtml => setDraft(prev => ({ ...prev, footerHtml }))}
                        fieldOptions={current.fields} />
                    </Box>
                  </Stack>}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Το PDF χρησιμοποιεί αυτόματα το λογότυπο του γραφείου και τα πεδία υπογραφής.
                  </Typography>
                </Box>
                <OfficeFormTemplatePreview
                  formName={labelFor(current.formCode)} draft={draft} agency={agency}
                  pdfUrl={pdfUrl} pdfLoading={pdfLoading} pdfError={pdfError}
                  sampleCustomer={sampleCustomer.data}
                />
              </Box>
            </>
          )}
        </Box>
      </Stack>
    </Card>
  );
}

const PREVIEW_VALUES: Record<string, string> = {
  "customer.name": "Πελάτης δείγμα",
  "customer.fullName": "Πελάτης δείγμα",
  "customer.email": "customer@example.gr",
  "customer.phone": "210 0000000",
  "customer.address": "Οδός Δείγματος 1, Αθήνα",
  "customer.vatNumber": "099999999",
  "customer.notes": "Σημειώσεις πελάτη",
  "office.name": "Το γραφείο σας",
  "office.address": "Διεύθυνση γραφείου",
  "office.email": "office@example.gr",
  "office.phone": "210 1111111",
  "office.vatNumber": "088888888",
  "agency.name": "Το γραφείο σας",
  "policy.number": "POL-000001",
  "policy.insuranceCompany": "Ασφαλιστική εταιρεία",
  contactDate: "28/09/2026",
  deliveryDate: "28/09/2026",
  documentsReceived: "GDPR · Έντυπο Αναγκών · Πληροφορίες Διαμεσολαβητή",
  today: "28/09/2026"
};

function escapePreviewHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function previewHtml(html: string): string {
  const stripped = (html || "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(\"\s*javascript:[^\"]*\"|'\s*javascript:[^']*')/gi, "");
  return stripped.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, key: string) => {
    const cleanKey = key.trim();
    const value = PREVIEW_VALUES[cleanKey] ?? `{{${cleanKey}}}`;
    return `<mark class="merge-field">${escapePreviewHtml(value)}</mark>`;
  });
}

function OfficeFormTemplatePreview({
  formName, draft, agency, pdfUrl, pdfLoading, pdfError, sampleCustomer
}: {
  formName: string;
  draft: { headerHtml: string; bodyHtml: string; footerHtml: string };
  agency: AgencyProfile;
  pdfUrl: string | null;
  pdfLoading: boolean;
  pdfError: string | null;
  sampleCustomer?: { id: string; firstName?: string; lastName?: string; companyName?: string } | null;
}) {
  const srcDoc = useMemo(() => {
    const header = previewHtml(draft.headerHtml);
    const body = previewHtml(draft.bodyHtml);
    const footer = previewHtml(draft.footerHtml);
    return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;background:#e9eef4;color:#0b2545;font-family:Arial,"Segoe UI",sans-serif}
      .page{min-height:720px;margin:12px auto;padding:34px 38px;background:#fff;box-shadow:0 2px 12px rgba(11,37,69,.15);font-size:13px;line-height:1.55}
      .office{border-bottom:2px solid #0b2545;padding-bottom:12px;margin-bottom:20px}.office h1{font-size:18px;margin:0 0 4px}.office p{margin:0;color:#52657a;font-size:11px}
      .custom-header{margin-bottom:12px}.content h1{font-size:20px}.content h2{font-size:16px}.content p{margin:5px 0}.content ul,.content ol{padding-left:24px}
      .custom-footer{margin-top:20px;padding-top:8px;border-top:1px solid #d9e0e8;color:#52657a;font-size:11px}
      .merge-field{background:#fff3cd;color:#7a5400;border-radius:3px;padding:0 3px}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:28px}.signature{border:1px solid #d9e0e8;min-height:72px;padding:8px;font-size:11px}.signature b{display:block;margin-bottom:24px}
      @media(max-width:700px){.page{margin:0;padding:22px;box-shadow:none}.signatures{grid-template-columns:1fr}}
    </style></head><body><main class="page">
      <section class="office">${agency.logoUrl ? `<img src="/api/agency-profile/logo" alt="" style="max-height:42px;max-width:150px;display:block;margin-bottom:8px">` : ""}<h1>${escapePreviewHtml(agency.name || "Το γραφείο σας")}</h1><p>Το λογότυπο και τα στοιχεία του γραφείου εμφανίζονται αυτόματα στο τελικό PDF.</p></section>
      <div class="custom-header">${header}</div><article class="content"><h2>${escapePreviewHtml(formName)}</h2>${body}</article><div class="custom-footer">${footer}</div>
      <section class="signatures"><div class="signature"><b>Πελάτης</b>Υπογραφή</div><div class="signature"><b>Γραφείο</b>Υπογραφή</div><div class="signature"><b>Ασφαλιστική</b>Υπογραφή</div></section>
    </main></body></html>`;
  }, [agency.logoUrl, agency.name, draft, formName]);

  return (
    <Card variant="outlined" sx={{ p: 1.25, position: { xl: "sticky" }, top: { xl: 12 } }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 0.5, pb: 1 }}>
        <VisibilityIcon color="primary" fontSize="small" />
        <Typography fontWeight={800}>Προεπισκόπηση εγγράφου</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 0.5, pb: 1 }}>
        Τελικό A4 PDF με στοιχεία δείγματος ή κενά placeholders όταν δεν υπάρχουν πελάτες. Ενημερώνεται αυτόματα μετά από κάθε αλλαγή.
      </Typography>
      {pdfUrl ? (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5, pb: 1 }}>
            <Chip size="small" color="success" icon={<PictureAsPdfIcon />} label="Έτοιμο PDF" />
            <Typography variant="caption" color="text.secondary" noWrap>
              {sampleCustomer
                ? `Δείγμα: ${sampleCustomer.companyName || `${sampleCustomer.firstName ?? ""} ${sampleCustomer.lastName ?? ""}`.trim() || "πελάτης"}`
                : "Κενά placeholders πελάτη"}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button component="a" href={pdfUrl} target="_blank" rel="noopener" size="small" startIcon={<OpenInNewIcon />}>
              Άνοιγμα PDF
            </Button>
          </Stack>
          <iframe title={`Τελικό PDF ${formName}`} src={pdfUrl} style={{ width: "100%", height: 760, border: 0, display: "block", borderRadius: 6, background: "#eef2f7" }} />
        </>
      ) : (
        <>
          {pdfLoading && <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5, pb: 1 }}><CircularProgress size={16} /><Typography variant="caption">Δημιουργία PDF…</Typography></Stack>}
          {pdfError && <Alert severity="warning" sx={{ mb: 1 }}>{pdfError}</Alert>}
          {!sampleCustomer && !pdfLoading && <Alert severity="info" sx={{ mb: 1 }}>Δεν υπάρχει πελάτης ακόμη· το PDF θα εμφανίσει κενά placeholders.</Alert>}
          <iframe title={`Προεπισκόπηση ${formName}`} srcDoc={srcDoc} sandbox="" style={{ width: "100%", height: 760, border: 0, display: "block", borderRadius: 6 }} />
        </>
      )}
    </Card>
  );
}

/* ---------------------- Legacy local preview helpers ---------------------- */

function TemplateAccordion({
  meta, agency, opened, onToggle
}: {
  meta: TemplateMeta;
  agency: AgencyProfile;
  opened: TemplateKey | false;
  onToggle: (v: TemplateKey | false) => void;
}) {
  const storageKey = STORAGE_PREFIX + meta.key;
  const defaultText = useMemo(() => meta.build(agency), [meta, agency]);

  // Load persisted override on mount. Falls back to defaultText when none.
  const [text, setText] = useState<string>(defaultText);
  const [hasOverride, setHasOverride] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(storageKey);
    if (stored) { setText(stored); setHasOverride(true); }
    else       { setText(defaultText); setHasOverride(false); }
  }, [storageKey, defaultText]);

  const beginEdit = () => { setDraft(text); setEditing(true); };
  const cancelEdit = () => { setEditing(false); };
  const saveEdit = () => {
    setText(draft);
    try {
      localStorage.setItem(storageKey, draft);
      setHasOverride(true);
      setNotice("Το έντυπο αποθηκεύτηκε τοπικά στον browser του γραφείου σας.");
      setTimeout(() => setNotice(null), 3000);
    } catch { setNotice("Δεν ήταν δυνατή η αποθήκευση (localStorage)."); }
    setEditing(false);
  };
  const resetToDefault = () => {
    if (!confirm("Επαναφορά του εντύπου στο αρχικό πρότυπο κείμενο; Οι αλλαγές σας θα χαθούν.")) return;
    localStorage.removeItem(storageKey);
    setText(defaultText);
    setHasOverride(false);
    setEditing(false);
    setNotice("Το έντυπο επαναφέρθηκε στην προεπιλογή.");
    setTimeout(() => setNotice(null), 3000);
  };

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  // Renders the template into a hidden iframe and fires the browser's print
  // dialog against it. The dialog offers "Save as PDF" natively on all
  // modern browsers, so we don't need a client-side PDF library.
  const printOrPdf = (mode: "print" | "pdf") => {
    const safeTitle = meta.title.replace(/[<>&"']/g, "");
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const html = `<!doctype html><html lang="el"><head><meta charset="utf-8" /><title>${safeTitle}</title>
<style>
  @page { size: A4 portrait; margin: 16mm 14mm; }
  html, body { margin: 0; padding: 0; color: #0b2545; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  main { padding: 8px 10px; }
  h1 { font-size: 18px; color: #0b2545; margin: 0 0 12px; letter-spacing: 0.2px; border-bottom: 2px solid #0b2545; padding-bottom: 6px; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 11.5px; line-height: 1.7; margin: 0; }
  footer { margin-top: 18px; font-size: 9px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 6px; text-align: center; }
</style>
</head><body><main>
  <h1>${safeTitle}</h1>
  <pre>${escaped}</pre>
  <footer>Δημιουργήθηκε από το Kalypsis · https://mykalypsis.gr</footer>
</main></body></html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed"; iframe.style.right = "0"; iframe.style.bottom = "0";
    iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
    iframe.style.opacity = "0"; iframe.style.pointerEvents = "none";
    let printed = false;
    iframe.addEventListener("load", () => {
      if (printed) return;
      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc?.body || doc.body.children.length === 0) return;
      printed = true;
      try {
        win.addEventListener("afterprint", () => setTimeout(() => iframe.remove(), 500), { once: true });
        win.focus();
        win.print();
      } catch { iframe.remove(); }
    });
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    if (mode === "pdf") {
      setNotice("Στον διάλογο εκτύπωσης επιλέξτε «Save as PDF» / «Αποθήκευση ως PDF».");
      setTimeout(() => setNotice(null), 5000);
    }
  };

  return (
    <Accordion
      expanded={opened === meta.key}
      onChange={(_, exp) => onToggle(exp ? meta.key : false)}
      sx={{ mb: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography fontWeight={700}>{meta.title}</Typography>
            {hasOverride && <Chip size="small" color="warning" variant="outlined" label="Προσαρμοσμένο" />}
          </Stack>
          <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
            <Chip size="small" label={meta.legalBase} color="primary" variant="outlined" />
            <Typography variant="caption" color="text.secondary">{meta.when}</Typography>
          </Stack>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
          {!editing ? (
            <>
              <Button size="small" startIcon={<EditIcon />} variant="outlined" onClick={beginEdit}>
                Επεξεργασία
              </Button>
              <Button size="small" startIcon={<PrintIcon />} variant="contained" onClick={() => printOrPdf("print")}>
                Εκτύπωση
              </Button>
              <Button size="small" startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={() => printOrPdf("pdf")}>
                Αποθήκευση PDF
              </Button>
              <Button size="small" startIcon={<ContentCopyIcon />} variant="outlined"
                onClick={doCopy}
                color={copied ? "success" : "primary"}>
                {copied ? "Αντιγράφηκε" : "Αντιγραφή κειμένου"}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Tooltip title={hasOverride ? "Αναιρεί τις αποθηκευμένες αλλαγές σας" : "Ήδη στο πρότυπο κείμενο"}>
                <span>
                  <Button size="small" startIcon={<RestartAltIcon />} variant="outlined" color="error"
                    disabled={!hasOverride} onClick={resetToDefault}>
                    Επαναφορά προεπιλογής
                  </Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <>
              <Button size="small" startIcon={<SaveIcon />} variant="contained" color="success" onClick={saveEdit}>
                Αποθήκευση
              </Button>
              <Button size="small" variant="outlined" onClick={cancelEdit}>
                Άκυρο
              </Button>
            </>
          )}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {editing ? (
          <TextField
            fullWidth multiline minRows={22} value={draft}
            onChange={e => setDraft(e.target.value)}
            InputProps={{
              sx: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, lineHeight: 1.55 }
            }}
          />
        ) : (
          <Box sx={{
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#0b2545"
          }}>
            {text}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

void TemplateAccordion;

/* ---------------------- Template content builders ---------------------- */

function agencyHeader(p: AgencyProfile): string {
  const tte = p.tteRegistrationNumber
    ? `Αρ. Μητρώου ΤτΕ: ${p.tteRegistrationNumber}${p.tteRegistrationYear ? ` (${p.tteRegistrationYear})` : ""}`
    : "Αρ. Μητρώου ΤτΕ: [ΣΥΜΠΛΗΡΩΣΤΕ]";
  return [
    p.name,
    p.addressLine ?? "[Διεύθυνση]",
    p.vatNumber ? `ΑΦΜ: ${p.vatNumber}` : "ΑΦΜ: [ΣΥΜΠΛΗΡΩΣΤΕ]",
    tte,
    p.contactEmail ? `Email: ${p.contactEmail}` : "Email: [ΣΥΜΠΛΗΡΩΣΤΕ]",
    p.contactPhone ? `Τηλ.: ${p.contactPhone}` : "",
  ].filter(Boolean).join("\n");
}

function buildGdpr13Text(p: AgencyProfile): string {
  return `ΕΝΗΜΕΡΩΣΗ ΓΙΑ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ ΠΡΟΣΩΠΙΚΩΝ ΔΕΔΟΜΕΝΩΝ
(Άρθρο 13 GDPR — Κανονισμός (ΕΕ) 2016/679)

ΥΠΕΥΘΥΝΟΣ ΕΠΕΞΕΡΓΑΣΙΑΣ:
${agencyHeader(p)}

1. ΣΤΟΙΧΕΙΑ ΠΟΥ ΣΥΛΛΕΓΟΥΜΕ
Στοιχεία ταυτοποίησης (ονοματεπώνυμο, ΑΦΜ, ΑΜΚΑ, αρ. ταυτότητας/διαβατηρίου,
δίπλωμα οδήγησης), επικοινωνίας (email, τηλέφωνα, διεύθυνση), οικονομικά
(IBAN, ασφαλιστικές οφειλές), ασφαλιστικά (κάλυψη, ζημιές). Για συμβόλαια
Ζωής/Υγείας ενδέχεται να ζητηθούν και δεδομένα υγείας (ειδική κατηγορία —
Άρθρο 9 GDPR) βάσει ξεχωριστής ρητής συγκατάθεσης.

2. ΣΚΟΠΟΙ & ΝΟΜΙΚΗ ΒΑΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ
α) Παροχή υπηρεσιών ασφαλιστικής διαμεσολάβησης — εκτέλεση σύμβασης
   (Άρθρο 6§1 στοιχ. β GDPR).
β) Συμμόρφωση με νομικές υποχρεώσεις (φορολογικές, AML/KYC) —
   Άρθρο 6§1 στοιχ. γ GDPR.
γ) Έννομο συμφέρον για διαχείριση σχέσης και βελτίωση υπηρεσιών —
   Άρθρο 6§1 στοιχ. στ GDPR.
δ) Marketing επικοινωνία — βάσει ρητής συγκατάθεσής σας (ανακλητή ανά πάσα
   στιγμή).

3. ΑΠΟΔΕΚΤΕΣ ΤΩΝ ΔΕΔΟΜΕΝΩΝ
- Ασφαλιστικές εταιρείες με τις οποίες συνεργαζόμαστε, μόνο όσον αφορά τα
  δικά τους συμβόλαια.
- Πάροχος τεχνολογίας «Kalypsis» (Παναγιώτης Κοτσοργιός, Μεσολόγγι) —
  ενεργεί ως Εκτελών την Επεξεργασία δυνάμει σύμβασης του Άρθρου 28 GDPR,
  με υποδομή cloud εντός ΕΟΧ (Hetzner, Γερμανία).
- Πάροχος αποστολής email «Brevo» (Γαλλία), μόνο για επικοινωνία.
- Αρμόδιες αρχές όπου το απαιτεί ο νόμος (ΑΑΔΕ, ΤτΕ, ΑΠΔΠΧ).

4. ΔΙΑΒΙΒΑΣΕΙΣ ΕΚΤΟΣ ΕΟΧ
Δεν πραγματοποιούνται τακτικές διαβιβάσεις εκτός Ευρωπαϊκού Οικονομικού
Χώρου. Έκτακτες διαβιβάσεις γίνονται μόνο με τις εγγυήσεις του Άρθρου 46 GDPR.

5. ΔΙΑΡΚΕΙΑ ΔΙΑΤΗΡΗΣΗΣ
Τα δεδομένα διατηρούνται όσο ισχύει η ασφαλιστική σχέση και για 10 έτη μετά
τη λήξη, βάσει του Ν. 4308/2014 (φορολογικές υποχρεώσεις) και της γενικής
παραγραφής των αξιώσεων.

6. ΔΙΚΑΙΩΜΑΤΑ ΣΑΣ (Άρθρα 15-22 GDPR)
- Πρόσβαση στα δεδομένα σας.
- Διόρθωση ανακριβών δεδομένων.
- Διαγραφή («δικαίωμα στη λήθη»), όπου δεν συγκρούεται με νομικές
  υποχρεώσεις διατήρησης.
- Περιορισμός επεξεργασίας.
- Φορητότητα σε δομημένο μηχαναγνώσιμο μορφότυπο.
- Εναντίωση σε επεξεργασία βάσει έννομου συμφέροντος.
- Ανάκληση συγκατάθεσης, χωρίς αναδρομική επίπτωση.

Άσκηση δικαιωμάτων: ${p.contactEmail ?? "[email γραφείου]"}

Καταγγελία στην ΑΠΔΠΧ:
Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα, Κηφισίας 1-3, 115 23 Αθήνα,
τηλ. 210 6475600, complaints@dpa.gr

7. ΥΠΟΧΡΕΩΤΙΚΟΣ ΧΑΡΑΚΤΗΡΑΣ ΠΑΡΟΧΗΣ ΔΕΔΟΜΕΝΩΝ
Η παροχή των στοιχείων που ζητούνται είναι αναγκαία για τη σύναψη και
εκτέλεση της ασφαλιστικής σύμβασης. Άρνηση παροχής συνεπάγεται αδυναμία
παροχής της υπηρεσίας.

Ημερομηνία: ....../....../..........      Ο/Η πελάτης/-ισσα:
                                            (Ονοματεπώνυμο & Υπογραφή)

_____________________________              _____________________________
`;
}

function buildGdpr9Text(p: AgencyProfile): string {
  return `ΡΗΤΗ ΣΥΓΚΑΤΑΘΕΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ ΔΕΔΟΜΕΝΩΝ ΥΓΕΙΑΣ
(Άρθρο 9§2 στοιχ. α GDPR — Ειδικές Κατηγορίες Δεδομένων)

ΥΠΕΥΘΥΝΟΣ ΕΠΕΞΕΡΓΑΣΙΑΣ:
${agencyHeader(p)}

Ο/Η υπογράφων/-ουσα:

Ονοματεπώνυμο: __________________________________________________

ΑΜΚΑ: ___________________________  ΑΦΜ: _________________________

ΔΗΛΩΝΩ ΡΗΤΩΣ ΚΑΙ ΕΝ ΕΠΙΓΝΩΣΕΙ ΟΤΙ:

Συναινώ ελεύθερα, ρητά και ενημερωμένα στη συλλογή και επεξεργασία των
δεδομένων μου που αφορούν την υγεία μου (ιατρικό ιστορικό, εργαστηριακές
εξετάσεις, διαγνώσεις, νοσηλείες, φαρμακευτική αγωγή), από τον Υπεύθυνο
Επεξεργασίας και τις συνεργαζόμενες ασφαλιστικές εταιρείες, αποκλειστικά
για τους παρακάτω σκοπούς:

α) Αξιολόγηση του κινδύνου και σύναψη ασφαλιστικού συμβολαίου Ζωής /
   Υγείας / Ατυχημάτων.
β) Εξέταση αιτημάτων αποζημίωσης / πληρωμής ασφαλιστικού ποσού.
γ) Συμμόρφωση με νομικές υποχρεώσεις που σχετίζονται με τα ανωτέρω.

Έχω ενημερωθεί ότι:
- Η συγκατάθεσή μου είναι ελεύθερη και ρητή, και μπορώ να την ανακαλέσω
  οποτεδήποτε χωρίς αναδρομική επίπτωση, με έγγραφη δήλωση στο ${p.contactEmail ?? "[email γραφείου]"}.
- Χωρίς τη συγκατάθεσή μου δεν είναι εφικτή η σύναψη ή η εξέλιξη του
  συμβολαίου Ζωής/Υγείας/Ατυχημάτων.
- Έχω δικαίωμα πρόσβασης, διόρθωσης, περιορισμού και διαγραφής των
  δεδομένων μου (Άρθρα 15-22 GDPR).

Ημερομηνία: ....../....../..........

Υπογραφή Πελάτη:  _______________________________

(Για ανηλίκους: Υπογραφή κηδεμόνα)
`;
}

function buildIddText(p: AgencyProfile): string {
  return `ΑΝΑΛΥΣΗ ΑΠΑΙΤΗΣΕΩΝ & ΑΝΑΓΚΩΝ ΠΕΛΑΤΗ
(Ν. 4583/2018 Άρθρο 27 — Insurance Distribution Directive)

ΑΣΦΑΛΙΣΤΙΚΟΣ ΔΙΑΜΕΣΟΛΑΒΗΤΗΣ:
${agencyHeader(p)}

Α. ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ
Ονοματεπώνυμο: __________________________________________________
ΑΦΜ: _____________________  Τηλέφωνο: __________________________
Email: ____________________________________________________________

Β. ΔΗΛΩΘΕΙΣΕΣ ΑΝΑΓΚΕΣ ΠΕΛΑΤΗ
Ο πελάτης δήλωσε ότι επιθυμεί κάλυψη για:

 [ ] Αυτοκίνητο / Δίκυκλο           [ ] Ζωή / Ατύχημα
 [ ] Κατοικία / Πυρός                [ ] Υγεία / Νοσοκομειακό
 [ ] Επιχείρηση                      [ ] Ταξιδιωτική
 [ ] Αστική Ευθύνη                   [ ] Νομική Προστασία
 [ ] Άλλο: ______________________________________________________

Ειδικές απαιτήσεις / προτεραιότητες:
_____________________________________________________________________
_____________________________________________________________________

Γ. ΓΝΩΣΕΙΣ & ΕΜΠΕΙΡΙΑ (μόνο για επενδυτικά προϊόντα ΖΩΗΣ, IBIP)
Προηγούμενη εμπειρία σε επενδυτικά:  [ ] Καμία  [ ] Περιορισμένη  [ ] Σημαντική
Ανοχή σε επενδυτικό ρίσκο:   [ ] Χαμηλή  [ ] Μεσαία  [ ] Υψηλή

Δ. ΠΡΟΤΕΙΝΟΜΕΝΟ ΠΡΟΪΟΝ
Ασφαλιστική εταιρεία: _____________________________________________
Προϊόν / Πακέτο: __________________________________________________
Ετήσιο ασφάλιστρο: ___________________ €
Βασικές καλύψεις:
_____________________________________________________________________
_____________________________________________________________________

Ε. ΑΙΤΙΟΛΟΓΗΣΗ ΚΑΤΑΛΛΗΛΟΤΗΤΑΣ
Το προτεινόμενο προϊόν καλύπτει τις δηλωθείσες ανάγκες του πελάτη διότι:
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________

ΣΤ. ΔΗΛΩΣΕΙΣ ΠΕΛΑΤΗ

 [ ] Έχω παραλάβει το τυποποιημένο έντυπο πληροφοριών IPID από τον
     διαμεσολαβητή.
 [ ] Έχω κατανοήσει τα βασικά χαρακτηριστικά, τους όρους και τις εξαιρέσεις
     του προϊόντος.
 [ ] Δηλώνω ότι όλα τα στοιχεία που έδωσα είναι αληθή και πλήρη.

Ημερομηνία: ....../....../..........

Υπογραφή Πελάτη: ____________________     Υπογραφή Διαμεσολαβητή: ____________________
`;
}

function buildAmlText(p: AgencyProfile): string {
  return `ΔΗΛΩΣΗ ΠΡΑΓΜΑΤΙΚΟΥ ΔΙΚΑΙΟΥΧΟΥ & ΠΗΓΗΣ ΧΡΗΜΑΤΩΝ
(Ν. 4557/2018 — Πρόληψη & Καταστολή Νομιμοποίησης Εσόδων από Εγκληματικές
Δραστηριότητες και Χρηματοδότησης Τρομοκρατίας)

ΑΣΦΑΛΙΣΤΙΚΟΣ ΔΙΑΜΕΣΟΛΑΒΗΤΗΣ:
${agencyHeader(p)}

Α. ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ / ΑΝΤΙΣΥΜΒΑΛΛΟΜΕΝΟΥ
Ονοματεπώνυμο / Επωνυμία: _________________________________________
ΑΦΜ: _____________________  ΔΟΥ: _________________________________
Δ/νση: ____________________________________________________________
Επάγγελμα / Δραστηριότητα: _______________________________________

Β. ΠΡΑΓΜΑΤΙΚΟΣ ΔΙΚΑΙΟΥΧΟΣ (Άρθρο 20 Ν. 4557/2018)
Δηλώνω ότι:

 [ ] Είμαι ο πραγματικός δικαιούχος (φυσικό πρόσωπο που κατέχει ή ελέγχει
     τελικά την περιουσία / το συμβόλαιο).

 [ ] Πραγματικός δικαιούχος είναι τρίτο πρόσωπο:
     Ονοματεπώνυμο: _______________________________________________
     ΑΦΜ: _____________________ Σχέση με πελάτη: _______________________

Γ. ΠΟΛΙΤΙΚΩΣ ΕΚΤΕΘΕΙΜΕΝΟ ΠΡΟΣΩΠΟ (Politically Exposed Person)
Ο πελάτης ή ο πραγματικός δικαιούχος είναι/υπήρξε στα τελευταία 12 μήνες
πολιτικώς εκτεθειμένο πρόσωπο (πχ βουλευτής, δικαστής, ανώτατος αξιωματούχος,
στέλεχος διεθνούς οργανισμού) ή στενός συγγενής/σύνεργος τέτοιου προσώπου;

 [ ] ΟΧΙ           [ ] ΝΑΙ — Διευκρινίστε: ___________________________

Δ. ΠΗΓΗ ΧΡΗΜΑΤΩΝ ΠΟΥ ΘΑ ΧΡΗΣΙΜΟΠΟΙΗΘΟΥΝ ΓΙΑ ΤΗΝ ΠΛΗΡΩΜΗ ΑΣΦΑΛΙΣΤΡΩΝ

 [ ] Μισθός / Σύνταξη          [ ] Έσοδα επιχειρηματικής δραστηριότητας
 [ ] Αποταμιεύσεις               [ ] Πώληση περιουσιακού στοιχείου
 [ ] Κληρονομιά / Δωρεά          [ ] Έσοδα επενδύσεων
 [ ] Άλλο: _______________________________________________________

Ε. ΣΚΟΠΟΣ & ΦΥΣΗ ΤΗΣ ΕΠΙΧΕΙΡΗΜΑΤΙΚΗΣ ΣΧΕΣΗΣ
 [ ] Ασφάλιση αγαθού (αυτοκίνητο, κατοικία κτλ)
 [ ] Ασφάλιση Ζωής / Υγείας (αποταμιευτικό / επενδυτικό)
 [ ] Εταιρική ασφάλιση
 [ ] Άλλο: _______________________________________________________

Δηλώνω υπεύθυνα ότι όλα τα ανωτέρω στοιχεία είναι αληθή και ακριβή. Είμαι
ενήμερος/-η ότι τυχόν ψευδής δήλωση επισύρει τις προβλεπόμενες από τον Ν.
4557/2018 και τον Ποινικό Κώδικα κυρώσεις. Δεσμεύομαι να ενημερώσω τον
διαμεσολαβητή για κάθε μεταβολή των παραπάνω στοιχείων.

Ημερομηνία: ....../....../..........

Υπογραφή Πελάτη: ____________________     Υπογραφή Διαμεσολαβητή: ____________________
`;
}
