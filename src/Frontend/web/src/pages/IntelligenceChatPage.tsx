import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Grid, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChatIcon from "@mui/icons-material/Chat";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { Conversation, Workbench } from "./intelligenceWorkbenchTypes";

type ChatResponse = { conversationId: string; text?: string; error?: string };
type ChatHistory = { messages: { role: string; content?: string }[] };

export function IntelligenceChatPage() {
  const q = useQuery({ queryKey: ["intelligence-workbench"], queryFn: async () => (await api.get<Workbench>("/intelligence/workbench")).data });
  const [chatId, setChatId] = useState<string>(); const [message, setMessage] = useState(""); const [chatReply, setChatReply] = useState(""); const [customerId, setCustomerId] = useState(""); const [policyId, setPolicyId] = useState("");
  const chatHistory = useQuery({ queryKey: ["intelligence-chat", chatId], enabled: !!chatId, queryFn: async () => (await api.get<ChatHistory>(`/intelligence/chats/${chatId}`)).data });
  const chat = useMutation({ mutationFn: async () => (await api.post<ChatResponse>("/intelligence/chat", { conversationId: chatId || null, message, customerId: customerId || null, policyId: policyId || null })).data, onSuccess: response => { setChatId(response.conversationId); setChatReply(response.text || response.error || "Δεν επιστράφηκε απάντηση."); setMessage(""); } });
  if (q.isLoading) return <Box p={3}><Typography>Φόρτωση συνομιλίας νοημοσύνης…</Typography></Box>;
  if (q.isError) return <Box p={3}><Alert severity="error">Δεν ήταν δυνατή η φόρτωση των συνομιλιών.</Alert></Box>;
  const conversations = q.data!.conversations.filter((conversation: Conversation) => conversation.kind === "Chat");
  return <Box sx={{ maxWidth: 1250, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Button component={RouterLink} to="/app/intelligence-workbench" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>Κέντρο Νοημοσύνης</Button>
    <Stack direction="row" spacing={1} alignItems="center" mb={1}><ChatIcon color="primary" /><Typography variant="h5" fontWeight={800}>Συνομιλία νοημοσύνης</Typography></Stack>
    <Typography color="text.secondary" mb={2}>Κάντε ερωτήσεις στη νοημοσύνη του γραφείου και προαιρετικά συνδέστε κάθε συνομιλία με πελάτη ή συμβόλαιο.</Typography>
    <Grid container spacing={2}><Grid item xs={12} md={8}><Card><CardContent><Typography variant="h6" mb={2}>Τρέχουσα συνομιλία</Typography>{chatHistory.data?.messages.map((item, index) => <Box key={`${item.role}-${index}`} sx={{ mb: 1, p: 1.5, borderRadius: 2, bgcolor: item.role === "assistant" ? "action.hover" : "primary.50" }}><Typography variant="caption" fontWeight={700}>{item.role === "assistant" ? "Νοημοσύνη" : "Εσείς"}</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{item.content}</Typography></Box>)}<Grid container spacing={1.5} mb={1.5}><Grid item xs={12} md={6}><TextField label="Κωδικός πελάτη (προαιρετικό)" value={customerId} onChange={e => setCustomerId(e.target.value)} fullWidth /></Grid><Grid item xs={12} md={6}><TextField label="Κωδικός συμβολαίου (προαιρετικό)" value={policyId} onChange={e => setPolicyId(e.target.value)} fullWidth /></Grid></Grid><TextField label="Μήνυμα" value={message} onChange={e => setMessage(e.target.value)} multiline minRows={5} fullWidth /><Button sx={{ mt: 1.5 }} variant="contained" startIcon={<AutoAwesomeIcon />} disabled={!message.trim() || chat.isPending} onClick={() => chat.mutate()}>Αποστολή</Button>{chatReply && <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 2 }}><Typography sx={{ whiteSpace: "pre-wrap" }}>{chatReply}</Typography></Box>}</CardContent></Card></Grid><Grid item xs={12} md={4}><Card><CardContent><Typography variant="h6">Πρόσφατες συνομιλίες</Typography>{conversations.length === 0 && <Typography color="text.secondary" mt={1}>Δεν υπάρχουν συνομιλίες ακόμη.</Typography>}{conversations.map(conversation => <Button key={conversation.id} fullWidth sx={{ justifyContent: "flex-start", my: .25, textAlign: "left" }} onClick={() => { setChatId(conversation.id); setChatReply(""); }}><Box><Typography variant="body2">{conversation.title} ({conversation.messageCount})</Typography>{conversation.resultPreview && <Typography variant="caption" color="text.secondary">{conversation.resultPreview.slice(0, 90)}…</Typography>}</Box></Button>)}</CardContent></Card></Grid></Grid>
  </Box>;
}
