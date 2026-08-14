import { useMemo } from "react";
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ConstructionIcon from "@mui/icons-material/Construction";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * ΕΡΜΗΣ — Meeting room. Embeds the public Jitsi Meet instance under
 * a Kalypsis-prefixed room name so agencies get instant voice/video
 * calls without us running any signaling infrastructure. Zero-config
 * for the Beta: works over WebRTC via the browser, no plugins.
 *
 * Anyone with the room URL can join — the join screen inside Jitsi
 * handles mic/camera prompts. Kalypsis stays out of the media path.
 *
 * Deliberately does NOT trigger any external notifications while in
 * Beta — invites propagate purely through the in-app ΕΡΜΗΣ message
 * that contains the meeting link.
 */
export function ErmesMeetingPage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Kalypsis prefix keeps rooms from other Jitsi users out of the
  // namespace. Slashes/spaces are unsafe in Jitsi room names.
  const safeRoom = roomId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "kalypsis";
  const jitsiRoom = `kalypsis-ermes-${safeRoom}`;

  const displayName = ((user?.firstName ?? "") + " " + (user?.lastName ?? "")).trim() || "Kalypsis";
  const userInfoParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("userInfo.displayName", displayName);
    if (user?.email) p.set("userInfo.email", user.email);
    // Prefill: skip prejoin screen so click → in-room.
    p.set("config.prejoinPageEnabled", "false");
    return p.toString();
  }, [displayName, user?.email]);

  const jitsiUrl = `https://meet.jit.si/${encodeURIComponent(jitsiRoom)}#${userInfoParams}`;
  const invitePath = `/app/ermes/meeting/${encodeURIComponent(safeRoom)}`;
  const inviteUrl = window.location.origin + invitePath;
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* no-op */ }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", gap: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Tooltip title="Επιστροφή στον ΕΡΜΗ">
          <IconButton onClick={() => navigate("/app/ermes")}><ArrowBackIcon /></IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" fontWeight={800}>ΕΡΜΗΣ · Συνάντηση</Typography>
            <Chip size="small" color="warning" variant="filled"
              icon={<ConstructionIcon sx={{ fontSize: 14 }} />}
              label="BETA · Δωρεάν εφ'όρου ζωής" sx={{ fontWeight: 700 }} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Δωμάτιο <b>{jitsiRoom}</b> · κρυπτογραφημένη σύνδεση WebRTC μέσω meet.jit.si
          </Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyInvite}>
          Αντιγραφή συνδέσμου
        </Button>
      </Stack>
      <Box sx={{ flex: 1, borderRadius: 1.5, overflow: "hidden", border: 1, borderColor: "divider" }}>
        <iframe
          title="Kalypsis Ermes meeting"
          src={jitsiUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </Box>
    </Box>
  );
}
