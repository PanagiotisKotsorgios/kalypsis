import { useEffect, useState } from "react";
import { ensureE2EKeypair } from "../ermes/keyManager";
import LockIcon from "@mui/icons-material/Lock";
import {
  Alert, Autocomplete, Avatar, Box, Button, Card, Checkbox, Chip,
  CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, InputAdornment, List, ListItem, ListItemAvatar,
  ListItemButton, ListItemText, Menu, MenuItem, Stack, TextField, Tooltip,
  Typography
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import SendIcon from "@mui/icons-material/Send";
import DraftsIcon from "@mui/icons-material/Drafts";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReportIcon from "@mui/icons-material/Report";
import ArchiveIcon from "@mui/icons-material/Archive";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ReplyIcon from "@mui/icons-material/Reply";
import ReplyAllIcon from "@mui/icons-material/ReplyAll";
import ForwardIcon from "@mui/icons-material/Forward";
import CreateIcon from "@mui/icons-material/Create";
import SearchIcon from "@mui/icons-material/Search";
import BlockIcon from "@mui/icons-material/Block";
import GroupsIcon from "@mui/icons-material/Groups";
import AddIcon from "@mui/icons-material/Add";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import RestoreIcon from "@mui/icons-material/Restore";
import CloseIcon from "@mui/icons-material/Close";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import ConstructionIcon from "@mui/icons-material/Construction";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import TableChartIcon from "@mui/icons-material/TableChart";
import ArticleIcon from "@mui/icons-material/Article";
import CategoryIcon from "@mui/icons-material/Category";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import PrintIcon from "@mui/icons-material/Print";
import ContactsIcon from "@mui/icons-material/Contacts";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import TagIcon from "@mui/icons-material/Tag";
import { VoiceRecorder } from "../components/VoiceRecorder";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { RichTextEditor } from "../components/RichTextEditor";
import { useAuth } from "../auth/AuthContext";

// ─── Types matching the backend DTOs ────────────────────────────────

interface ErmesRecipientDto {
  userId: string; display: string; email: string; kind: string;
  isRead: boolean; isStarred: boolean;
}
interface AttachmentDto { id: string; fileName: string; mimeType: string; sizeBytes: number; }
interface ErmesMessageDto {
  id: string; threadId: string; inReplyToMessageId: string | null;
  senderUserId: string; senderDisplay: string; senderEmail: string;
  subject: string; bodyHtml: string; preview: string;
  folder: string; isRead: boolean; isStarred: boolean; isImportant: boolean;
  isDraft: boolean; automationSource: string | null;
  category: string | null;
  externalEmailRequested: boolean; externalEmailDelivered: boolean; externalEmailStatus: string | null;
  createdAt: string; sentAt: string | null;
  recipients: ErmesRecipientDto[];
  attachments: AttachmentDto[];
}
interface FolderCount { folder: string; total: number; unread: number; }
interface Contact { userId: string; display: string; email: string; role: string; }
interface Team { id: string; name: string; description: string | null; members: Contact[]; }
interface BlockDto { id: string; blockedUserId: string; blockedDisplay: string; blockedEmail: string; reason: string | null; createdAt: string; }
interface OverviewDto { folders: FolderCount[]; teams: Team[]; contacts: Contact[]; }

// ─── Categories + canned templates (composer helpers) ──────────────

const CATEGORIES = [
  { key: "General",     label: "Γενικά",       color: "default" as const },
  { key: "Production",  label: "Παραγωγή",     color: "primary" as const },
  { key: "Commissions", label: "Προμήθειες",   color: "success" as const },
  { key: "Customer",    label: "Πελάτης",      color: "info"    as const },
  { key: "Claim",       label: "Ζημιά",        color: "warning" as const },
  { key: "Urgent",      label: "Επείγον",      color: "error"   as const },
];

interface Template { key: string; label: string; subject: string; bodyHtml: string; }
const TEMPLATES: Template[] = [
  {
    key: "monthly-production",
    label: "Ενημέρωση παραγωγής μηνός",
    subject: "Ενημέρωση παραγωγής — {{month}}",
    bodyHtml:
      "<p>Καλησπέρα,</p>" +
      "<p>Επισυνάπτω τη λίστα παραγωγής για τον μήνα <b>{{month}}</b>. Παρακαλώ ενημερώστε αν χρειάζεται διόρθωση κάποιας εγγραφής.</p>" +
      "<p>Ευχαριστώ,<br/>{{me}}</p>",
  },
  {
    key: "commission-reminder",
    label: "Υπενθύμιση εκκαθάρισης προμηθειών",
    subject: "Υπενθύμιση εκκαθάρισης προμηθειών",
    bodyHtml:
      "<p>Καλησπέρα,</p>" +
      "<p>Παρακαλώ για την εκκαθάριση των προμηθειών του τρέχοντος μήνα. Οι λεπτομέρειες βρίσκονται στην εφαρμογή, στην ενότητα <b>Εκκαθαρίσεις Προμηθειών</b>.</p>" +
      "<p>Ευχαριστώ,<br/>{{me}}</p>",
  },
  {
    key: "renewal-heads-up",
    label: "Ενημέρωση για ληξιπρόθεσμα συμβόλαια",
    subject: "Ληξιπρόθεσμα συμβόλαια — υπενθύμιση",
    bodyHtml:
      "<p>Καλησπέρα,</p>" +
      "<p>Έχω εντοπίσει συμβόλαια που λήγουν εντός των επόμενων 30 ημερών. Παρακαλώ ενημερώστε τους πελάτες σας για ανανέωση.</p>" +
      "<p>Ευχαριστώ,<br/>{{me}}</p>",
  },
  {
    key: "welcome",
    label: "Καλωσόρισμα νέου συνεργάτη",
    subject: "Καλωσορίσατε στο δίκτυο συνεργατών",
    bodyHtml:
      "<p>Καλησπέρα σας,</p>" +
      "<p>Σας καλωσορίζουμε στο δίκτυό μας. Το γραφείο μας είναι στη διάθεσή σας για κάθε αίτημα ή απορία.</p>" +
      "<p>Με εκτίμηση,<br/>{{me}}</p>",
  },
  {
    key: "thank-you",
    label: "Ευχαριστήριο μήνυμα",
    subject: "Σας ευχαριστούμε",
    bodyHtml:
      "<p>Καλησπέρα,</p>" +
      "<p>Θέλαμε να σας ευχαριστήσουμε για τη συνεργασία σας. Είμαστε στη διάθεσή σας.</p>" +
      "<p>Με εκτίμηση,<br/>{{me}}</p>",
  },
];

const fillTemplate = (tpl: Template, meName: string) => {
  const now = new Date();
  const month = now.toLocaleDateString("el-GR", { month: "long", year: "numeric" });
  const replace = (s: string) => s.replace(/\{\{month\}\}/g, month).replace(/\{\{me\}\}/g, meName);
  return { subject: replace(tpl.subject), bodyHtml: replace(tpl.bodyHtml) };
};

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// ─── Folder metadata ────────────────────────────────────────────────

const FOLDERS = [
  { key: "Inbox",   label: "Εισερχόμενα",  icon: <InboxIcon fontSize="small" /> },
  { key: "Starred", label: "Με αστέρι",    icon: <StarIcon fontSize="small" /> },
  { key: "Sent",    label: "Απεσταλμένα",  icon: <SendIcon fontSize="small" /> },
  { key: "Drafts",  label: "Πρόχειρα",     icon: <DraftsIcon fontSize="small" /> },
  { key: "Archive", label: "Αρχειοθέτηση", icon: <ArchiveIcon fontSize="small" /> },
  { key: "Spam",    label: "Ανεπιθύμητα",  icon: <ReportIcon fontSize="small" /> },
  { key: "Trash",   label: "Κάδος",        icon: <DeleteOutlineIcon fontSize="small" /> },
];

const dateShort = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23", timeZone: "Europe/Athens" })
    : d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
};

/**
 * Open a new tab with a print-friendly thread view. Kalypsis branding
 * is intentionally minimal so the operator can slap this into a customer
 * folder or forward it via email.
 */
