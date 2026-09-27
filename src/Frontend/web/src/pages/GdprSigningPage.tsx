import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Card, CircularProgress, FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography } from "@mui/material";
import DrawIcon from "@mui/icons-material/Draw";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";

interface PublicForm { agencyName: string; customerName: string; customerEmail?: string | null; role: string; formCode?: string; formTitle: string; expiresAt: string; canSign: boolean; policyNumber?: string | null; }

export function GdprSigningPage() {
  const { token = "" } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [consented, setConsented] = useState("yes");
  const [signed, setSigned] = useState(false);
  const [signerName, setSignerName] = useState("");
  const q = useQuery({ queryKey: ["public-gdpr-signing", token], queryFn: async () => (await api.get<PublicForm>(`/public/gdpr-signing/${token}`)).data, enabled: !!token, retry: false });
  const sign = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Δεν βρέθηκε πεδίο υπογραφής.");
      return (await api.post<PublicForm>(`/public/gdpr-signing/${token}/sign`, { consented: q.data?.formCode === "customer-needs" ? true : q.data?.role === "Customer" ? consented === "yes" : true, signerName: signerName.trim() || q.data?.customerName || "", signatureDataUrl: canvas.toDataURL("image/png") })).data;
    },
    onSuccess: () => setSigned(true)
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0b2545"; ctx.lineWidth = 2; ctx.lineCap = "round";
  }, [q.data]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => { drawing.current = true; canvasRef.current?.setPointerCapture(e.pointerId); const p = point(e); const ctx = canvasRef.current?.getContext("2d"); ctx?.beginPath(); ctx?.moveTo(p.x, p.y); };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const p = point(e); const ctx = canvasRef.current?.getContext("2d"); ctx?.lineTo(p.x, p.y); ctx?.stroke(); };
  const stop = () => { drawing.current = false; };

  if (q.isLoading) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (q.isError || !q.data) return <Box sx={{ maxWidth: 640, mx: "auto", p: 3 }}><Alert severity="error">{q.isError ? extractErrorMessage(q.error) : "Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει."}</Alert></Box>;
  const form = q.data.formCode === "customer-needs" ? { ...q.data, role: "CustomerNeeds" } : q.data;
  if (signed || !form.canSign) return <Box sx={{ maxWidth: 680, mx: "auto", p: { xs: 2, sm: 4 } }}><Card sx={{ p: { xs: 3, sm: 5 }, textAlign: "center" }}><Typography variant="h5" fontWeight={800} gutterBottom>{signed ? "Η υπογραφή καταχωρήθηκε" : "Το έντυπο έχει ήδη ολοκληρωθεί"}</Typography><Typography color="text.secondary">Το έγγραφο ενημερώθηκε αυτόματα στην καρτέλα του πελάτη. Μπορείτε να κλείσετε αυτό το παράθυρο.</Typography></Card></Box>;
  return <Box sx={{ maxWidth: 760, mx: "auto", p: { xs: 2, sm: 4 } }}>
    <Stack spacing={2.5}>
      {form.formCode === "customer-needs" && <Alert severity="info">Το έντυπο αναγκών έχει συμπληρωθεί από το γραφείο με τα στοιχεία της καρτέλας σας. Ελέγξτε τις απαντήσεις και υπογράψτε ηλεκτρονικά από κινητό ή υπολογιστή.</Alert>}
      <Box><Typography variant="overline" color="primary">{form.agencyName}</Typography><Typography variant="h4" fontWeight={800}>{form.formTitle}</Typography><Typography color="text.secondary">Πελάτης: {form.customerName}{form.policyNumber ? ` · Συμβόλαιο: ${form.policyNumber}` : ""}</Typography><Typography variant="caption" color="text.secondary">Ο σύνδεσμος ισχύει έως {new Date(form.expiresAt).toLocaleString("el-GR")}</Typography></Box>
      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Typography fontWeight={700} gutterBottom>Ενημέρωση και δήλωση</Typography><Typography variant="body2" color="text.secondary">Διαβάστε την ενημέρωση του γραφείου για την επεξεργασία των προσωπικών δεδομένων σας. Η επιλογή σας και η χειρόγραφη υπογραφή σας θα ενσωματωθούν στο επίσημο PDF.</Typography></Card>
      {form.role === "Customer" && <FormControl><Typography fontWeight={700}>Επιλογή</Typography><RadioGroup value={consented} onChange={e => setConsented(e.target.value)}><FormControlLabel value="yes" control={<Radio />} label="Συναινώ στην επεξεργασία όπως περιγράφεται στο έντυπο" /><FormControlLabel value="no" control={<Radio />} label="Δεν συναινώ στην επεξεργασία" /></RadioGroup></FormControl>}
      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Typography fontWeight={700} gutterBottom><DrawIcon sx={{ verticalAlign: "middle", mr: 1 }} />Χειρόγραφη υπογραφή</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Υπογράψτε με το δάχτυλο ή γραφίδα στο κινητό σας.</Typography><canvas ref={canvasRef} width={900} height={260} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} style={{ width: "100%", height: 190, display: "block", border: "1px dashed #8aa0b7", borderRadius: 8, touchAction: "none", background: "#fff" }} /><Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}><Button size="small" onClick={() => { const c = canvasRef.current; const x = c?.getContext("2d"); if (c && x) { x.clearRect(0, 0, c.width, c.height); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); } }}>Καθαρισμός</Button></Box></Card>
      <input aria-label="Ονοματεπώνυμο" placeholder="Ονοματεπώνυμο υπογράφοντος" value={signerName} onChange={e => setSignerName(e.target.value)} style={{ font: "inherit", padding: 12, borderRadius: 6, border: "1px solid #b9c4d0" }} />
      {sign.isError && <Alert severity="error">{extractErrorMessage(sign.error)}</Alert>}
      <Button variant="contained" size="large" startIcon={sign.isPending ? <CircularProgress size={18} color="inherit" /> : <DrawIcon />} onClick={() => sign.mutate()} disabled={sign.isPending}>Υπογραφή και υποβολή</Button>
      <Typography variant="caption" color="text.secondary">Με την υποβολή καταγράφονται η ημερομηνία, το τεχνικό αποτύπωμα της σύνδεσης και η υπογραφή στο αρχείο του γραφείου.</Typography>
    </Stack>
  </Box>;
}
