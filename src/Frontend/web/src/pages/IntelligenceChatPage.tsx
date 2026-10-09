import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChatIcon from "@mui/icons-material/Chat";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { Conversation, Workbench } from "./intelligenceWorkbenchTypes";

type ChatResponse = { conversationId: string; text?: string; error?: string };
type ChatHistory = { messages: { role: string; content?: string }[] };

export function IntelligenceChatPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["intelligence-workbench"], queryFn: async () => (await api.get<Workbench>("/intelligence/workbench")).data });
  const [chatId, setChatId] = useState<string>();
  const [message, setMessage] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const chatHistory = useQuery({ queryKey: ["intelligence-chat", chatId], enabled: !!chatId, queryFn: async () => (await api.get<ChatHistory>(`/intelligence/chats/${chatId}`)).data });
  const chat = useMutation({
    mutationFn: async () => (await api.post<ChatResponse>("/intelligence/chat", { conversationId: chatId || null, message, customerId: customerId || null, policyId: policyId || null })).data,
    onSuccess: response => {
      setChatId(response.conversationId);
      setChatReply(response.text || response.error || "Δεν επιστράφηκε απάντηση.");
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["intelligence-workbench"] });
      void qc.invalidateQueries({ queryKey: ["intelligence-chat", response.conversationId] });
    },
  });

  if (q.isLoading) return <Box p={3}><Typography>Φόρτωση συνομιλίας νοημοσύνης…</Typography></Box>;
  if (q.isError) return <Box p={3}><Alert severity="error">Δεν ήταν δυνατή η φόρτωση των συνομιλιών.</Alert></Box>;

  const conversations = q.data!.conversations.filter((conversation: Conversation) => conversation.kind === "Chat");
  const filteredConversations = useMemo(() => {
    const term = conversationSearch.trim().toLocaleLowerCase("el-GR");
    return conversations.filter(conversation => !term || `${conversation.title} ${conversation.resultPreview || ""}`.toLocaleLowerCase("el-GR").includes(term));
  }, [conversations, conversationSearch]);
  const messages = chatHistory.data?.messages ?? [];
  const liveReplyAlreadyInHistory = !!chatReply && messages.some(item => item.role === "assistant" && item.content === chatReply);

  const startNewConversation = () => {
    setChatId(undefined);
    setChatReply("");
    setMessage("");
    setCustomerId("");
    setPolicyId("");
  };

  const submit = () => {
    if (message.trim() && !chat.isPending) chat.mutate();
  };

  return <Box sx={{ maxWidth: 1250, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Button component={RouterLink} to="/app/intelligence-workbench" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>Κέντρο Νοημοσύνης</Button>
    <Stack direction="row" spacing={1} alignItems="center" mb={1}><ChatIcon color="primary" /><Typography variant="h5" fontWeight={800}>Συνομιλία νοημοσύνης</Typography></Stack>
    <Typography color="text.secondary" mb={2}>Κάντε ερωτήσεις στη νοημοσύνη του γραφείου, δείτε απαντήσεις σαν συνομιλία και συνεχίστε οποιαδήποτε παλαιότερη συζήτηση.</Typography>

    <Grid container spacing={2}>
      <Grid item xs={12} md={8}>
        <Card sx={{ border: "1px solid", borderColor: "divider", boxShadow: 2 }}>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1} mb={1.5}>
              <Box><Typography variant="h6">{chatId ? "Συνέχιση συνομιλίας" : "Νέα συνομιλία"}</Typography><Typography variant="caption" color="text.secondary">Οι απαντήσεις εμφανίζονται αμέσως στο παράθυρο συνομιλίας.</Typography></Box>
              <Button size="small" variant="outlined" startIcon={<AddCommentOutlinedIcon />} onClick={startNewConversation}>Νέα συνομιλία</Button>
            </Stack>
            <Box sx={{ height: { xs: 380, md: 470 }, overflowY: "auto", p: { xs: 1, md: 1.5 }, mb: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "grey.50" }}>
              {messages.length === 0 && !chatReply && <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", color: "text.secondary", textAlign: "center" }}><AutoAwesomeIcon sx={{ fontSize: 42, mb: 1, color: "primary.main" }} /><Typography fontWeight={700}>Ρωτήστε τη νοημοσύνη του γραφείου</Typography><Typography variant="body2">Οι απαντήσεις σας θα εμφανιστούν εδώ.</Typography></Stack>}
              <Stack spacing={1.25}>
                {messages.map((item, index) => <Box key={`${item.role}-${index}`} sx={{ alignSelf: item.role === "assistant" ? "flex-start" : "flex-end", width: { xs: "92%", sm: "82%" }, p: 1.5, borderRadius: 2, bgcolor: item.role === "assistant" ? "#fff" : "primary.main", color: item.role === "assistant" ? "text.primary" : "primary.contrastText", border: "1px solid", borderColor: item.role === "assistant" ? "divider" : "primary.dark", boxShadow: 1 }}><Typography variant="caption" fontWeight={800} display="block" mb={.35}>{item.role === "assistant" ? "Νοημοσύνη" : "Εσείς"}</Typography><Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{item.content}</Typography></Box>)}
                {chatReply && !liveReplyAlreadyInHistory && <Box sx={{ alignSelf: "flex-start", width: { xs: "92%", sm: "82%" }, p: 1.5, borderRadius: 2, bgcolor: "#fff", border: "1px solid", borderColor: "primary.light", boxShadow: 2 }}><Typography variant="caption" color="primary.main" fontWeight={800} display="block" mb={.35}>Νοημοσύνη · νέα απάντηση</Typography><Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{chatReply}</Typography></Box>}
                {chat.isPending && <Box sx={{ alignSelf: "flex-start", p: 1.25, borderRadius: 2, bgcolor: "#fff", border: "1px solid", borderColor: "divider" }}><Typography variant="body2" color="text.secondary">Η νοημοσύνη επεξεργάζεται την ερώτησή σας…</Typography></Box>}
              </Stack>
            </Box>
            <Grid container spacing={1.25} mb={1.25}>
              <Grid item xs={12} sm={6}><TextField size="small" label="Κωδικός πελάτη (προαιρετικό)" value={customerId} onChange={event => setCustomerId(event.target.value)} fullWidth /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" label="Κωδικός συμβολαίου (προαιρετικό)" value={policyId} onChange={event => setPolicyId(event.target.value)} fullWidth /></Grid>
            </Grid>
            <TextField label="Γράψτε την ερώτησή σας" value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} multiline minRows={3} maxRows={8} fullWidth placeholder="Πατήστε Enter για αποστολή ή Shift+Enter για νέα γραμμή" InputProps={{ endAdornment: <InputAdornment position="end"><Button variant="contained" onClick={submit} disabled={!message.trim() || chat.isPending} endIcon={<SendIcon />}>Αποστολή</Button></InputAdornment> }} />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card sx={{ border: "1px solid", borderColor: "divider", boxShadow: 2 }}>
          <CardContent>
            <Typography variant="h6" mb={1}>Ιστορικό συνομιλιών</Typography>
            <TextField size="small" label="Αναζήτηση ιστορικού" value={conversationSearch} onChange={event => setConversationSearch(event.target.value)} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>{filteredConversations.length} συνομιλίες</Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ maxHeight: 430, overflowY: "auto" }}>
              {filteredConversations.length === 0 && <Typography color="text.secondary" mt={1}>Δεν βρέθηκαν παλιές συνομιλίες.</Typography>}
              {filteredConversations.map(conversation => <Button key={conversation.id} fullWidth sx={{ justifyContent: "flex-start", alignItems: "flex-start", my: .25, py: 1, textAlign: "left", bgcolor: chatId === conversation.id ? "action.selected" : "transparent" }} onClick={() => { setChatId(conversation.id); setChatReply(""); }}><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={chatId === conversation.id ? 800 : 600} noWrap>{conversation.title || "Συνομιλία"}</Typography><Typography variant="caption" color="text.secondary">{conversation.messageCount} μηνύματα</Typography>{conversation.resultPreview && <Typography variant="caption" color="text.secondary" display="block" noWrap>{conversation.resultPreview}</Typography>}</Box></Button>)}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>;
}
