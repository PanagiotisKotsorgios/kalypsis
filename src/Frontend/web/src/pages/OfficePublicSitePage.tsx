import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";

type Post = { id: string; title: string; body: string; imageUrl?: string; isPublished: boolean };
type Offer = { id: string; title: string; body: string; ctaLabel?: string; ctaUrl?: string; isActive: boolean };
type Banner = { id: string; text: string; kind?: string; linkUrl?: string; isActive: boolean };
type Site = { slug: string; siteName: string; tagline: string; heroTitle: string; heroBody: string; logoUrl: string | null; brandColorHex: string; postsJson: string; offersJson: string; bannersJson: string };

const parseList = <T,>(raw: string): T[] => { try { const value = JSON.parse(raw); return Array.isArray(value) ? value : []; } catch { return []; } };

export function OfficePublicSitePage() {
  const { slug = "" } = useParams();
  const [open, setOpen] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", product: "", message: "", preferredContact: "email", consentGiven: false });
  const host = typeof window === "undefined" ? "" : window.location.hostname;
  const siteQuery = useQuery({ queryKey: ["public-office-site", slug || host], queryFn: async () => (await api.get<Site>(slug ? `/public/office-sites/${encodeURIComponent(slug)}` : `/public/office-sites/resolve?host=${encodeURIComponent(host)}`)).data });
  const site = siteQuery.data;
  const submit = useMutation({ mutationFn: () => api.post(`/public/office-sites/${encodeURIComponent(site?.slug ?? slug)}/requests`, { ...form, source: "public-site" }), onSuccess: () => { setSent(true); setOpen(false); setForm({ fullName: "", email: "", phone: "", product: "", message: "", preferredContact: "email", consentGiven: false }); }, onError: e => setError(extractErrorMessage(e)) });
  const posts = useMemo(() => site ? parseList<Post>(site.postsJson).filter(x => x.isPublished) : [], [site]);
  const offers = useMemo(() => site ? parseList<Offer>(site.offersJson).filter(x => x.isActive) : [], [site]);
  const banners = useMemo(() => site ? parseList<Banner>(site.bannersJson).filter(x => x.isActive) : [], [site]);
  if (siteQuery.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  if (siteQuery.isError || !site) return <Container sx={{ py: 10 }}><Alert severity="error">Η ιστοσελίδα δεν είναι διαθέσιμη.</Alert></Container>;
  const color = /^#[0-9a-f]{6}$/i.test(site.brandColorHex) ? site.brandColorHex : "#1f7bb3";
  const update = (key: keyof typeof form, value: string | boolean) => setForm(x => ({ ...x, [key]: value }));
  return <Box sx={{ minHeight: "100vh", bgcolor: "#f7fafc" }}>
    <Box sx={{ bgcolor: color, color: "white" }}><Container sx={{ py: 2 }}><Stack direction="row" alignItems="center" spacing={2}>{site.logoUrl && <Box component="img" src={site.logoUrl} alt="" sx={{ width: 56, height: 56, objectFit: "contain", bgcolor: "white", borderRadius: 1 }} />}<Box><Typography variant="h6" fontWeight={800}>{site.siteName}</Typography><Typography variant="body2" sx={{ opacity: .9 }}>{site.tagline}</Typography></Box></Stack></Container></Box>
    {banners.length > 0 && <Container sx={{ pt: 2 }}>{banners.map(b => <Alert key={b.id} severity={b.kind === "warning" ? "warning" : "info"} sx={{ mb: 1 }}>{b.linkUrl ? <a href={b.linkUrl} style={{ color: "inherit" }}>{b.text}</a> : b.text}</Alert>)}</Container>}
    <Container sx={{ py: { xs: 5, md: 8 } }}><Paper elevation={0} sx={{ p: { xs: 3, md: 7 }, borderRadius: 4, background: `linear-gradient(135deg, ${color}18, white 65%)` }}><Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: 34, md: 56 }, maxWidth: 760 }}>{site.heroTitle}</Typography><Typography sx={{ mt: 2, maxWidth: 760, fontSize: 18, whiteSpace: "pre-wrap" }}>{site.heroBody}</Typography><Button sx={{ mt: 3 }} variant="contained" size="large" endIcon={<SendIcon />} onClick={() => setOpen(true)}>Ζητήστε ενημέρωση</Button></Paper>
      {offers.length > 0 && <Grid container spacing={2.5} sx={{ mt: 3 }}>{offers.map(o => <Grid item xs={12} md={4} key={o.id}><Card sx={{ height: "100%" }}><CardContent><Typography variant="h6" fontWeight={800}>{o.title}</Typography><Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{o.body}</Typography>{o.ctaUrl && <Button href={o.ctaUrl} sx={{ mt: 2 }}>{o.ctaLabel || "Μάθετε περισσότερα"}</Button>}</CardContent></Card></Grid>)}</Grid>}
    </Container>
    {posts.length > 0 && <Container sx={{ pb: 8 }}><Typography variant="h4" fontWeight={800} sx={{ mb: 2 }}>Νέα & ενημερώσεις</Typography><Grid container spacing={2.5}>{posts.map(p => <Grid item xs={12} md={4} key={p.id}><Card>{p.imageUrl && <Box component="img" src={p.imageUrl} alt="" sx={{ width: "100%", height: 180, objectFit: "cover" }} />}<CardContent><Typography variant="h6" fontWeight={800}>{p.title}</Typography><Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{p.body}</Typography></CardContent></Card></Grid>)}</Grid></Container>}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Αίτημα επικοινωνίας</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField required label="Ονοματεπώνυμο" value={form.fullName} onChange={e => update("fullName", e.target.value)} /><TextField required type="email" label="Email" value={form.email} onChange={e => update("email", e.target.value)} /><TextField label="Τηλέφωνο" value={form.phone} onChange={e => update("phone", e.target.value)} /><TextField select SelectProps={{ native: true }} label="Ενδιαφέρομαι για" value={form.product} onChange={e => update("product", e.target.value)}><option value="">Επιλέξτε</option><option>Αυτοκίνητο</option><option>Κατοικία</option><option>Υγεία</option><option>Ζωή</option><option>Επιχείρηση</option><option>Άλλο</option></TextField><TextField required multiline minRows={4} label="Μήνυμα" value={form.message} onChange={e => update("message", e.target.value)} /><label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}><input type="checkbox" checked={form.consentGiven} onChange={e => update("consentGiven", e.target.checked)} />Συμφωνώ να επικοινωνήσει μαζί μου το γραφείο για το συγκεκριμένο αίτημα.</label>{error && <Alert severity="error">{error}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Άκυρο</Button><Button variant="contained" disabled={submit.isPending || !form.consentGiven} onClick={() => submit.mutate()}>{submit.isPending ? "Αποστολή…" : "Αποστολή"}</Button></DialogActions></Dialog>
    {sent && <Alert onClose={() => setSent(false)} severity="success" sx={{ position: "fixed", bottom: 18, right: 18, zIndex: 5 }}>Το αίτημά σας στάλθηκε στο γραφείο.</Alert>}
  </Box>;
}
