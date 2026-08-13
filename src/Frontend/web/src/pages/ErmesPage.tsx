import { useEffect, useState } from "react";
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
    ? d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit" });
};

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
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ msg: ErmesMessageDto; mode: "reply" | "replyAll" | "forward" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState<null | "teams" | "blocks">(null);
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

  const openMessage = (m: ErmesMessageDto) => {
    if (m.isDraft) {
      // Editing a draft — pop the composer with the draft prefilled.
      setReplyTo({ msg: m, mode: "reply" }); // reused as "prefill body/recipients"
      setComposeOpen(true);
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
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", gap: 1 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <MailOutlineIcon color="primary" sx={{ fontSize: 32 }} />
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h5" fontWeight={800}>ΕΡΜΗΣ — Επικοινωνία</Typography>
            <Chip
              size="small" color="warning" variant="filled"
              icon={<ConstructionIcon sx={{ fontSize: 14 }} />}
              label="BETA · Δωρεάν εφ'όρου ζωής για τους early users"
              onClick={() => setBetaOpen(true)}
              sx={{ fontWeight: 700, cursor: "pointer" }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Kalypsis-native, end-to-end εντός της πλατφόρμας. Χωρίς spam, χωρίς Outlook.
          </Typography>
        </Box>
        <Button variant="contained" size="large" startIcon={<CreateIcon />}
          onClick={() => { setReplyTo(null); setComposeOpen(true); }}>
          Νέο μήνυμα
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: "240px 380px 1fr", gap: 1.5, flex: 1, minHeight: 0 }}>
        {/* ── Left rail: folders + teams + blocks ─────────────────── */}
        <Card variant="outlined" sx={{ overflowY: "auto", p: 0 }}>
          <List dense disablePadding>
            {FOLDERS.map(f => {
              const c = counts[f.key];
              const active = folder === f.key;
              return (
                <ListItemButton key={f.key} selected={active} onClick={() => setFolder(f.key)}
                  sx={{ py: 0.75 }}>
                  <Box sx={{ mr: 1, color: active ? "primary.main" : "text.secondary" }}>{f.icon}</Box>
                  <ListItemText
                    primary={f.label}
                    primaryTypographyProps={{ fontWeight: active ? 800 : 500 }}
                  />
                  {c && (c.unread > 0
                    ? <Chip label={c.unread} size="small" color="primary" sx={{ height: 20 }} />
                    : c.total > 0 && <Typography variant="caption" color="text.secondary">{c.total}</Typography>)}
                </ListItemButton>
              );
            })}
          </List>
          <Divider />
          <Box sx={{ px: 1.5, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="overline" color="text.secondary">Ομάδες</Typography>
            <IconButton size="small" onClick={() => setManageOpen("teams")}><AddIcon fontSize="small" /></IconButton>
          </Box>
          <List dense disablePadding>
            {(overview.data?.teams ?? []).map(t => (
              <ListItemButton key={t.id} sx={{ py: 0.5 }}>
                <GroupsIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
                <ListItemText primary={t.name} secondary={`${t.members.length} μέλη`}
                  primaryTypographyProps={{ variant: "body2" }} />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <Box sx={{ px: 1.5, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="overline" color="text.secondary">Ρυθμίσεις</Typography>
          </Box>
          <ListItemButton onClick={() => setManageOpen("blocks")} sx={{ py: 0.75 }}>
            <BlockIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
            <ListItemText primary="Ανεπιθύμητοι / Μπλοκ" primaryTypographyProps={{ variant: "body2" }} />
          </ListItemButton>
        </Card>

        {/* ── Middle: message list ───────────────────────────────── */}
        <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
            <TextField size="small" fullWidth placeholder="Αναζήτηση σε θέμα, αποστολέα, περιεχόμενο…"
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          </Box>
          <Box sx={{ px: 1, py: 0.75, borderBottom: 1, borderColor: "divider",
            display: "flex", alignItems: "center", gap: 0.5 }}>
            <Checkbox size="small"
              checked={(list.data?.length ?? 0) > 0 && selected.size === (list.data?.length ?? 0)}
              indeterminate={selected.size > 0 && selected.size < (list.data?.length ?? 0)}
              onChange={toggleAll} />
            {selected.size === 0 ? (
              <Typography variant="caption" color="text.secondary">{(list.data ?? []).length} μηνύματα</Typography>
            ) : (
              <BulkBar folder={folder} disabled={bulk.isPending}
                onAction={(a) => bulk.mutate({ action: a, ids: Array.from(selected) })} />
            )}
          </Box>
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {list.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} /></Box>
            ) : (list.data ?? []).length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
                Καμία εγγραφή σε αυτόν τον φάκελο.
              </Box>
            ) : (list.data ?? []).map(m => (
              <MessageRow key={m.id} msg={m} selected={selected.has(m.id)}
                active={openThreadId === m.threadId}
                onToggle={() => toggleOne(m.id)}
                onOpen={() => openMessage(m)}
                onStar={() => bulk.mutate({ action: m.isStarred ? "Unstar" : "Star", ids: [m.id] })} />
            ))}
          </Box>
        </Card>

        {/* ── Right: reader ───────────────────────────────────────── */}
        <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!openThreadId ? (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", color: "text.secondary", gap: 1 }}>
              <MailOutlineIcon sx={{ fontSize: 56, opacity: 0.35 }} />
              <Typography variant="body2">Επιλέξτε μήνυμα για να διαβάσετε τη συνομιλία.</Typography>
            </Box>
          ) : thread.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : (
            <ThreadReader
              messages={thread.data ?? []}
              myId={myId ?? ""}
              onClose={() => setOpenThreadId(null)}
              onReply={(m, mode) => { setReplyTo({ msg: m, mode }); setComposeOpen(true); }}
              onDelete={(id) => bulk.mutate({ action: "Delete", ids: [id] })}
              onMoveSpam={(id) => bulk.mutate({ action: "MoveSpam", ids: [id] })}
              onArchive={(id) => bulk.mutate({ action: "MoveArchive", ids: [id] })}
              onRestore={(id) => bulk.mutate({ action: "Restore", ids: [id] })}
              onBlockSender={(uid) => api.post("/ermes/blocks", { blockedUserId: uid })
                .then(() => qc.invalidateQueries({ queryKey: ["ermes"] }))
                .catch(e => setError(extractErrorMessage(e)))}
            />
          )}
        </Card>
      </Box>

      {/* Composer dialog */}
      <ComposeDialog
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setReplyTo(null); }}
        contacts={overview.data?.contacts ?? []}
        teams={overview.data?.teams ?? []}
        reply={replyTo}
        meDisplay={((user?.firstName ?? "") + " " + (user?.lastName ?? "")).trim()}
        onSent={() => {
          setComposeOpen(false); setReplyTo(null);
          void qc.invalidateQueries({ queryKey: ["ermes"] });
        }} />

      {/* Manage teams / blocks */}
      <ManageDialog kind={manageOpen} onClose={() => setManageOpen(null)}
        contacts={overview.data?.contacts ?? []} teams={overview.data?.teams ?? []} />

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
  return (
    <Box onClick={onOpen}
      sx={{
        display: "flex", alignItems: "center", gap: 1,
        px: 1, py: 1.25, cursor: "pointer",
        borderLeft: 3, borderColor: active ? "primary.main" : "transparent",
        bgcolor: active ? "action.selected" : msg.isRead ? "transparent" : "rgba(30,167,225,0.06)",
        "&:hover": { bgcolor: "action.hover" },
        borderBottom: 1, borderBottomColor: "divider",
      }}>
      <Checkbox size="small" checked={selected}
        onClick={(e) => { e.stopPropagation(); onToggle(); }} />
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onStar(); }}>
        {msg.isStarred ? <StarIcon fontSize="small" sx={{ color: "warning.main" }} />
          : <StarBorderIcon fontSize="small" />}
      </IconButton>
      <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: "primary.main" }}>{initials || "?"}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" fontWeight={msg.isRead ? 500 : 800} noWrap sx={{ flex: 1 }}>
            {msg.senderDisplay}
          </Typography>
          {msg.isImportant && <PriorityHighIcon fontSize="small" sx={{ color: "error.main" }} />}
          {msg.automationSource && <Chip label="auto" size="small" sx={{ height: 16, fontSize: 10 }} />}
          <Typography variant="caption" color="text.secondary">{dateShort(msg.sentAt ?? msg.createdAt)}</Typography>
        </Stack>
        <Typography variant="body2" fontWeight={msg.isRead ? 500 : 700} noWrap>
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
        <Tip title="Κλείσιμο"><IconButton onClick={onClose}><CloseIcon /></IconButton></Tip>
      </Box>
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
                {new Date(m.sentAt ?? m.createdAt).toLocaleString("el-GR")}
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
  open, onClose, contacts, teams, reply, onSent, meDisplay,
}: {
  open: boolean; onClose: () => void;
  contacts: Contact[]; teams: Team[];
  reply: { msg: ErmesMessageDto; mode: "reply" | "replyAll" | "forward" } | null;
  onSent: () => void;
  meDisplay: string;
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
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [tplAnchor, setTplAnchor] = useState<HTMLElement | null>(null);
  const [catAnchor, setCatAnchor] = useState<HTMLElement | null>(null);
  const [prodOpen, setProdOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, reply]);

  const send = useMutation({
    mutationFn: async (saveAsDraft: boolean) => api.post("/ermes/messages", {
      subject, bodyHtml,
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
    onSuccess: onSent,
    onError: (e) => setErr(extractErrorMessage(e)),
  });

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

  return (
    <>
      <Dialog open={open} onClose={onClose} fullScreen>
        <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "divider",
          display: "flex", alignItems: "center", gap: 1, bgcolor: "background.paper" }}>
          <Tooltip title="Πίσω">
            <IconButton onClick={onClose}><ArrowBackIcon /></IconButton>
          </Tooltip>
          <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>
            {reply ? (reply.mode === "forward" ? "Προώθηση μηνύματος" : "Απάντηση") : "Νέο μήνυμα"}
          </Typography>
          <Button size="small" startIcon={<DraftsIcon />} disabled={send.isPending}
            onClick={() => send.mutate(true)}>Πρόχειρο</Button>
          <Button size="small" variant="contained" startIcon={<SendIcon />} disabled={send.isPending}
            onClick={() => send.mutate(false)}>Αποστολή</Button>
        </Box>

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
                <FormControlLabel
                  sx={{ ml: 0 }}
                  control={<Switch size="small" checked={sendExternal}
                    onChange={(_e, v) => setSendExternal(v)} />}
                  label={<Stack direction="row" alignItems="center" spacing={0.5}>
                    <AlternateEmailIcon fontSize="small" />
                    <Typography variant="body2">Αποστολή και σε email</Typography>
                  </Stack>} />
              </Stack>

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

              <RichTextEditor html={bodyHtml} onHtmlChange={setBodyHtml} minHeight={420} />
            </Stack>
          </Box>
        </Box>
      </Dialog>

      {/* Template picker menu */}
      <Menu anchorEl={tplAnchor} open={!!tplAnchor} onClose={() => setTplAnchor(null)}>
        {TEMPLATES.map(t => (
          <MenuItem key={t.key} onClick={() => insertTemplate(t)}>{t.label}</MenuItem>
        ))}
      </Menu>

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
  kind, onClose, contacts, teams,
}: {
  kind: "teams" | "blocks" | null; onClose: () => void;
  contacts: Contact[]; teams: Team[];
}) {
  const qc = useQueryClient();
  const isTeams = kind === "teams";
  const [addTeamName, setAddTeamName] = useState("");
  const [addTeamMembers, setAddTeamMembers] = useState<Contact[]>([]);
  const [addBlockUser, setAddBlockUser] = useState<Contact | null>(null);
  const [addBlockReason, setAddBlockReason] = useState("");

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

  return (
    <Dialog open={!!kind} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isTeams ? "Ομάδες παραληπτών" : "Ανεπιθύμητοι αποστολείς"}
      </DialogTitle>
      <DialogContent>
        {isTeams ? (
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
                <ListItem key={t.id} secondaryAction={
                  <IconButton onClick={(e) => setMenuFor({ el: e.currentTarget, id: t.id, kind: "team" })}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }>
                  <ListItemAvatar><Avatar><GroupsIcon /></Avatar></ListItemAvatar>
                  <ListItemText primary={t.name} secondary={t.members.map(m => m.display).join(", ")} />
                </ListItem>
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