function printThread(messages: ErmesMessageDto[], subject: string) {
  const esc = (s: string) => (s ?? "").replace(/[&<>]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const items = messages.map(m => `
    <section style="border-bottom:1px solid #ddd;padding:12px 0">
      <div style="font-weight:700;font-size:13px">${esc(m.senderDisplay)}
        <span style="color:#666;font-weight:400">&lt;${esc(m.senderEmail)}&gt;</span></div>
      <div style="color:#666;font-size:12px;margin-bottom:6px">
        προς: ${esc((m.recipients ?? []).map(r => r.display).join(", "))}
        · ${new Date(m.sentAt ?? m.createdAt).toLocaleString("el-GR", { hour12: false, hourCycle: "h23", timeZone: "Europe/Athens" })}
      </div>
      <div style="font-size:13px;line-height:1.5">${m.bodyHtml || ""}</div>
    </section>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <title>${esc(subject)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;padding:24px;max-width:800px;margin:auto}
      h1{font-size:18px;margin:0 0 12px}
      @media print { body{padding:0} }
    </style></head><body>
    <h1>${esc(subject)}</h1>
    ${items}
    <p style="color:#999;font-size:11px;margin-top:24px">
      Εκτυπώθηκε από Kalypsis · ΕΡΜΗΣ · ${new Date().toLocaleString("el-GR", { hour12: false, hourCycle: "h23", timeZone: "Europe/Athens" })}
    </p>
    <script>window.onload=()=>setTimeout(()=>window.print(),120);</script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}

/**
 * ΕΡΜΗΣ — Kalypsis-native messaging workspace.
 *
 * 3-column Outlook-style layout:
 *   • Left rail  — folders, teams, blocklist, composer button
 *   • Middle     — message list (search + bulk actions + pagination)
 *   • Right      — reader panel (thread view + reply / forward / actions)
 *
 * All state lives in URL-agnostic React state so a full-page refresh
 * always lands the operator back in Inbox. Real-time deltas come from
 * react-query's default 30-second refetch — good enough for internal
 * messaging without adding a websocket transport.
 */
export function ErmesPage() {
  const { user } = useAuth();
  const myId = user?.userId;
  const qc = useQueryClient();
  const [folder, setFolder]   = useState<string>("Inbox");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  // Composer lives in three modes:
  //   • closed     — reader / welcome pane owns the right column
  //   • inline     — composer takes over the right column (Gmail-style)
  //   • fullscreen — composer opens as a full-screen dialog overlay
  const [composerMode, setComposerMode] = useState<"closed" | "inline" | "fullscreen">("closed");
  const openCompose = () => { setComposerMode("inline"); setOpenThreadId(null); };
  const closeCompose = () => { setComposerMode("closed"); setReplyTo(null); };
  const [replyTo, setReplyTo] = useState<{ msg: ErmesMessageDto; mode: "reply" | "replyAll" | "forward" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState<null | "teams" | "blocks" | "contacts" | "automations">(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Signature persisted per-user in localStorage — never leaves the browser
  // until the user actually composes with «Χρήση υπογραφής» toggled on.
  const sigKey = `kalypsis.ermes.signature.${myId ?? "anon"}`;
  const [signature, setSignatureState] = useState<string>(() => {
    try { return window.localStorage.getItem(sigKey) ?? ""; } catch { return ""; }
  });
  const setSignature = (v: string) => {
    setSignatureState(v);
    try { window.localStorage.setItem(sigKey, v); } catch { /* quota */ }
  };
  const [signatureEditorOpen, setSignatureEditorOpen] = useState(false);
  const [channelTeam, setChannelTeam] = useState<Team | null>(null);
  // Beta notice — shown the first time a user lands on ΕΡΜΗΣ. The
  // localStorage flag is scoped per-user so a shared browser still nags
  // each teammate individually once. Re-opening from the header chip
  // ignores the flag and always shows the dialog.
  const betaKey = `kalypsis.ermes.betaNoticeSeen.${myId ?? "anon"}`;
  const [betaOpen, setBetaOpen] = useState<boolean>(() => {
    try { return !window.localStorage.getItem(betaKey); } catch { return true; }
  });
  const closeBeta = () => {
    try { window.localStorage.setItem(betaKey, "1"); } catch { /* quota */ }
    setBetaOpen(false);
  };

  const overview = useQuery({
    queryKey: ["ermes", "overview"],
    queryFn: async () => (await api.get<OverviewDto>("/ermes/overview")).data,
    refetchInterval: 30_000,
  });

  const list = useQuery({
    queryKey: ["ermes", "list", folder, search],
    queryFn: async () => (await api.get<ErmesMessageDto[]>("/ermes/messages", {
      params: { folder, search: search.trim() || undefined, take: 200 }
    })).data,
    refetchInterval: 30_000,
  });

  const thread = useQuery({
    queryKey: ["ermes", "thread", openThreadId],
    enabled: !!openThreadId,
    queryFn: async () => (await api.get<ErmesMessageDto[]>(`/ermes/threads/${openThreadId}`)).data,
  });

  // Reset the reader + selection whenever the folder or search changes.
  useEffect(() => { setSelected(new Set()); setOpenThreadId(null); }, [folder, search]);

  // ── E2E keypair provisioning ─────────────────────────────────────
  // On first ErmesPage load, generate an ECDH P-256 keypair (private
  // half pinned to this browser via IndexedDB, extractable:false) and
  // publish the public half to /api/ermes/keys/mine so peers can encrypt
  // for us. Idempotent — future loads see the existing keypair, don't
  // re-generate. See src/ermes/keyManager.ts for the crypto primitives.
  const [e2eStatus, setE2eStatus] = useState<"idle" | "ready" | "unsupported" | "error">("idle");
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    (async () => {
      try {
        const env = await ensureE2EKeypair(myId);
        if (cancelled) return;
        setE2eStatus(env ? "ready" : "unsupported");
      } catch (e) {
        console.warn("Ermes E2E keypair provisioning failed", e);
        if (!cancelled) setE2eStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [myId]);

  // ── Jitsi Meet dialog ────────────────────────────────────────────
  // «Έναρξη meeting» on an open thread fetches a deterministic room
  // name from the backend + opens the Jitsi Meet URL in an iframe
  // (or a new tab if the browser blocks embedding). Jitsi handles the
  // WebRTC signalling + TURN — we own only the room-name derivation.
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const startMeetingForThread = async (threadId: string) => {
    try {
      const r = await api.get<{ url: string; roomName: string }>("/ermes/meeting/room",
        { params: { threadId } });
      setMeetingUrl(r.data.url);
    } catch (e) { setError(extractErrorMessage(e)); }
  };

  // ── Real-time SSE stream ───────────────────────────────────────────
  // Opens a long-lived fetch stream to /api/ermes/stream. Every «message»
  // event pushed by the backend invalidates the ermes react-query cache,
  // so the inbox refreshes instantly without polling. Uses fetch (not
  // EventSource) so we can send the Authorization header via the axios
  // interceptor's baseURL — reads chunks manually and parses `event: X /
  // data: Y` framing. Auto-reconnects with a 5-second backoff. Cleans up
  // on unmount / route change / logout.
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const token = (() => {
      try { return JSON.parse(sessionStorage.getItem("kalypsis_auth") || localStorage.getItem("kalypsis_auth") || "null")?.accessToken as string | undefined; }
      catch { return undefined; }
    })();
    if (!token) return; // no session — nothing to stream

    async function connect() {
      while (!cancelled) {
        try {
          const res = await fetch("/api/ermes/stream", {
            headers: { Authorization: `Bearer ${token}` },
            signal: ac.signal,
          });
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            // Frames end with a blank line — split, parse `event: X` and
            // `data: Y` inside each block.
            let idx: number;
            while ((idx = buf.indexOf("\n\n")) !== -1) {
              const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
              if (frame.startsWith(":")) continue; // comment / keep-alive
              let evt = "message";
              for (const line of frame.split("\n")) {
                if (line.startsWith("event:")) evt = line.slice(6).trim();
              }
              if (evt === "message") {
                void qc.invalidateQueries({ queryKey: ["ermes"] });
              }
            }
          }
        } catch (_) { /* network drop → retry */ }
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 5000)); // backoff
      }
    }
    void connect();
    return () => { cancelled = true; ac.abort(); };
  }, [qc]);

  // Keyboard shortcuts — only fire while nothing editable is focused,
  // so typing in composer / search / reply body never triggers them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case "c": setReplyTo(null); openCompose(); break;
        case "?": setShortcutsOpen(true); break;
        case "/":
          {
            const el = document.querySelector<HTMLInputElement>('input[placeholder*="Αναζήτηση"]');
            if (el) { e.preventDefault(); el.focus(); }
          }
          break;
        case "Escape":
          if (openThreadId) setOpenThreadId(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openThreadId]);

  const openMessage = (m: ErmesMessageDto) => {
    if (m.isDraft) {
      // Editing a draft — pop the composer with the draft prefilled.
      setReplyTo({ msg: m, mode: "reply" });
      openCompose();
      return;
    }
    setOpenThreadId(m.threadId);
  };

  const bulk = useMutation({
    mutationFn: async ({ action, ids }: { action: string; ids: string[] }) =>
      api.post("/ermes/messages/bulk", { messageIds: ids, action }),
    onSuccess: () => {
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["ermes"] });
    },
    onError: (e) => setError(extractErrorMessage(e)),
  });

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    const ids = (list.data ?? []).map(m => m.id);
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids));
  };

  const counts: Record<string, FolderCount> = {};
  for (const f of overview.data?.folders ?? []) counts[f.folder] = f;

  return (
    <Box sx={{
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 120px)", gap: 1.25,
      // Frame the whole page with a subtle app-background so the 3-column
      // Cards feel elevated — matches the Outlook / modern-mail vibe.
      bgcolor: (t) => t.palette.mode === "dark" ? "transparent" : "#f7f9fc",
      mx: -2, px: 2, pt: 1.5,
    }}>
      {/* Command bar — sharper hierarchy, prominent primary action */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 2,
        bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider",
        borderRadius: 2, px: 2, py: 1.25,
        boxShadow: "0 4px 12px -8px rgba(11,37,69,0.14)",
      }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: 1.5, display: "grid", placeItems: "center",
          bgcolor: (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.20)" : "#e7f0fa",
          color: "primary.main",
        }}>
          <MailOutlineIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.01em" }}>
              ΕΡΜΗΣ
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: "1px" }}>
              · κρυπτογραφημένη επικοινωνία
            </Typography>
            <Chip
              size="small" color="warning" variant="filled"
              icon={<ConstructionIcon sx={{ fontSize: 14 }} />}
              label="BETA · Δωρεάν εφ'όρου ζωής για τους early users"
              onClick={() => setBetaOpen(true)}
              sx={{ fontWeight: 700, cursor: "pointer", ml: 0.5 }}
            />
          </Stack>
        </Box>
        {/* E2E status chip — «Κρυπτογραφημένη» when a keypair is
            provisioned in this browser + registered on the server. Users
            know at a glance that this session is E2E-ready. */}
        {e2eStatus === "ready" && (
          <Tooltip title="Το πρόγραμμα περιήγησής σας έχει ζεύγος κλειδιών E2E — το ιδιωτικό μένει τοπικά, το δημόσιο δημοσιεύθηκε στους συνεργάτες σας.">
            <Chip icon={<LockIcon sx={{ fontSize: 15 }} />} label="Κρυπτογραφημένη"
              size="small" color="success" variant="outlined"
              sx={{ fontWeight: 700, mr: 1 }} />
          </Tooltip>
        )}
        {openThreadId && (
          <Button variant="outlined" size="medium" startIcon={<VideocamIcon />}
            onClick={() => startMeetingForThread(openThreadId)}
            sx={{ fontWeight: 700, mr: 1 }}>
            Έναρξη meeting
          </Button>
        )}
        <Button variant="contained" size="medium" startIcon={<CreateIcon />}
          onClick={() => { setReplyTo(null); openCompose(); }}
          sx={{
            fontWeight: 700, px: 2.5,
            boxShadow: "0 8px 20px -10px rgba(31,123,179,0.55)",
          }}>
          Νέο μήνυμα
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{
        display: "grid",
        // Slightly narrower rail + slightly wider middle for a more Outlook-
        // like feel. Reading pane still owns the remaining width.
        gridTemplateColumns: "224px 400px 1fr",
        gap: 1.5, flex: 1, minHeight: 0,
      }}>
        {/* ── Left rail: folders + teams + blocks ─────────────────── */}
        <Card variant="outlined" sx={{
          overflowY: "auto", p: 0,
          // Denser, sharper rail with Outlook-style active-item bar
          "& .MuiListItemButton-root": {
            borderLeft: "3px solid transparent",
            transition: "border-color 140ms, background-color 140ms",
          },
          "& .MuiListItemButton-root.Mui-selected": {
            borderLeftColor: "primary.main",
            bgcolor: (t) => t.palette.mode === "dark"
              ? "rgba(78,138,206,0.16)"
              : "rgba(31,123,179,0.09)",
          },
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 3 },
        }}>
          <List dense disablePadding sx={{ py: 0.5 }}>
            {FOLDERS.map(f => {
              const c = counts[f.key];
              const active = folder === f.key;
              return (
                <ListItemButton key={f.key} selected={active} onClick={() => setFolder(f.key)}
                  sx={{ py: 0.9, pl: 1.75 }}>
                  <Box sx={{ mr: 1.25, color: active ? "primary.main" : "text.secondary", display: "flex" }}>{f.icon}</Box>
                  <ListItemText
                    primary={f.label}
                    primaryTypographyProps={{
                      fontWeight: active ? 700 : 500,
                      fontSize: 13.5,
                      color: active ? "primary.main" : "text.primary",
                    }}
                  />
                  {c && (c.unread > 0
                    ? <Chip label={c.unread} size="small" color="primary"
                        sx={{ height: 20, fontWeight: 700, fontSize: 11 }} />
                    : c.total > 0 && <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{c.total}</Typography>)}
                </ListItemButton>
              );
            })}
          </List>
          <Divider />
          <Box sx={{ px: 1.5, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="overline" color="text.secondary">Κανάλια · Ομάδες</Typography>
            <IconButton size="small" onClick={() => setManageOpen("teams")}><AddIcon fontSize="small" /></IconButton>
          </Box>
          <List dense disablePadding>
            {(overview.data?.teams ?? []).map(t => (
              <ListItemButton key={t.id} sx={{ py: 0.5 }} onClick={() => setChannelTeam(t)}>
                <TagIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
                <ListItemText primary={t.name} secondary={`${t.members.length} μέλη`}
                  primaryTypographyProps={{ variant: "body2" }} />
              </ListItemButton>
            ))}
            {(overview.data?.teams ?? []).length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: "block" }}>
                Καμία ομάδα ακόμη. Πατήστε «+» για νέα.
              </Typography>
            )}
          </List>
          <Divider />
          {/* Category quick-filter chips — click to narrow the middle
              list to a single category. Click again to clear. */}
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography variant="overline" color="text.secondary" display="block" mb={0.5}>
              Κατηγορίες
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <Chip size="small" label="Όλες" color={!categoryFilter ? "primary" : "default"}
                variant={!categoryFilter ? "filled" : "outlined"}
                onClick={() => setCategoryFilter("")} sx={{ height: 22 }} />
              {CATEGORIES.map(c => (
                <Chip key={c.key} size="small" label={c.label}
                  color={categoryFilter === c.key ? c.color : "default"}
                  variant={categoryFilter === c.key ? "filled" : "outlined"}
                  onClick={() => setCategoryFilter(categoryFilter === c.key ? "" : c.key)}
                  sx={{ height: 22 }} />
              ))}
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ px: 1.5, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="overline" color="text.secondary">Ρυθμίσεις</Typography>
          </Box>
          <ListItemButton onClick={() => setManageOpen("contacts")} sx={{ py: 0.75 }}>
            <ContactsIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
            <ListItemText primary="Επαφές" primaryTypographyProps={{ variant: "body2" }} />
            <Typography variant="caption" color="text.secondary">
              {overview.data?.contacts?.length ?? 0}
            </Typography>
          </ListItemButton>
          <ListItemButton onClick={() => setManageOpen("automations")} sx={{ py: 0.75 }}>
            <ConstructionIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
            <ListItemText primary="Αυτοματισμοί" primaryTypographyProps={{ variant: "body2" }} />
          </ListItemButton>
          <ListItemButton onClick={() => setSignatureEditorOpen(true)} sx={{ py: 0.75 }}>
            <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
            <ListItemText primary="Υπογραφή" primaryTypographyProps={{ variant: "body2" }} />
            {signature && <Chip size="small" label="ok" color="success" sx={{ height: 18, fontSize: 10 }} />}
          </ListItemButton>
          <ListItemButton onClick={() => setShortcutsOpen(true)} sx={{ py: 0.75 }}>
            <KeyboardIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
            <ListItemText primary="Συντομεύσεις" primaryTypographyProps={{ variant: "body2" }} />
          </ListItemButton>
          <ListItemButton onClick={() => setManageOpen("blocks")} sx={{ py: 0.75 }}>
            <BlockIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
            <ListItemText primary="Ανεπιθύμητοι / Μπλοκ" primaryTypographyProps={{ variant: "body2" }} />
          </ListItemButton>
        </Card>

        {/* ── Middle: message list ───────────────────────────────── */}
        <Card variant="outlined" sx={{
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Search + Focused/Other tabs */}
          <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "divider" }}>
            <TextField size="small" fullWidth placeholder="Αναζήτηση σε θέμα, αποστολέα, περιεχόμενο…"
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                sx: { bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#f4f6fa" },
              }} />
            <Stack direction="row" spacing={0.25} sx={{
              mt: 1.25, borderBottom: "2px solid transparent",
              "& .tab": {
                px: 1.5, py: 0.5, cursor: "pointer", fontSize: 13,
                fontWeight: 700, color: "text.secondary",
                borderBottom: "2px solid transparent", marginBottom: "-2px",
                letterSpacing: "0.01em",
              },
              "& .tab.active": {
                color: "primary.main",
                borderBottomColor: "primary.main",
              },
              "& .tab:hover:not(.active)": { color: "text.primary" },
            }}>
              <Box className={`tab ${!unreadOnly ? "active" : ""}`} onClick={() => setUnreadOnly(false)}>
                Εστιασμένα
              </Box>
              <Box className={`tab ${unreadOnly ? "active" : ""}`} onClick={() => setUnreadOnly(true)}>
                Μη αναγνωσμένα
              </Box>
            </Stack>
          </Box>
          <Box sx={{ px: 1.25, py: 0.6, borderBottom: 1, borderColor: "divider",
            display: "flex", alignItems: "center", gap: 0.5,
            bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#fafbfd",
            minHeight: 40 }}>
            <Checkbox size="small"
              checked={(list.data?.length ?? 0) > 0 && selected.size === (list.data?.length ?? 0)}
              indeterminate={selected.size > 0 && selected.size < (list.data?.length ?? 0)}
              onChange={toggleAll} />
            {selected.size === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontWeight: 600 }}>
                {(() => {
                  const all = list.data ?? [];
                  const filtered = all.filter(m =>
                    (!categoryFilter || m.category === categoryFilter) &&
                    (!unreadOnly || !m.isRead));
                  return filtered.length === all.length
                    ? `${all.length} μηνύματα`
                    : `${filtered.length} από ${all.length}`;
                })()}
              </Typography>
            ) : (
              <BulkBar folder={folder} disabled={bulk.isPending}
                onAction={(a) => bulk.mutate({ action: a, ids: Array.from(selected) })} />
            )}
          </Box>
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {list.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} /></Box>
            ) : (() => {
              const filtered = (list.data ?? []).filter(m =>
                (!categoryFilter || m.category === categoryFilter) &&
                (!unreadOnly || !m.isRead));
              if (filtered.length === 0) {
                return (
                  <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
                    {categoryFilter || unreadOnly
                      ? "Καμία εγγραφή που να ταιριάζει με τα φίλτρα."
                      : "Καμία εγγραφή σε αυτόν τον φάκελο."}
                  </Box>
                );
              }
              return filtered.map(m => (
                <MessageRow key={m.id} msg={m} selected={selected.has(m.id)}
                  active={openThreadId === m.threadId}
                  onToggle={() => toggleOne(m.id)}
                  onOpen={() => openMessage(m)}
                  onStar={() => bulk.mutate({ action: m.isStarred ? "Unstar" : "Star", ids: [m.id] })} />
              ));
            })()}
          </Box>
        </Card>

        {/* ── Right: composer (inline) / reader / welcome pane ─── */}
        <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {composerMode === "inline" ? (
            <ComposeDialog
              variant="inline"
              onExpand={() => setComposerMode("fullscreen")}
              onClose={closeCompose}
              contacts={overview.data?.contacts ?? []}
              teams={overview.data?.teams ?? []}
              reply={replyTo}
              meDisplay={((user?.firstName ?? "") + " " + (user?.lastName ?? "")).trim()}
              signature={signature}
              onSent={() => { closeCompose(); void qc.invalidateQueries({ queryKey: ["ermes"] }); }}
            />
          ) : openThreadId ? (
            thread.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
            ) : (
              <ThreadReader
                messages={thread.data ?? []}
                myId={myId ?? ""}
                onClose={() => setOpenThreadId(null)}
                onReply={(m, mode) => { setReplyTo({ msg: m, mode }); openCompose(); }}
                onDelete={(id) => bulk.mutate({ action: "Delete", ids: [id] })}
                onMoveSpam={(id) => bulk.mutate({ action: "MoveSpam", ids: [id] })}
                onArchive={(id) => bulk.mutate({ action: "MoveArchive", ids: [id] })}
                onRestore={(id) => bulk.mutate({ action: "Restore", ids: [id] })}
                onBlockSender={(uid) => api.post("/ermes/blocks", { blockedUserId: uid })
                  .then(() => qc.invalidateQueries({ queryKey: ["ermes"] }))
                  .catch(e => setError(extractErrorMessage(e)))}
              />
            )
          ) : (
            <WelcomePane
              onCompose={() => { setReplyTo(null); openCompose(); }}
              onOpenContacts={() => setManageOpen("contacts")}
              onOpenAutomations={() => setManageOpen("automations")}
              onOpenTeams={() => setManageOpen("teams")}
              counts={counts}
              contacts={overview.data?.contacts ?? []}
              onQuickCompose={(c) => {
                setReplyTo({
                  msg: {
                    id: "", threadId: "", inReplyToMessageId: null,
                    senderUserId: c.userId, senderDisplay: c.display, senderEmail: c.email,
                    subject: "", bodyHtml: "", preview: "",
                    folder: "Inbox", isRead: true, isStarred: false, isImportant: false,
                    isDraft: false, automationSource: null, category: null,
                    externalEmailRequested: false, externalEmailDelivered: false, externalEmailStatus: null,
                    createdAt: new Date().toISOString(), sentAt: null,
                    recipients: [], attachments: [],
                  },
                  mode: "reply",
                });
                openCompose();
              }}
            />
          )}
        </Card>
      </Box>

      {/* Full-screen composer overlay — only rendered on user demand */}
      {composerMode === "fullscreen" && (
        <ComposeDialog
          variant="fullscreen"
          onCollapse={() => setComposerMode("inline")}
          onClose={closeCompose}
          contacts={overview.data?.contacts ?? []}
          teams={overview.data?.teams ?? []}
          reply={replyTo}
          meDisplay={((user?.firstName ?? "") + " " + (user?.lastName ?? "")).trim()}
          signature={signature}
          onSent={() => { closeCompose(); void qc.invalidateQueries({ queryKey: ["ermes"] }); }}
        />
      )}

      {/* Manage teams / blocks / contacts / automations */}
      <ManageDialog kind={manageOpen} onClose={() => setManageOpen(null)}
        contacts={overview.data?.contacts ?? []} teams={overview.data?.teams ?? []}
        onCompose={(c) => {
          setReplyTo({
            msg: {
              id: "", threadId: "", inReplyToMessageId: null,
              senderUserId: c.userId, senderDisplay: c.display, senderEmail: c.email,
              subject: "", bodyHtml: "", preview: "",
              folder: "Inbox", isRead: true, isStarred: false, isImportant: false,
              isDraft: false, automationSource: null, category: null,
              externalEmailRequested: false, externalEmailDelivered: false, externalEmailStatus: null,
              createdAt: new Date().toISOString(), sentAt: null,
              recipients: [], attachments: [],
            },
            mode: "reply",
          });
          openCompose();
        }} />

      {/* Signature editor + keyboard-shortcuts sheet */}
      <SignatureEditor open={signatureEditorOpen} html={signature}
        onClose={() => setSignatureEditorOpen(false)}
        onSave={(v) => setSignature(v)} />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Channel view (Discord-style feed for a team) */}
      <ChannelDialog team={channelTeam} onClose={() => setChannelTeam(null)}
        meDisplay={((user?.firstName ?? "") + " " + (user?.lastName ?? "")).trim()} />

      {/* Beta / early-access notice — first visit, dismissible; the header
          chip re-opens it any time. */}
      <Dialog open={betaOpen} onClose={closeBeta} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 800 }}>
          <ConstructionIcon color="warning" />
          ΕΡΜΗΣ — Υπό ενεργή ανάπτυξη
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Alert severity="warning" icon={<ConstructionIcon />}>
              Ο <b>ΕΡΜΗΣ</b> βρίσκεται σε <b>ενεργή ανάπτυξη (Beta)</b>.
              Ορισμένες λειτουργίες (cross-tenant μηνύματα σε εξωτερικούς
              συνεργάτες, αυτόματη αποστολή μηνιαίων λιστών παραγωγής,
              email nudges, real-time push) έρχονται σταδιακά.
            </Alert>
            <Alert severity="success" icon={<CardGiftcardIcon />}>
              <Typography fontWeight={800} mb={0.5}>
                Χρησιμοποιήστε τον τώρα — μείνει δωρεάν εφ'όρου ζωής.
              </Typography>
              <Typography variant="body2">
                Κάθε γραφείο που ξεκινά με τον ΕΡΜΗΣ κατά την Beta φάση
                θα τον διατηρήσει <b>δωρεάν για πάντα</b> μετά την
                επίσημη κυκλοφορία, ακόμη κι όταν το plan μετακινηθεί
                σε πληρωμένη συνδρομή.
              </Typography>
            </Alert>
            <Typography variant="caption" color="text.secondary">
              Για αναφορές, feedback ή προτάσεις: <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBeta} variant="contained">Το κατάλαβα, ας ξεκινήσω</Button>
        </DialogActions>
      </Dialog>

      {/* Jitsi Meet dialog — deterministic room name comes from
          /api/ermes/meeting/room?threadId. Every participant on the
          same thread who hits the button lands in the same call.
          If iframe embedding is blocked, users can open the room in a
          new tab from the header of the dialog. */}
      <Dialog open={!!meetingUrl} onClose={() => setMeetingUrl(null)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { height: { xs: "90vh", md: "80vh" } } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 800 }}>
          <VideocamIcon color="primary" />
          Συνάντηση συζήτησης
          <Box sx={{ flex: 1 }} />
          {meetingUrl && (
            <Button size="small" component="a" href={meetingUrl} target="_blank" rel="noopener noreferrer">
              Άνοιγμα σε νέα καρτέλα
            </Button>
          )}
          <IconButton onClick={() => setMeetingUrl(null)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: "100%" }}>
          {meetingUrl && (
            <iframe src={meetingUrl} title="Kalypsis meeting"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              style={{ border: 0, width: "100%", height: "100%" }} />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// ─── Bulk action bar ─────────────────────────────────────────────────

function BulkBar({ folder, onAction, disabled }: {
  folder: string; onAction: (a: string) => void; disabled: boolean;
}) {
  return (
    <Stack direction="row" spacing={0.5}>
      <Tip title="Αναγνωσμένο"><IconButton size="small" disabled={disabled} onClick={() => onAction("MarkRead")}><MarkEmailReadIcon fontSize="small" /></IconButton></Tip>
      <Tip title="Μη αναγνωσμένο"><IconButton size="small" disabled={disabled} onClick={() => onAction("MarkUnread")}><MarkEmailUnreadIcon fontSize="small" /></IconButton></Tip>
      <Tip title="Αστέρι"><IconButton size="small" disabled={disabled} onClick={() => onAction("Star")}><StarIcon fontSize="small" /></IconButton></Tip>
      <Tip title="Αρχειοθέτηση"><IconButton size="small" disabled={disabled} onClick={() => onAction("MoveArchive")}><ArchiveIcon fontSize="small" /></IconButton></Tip>
      <Tip title="Ανεπιθύμητο"><IconButton size="small" disabled={disabled} onClick={() => onAction("MoveSpam")}><ReportIcon fontSize="small" /></IconButton></Tip>
      {folder === "Trash" || folder === "Drafts"
        ? <Tip title="Επαναφορά"><IconButton size="small" disabled={disabled} onClick={() => onAction("Restore")}><RestoreIcon fontSize="small" /></IconButton></Tip>
        : null}
      <Tip title="Διαγραφή"><IconButton size="small" color="error" disabled={disabled} onClick={() => onAction(folder === "Trash" ? "Delete" : "MoveTrash")}><DeleteOutlineIcon fontSize="small" /></IconButton></Tip>
    </Stack>
  );
}
function Tip({ title, children }: { title: string; children: JSX.Element }) {
  return <Tooltip title={title} arrow>{children}</Tooltip>;
}

// ─── Message row (middle column) ─────────────────────────────────────

function MessageRow({ msg, selected, active, onToggle, onOpen, onStar }: {
  msg: ErmesMessageDto; selected: boolean; active: boolean;
  onToggle: () => void; onOpen: () => void; onStar: () => void;
}) {
  const initials = msg.senderDisplay
    .split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
  // Deterministic avatar tint from sender's name so each contact keeps
  // a stable colour across the list — makes scanning easier.
  const avatarTint = (() => {
    const palette = ["#1f7bb3", "#0b2545", "#7c6feb", "#2ea44f", "#c26aa0", "#d97706", "#4b5563"];
    let h = 0;
    for (let i = 0; i < msg.senderDisplay.length; i++) h = (h * 31 + msg.senderDisplay.charCodeAt(i)) | 0;
    return palette[Math.abs(h) % palette.length];
  })();

  return (
    <Box onClick={onOpen}
      sx={{
        display: "flex", alignItems: "center", gap: 1,
        px: 1.25, py: 1.25, cursor: "pointer",
        // 3px accent bar on active OR unread — Outlook-style
        borderLeft: 3,
        borderColor: active
          ? "primary.main"
          : msg.isRead ? "transparent" : "rgba(31,123,179,0.55)",
        bgcolor: active
          ? (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.20)" : "#e7f0fa"
          : "transparent",
        "&:hover": { bgcolor: active
          ? (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.24)" : "#dce9f6"
          : "action.hover" },
        borderBottom: 1, borderBottomColor: "divider",
        transition: "background-color 120ms",
      }}>
      <Checkbox size="small" checked={selected}
        onClick={(e) => { e.stopPropagation(); onToggle(); }} />
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onStar(); }}
        sx={{ p: 0.4 }}>
        {msg.isStarred ? <StarIcon fontSize="small" sx={{ color: "warning.main" }} />
          : <StarBorderIcon fontSize="small" sx={{ color: "text.disabled" }} />}
      </IconButton>
      <Avatar sx={{
        width: 34, height: 34, fontSize: 12.5, fontWeight: 700,
        bgcolor: avatarTint, color: "#fff",
      }}>{initials || "?"}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" fontWeight={msg.isRead ? 500 : 800} noWrap
            sx={{ flex: 1, fontSize: 13.5, color: msg.isRead ? "text.primary" : "text.primary" }}>
            {msg.senderDisplay}
          </Typography>
          {msg.isImportant && <PriorityHighIcon fontSize="small" sx={{ color: "error.main" }} />}
          {msg.automationSource && <Chip label="auto" size="small" sx={{ height: 16, fontSize: 10 }} />}
          <Typography variant="caption" sx={{
            color: msg.isRead ? "text.secondary" : "primary.main",
            fontWeight: msg.isRead ? 500 : 700, fontSize: 11.5,
          }}>{dateShort(msg.sentAt ?? msg.createdAt)}</Typography>
        </Stack>
        <Typography variant="body2" fontWeight={msg.isRead ? 500 : 700} noWrap
          sx={{ fontSize: 13, mt: 0.25 }}>

          {msg.isDraft && <Chip label="Πρόχειρο" size="small" color="warning" sx={{ mr: 0.5, height: 16, fontSize: 10 }} />}
          {msg.category && (() => {
            const cm = CATEGORIES.find(c => c.key === msg.category);
            return cm ? <Chip label={cm.label} size="small" color={cm.color} sx={{ mr: 0.5, height: 16, fontSize: 10 }} /> : null;
          })()}
          {msg.attachments?.length > 0 && <AttachFileIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5, color: "text.secondary" }} />}
          {msg.externalEmailRequested && <AlternateEmailIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5, color: msg.externalEmailDelivered ? "success.main" : "text.secondary" }} />}
          {msg.subject || "(Χωρίς θέμα)"}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {msg.preview || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Thread reader (right column) ────────────────────────────────────

function ThreadReader({
  messages, myId, onClose, onReply, onDelete, onMoveSpam, onArchive, onRestore, onBlockSender
}: {
  messages: ErmesMessageDto[]; myId: string;
  onClose: () => void;
  onReply: (m: ErmesMessageDto, mode: "reply" | "replyAll" | "forward") => void;
  onDelete: (id: string) => void;
  onMoveSpam: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onBlockSender: (uid: string) => void;
}) {
  const last = messages[messages.length - 1];
  if (!last) return null;
  const subject = messages[0]?.subject || "(Χωρίς θέμα)";
  // Read receipts for the last message — number of recipients who have
  // opened it. Rendered as a small info bar above the body.
  const lastReadCount = (last.recipients ?? []).filter(r => r.isRead).length;
  const lastRecipientCount = (last.recipients ?? []).length;
  return (
    <>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider",
        display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>{subject}</Typography>
        <Tip title="Απάντηση"><IconButton onClick={() => onReply(last, "reply")}><ReplyIcon /></IconButton></Tip>
        <Tip title="Απάντηση σε όλους"><IconButton onClick={() => onReply(last, "replyAll")}><ReplyAllIcon /></IconButton></Tip>
        <Tip title="Προώθηση"><IconButton onClick={() => onReply(last, "forward")}><ForwardIcon /></IconButton></Tip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
        <Tip title="Αρχειοθέτηση"><IconButton onClick={() => onArchive(last.id)}><ArchiveIcon /></IconButton></Tip>
        <Tip title="Ανεπιθύμητο"><IconButton onClick={() => onMoveSpam(last.id)}><ReportIcon /></IconButton></Tip>
        {last.folder === "Trash"
          ? <Tip title="Επαναφορά"><IconButton onClick={() => onRestore(last.id)}><RestoreIcon /></IconButton></Tip>
          : <Tip title="Διαγραφή"><IconButton color="error" onClick={() => onDelete(last.id)}><DeleteOutlineIcon /></IconButton></Tip>}
        {last.senderUserId !== myId && (
          <Tip title="Μπλοκάρισμα αποστολέα"><IconButton onClick={() => onBlockSender(last.senderUserId)}><BlockIcon /></IconButton></Tip>
        )}
        <Tip title="Εκτύπωση συνομιλίας">
          <IconButton onClick={() => printThread(messages, subject)}><PrintIcon /></IconButton>
        </Tip>
        <Tip title="Κλείσιμο"><IconButton onClick={onClose}><CloseIcon /></IconButton></Tip>
      </Box>
      {lastRecipientCount > 0 && last.senderUserId === myId && (
        <Box sx={{ px: 1.5, py: 0.5, borderBottom: 1, borderColor: "divider",
          bgcolor: "action.hover", display: "flex", alignItems: "center", gap: 1 }}>
          <VisibilityIcon fontSize="small" sx={{ color: lastReadCount > 0 ? "success.main" : "text.disabled" }} />
          <Typography variant="caption" color="text.secondary">
            Αναγνώστηκε από {lastReadCount} / {lastRecipientCount}
          </Typography>
          <Tooltip title={
            <Box>
              {(last.recipients ?? []).map(r => (
                <div key={r.userId}>{r.display} — {r.isRead ? "διαβασμένο" : "μη διαβασμένο"}</div>
              ))}
            </Box>
          }>
            <Typography variant="caption" color="primary" sx={{ cursor: "help", textDecoration: "underline" }}>
              λεπτομέρειες
            </Typography>
          </Tooltip>
        </Box>
      )}
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {messages.map((m, i) => (
          <Box key={m.id} sx={{ mb: i === messages.length - 1 ? 0 : 2, pb: 2,
            borderBottom: i === messages.length - 1 ? "none" : 1, borderColor: "divider" }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
              <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main" }}>
                {m.senderDisplay.split(" ").filter(Boolean).slice(0,2).map(s => s[0]).join("").toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>{m.senderDisplay}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    &lt;{m.senderEmail}&gt;
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  προς: {m.recipients.map(r => r.display).join(", ") || "—"}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(m.sentAt ?? m.createdAt).toLocaleString("el-GR", { hour12: false, hourCycle: "h23", timeZone: "Europe/Athens" })}
              </Typography>
            </Stack>
            <Box sx={{
              "& blockquote": { borderLeft: 3, borderColor: "divider",
                pl: 1.5, ml: 0, my: 1, color: "text.secondary" },
              "& p": { my: 0.5 },
              "& table": { borderCollapse: "collapse", width: "100%", fontSize: 13 },
              fontSize: 14, lineHeight: 1.6,
            }} dangerouslySetInnerHTML={{ __html: m.bodyHtml || "" }} />
            {m.attachments && m.attachments.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={1.5}>
                {m.attachments.map(a => (
                  <Chip key={a.id} icon={<AttachFileIcon />}
                    label={`${a.fileName} · ${formatBytes(a.sizeBytes)}`}
                    onClick={async () => {
                      const res = await api.get<Blob>(`/ermes/attachments/${a.id}`, { responseType: "blob" });
                      const url = window.URL.createObjectURL(res.data);
                      const el = document.createElement("a");
                      el.href = url; el.download = a.fileName; el.click();
                      window.URL.revokeObjectURL(url);
                    }}
                    sx={{ cursor: "pointer" }} />
                ))}
              </Stack>
            )}
            {m.category && (() => {
              const cm = CATEGORIES.find(c => c.key === m.category);
              return cm ? (
                <Stack direction="row" spacing={1} mt={1.5}>
                  <Chip icon={<CategoryIcon />} label={cm.label} size="small" color={cm.color} />
                  {m.externalEmailRequested && (
                    <Chip size="small" icon={<AlternateEmailIcon />}
                      color={m.externalEmailDelivered ? "success" : "default"}
                      label={m.externalEmailDelivered
                        ? "Στάλθηκε και σε email"
                        : (m.externalEmailStatus ?? "Email σε αναμονή")} />
                  )}
                </Stack>
              ) : null;
            })()}
          </Box>
        ))}
      </Box>
    </>
  );
}

// ─── Compose dialog ──────────────────────────────────────────────────

/**
 * Full-screen composer. Ships with:
 *  • Header «Πίσω» button that mirrors mail-app UX.
 *  • Rich text editor + subject + To/Cc + team fan-out.
 *  • Category chip picker + external-email switch (routes through Brevo).
 *  • Attachment upload chips (drag/click, 16MB cap).
 *  • Template picker menu with 5 canned bodies.
 *  • «Εισαγωγή λίστας παραγωγής» dialog that pulls /production-lists
 *    with period + carrier + producer filters and drops a formatted
 *    HTML table into the body.
 */
function ComposeDialog({
  variant, onExpand, onCollapse, onClose, contacts, teams, reply, onSent, meDisplay, signature,
}: {
  variant: "inline" | "fullscreen";
  onExpand?: () => void;
  onCollapse?: () => void;
  onClose: () => void;
  contacts: Contact[]; teams: Team[];
  reply: { msg: ErmesMessageDto; mode: "reply" | "replyAll" | "forward" } | null;
  onSent: () => void;
  meDisplay: string;
  signature: string;
}) {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [to, setTo] = useState<Contact[]>([]);
  const [cc, setCc] = useState<Contact[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [selTeams, setSelTeams] = useState<Team[]>([]);
  const [important, setImportant] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [sendExternal, setSendExternal] = useState(false);
  const [useSignature, setUseSignature] = useState<boolean>(true);
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [tplAnchor, setTplAnchor] = useState<HTMLElement | null>(null);
  const [catAnchor, setCatAnchor] = useState<HTMLElement | null>(null);
  const [prodOpen, setProdOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Custom templates persisted per-browser in localStorage; merged with
  // the built-in TEMPLATES in the picker menu.
  const [customTemplates, setCustomTemplates] = useState<Template[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("kalypsis.ermes.customTemplates.v1") ?? "[]"); }
    catch { return []; }
  });
  const persistCustomTemplates = (next: Template[]) => {
    setCustomTemplates(next);
    try { window.localStorage.setItem("kalypsis.ermes.customTemplates.v1", JSON.stringify(next)); }
    catch { /* quota */ }
  };
  const [tplManagerOpen, setTplManagerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const uploadVoiceBlob = async (blob: Blob, durationMs: number) => {
    setUploading(true);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const file = new File([blob], `voice-message-${Date.now()}.${ext}`, { type: blob.type });
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<AttachmentDto>("/ermes/attachments", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachments(prev => [...prev, res.data]);
      // Insert an inline audio player pointing at the attachment
      // download URL. The reader renders it via dangerouslySetInnerHTML
      // and every recipient can play it inside the message.
      const audioUrl = `/api/ermes/attachments/${res.data.id}`;
      const secs = Math.max(1, Math.round(durationMs / 1000));
      const audioBlock =
        `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:8px 0;` +
        `background:#f8fafc;display:flex;align-items:center;gap:10px;font-family:Arial,sans-serif;font-size:13px">` +
          `<span style="width:28px;height:28px;border-radius:50%;background:#1d4ed8;color:#fff;display:inline-flex;align-items:center;justify-content:center">🎤</span>` +
          `<span style="font-weight:700;color:#0f172a">Ηχητικό μήνυμα · ${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}</span>` +
          `<audio controls preload="none" src="${audioUrl}" style="height:32px;max-width:280px;margin-left:auto"></audio>` +
        `</div>`;
      setBodyHtml(prev => (prev || "") + audioBlock);
      setVoiceOpen(false);
    } catch (e) {
      setErr(extractErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  // Autosave — the composer creates a Draft row after the first ~2.5s
  // of activity, then updates that same row on subsequent typing so the
  // Drafts folder doesn't accumulate one row per keystroke.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // Reset the draft id whenever we start a fresh composer (reply switches
  // subject → we want a fresh draft, not to keep updating the old one).
  useEffect(() => { setDraftId(null); setAutoSaveStatus("idle"); setLastSavedAt(null); }, [reply?.msg.id, reply?.mode]);

  useEffect(() => {
    if (reply) {
      const { msg, mode } = reply;
      if (mode === "reply") {
        setSubject(msg.subject.startsWith("Re: ") ? msg.subject : `Re: ${msg.subject}`);
        setTo([{ userId: msg.senderUserId, display: msg.senderDisplay, email: msg.senderEmail, role: "" }]);
        setCc([]); setShowCc(false);
      } else if (mode === "replyAll") {
        setSubject(msg.subject.startsWith("Re: ") ? msg.subject : `Re: ${msg.subject}`);
        setTo([{ userId: msg.senderUserId, display: msg.senderDisplay, email: msg.senderEmail, role: "" }]);
        const ccList = msg.recipients.filter(r => r.kind === "Cc").map(r => ({
          userId: r.userId, display: r.display, email: r.email, role: ""
        }));
        setCc(ccList); setShowCc(ccList.length > 0);
      } else {
        setSubject(msg.subject.startsWith("Fwd: ") ? msg.subject : `Fwd: ${msg.subject}`);
        setTo([]); setCc([]); setShowCc(false);
      }
      const quoted = `<br/><br/><blockquote>—— Αρχικό μήνυμα ——<br/>Από: ${msg.senderDisplay}<br/>Θέμα: ${msg.subject}<br/><br/>${msg.bodyHtml}</blockquote>`;
      setBodyHtml(quoted);
      setImportant(msg.isImportant);
      setCategory(msg.category ?? "");
      setSelTeams([]); setSendExternal(false); setAttachments([]);
    } else {
      setSubject(""); setBodyHtml(""); setTo([]); setCc([]); setShowCc(false);
      setSelTeams([]); setImportant(false); setCategory(""); setSendExternal(false); setAttachments([]);
    }
    setErr(null);
  }, [reply]);

  const send = useMutation({
    mutationFn: async (saveAsDraft: boolean) => api.post("/ermes/messages", {
      subject,
      bodyHtml: (useSignature && signature)
        ? `${bodyHtml}<br/><br/><div class="kx-signature">${signature}</div>`
        : bodyHtml,
      recipients: [
        ...to.map(c => ({ userId: c.userId, kind: "To" })),
        ...cc.map(c => ({ userId: c.userId, kind: "Cc" })),
      ],
      teamIds: selTeams.map(t => t.id),
      inReplyToMessageId: reply?.msg.id ?? null,
      isImportant: important,
      saveAsDraft,
      category: category || null,
      sendExternalEmail: sendExternal,
      attachmentIds: attachments.map(a => a.id),
    }),
    onSuccess: () => {
      // A real send just superseded the autosaved draft — clear the id
      // so opening the composer again starts fresh.
      setDraftId(null); setAutoSaveStatus("idle"); setLastSavedAt(null);
      onSent();
    },
    onError: (e) => setErr(extractErrorMessage(e)),
  });

  // ── Autosave (debounced) ──────────────────────────────────────
  // Every 2.5s of «no typing» we push the current state as a draft. If
  // we already have a draft id we PUT to update it in place; otherwise
  // we POST once, capture the id, and PUT for every subsequent tick so
  // the Drafts folder shows exactly one row per compose session.
  useEffect(() => {
    // Only autosave when the operator has actually put SOMETHING in.
    const hasContent = subject.trim() !== "" || (bodyHtml.replace(/<[^>]+>/g, "").trim() !== "")
      || to.length > 0 || cc.length > 0 || selTeams.length > 0;
    if (!hasContent) return;
    const t = setTimeout(async () => {
      try {
        setAutoSaveStatus("saving");
        const finalBody = (useSignature && signature)
          ? `${bodyHtml}<br/><br/><div class="kx-signature">${signature}</div>`
          : bodyHtml;
        if (draftId) {
          await api.put(`/ermes/messages/${draftId}/draft`, {
            subject, bodyHtml: finalBody,
            recipients: [
              ...to.map(c => ({ userId: c.userId, kind: "To" })),
              ...cc.map(c => ({ userId: c.userId, kind: "Cc" })),
            ],
            teamIds: selTeams.map(t => t.id),
            isImportant: important,
            category: category || null,
            sendExternalEmail: sendExternal,
            attachmentIds: attachments.map(a => a.id),
          });
        } else {
          const res = await api.post<string>("/ermes/messages", {
            subject, bodyHtml: finalBody,
            recipients: [
              ...to.map(c => ({ userId: c.userId, kind: "To" })),
              ...cc.map(c => ({ userId: c.userId, kind: "Cc" })),
            ],
            teamIds: selTeams.map(t => t.id),
            inReplyToMessageId: reply?.msg.id ?? null,
            isImportant: important,
            saveAsDraft: true,
            category: category || null,
            sendExternalEmail: sendExternal,
            attachmentIds: attachments.map(a => a.id),
          });
          setDraftId(res.data);
        }
        setAutoSaveStatus("saved");
        setLastSavedAt(new Date());
      } catch {
        setAutoSaveStatus("error");
      }
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, bodyHtml, to, cc, selTeams, important, category, sendExternal, attachments, useSignature]);

  const insertTemplate = (t: Template) => {
    const { subject: s, bodyHtml: b } = fillTemplate(t, meDisplay);
    if (!subject) setSubject(s);
    // Prepend the template body so any reply-quoted content stays below.
    setBodyHtml(b + (bodyHtml ? "<br/>" + bodyHtml : ""));
    setTplAnchor(null);
  };

  const uploadFile = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      setErr("Μέγιστο μέγεθος αρχείου: 16 MB.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<AttachmentDto>("/ermes/attachments", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachments(prev => [...prev, res.data]);
    } catch (e) {
      setErr(extractErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const catMeta = CATEGORIES.find(c => c.key === category);

  const isFull = variant === "fullscreen";
  const header = (
    <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "divider",
      display: "flex", alignItems: "center", gap: 1, bgcolor: "background.paper" }}>
      <Tooltip title={isFull ? "Πίσω" : "Κλείσιμο"}>
        <IconButton onClick={onClose}>
          {isFull ? <ArrowBackIcon /> : <CloseIcon />}
        </IconButton>
      </Tooltip>
      <Typography variant="h6" fontWeight={800} sx={{ mr: 1 }}>
        {reply ? (reply.mode === "forward" ? "Προώθηση μηνύματος" : "Απάντηση") : "Νέο μήνυμα"}
      </Typography>
      <Box sx={{ flex: 1 }}>
        {autoSaveStatus === "saving" && (
          <Typography variant="caption" color="text.secondary">Αποθήκευση…</Typography>
        )}
        {autoSaveStatus === "saved" && lastSavedAt && (
          <Typography variant="caption" color="text.secondary">
            Αποθηκευμένο πρόχειρο · {lastSavedAt.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23", timeZone: "Europe/Athens" })}
          </Typography>
        )}
        {autoSaveStatus === "error" && (
          <Typography variant="caption" color="error.main">Σφάλμα αυτόματης αποθήκευσης</Typography>
        )}
      </Box>
      {isFull
        ? <Tooltip title="Ενσωμάτωση στη σελίδα"><IconButton size="small" onClick={onCollapse}><CloseFullscreenIcon /></IconButton></Tooltip>
        : <Tooltip title="Πλήρης οθόνη"><IconButton size="small" onClick={onExpand}><OpenInFullIcon /></IconButton></Tooltip>}
      <Button size="small" startIcon={<DraftsIcon />} disabled={send.isPending}
        onClick={() => send.mutate(true)}>Πρόχειρο</Button>
      <Button size="small" variant="contained" startIcon={<SendIcon />} disabled={send.isPending}
        onClick={() => send.mutate(false)}>Αποστολή</Button>
    </Box>
  );
  const body = (

        <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 2, md: 6 }, py: 3, bgcolor: "background.default" }}>
          <Box sx={{ maxWidth: 960, mx: "auto" }}>
            {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
            <Stack spacing={1.5}>
              <Autocomplete<Contact, true>
                multiple size="small" options={contacts}
                value={to} onChange={(_e, v) => setTo(v)}
                getOptionLabel={(c) => `${c.display} <${c.email}>`}
                isOptionEqualToValue={(a, b) => a.userId === b.userId}
                renderInput={(p) => <TextField {...p} label="Προς"
                  InputProps={{ ...p.InputProps,
                    endAdornment: <>
                      {!showCc && <Button size="small" onClick={() => setShowCc(true)}>+Cc</Button>}
                      {p.InputProps.endAdornment}
                    </> }} />}
              />
              {showCc && (
                <Autocomplete<Contact, true>
                  multiple size="small" options={contacts}
                  value={cc} onChange={(_e, v) => setCc(v)}
                  getOptionLabel={(c) => `${c.display} <${c.email}>`}
                  isOptionEqualToValue={(a, b) => a.userId === b.userId}
                  renderInput={(p) => <TextField {...p} label="Κοιν." />}
                />
              )}
              <Autocomplete<Team, true>
                multiple size="small" options={teams}
                value={selTeams} onChange={(_e, v) => setSelTeams(v)}
                getOptionLabel={(t) => `${t.name} (${t.members.length})`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(p) => <TextField {...p} label="Ομάδες παραληπτών" />}
              />
              <TextField size="small" label="Θέμα" value={subject}
                onChange={e => setSubject(e.target.value)}
                InputProps={{ endAdornment: (
                  <Tip title="Σημαντικό (κόκκινο σήμα στον παραλήπτη)">
                    <IconButton size="small" color={important ? "error" : "default"}
                      onClick={() => setImportant(v => !v)}>
                      <PriorityHighIcon fontSize="small" />
                    </IconButton>
                  </Tip>
                ) }} />

              {/* Composer toolbar — templates / production list insert /
                  attachments / category / external email */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Button size="small" startIcon={<ArticleIcon />} variant="outlined"
                  onClick={(e) => setTplAnchor(e.currentTarget)}>
                  Πρότυπα
                </Button>
                <Button size="small" startIcon={<TableChartIcon />} variant="outlined"
                  onClick={() => setProdOpen(true)}>
                  Λίστα παραγωγής
                </Button>
                <Button size="small" startIcon={<MicIcon />} variant="outlined" color="error"
                  onClick={() => setVoiceOpen(v => !v)}>
                  Ηχητικό μήνυμα
                </Button>
                <Button size="small" startIcon={<VideocamIcon />} variant="outlined"
                  onClick={() => {
                    // Generate a short random room id, inject the invite
                    // block at the top of the body, prefill the subject.
                    const id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 12);
                    const url = `${window.location.origin}/app/ermes/meeting/${id}`;
                    const inviteBlock =
                      `<div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;padding:12px;margin-bottom:12px;font-family:Arial,sans-serif">
                        <div style="font-weight:700;color:#1d4ed8;margin-bottom:4px">📹 Πρόσκληση σε συνάντηση ΕΡΜΗΣ</div>
                        <div style="color:#334155;font-size:13px;margin-bottom:8px">
                          Voice / video κλήση εντός Kalypsis. Ανοίγει κατευθείαν στον browser.
                        </div>
                        <a href="${url}" style="display:inline-block;padding:8px 14px;background:#1d4ed8;color:#fff;
                          border-radius:6px;text-decoration:none;font-weight:700">Σύνδεση στη συνάντηση</a>
                        <div style="color:#64748b;font-size:11px;margin-top:8px">${url}</div>
                      </div>`;
                    setBodyHtml(inviteBlock + (bodyHtml || ""));
                    if (!subject) setSubject("Πρόσκληση σε συνάντηση ΕΡΜΗΣ");
                  }}>
                  Συνάντηση
                </Button>
                <Button size="small" startIcon={<AttachFileIcon />} variant="outlined" component="label"
                  disabled={uploading}>
                  {uploading ? "Ανέβασμα…" : "Επισύναψη"}
                  <input type="file" hidden multiple onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach(f => uploadFile(f));
                    e.target.value = "";
                  }} />
                </Button>
                <Button size="small" startIcon={<CategoryIcon />} variant="outlined"
                  onClick={(e) => setCatAnchor(e.currentTarget)}>
                  {catMeta ? `Κατηγορία: ${catMeta.label}` : "Κατηγορία"}
                </Button>
                {catMeta && (
                  <Chip label={catMeta.label} size="small" color={catMeta.color}
                    onDelete={() => setCategory("")} />
                )}
                <Box sx={{ flex: 1 }} />
                {signature && (
                  <FormControlLabel
                    sx={{ ml: 0 }}
                    control={<Switch size="small" checked={useSignature}
                      onChange={(_e, v) => setUseSignature(v)} />}
                    label={<Stack direction="row" alignItems="center" spacing={0.5}>
                      <DriveFileRenameOutlineIcon fontSize="small" />
                      <Typography variant="body2">Υπογραφή</Typography>
                    </Stack>} />
                )}
                {/* External email is BETA-locked to keep the platform
                    safe from bounces/spam-flagging while ΕΡΜΗΣ stabilises.
                    Switch is disabled + explains why on hover. */}
                <Tooltip title="Απενεργοποιημένο κατά την Beta φάση — τα μηνύματα παραδίδονται μόνο εντός Kalypsis, όχι σε εξωτερικό email.">
                  <span>
                    <FormControlLabel
                      sx={{ ml: 0, opacity: 0.55 }}
                      control={<Switch size="small" checked={false} disabled
                        onChange={(_e, v) => setSendExternal(v)} />}
                      label={<Stack direction="row" alignItems="center" spacing={0.5}>
                        <AlternateEmailIcon fontSize="small" />
                        <Typography variant="body2">Αποστολή και σε email (BETA)</Typography>
                      </Stack>} />
                  </span>
                </Tooltip>
              </Stack>

              {/* Voice recorder panel */}
              {voiceOpen && (
                <VoiceRecorder
                  onCancel={() => setVoiceOpen(false)}
                  onFinished={(blob, ms) => uploadVoiceBlob(blob, ms)} />
              )}

              {/* Attachment chips */}
              {attachments.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {attachments.map(a => (
                    <Chip key={a.id} icon={<AttachFileIcon />}
                      label={`${a.fileName} · ${formatBytes(a.sizeBytes)}`}
                      onDelete={() => setAttachments(prev => prev.filter(x => x.id !== a.id))} />
                  ))}
                </Stack>
              )}

              <RichTextEditor html={bodyHtml} onHtmlChange={setBodyHtml} minHeight={isFull ? 420 : 260} />
            </Stack>
          </Box>
        </Box>
  );
  const wrapper = isFull
    ? <Dialog open onClose={onClose} fullScreen>{header}{body}</Dialog>
    : <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>{header}{body}</Box>;

  return (
    <>
      {wrapper}

      {/* Template picker menu — built-in + custom user templates */}
      <Menu anchorEl={tplAnchor} open={!!tplAnchor} onClose={() => setTplAnchor(null)}>
        {TEMPLATES.map(t => (
          <MenuItem key={t.key} onClick={() => insertTemplate(t)}>{t.label}</MenuItem>
        ))}
        {customTemplates.length > 0 && <Divider />}
        {customTemplates.map(t => (
          <MenuItem key={t.key} onClick={() => insertTemplate(t)}>
            <ArticleIcon fontSize="small" sx={{ mr: 1, color: "primary.main" }} />
            {t.label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { setTplAnchor(null); setTplManagerOpen(true); }}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} />
          Διαχείριση προτύπων…
        </MenuItem>
      </Menu>

      {/* Custom-templates CRUD */}
      <TemplateManager open={tplManagerOpen} onClose={() => setTplManagerOpen(false)}
        templates={customTemplates} onChange={persistCustomTemplates} />


      {/* Category picker menu */}
      <Menu anchorEl={catAnchor} open={!!catAnchor} onClose={() => setCatAnchor(null)}>
        <MenuItem onClick={() => { setCategory(""); setCatAnchor(null); }}>— Καμία —</MenuItem>
        {CATEGORIES.map(c => (
          <MenuItem key={c.key} onClick={() => { setCategory(c.key); setCatAnchor(null); }}>
            <Chip size="small" label={c.label} color={c.color} sx={{ mr: 1 }} />
          </MenuItem>
        ))}
      </Menu>

      {/* Production-list inserter */}
      <ProductionListInsertDialog open={prodOpen} onClose={() => setProdOpen(false)}
        onInsert={(html) => { setBodyHtml(prev => (prev ? prev + "<br/>" : "") + html); setProdOpen(false); }} />
    </>
  );
}

/**
 * Small dialog that fetches /production-lists with a period + carrier +
 * producer filter and inserts a formatted HTML table into the message
 * body. Reuses the same endpoint the ProductionLists page already
 * consumes so there's a single source of truth.
 */
function ProductionListInsertDialog({
  open, onClose, onInsert,
}: {
  open: boolean; onClose: () => void; onInsert: (html: string) => void;
}) {
  const y = new Date().getFullYear();
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo]     = useState(`${y}-12-31`);
  const [carrierId, setCarrierId] = useState("");
  const [producerId, setProducerId] = useState("");

  const carriers = useQuery({
    queryKey: ["ermes-carriers"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>(
      "/insurance-companies", { params: { onlyUsed: true } })).data,
  });
  const producers = useQuery({
    queryKey: ["ermes-producers"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data,
  });

  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await api.get<{ rows: any[]; grand: any }>("/production-lists", {
        params: { from, to,
          insuranceCompanyId: carrierId || undefined,
          producerId: producerId || undefined,
          groupBy: "carrier" },
      });
      setRows(res.data.rows ?? []);
      setTotals(res.data.grand ?? null);
    } catch (e) {
      setErr(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const insert = () => {
    if (rows.length === 0) return;
    const money = (n: number) =>
      `€${(n ?? 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const escape = (s: any) => String(s ?? "").replace(/[&<>]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const head = `<thead><tr>
      <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc">Συμβόλαιο</th>
      <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc">Πελάτης</th>
      <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc">Εταιρία</th>
      <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc">Μικτό</th>
      <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #ccc">Προμ. γραφείου</th>
    </tr></thead>`;
    const body = rows.slice(0, 200).map(r => `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;font-family:monospace">${escape(r.policyNumber)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${escape(r.customerName)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${escape(r.insuranceCompany)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${money(r.gross)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${money(r.agencyCommission)}</td>
    </tr>`).join("");
    const foot = totals ? `<tfoot><tr>
      <td colspan="3" style="padding:6px 8px;font-weight:700">Σύνολο (${rows.length} συμβόλαια)</td>
      <td style="padding:6px 8px;text-align:right;font-weight:700">${money(totals.gross)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:700">${money(totals.agencyCommission)}</td>
    </tr></tfoot>` : "";
    const table = `<p><b>Λίστα παραγωγής</b> (${from} → ${to})</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">${head}<tbody>${body}</tbody>${foot}</table>`;
    onInsert(table);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Εισαγωγή λίστας παραγωγής</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={1.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} fullWidth
              value={from} onChange={e => setFrom(e.target.value)} />
            <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} fullWidth
              value={to} onChange={e => setTo(e.target.value)} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField select size="small" label="Ασφαλιστική" fullWidth
              value={carrierId} onChange={e => setCarrierId(e.target.value)}>
              <MenuItem value="">Όλες</MenuItem>
              {(carriers.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Συνεργάτης" fullWidth
              value={producerId} onChange={e => setProducerId(e.target.value)}>
              <MenuItem value="">Όλοι</MenuItem>
              {(producers.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" onClick={fetchData} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : "Ανάκτηση"}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {rows.length > 0 ? `${rows.length} εγγραφές — μέγιστο 200 στην εισαγωγή.` : "Πατήστε «Ανάκτηση» για δείγμα."}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={insert} disabled={rows.length === 0}>Εισαγωγή στο μήνυμα</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Manage dialog (teams + blocks) ─────────────────────────────────

function ManageDialog({
  kind, onClose, contacts, teams, onCompose,
}: {
  kind: "teams" | "blocks" | "contacts" | "automations" | null; onClose: () => void;
  contacts: Contact[]; teams: Team[];
  onCompose?: (c: Contact) => void;
}) {
  const qc = useQueryClient();
  const [addTeamName, setAddTeamName] = useState("");
  const [addTeamMembers, setAddTeamMembers] = useState<Contact[]>([]);
  const [addBlockUser, setAddBlockUser] = useState<Contact | null>(null);
  const [addBlockReason, setAddBlockReason] = useState("");
  const [contactsSearch, setContactsSearch] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Contact[]>([]);
  // Favourite contacts — pure client-side (localStorage), keeps the
  // starred contacts pinned to the top of the Contacts view.
  const favKey = "kalypsis.ermes.favContacts.v1";
  const [favs, setFavs] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(window.localStorage.getItem(favKey) ?? "[]")); } catch { return new Set(); }
  });
  const toggleFav = (id: string) => {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { window.localStorage.setItem(favKey, JSON.stringify(Array.from(next))); } catch { /* quota */ }
      return next;
    });
  };

  const blocks = useQuery({
    queryKey: ["ermes", "blocks"],
    enabled: kind === "blocks",
    queryFn: async () => (await api.get<BlockDto[]>("/ermes/blocks")).data,
  });

  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; id: string; kind: "team" | "block" } | null>(null);

  const createTeam = useMutation({
    mutationFn: async () => api.post("/ermes/teams", {
      name: addTeamName, description: null,
      memberUserIds: addTeamMembers.map(c => c.userId),
    }),
    onSuccess: () => {
      setAddTeamName(""); setAddTeamMembers([]);
      void qc.invalidateQueries({ queryKey: ["ermes"] });
    },
  });
  const deleteTeam = useMutation({
    mutationFn: async (id: string) => api.delete(`/ermes/teams/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ermes"] }),
  });
  const addBlock = useMutation({
    mutationFn: async () => api.post("/ermes/blocks", {
      blockedUserId: addBlockUser!.userId, reason: addBlockReason.trim() || null,
    }),
    onSuccess: () => {
      setAddBlockUser(null); setAddBlockReason("");
      void qc.invalidateQueries({ queryKey: ["ermes"] });
    },
  });
  const removeBlock = useMutation({
    mutationFn: async (id: string) => api.delete(`/ermes/blocks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ermes"] }),
  });
  const editTeamMembers = useMutation({
    // Recreates the team with the new member list — cheap because a team
    // is essentially just name + members, and this saves us needing an
    // extra add/remove endpoint pair on the backend.
    mutationFn: async (v: { teamId: string; name: string; members: Contact[] }) => {
      await api.delete(`/ermes/teams/${v.teamId}`);
      return api.post("/ermes/teams", {
        name: v.name, description: null,
        memberUserIds: v.members.map(c => c.userId),
      });
    },
    onSuccess: () => { setExpandedTeam(null); void qc.invalidateQueries({ queryKey: ["ermes"] }); },
  });

  return (
    <Dialog open={!!kind} onClose={onClose} fullWidth maxWidth={kind === "contacts" ? "md" : "sm"}>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {kind === "teams" ? "Ομάδες παραληπτών"
          : kind === "contacts" ? "Επαφές γραφείου"
          : kind === "automations" ? "Αυτοματισμοί ΕΡΜΗΣ"
          : "Ανεπιθύμητοι αποστολείς"}
      </DialogTitle>
      <DialogContent>
        {kind === "contacts" ? (
          <ContactsView contacts={contacts} search={contactsSearch}
            onSearch={setContactsSearch} favs={favs} onToggleFav={toggleFav}
            onCompose={(c) => { onCompose?.(c); onClose(); }} />
        ) : kind === "automations" ? (
          <AutomationsView contacts={contacts} teams={teams} />
        ) : kind === "teams" ? (
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" fontWeight={700} mb={1}>Νέα ομάδα</Typography>
              <Stack spacing={1.5}>
                <TextField size="small" label="Όνομα ομάδας" value={addTeamName}
                  onChange={e => setAddTeamName(e.target.value)} fullWidth />
                <Autocomplete<Contact, true>
                  multiple size="small" options={contacts}
                  value={addTeamMembers} onChange={(_e, v) => setAddTeamMembers(v)}
                  getOptionLabel={(c) => `${c.display} <${c.email}>`}
                  isOptionEqualToValue={(a, b) => a.userId === b.userId}
                  renderInput={(p) => <TextField {...p} label="Μέλη" />}
                />
                <Button variant="contained" startIcon={<AddIcon />} disabled={!addTeamName.trim() || createTeam.isPending}
                  onClick={() => createTeam.mutate()}>Δημιουργία</Button>
              </Stack>
            </Card>
            <List dense>
              {teams.map(t => (
                <Box key={t.id}>
                  <ListItem
                    secondaryAction={
                      <Stack direction="row">
                        <Tip title="Προεπισκόπηση / Επεξεργασία μελών">
                          <IconButton onClick={() => {
                            const opening = expandedTeam !== t.id;
                            setExpandedTeam(opening ? t.id : null);
                            if (opening) setTeamMembers([...t.members]);
                          }}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tip>
                        <IconButton onClick={(e) => setMenuFor({ el: e.currentTarget, id: t.id, kind: "team" })}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }>
                    <ListItemAvatar><Avatar><GroupsIcon /></Avatar></ListItemAvatar>
                    <ListItemText primary={t.name}
                      secondary={`${t.members.length} μέλη — ${t.members.slice(0, 3).map(m => m.display).join(", ")}${t.members.length > 3 ? "…" : ""}`} />
                  </ListItem>
                  {expandedTeam === t.id && (
                    <Card variant="outlined" sx={{ mx: 2, mb: 1, p: 2, bgcolor: "action.hover" }}>
                      <Typography variant="caption" color="text.secondary" mb={1} display="block">
                        Επεξεργασία μελών ομάδας «{t.name}»
                      </Typography>
                      <Stack spacing={1.5}>
                        <Autocomplete<Contact, true>
                          multiple size="small" options={contacts}
                          value={teamMembers} onChange={(_e, v) => setTeamMembers(v)}
                          getOptionLabel={(c) => `${c.display} <${c.email}>`}
                          isOptionEqualToValue={(a, b) => a.userId === b.userId}
                          renderInput={(p) => <TextField {...p} label="Μέλη" />}
                        />
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" onClick={() => setExpandedTeam(null)}>Άκυρο</Button>
                          <Button size="small" variant="contained" disabled={editTeamMembers.isPending}
                            onClick={() => editTeamMembers.mutate({ teamId: t.id, name: t.name, members: teamMembers })}>
                            Αποθήκευση
                          </Button>
                        </Stack>
                      </Stack>
                    </Card>
                  )}
                </Box>
              ))}
              {teams.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>Καμία ομάδα ακόμη.</Typography>}
            </List>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" fontWeight={700} mb={1}>Προσθήκη μπλοκ</Typography>
              <Stack spacing={1.5}>
                <Autocomplete<Contact, false>
                  size="small" options={contacts}
                  value={addBlockUser} onChange={(_e, v) => setAddBlockUser(v)}
                  getOptionLabel={(c) => `${c.display} <${c.email}>`}
                  isOptionEqualToValue={(a, b) => a.userId === b.userId}
                  renderInput={(p) => <TextField {...p} label="Χρήστης" />}
                />
                <TextField size="small" label="Αιτία (προαιρετικά)"
                  value={addBlockReason} onChange={e => setAddBlockReason(e.target.value)} fullWidth />
                <Button variant="contained" color="error" startIcon={<BlockIcon />}
                  disabled={!addBlockUser || addBlock.isPending} onClick={() => addBlock.mutate()}>
                  Μπλοκάρισμα
                </Button>
              </Stack>
            </Card>
            <List dense>
              {(blocks.data ?? []).map(b => (
                <ListItem key={b.id} secondaryAction={
                  <IconButton onClick={() => removeBlock.mutate(b.id)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }>
                  <ListItemAvatar><Avatar sx={{ bgcolor: "error.main" }}><BlockIcon /></Avatar></ListItemAvatar>
                  <ListItemText primary={b.blockedDisplay} secondary={b.reason ?? b.blockedEmail} />
                </ListItem>
              ))}
              {(blocks.data ?? []).length === 0 && <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>Κανένας αποστολέας δεν είναι μπλοκαρισμένος.</Typography>}
            </List>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Κλείσιμο</Button>
      </DialogActions>
      <Menu open={!!menuFor} anchorEl={menuFor?.el} onClose={() => setMenuFor(null)}>
        <MenuItem onClick={() => { if (menuFor) deleteTeam.mutate(menuFor.id); setMenuFor(null); }}>Διαγραφή</MenuItem>
      </Menu>
    </Dialog>
  );
}

// ─── Contacts view (inside ManageDialog) ─────────────────────────────

function ContactsView({
  contacts, search, onSearch, favs, onToggleFav, onCompose,
}: {
  contacts: Contact[]; search: string; onSearch: (s: string) => void;
  favs: Set<string>; onToggleFav: (id: string) => void;
  onCompose: (c: Contact) => void;
}) {
  const filtered = contacts.filter(c => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return `${c.display} ${c.email} ${c.role}`.toLowerCase().includes(s);
  });
  // Pin favourites to the top.
  const sorted = filtered.slice().sort((a, b) => {
    const fa = favs.has(a.userId) ? 0 : 1;
    const fb = favs.has(b.userId) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.display.localeCompare(b.display, "el");
  });
  return (
    <Stack spacing={2}>
      <TextField size="small" fullWidth
        placeholder="Αναζήτηση σε όνομα, email ή ρόλο…"
        value={search} onChange={e => onSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      <Typography variant="caption" color="text.secondary">
        {sorted.length} επαφές — αστέρι για γρήγορη πρόσβαση, κλικ στο «Μήνυμα» για compose.
      </Typography>
      <List dense sx={{ maxHeight: 480, overflowY: "auto" }}>
        {sorted.map(c => (
          <ListItem key={c.userId} secondaryAction={
            <Stack direction="row" spacing={0.5}>
              <Tip title={favs.has(c.userId) ? "Αφαίρεση από αγαπημένα" : "Προσθήκη στα αγαπημένα"}>
                <IconButton size="small" onClick={() => onToggleFav(c.userId)}>
                  {favs.has(c.userId) ? <StarIcon fontSize="small" sx={{ color: "warning.main" }} /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </Tip>
              <Button size="small" variant="outlined" startIcon={<CreateIcon />}
                onClick={() => onCompose(c)}>Μήνυμα</Button>
            </Stack>
          }>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: "primary.main" }}>
                {c.display.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase() || "?"}
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={c.display}
              secondary={<>
                {c.email}
                {c.role && <Chip size="small" label={c.role} sx={{ ml: 1, height: 16, fontSize: 10 }} />}
              </>} />
          </ListItem>
        ))}
        {sorted.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
            Δεν υπάρχουν επαφές που να ταιριάζουν.
          </Typography>
        )}
      </List>
    </Stack>
  );
}

// ─── Automations view (client-only stub while backend cron ships) ────

interface AutomationRule {
  id: string;
  name: string;
  kind: "MonthlyProductionList" | "WeeklySummary" | "Custom";
  schedule: string;
  recipientIds: string[];
  teamIds: string[];
  category: string;
  sendExternalEmail: boolean;
  enabled: boolean;
  createdAt: string;
}

function AutomationsView({ contacts, teams }: { contacts: Contact[]; teams: Team[] }) {
  const key = "kalypsis.ermes.automations.v1";
  const [rules, setRules] = useState<AutomationRule[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(key) ?? "[]"); } catch { return []; }
  });
  const persist = (next: AutomationRule[]) => {
    setRules(next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota */ }
  };
  const [addOpen, setAddOpen] = useState(false);
  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<ConstructionIcon />}>
        Ρυθμίστε αυτόματες αποστολές — π.χ. μηνιαία λίστα παραγωγής στους συνεργάτες.
        Ο scheduler θα ενεργοποιηθεί μαζί με το επίσημο release του ΕΡΜΗΣ (Beta:
        οι κανόνες αποθηκεύονται τοπικά ώστε να είναι έτοιμοι όταν σηκωθεί ο cron).
      </Alert>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ alignSelf: "flex-start" }}>
        Νέος αυτοματισμός
      </Button>
      <List dense>
        {rules.map(r => (
          <ListItem key={r.id} secondaryAction={
            <Stack direction="row" spacing={0.5}>
              <FormControlLabel
                control={<Switch size="small" checked={r.enabled}
                  onChange={(_e, v) => persist(rules.map(x => x.id === r.id ? { ...x, enabled: v } : x))} />}
                label="" sx={{ ml: 0 }} />
              <IconButton onClick={() => persist(rules.filter(x => x.id !== r.id))}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          }>
            <ListItemAvatar><Avatar sx={{ bgcolor: r.enabled ? "success.main" : "grey.500" }}>
              <ConstructionIcon />
            </Avatar></ListItemAvatar>
            <ListItemText primary={r.name}
              secondary={`${AUTOMATION_KIND_LABEL[r.kind]} · ${r.schedule}${r.sendExternalEmail ? " · email nudge" : ""}`} />
          </ListItem>
        ))}
        {rules.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
            Δεν έχετε ορίσει αυτοματισμούς ακόμη.
          </Typography>
        )}
      </List>
      <AutomationEditor open={addOpen} onClose={() => setAddOpen(false)}
        contacts={contacts} teams={teams}
        onSave={(rule) => { persist([...rules, rule]); setAddOpen(false); }} />
    </Stack>
  );
}

