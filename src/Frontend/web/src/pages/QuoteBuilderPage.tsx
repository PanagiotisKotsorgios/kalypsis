import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import { useMutation } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { money, date } from "../utils/format";

const PRODUCT_TYPES = ["Auto", "Home", "Health", "Life", "Business", "Travel"] as const;
type ProductType = typeof PRODUCT_TYPES[number];

interface OfferDto {
  offerId: string;
  carrierCode: string;
  premium: number | null;
  commission: number | null;
  carrierProductCode: string | null;
  summary: string | null;
  validUntil: string | null;
}
interface QuoteResponse {
  quoteId: string;
  quoteNumber: string;
  offers: OfferDto[];
}

const RISK_TEMPLATES: Record<ProductType, Record<string, string | number>> = {
  Auto:     { plate: "ABC1234", year: 2020, bonusMalus: 5, driverAge: 35, postalCode: "11528" },
  Home:     { postalCode: "11528", squareMeters: 90, yearBuilt: 2005, hasAlarm: 1, floor: 2 },
  Health:   { age: 38, smoker: 0, preexisting: 0, deductible: 500 },
  Life:     { age: 38, smoker: 0, sumInsured: 100000, term: 20 },
  Business: { sector: "retail", revenue: 250000, employees: 4, hasFireSystem: 1 },
  Travel:   { destination: "EU", days: 7, travellers: 2 }
};

export function QuoteBuilderPage() {
  const [productType, setProductType] = useState<ProductType>("Auto");
  const [riskInputs, setRiskInputs] = useState<Record<string, string | number>>(RISK_TEMPLATES.Auto);
  const [rawJson, setRawJson] = useState<string>(JSON.stringify(RISK_TEMPLATES.Auto, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResponse | null>(null);

  function switchProduct(p: ProductType) {
    setProductType(p);
    setRiskInputs(RISK_TEMPLATES[p]);
    setRawJson(JSON.stringify(RISK_TEMPLATES[p], null, 2));
    setResult(null);
  }

  function patchField(key: string, value: string | number) {
    const next = { ...riskInputs, [key]: value };
    setRiskInputs(next);
    setRawJson(JSON.stringify(next, null, 2));
  }

  const run = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try { parsed = JSON.parse(rawJson); }
      catch { throw new Error("Μη έγκυρο JSON στις παραμέτρους κινδύνου."); }
      const body = {
        productType,
        riskInputsJson: JSON.stringify(parsed)
      };
      return (await api.post<QuoteResponse>("/quotes", body)).data;
    },
    onSuccess: (r) => { setResult(r); setError(null); },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const cheapest = useMemo(() => {
    if (!result || result.offers.length === 0) return null;
    return result.offers[0];
  }, [result]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <RequestQuoteIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Πολυτιμολόγηση</Typography>
          <Typography color="text.secondary">
            Στείλτε μια αίτηση προσφοράς σε όλους τους συνεργαζόμενους ασφαλιστές ταυτόχρονα.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start">
        <Card variant="outlined" sx={{ p: 3, width: { xs: "100%", lg: 460 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Τύπος προϊόντος</Typography>
          <TextField select fullWidth value={productType} onChange={(e) => switchProduct(e.target.value as ProductType)}>
            {PRODUCT_TYPES.map((p) => (
              <MenuItem key={p} value={p}>
                {p === "Auto" ? "Αυτοκίνητο" :
                  p === "Home" ? "Κατοικία" :
                  p === "Health" ? "Υγείας" :
                  p === "Life" ? "Ζωής" :
                  p === "Business" ? "Επιχείρησης" : "Ταξιδιού"}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="h6" sx={{ fontWeight: 700, mt: 3, mb: 1.5 }}>Στοιχεία κινδύνου</Typography>
          <Stack spacing={1.5}>
            {Object.entries(riskInputs).map(([k, v]) => (
              <TextField
                key={k}
                size="small"
                label={k}
                value={String(v)}
                onChange={(e) => {
                  const isNumber = typeof v === "number";
                  const next = isNumber && e.target.value !== ""
                    ? Number(e.target.value)
                    : e.target.value;
                  patchField(k, next);
                }}
                type={typeof v === "number" ? "number" : "text"}
                fullWidth
              />
            ))}
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            Προχωρημένο JSON (μπορείτε να επεξεργαστείτε απευθείας):
          </Typography>
          <TextField
            multiline
            minRows={5}
            maxRows={10}
            fullWidth
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            sx={{ mt: 1, fontFamily: "monospace" }}
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
          />

          <Button
            size="large"
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            onClick={() => run.mutate()}
            disabled={run.isPending}
            startIcon={run.isPending ? <CircularProgress size={18} color="inherit" /> : <RequestQuoteIcon />}
          >
            {run.isPending ? "Ανάκτηση προσφορών…" : "Λήψη προσφορών"}
          </Button>
        </Card>

        <Box sx={{ flex: 1, width: "100%" }}>
          {!result ? (
            <Card variant="outlined" sx={{ p: 5, textAlign: "center", color: "text.secondary" }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Καμία προσφορά ακόμα</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Συμπληρώστε τα στοιχεία και πατήστε «Λήψη προσφορών» για να δείτε τις τιμές από όλους τους ασφαλιστές.
              </Typography>
            </Card>
          ) : (
            <Stack spacing={2}>
              <Card variant="outlined" sx={{ p: 2.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Αριθμός προσφοράς</Typography>
                    <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{result.quoteNumber}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Πλήθος προσφορών</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{result.offers.length}</Typography>
                  </Box>
                  {cheapest && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">Φθηνότερη</Typography>
                      <Typography sx={{ fontWeight: 700, color: "success.main" }}>
                        {cheapest.premium != null ? money(cheapest.premium) : "—"} · {cheapest.carrierCode}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Card>

              <Card variant="outlined" sx={{ overflowX: "auto" }}>
                <Table size="medium">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Ασφαλιστής</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Προϊόν</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Ασφάλιστρο</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Προμήθεια</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Ισχύει έως</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.offers.map((o, i) => (
                      <TableRow key={o.offerId} hover sx={{ bgcolor: i === 0 ? "rgba(76,175,80,0.06)" : undefined }}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip size="small" label={o.carrierCode} color={i === 0 ? "success" : "default"} />
                            {i === 0 && <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>BEST</Typography>}
                          </Stack>
                        </TableCell>
                        <TableCell>{o.carrierProductCode ?? "—"}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: 16 }}>
                          {o.premium != null ? money(o.premium) : "—"}
                        </TableCell>
                        <TableCell align="right">
                          {o.commission != null ? money(o.commission) : "—"}
                        </TableCell>
                        <TableCell>
                          {o.validUntil ? date(o.validUntil) : "—"}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined" disabled>
                            Έκδοση
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
