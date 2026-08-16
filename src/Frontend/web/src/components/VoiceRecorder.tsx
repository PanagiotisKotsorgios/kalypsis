import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Discord-style voice-message recorder. Grabs the user's microphone via
 * getUserMedia, records to memory with MediaRecorder, and calls back
 * with the final Blob when the operator stops. Elapsed-time indicator
 * pulses red while active. Stream tracks are stopped on unmount so the
 * browser doesn't keep the mic light on after the dialog closes.
 */
export function VoiceRecorder({
  onCancel, onFinished,
}: {
  onCancel: () => void;
  onFinished: (blob: Blob, durationMs: number) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "stopping">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const startRecording = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // audio/webm;codecs=opus is the widest-supported browser preset;
      // Safari uses audio/mp4 — MediaRecorder picks whichever it supports.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const durationMs = Date.now() - startedAtRef.current;
        // Release the mic — the browser's tab-level indicator turns off.
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setState("idle");
        onFinished(blob, durationMs);
      };
      rec.start(250);
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setState("recording");
    } catch (e: any) {
      setErr(e?.name === "NotAllowedError"
        ? "Δεν έχετε δώσει άδεια στο μικρόφωνο. Ελέγξτε τις ρυθμίσεις του browser."
        : e?.message ?? String(e));
      setState("idle");
    }
  };

  // Elapsed-time ticker while recording.
  useEffect(() => {
    if (state !== "recording") return;
    const iv = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 250);
    return () => clearInterval(iv);
  }, [state]);

  // Auto-cleanup: if the operator navigates away mid-recording, release
  // the mic and drop the buffered blob.
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* already stopped */ }
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const stop = () => {
    if (state !== "recording") return;
    setState("stopping");
    recorderRef.current?.stop();
  };

  const mmss = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: state === "recording" ? "error.main" : "divider",
      borderRadius: 1.5, bgcolor: state === "recording" ? "rgba(211,47,47,0.06)" : "background.default" }}>
      {err && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        {state === "idle" && (
          <>
            <Button variant="contained" color="error" startIcon={<MicIcon />} onClick={startRecording}>
              Έναρξη ηχογράφησης
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Θα ζητηθεί άδεια στο μικρόφωνο. Το ηχητικό επισυνάπτεται και προστίθεται inline player στο σώμα του μηνύματος.
            </Typography>
            <Button size="small" startIcon={<CloseIcon />} onClick={onCancel}>Άκυρο</Button>
          </>
        )}
        {state === "recording" && (
          <>
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "error.main",
              animation: "kx-pulse 1.1s ease-in-out infinite",
              "@keyframes kx-pulse": {
                "0%, 100%": { opacity: 1, transform: "scale(1)" },
                "50%": { opacity: 0.35, transform: "scale(1.35)" },
              } }} />
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
              Ηχογράφηση · {mmss(elapsed)}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={stop}>
              Τερματισμός
            </Button>
          </>
        )}
        {state === "stopping" && (
          <>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Ολοκλήρωση…</Typography>
          </>
        )}
      </Stack>
    </Box>
  );
}