const AUTOMATION_KIND_LABEL: Record<AutomationRule["kind"], string> = {
  MonthlyProductionList: "Μηνιαία λίστα παραγωγής",
  WeeklySummary: "Εβδομαδιαία σύνοψη",
  Custom: "Προσαρμοσμένο",
};

function AutomationEditor({
  open, onClose, contacts, teams, onSave,
}: {
  open: boolean; onClose: () => void;
  contacts: Contact[]; teams: Team[];
  onSave: (rule: AutomationRule) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AutomationRule["kind"]>("MonthlyProductionList");
  const [schedule, setSchedule] = useState("Τέλος κάθε μήνα");
  const [recipients, setRecipients] = useState<Contact[]>([]);
  const [selTeams, setSelTeams] = useState<Team[]>([]);
  const [category, setCategory] = useState<string>("Production");
  const [sendExt, setSendExt] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(""); setKind("MonthlyProductionList"); setSchedule("Τέλος κάθε μήνα");
    setRecipients([]); setSelTeams([]); setCategory("Production"); setSendExt(false);
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Νέος αυτοματισμός</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField size="small" label="Όνομα" value={name} onChange={e => setName(e.target.value)} fullWidth
            placeholder="π.χ. Μηνιαία παραγωγή προς συνεργάτες" />
          <TextField select size="small" label="Τύπος" value={kind} fullWidth
            onChange={e => setKind(e.target.value as AutomationRule["kind"])}>
            {(Object.keys(AUTOMATION_KIND_LABEL) as AutomationRule["kind"][]).map(k =>
              <MenuItem key={k} value={k}>{AUTOMATION_KIND_LABEL[k]}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Πρόγραμμα" value={schedule} fullWidth
            onChange={e => setSchedule(e.target.value)}>
            {["Τέλος κάθε μήνα", "Αρχή κάθε μήνα", "Κάθε Δευτέρα", "Κάθε Παρασκευή", "Κάθε 1η ημέρα εργασίας"]
              .map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <Autocomplete<Contact, true>
            multiple size="small" options={contacts}
            value={recipients} onChange={(_e, v) => setRecipients(v)}
            getOptionLabel={(c) => `${c.display} <${c.email}>`}
            isOptionEqualToValue={(a, b) => a.userId === b.userId}
            renderInput={(p) => <TextField {...p} label="Παραλήπτες" />}
          />
          <Autocomplete<Team, true>
            multiple size="small" options={teams}
            value={selTeams} onChange={(_e, v) => setSelTeams(v)}
            getOptionLabel={(t) => `${t.name} (${t.members.length})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(p) => <TextField {...p} label="Ομάδες παραληπτών" />}
          />
          <TextField select size="small" label="Κατηγορία" value={category} fullWidth
            onChange={e => setCategory(e.target.value)}>
            <MenuItem value="">— Καμία —</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
          </TextField>
          <FormControlLabel
            control={<Switch checked={sendExt} onChange={(_e, v) => setSendExt(v)} />}
            label="Παράλληλη αποστολή σε email" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={!name.trim() || (recipients.length === 0 && selTeams.length === 0)}
          onClick={() => onSave({
            id: crypto.randomUUID?.() ?? `a-${Date.now()}`,
            name: name.trim(), kind, schedule,
            recipientIds: recipients.map(r => r.userId),
            teamIds: selTeams.map(t => t.id),
            category, sendExternalEmail: sendExt, enabled: true,
            createdAt: new Date().toISOString(),
          })}>
          Αποθήκευση
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Signature editor + shortcuts sheet ──────────────────────────────

function SignatureEditor({ open, html, onClose, onSave }: {
  open: boolean; html: string; onClose: () => void; onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(html);
  useEffect(() => { if (open) setDraft(html); }, [open, html]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Υπογραφή</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" mb={1} display="block">
          Η υπογραφή προστίθεται αυτόματα κάτω από κάθε μήνυμα όταν πατήσετε
          το «Προσθήκη υπογραφής» στη μπάρα του composer.
        </Typography>
        <RichTextEditor html={draft} onHtmlChange={setDraft} minHeight={220}
          placeholder="π.χ. Με εκτίμηση, — {όνομα} — τηλ. …" />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onSave("")} color="error">Καθαρισμός</Button>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => { onSave(draft); onClose(); }}>Αποθήκευση</Button>
      </DialogActions>
    </Dialog>
  );
}

function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows = [
    ["c", "Νέο μήνυμα"],
    ["/", "Εστίαση στην αναζήτηση"],
    ["Esc", "Κλείσιμο ανοιχτής συνομιλίας"],
    ["?", "Άνοιγμα αυτής της βοήθειας"],
  ];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>Συντομεύσεις πληκτρολογίου</DialogTitle>
      <DialogContent>
        <List dense>
          {rows.map(([k, l]) => (
            <ListItem key={k} secondaryAction={<Typography variant="body2">{l}</Typography>}>
              <Chip label={k} size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">Κλείσιμο</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Custom template manager (CRUD) ──────────────────────────────────

function TemplateManager({ open, onClose, templates, onChange }: {
  open: boolean; onClose: () => void;
  templates: Template[]; onChange: (t: Template[]) => void;
}) {
  const [editing, setEditing] = useState<Template | null>(null);
  const [draft, setDraft] = useState<Template>({ key: "", label: "", subject: "", bodyHtml: "" });
  const startNew = () => {
    const t: Template = {
      key: crypto.randomUUID?.() ?? `t-${Date.now()}`,
      label: "", subject: "", bodyHtml: "",
    };
    setEditing(t); setDraft(t);
  };
  const startEdit = (t: Template) => { setEditing(t); setDraft({ ...t }); };
  const save = () => {
    if (!draft.label.trim()) return;
    const exists = templates.some(t => t.key === draft.key);
    onChange(exists ? templates.map(t => t.key === draft.key ? draft : t) : [...templates, draft]);
    setEditing(null);
  };
  const remove = (key: string) => onChange(templates.filter(t => t.key !== key));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Διαχείριση προτύπων μηνυμάτων</DialogTitle>
      <DialogContent>
        {editing ? (
          <Stack spacing={2} mt={1}>
            <Typography variant="caption" color="text.secondary">
              Χρησιμοποιήστε <code>{"{{month}}"}</code> και <code>{"{{me}}"}</code> για αυτόματη
              αντικατάσταση με τον τρέχοντα μήνα και το όνομά σας.
            </Typography>
            <TextField size="small" label="Όνομα προτύπου" value={draft.label}
              onChange={e => setDraft({ ...draft, label: e.target.value })} fullWidth />
            <TextField size="small" label="Θέμα" value={draft.subject}
              onChange={e => setDraft({ ...draft, subject: e.target.value })} fullWidth />
            <RichTextEditor html={draft.bodyHtml}
              onHtmlChange={(v) => setDraft({ ...draft, bodyHtml: v })} minHeight={220}
              placeholder="Σώμα προτύπου…" />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setEditing(null)}>Άκυρο</Button>
              <Button variant="contained" onClick={save} disabled={!draft.label.trim()}>Αποθήκευση</Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={startNew} sx={{ alignSelf: "flex-start" }}>
              Νέο πρότυπο
            </Button>
            <List dense>
              {templates.map(t => (
                <ListItem key={t.key} secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => startEdit(t)}>Επεξεργασία</Button>
                    <IconButton color="error" onClick={() => remove(t.key)}><CloseIcon fontSize="small" /></IconButton>
                  </Stack>
                }>
                  <ListItemAvatar><Avatar><ArticleIcon /></Avatar></ListItemAvatar>
                  <ListItemText primary={t.label} secondary={t.subject || "(χωρίς θέμα)"} />
                </ListItem>
              ))}
              {templates.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                  Δεν έχετε προσαρμοσμένα πρότυπα. Πατήστε «Νέο πρότυπο» για να ξεκινήσετε.
                </Typography>
              )}
            </List>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Κλείσιμο</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Welcome pane (right column when nothing selected) ───────────────

function WelcomePane({
  onCompose, onOpenContacts, onOpenAutomations, onOpenTeams,
  counts, contacts, onQuickCompose,
}: {
  onCompose: () => void;
  onOpenContacts: () => void;
  onOpenAutomations: () => void;
  onOpenTeams: () => void;
  counts: Record<string, FolderCount>;
  contacts: Contact[];
  onQuickCompose: (c: Contact) => void;
}) {
  // Reuse the favourites list as "quick contacts" so the pane feels
  // personalised even before the operator has any conversation history.
  const favKey = "kalypsis.ermes.favContacts.v1";
  const favIds = (() => {
    try { return new Set<string>(JSON.parse(window.localStorage.getItem(favKey) ?? "[]")); }
    catch { return new Set<string>(); }
  })();
  const favouriteContacts = contacts.filter(c => favIds.has(c.userId)).slice(0, 8);

  return (
    <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <Avatar sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
            <MailOutlineIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800}>Καλωσόρισες στο σύστημα ΕΡΜΗΣ</Typography>
            <Typography variant="body2" color="text.secondary">
              Επιλέξτε μήνυμα από τη λίστα ή ξεκινήστε νέο.
            </Typography>
          </Box>
        </Stack>

        {/* Quick stats */}
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(4, 1fr)", mb: 3 }}>
          {(["Inbox", "Sent", "Drafts", "Starred"] as const).map(k => {
            const c = counts[k];
            const label = FOLDERS.find(f => f.key === k)?.label ?? k;
            return (
              <Card key={k} variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                <Typography variant="h5" fontWeight={800}>{c?.total ?? 0}</Typography>
                {(c?.unread ?? 0) > 0 && (
                  <Chip size="small" color="primary" label={`${c!.unread} νέα`}
                    sx={{ height: 18, fontSize: 10 }} />
                )}
              </Card>
            );
          })}
        </Box>

        {/* Quick actions */}
        <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="overline" color="text.secondary" display="block" mb={1}>
            Γρήγορες ενέργειες
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" startIcon={<CreateIcon />} onClick={onCompose}>
              Νέο μήνυμα
            </Button>
            <Button variant="outlined" startIcon={<ContactsIcon />} onClick={onOpenContacts}>
              Επαφές γραφείου
            </Button>
            <Button variant="outlined" startIcon={<GroupsIcon />} onClick={onOpenTeams}>
              Ομάδες
            </Button>
            <Button variant="outlined" startIcon={<ConstructionIcon />} onClick={onOpenAutomations}>
              Αυτοματισμοί
            </Button>
            <Button variant="outlined" color="secondary" startIcon={<VideocamIcon />}
              onClick={() => {
                const id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}`).slice(0, 12);
                window.open(`/app/ermes/meeting/${id}`, "_blank");
              }}>
              Έναρξη συνάντησης
            </Button>
          </Stack>
        </Card>

        {/* Favourite contacts */}
        <Card variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" mb={1}>
            <StarIcon fontSize="small" sx={{ mr: 0.5, color: "warning.main" }} />
            <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
              Αγαπημένες επαφές
            </Typography>
            <Button size="small" onClick={onOpenContacts}>Όλες</Button>
          </Stack>
          {favouriteContacts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Ανοίξτε τις «Επαφές» και προσθέστε αστέρι στους ανθρώπους που επικοινωνείτε συχνά — θα εμφανίζονται εδώ.
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {favouriteContacts.map(c => (
                <Card key={c.userId} variant="outlined" sx={{ p: 1, cursor: "pointer",
                  "&:hover": { borderColor: "primary.main", boxShadow: 1 } }}
                  onClick={() => onQuickCompose(c)}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32, fontSize: 12 }}>
                      {c.display.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase() || "?"}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{c.display}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>{c.email}</Typography>
                    </Box>
                  </Stack>
                </Card>
              ))}
            </Box>
          )}
        </Card>
      </Box>
    </Box>
  );
}

