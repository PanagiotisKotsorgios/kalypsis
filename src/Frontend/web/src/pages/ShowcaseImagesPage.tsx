import { useRef, useState, type DragEvent } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, IconButton, Stack, Typography
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageIcon from "@mui/icons-material/Image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

const TAB_KEYS = ["customers", "policies", "quotes", "commissions", "reports"] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, string> = {
  customers: "Πελάτες",
  policies: "Συμβόλαια",
  quotes: "Πολυτιμολόγηση",
  commissions: "Προμήθειες",
  reports: "Αναφορές"
};

interface ShowcaseImage {
  key: string;
  url: string;
  size: number;
  updatedAt: string;
}

export function ShowcaseImagesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["showcase-images"],
    queryFn: async () => (await api.get<ShowcaseImage[]>("/platform/showcase-images")).data
  });

  function refresh() { void qc.invalidateQueries({ queryKey: ["showcase-images"] }); }

  const byKey: Record<string, ShowcaseImage | undefined> = {};
  for (const img of q.data ?? []) byKey[img.key] = img.url ? img : undefined;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <ImageIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Εικόνες Vitrine</Typography>
          <Typography color="text.secondary">
            Σύρετε και αφήστε στιγμιότυπα από την εφαρμογή. Εμφανίζονται στο
            κεντρικό landing αντί για τα προεπιλεγμένα SVG mockups.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Συμβουλές για επαγγελματικά αποτελέσματα:</strong> PNG ή WebP, 16:10
        (π.χ. 2400×1500 px), έως 10 MB. Τραβήξτε το screenshot από το browser σε
        zoom 100%, ολόκληρη η οθόνη της εφαρμογής, χωρίς τη μπάρα του browser.
      </Alert>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }
        }}>
          {TAB_KEYS.map((key) => (
            <ShowcaseSlot
              key={key}
              tabKey={key}
              label={TAB_LABELS[key]}
              existing={byKey[key]}
              onChanged={refresh}
              onError={setError}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function ShowcaseSlot({
  tabKey, label, existing, onChanged, onError
}: {
  tabKey: TabKey;
  label: string;
  existing: ShowcaseImage | undefined;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 10_000_000) throw new Error("Αρχείο μεγαλύτερο από 10 MB.");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error("Δεκτά μόνο PNG, JPG ή WebP.");
      const form = new FormData();
      form.append("file", file);
      return (await api.post<ShowcaseImage>(`/platform/showcase-images/${tabKey}`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      })).data;
    },
    onSuccess: onChanged,
    onError: (e) => onError(extractErrorMessage(e))
  });

  const del = useMutation({
    mutationFn: async () => api.delete(`/platform/showcase-images/${tabKey}`),
    onSuccess: onChanged,
    onError: (e) => onError(extractErrorMessage(e))
  });

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload.mutate(file);
  }

  return (
    <Card variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{
        p: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
          <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
            {tabKey}
          </Typography>
        </Box>
        {existing && (
          <IconButton size="small" color="error" disabled={del.isPending}
            onClick={() => { if (confirm(`Διαγραφή εικόνας για "${label}";`)) del.mutate(); }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        sx={{
          position: "relative",
          aspectRatio: "16 / 10",
          bgcolor: dragOver ? "rgba(176,138,62,0.12)" : "#fbfaf6",
          cursor: "pointer",
          borderTop: dragOver ? "2px dashed var(--gold, #b08a3e)" : "2px dashed transparent",
          transition: "background 220ms ease, border-color 220ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = "";
          }} />

        {existing ? (
          <Box
            component="img"
            src={existing.url + "?v=" + encodeURIComponent(existing.updatedAt)}
            alt={label}
            sx={{
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "top center",
              opacity: upload.isPending ? 0.4 : 1,
              transition: "opacity 220ms ease"
            }}
          />
        ) : (
          <Stack alignItems="center" spacing={1} sx={{ color: "text.secondary", py: 4, px: 2, textAlign: "center" }}>
            <CloudUploadIcon sx={{ fontSize: 44 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {dragOver ? "Αφήστε εδώ για ανέβασμα" : "Σύρετε εικόνα ή κάντε κλικ"}
            </Typography>
            <Typography variant="caption">PNG / JPG / WebP · έως 10 MB · 16:10</Typography>
          </Stack>
        )}

        {upload.isPending && (
          <Box sx={{
            position: "absolute", inset: 0,
            bgcolor: "rgba(255,255,255,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <CircularProgress />
          </Box>
        )}
      </Box>

      {existing && (
        <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary">
            {(existing.size / 1024).toFixed(0)} KB · {new Date(existing.updatedAt).toLocaleString("el-GR")}
          </Typography>
          <Button size="small" startIcon={<CloudUploadIcon />} onClick={() => inputRef.current?.click()}>
            Αντικατάσταση
          </Button>
        </Box>
      )}
    </Card>
  );
}