// ─── Channel view (Discord-style shared feed per team) ──────────────

function ChannelDialog({ team, onClose, meDisplay }: {
  team: Team | null; onClose: () => void; meDisplay: string;
}) {
  const qc = useQueryClient();
  const [postHtml, setPostHtml] = useState("");
  const feed = useQuery({
    queryKey: ["ermes", "channel", team?.id],
    enabled: !!team,
    refetchInterval: 15_000,
    queryFn: async () => (await api.get<ErmesMessageDto[]>(`/ermes/channels/${team!.id}/messages`)).data,
  });
  useEffect(() => { if (team) setPostHtml(""); }, [team?.id]);

  const post = useMutation({
    mutationFn: async () => api.post("/ermes/messages", {
      subject: `#${team!.name}`,
      bodyHtml: postHtml,
      recipients: [],
      teamIds: [team!.id],
      channelId: team!.id,
      inReplyToMessageId: null,
      isImportant: false,
      saveAsDraft: false,
      sendExternalEmail: false,
      attachmentIds: [],
    }),
    onSuccess: () => {
      setPostHtml("");
      void qc.invalidateQueries({ queryKey: ["ermes", "channel", team?.id] });
      void qc.invalidateQueries({ queryKey: ["ermes"] });
    },
  });

  if (!team) return null;

  // Chronological reading order — oldest first, newest at the bottom.
  const ordered = (feed.data ?? []).slice().reverse();

  return (
    <Dialog open onClose={onClose} fullScreen>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider",
        display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title="Πίσω">
          <IconButton onClick={onClose}><ArrowBackIcon /></IconButton>
        </Tooltip>
        <TagIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={800}>{team.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            Κανάλι · {team.members.length} μέλη · {team.members.map(m => m.display).join(", ") || "χωρίς μέλη"}
          </Typography>
        </Box>
        <Chip size="small" color="warning" variant="filled"
          icon={<ConstructionIcon sx={{ fontSize: 14 }} />}
          label="BETA" sx={{ fontWeight: 700 }} />
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 2, md: 4 }, py: 2, bgcolor: "background.default" }}>
        <Box sx={{ maxWidth: 900, mx: "auto" }}>
          {feed.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : ordered.length === 0 ? (
            <Alert severity="info">
              Καμία δημοσίευση ακόμη σε αυτό το κανάλι. Πληκτρολογήστε παρακάτω για να ξεκινήσετε.
            </Alert>
          ) : ordered.map((m) => (
            <Box key={m.id} sx={{ mb: 2, pb: 2, borderBottom: 1, borderColor: "divider" }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start" mb={0.5}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 12 }}>
                  {m.senderDisplay.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase() || "?"}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={800}>{m.senderDisplay}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(m.sentAt ?? m.createdAt).toLocaleString("el-GR", { hour12: false, hourCycle: "h23", timeZone: "Europe/Athens" })}
                    </Typography>
                  </Stack>
                  <Box sx={{ mt: 0.5, "& p": { my: 0.5 }, fontSize: 14, lineHeight: 1.55 }}
                    dangerouslySetInnerHTML={{ __html: m.bodyHtml || "" }} />
                  {m.attachments?.length > 0 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={1}>
                      {m.attachments.map(a => (
                        <Chip key={a.id} size="small" icon={<AttachFileIcon />}
                          label={a.fileName}
                          onClick={async () => {
                            const res = await api.get<Blob>(`/ermes/attachments/${a.id}`, { responseType: "blob" });
                            const url = window.URL.createObjectURL(res.data);
                            const el = document.createElement("a");
                            el.href = url; el.download = a.fileName; el.click();
                            window.URL.revokeObjectURL(url);
                          }}
                          sx={{ cursor: "pointer" }} />
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Box sx={{ maxWidth: 900, mx: "auto" }}>
          <RichTextEditor html={postHtml} onHtmlChange={setPostHtml}
            minHeight={120} placeholder={`Μήνυμα στο #${team.name} — φαίνεται σε όλα τα μέλη`} />
          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={1}>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, alignSelf: "center" }}>
              Ο {meDisplay || "χρήστης"} δημοσιεύει στο #{team.name}
            </Typography>
            <Button variant="contained" startIcon={<SendIcon />}
              disabled={post.isPending || !postHtml.replace(/<[^>]+>/g, "").trim()}
              onClick={() => post.mutate()}>
              Δημοσίευση
            </Button>
          </Stack>
        </Box>
      </Box>
    </Dialog>
  );
}
