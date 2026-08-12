import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Chip, IconButton, Stack, Tab, Tabs, Tooltip, Typography, LinearProgress, Alert
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Remove";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import DownloadIcon from "@mui/icons-material/Download";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import * as XLSX from "xlsx";
import { api } from "../api/client";

/**
 * Draggable / minimisable floating panel showing the platform-managed
 * «Οδηγός παραμετρικών» PDF (rendered inline) or download-only for other
 * MIME types (xlsx). Renders as a fixed-position React child of body
 * via inline styles — no portal library dependency needed.
 *
 * Uses api.get with responseType blob so the auth Bearer header applies
 * (the file is behind /platform/carriers/{id}/reference/download which is
 * AgencyStaff-gated); the iframe then loads an object-URL for the blob.
 */
export interface CarrierReferenceMeta {
  id: string;
  insuranceCompanyId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string | null;
}

interface Props {
  carrierId: string | null;   // null → hidden
  carrierName?: string;
  onClose: () => void;
}

export function CarrierReferenceViewer({ carrierId, carrierName, onClose }: Props) {
  const [meta, setMeta] = useState<CarrierReferenceMeta | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [minimised, setMinimised] = useState(false);
  const [maximised, setMaximised] = useState(false);
  const [pos, setPos] = useState({ x: 40, y: 80 });
  const [size] = useState({ w: 900, h: 680 });
  const dragging = useRef<{ dx: number; dy: number } | null>(null);
  // xlsx sheets — parsed client-side via SheetJS. Each sheet renders as
  // an <table> HTML string so the operator can browse it inline instead
  // of downloading + opening Excel externally.
  const [sheets, setSheets] = useState<Array<{ name: string; html: string }>>([]);
  const [activeSheet, setActiveSheet] = useState(0);

  // Fetch meta whenever the carrier changes; only fetch bytes when the
  // pane is actually open (not minimised) to keep memory small.
  useEffect(() => {
    if (!carrierId) return;
    let alive = true;
    setLoading(true); setErr(null); setMeta(null); setBlobUrl(null);
    setSheets([]); setActiveSheet(0);
    (async () => {
      try {
        const res = await api.get<CarrierReferenceMeta | ''>(
          `/platform/carriers/${carrierId}/reference/meta`);
        if (!alive) return;
        // Backend returns 204 (empty) when no reference has been uploaded.
        if (!res.data) { setMeta(null); setLoading(false); return; }
        setMeta(res.data);
        const blob = await api.get<Blob>(
          `/platform/carriers/${carrierId}/reference/download`,
          { responseType: "blob" });
        if (!alive) return;
        const url = URL.createObjectURL(blob.data);
        setBlobUrl(url);
        // Detect xlsx and parse inline so operators can browse without
        // leaving the app. SheetJS is already in the bundle for
        // Over-Commission grid + table-export flows.
        const isXlsxLocal = (res.data.mimeType.toLowerCase().includes("spreadsheet"))
          || res.data.fileName.toLowerCase().endsWith(".xlsx");
        if (isXlsxLocal) {
          try {
            const buf = await blob.data.arrayBuffer();
            if (!alive) return;
            const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
            const parsed = wb.SheetNames.map(name => ({
              name,
              html: XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false }),
            }));
            if (alive) setSheets(parsed);
          } catch { /* keep the download-only fallback if parse fails */ }
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Αδυναμία φόρτωσης οδηγού.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierId]);

  // Drag handlers — pointer events so it works on trackpad + touch.
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragging.current.dx)),
      y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragging.current.dy)),
    });
  };
  const onPointerUp = () => { dragging.current = null; };

  const isPdf = useMemo(() =>
    (meta?.mimeType?.toLowerCase() ?? "").includes("pdf")
      || (meta?.fileName?.toLowerCase() ?? "").endsWith(".pdf"),
  [meta]);

  if (!carrierId) return null;

  const style: React.CSSProperties = maximised ? {
    position: "fixed", left: 20, top: 20, right: 20, bottom: 20,
    width: "auto", height: "auto",
  } : {
    position: "fixed", left: pos.x, top: pos.y,
    width: size.w, height: minimised ? 44 : size.h,
  };

  return (
    <Box sx={{
      ...style,
      zIndex: 1300,
      bgcolor: "background.paper",
      border: "1.5px solid",
      borderColor: "primary.main",
      borderRadius: 2,
      boxShadow: "0 20px 48px -12px rgba(11,37,69,0.35)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Title bar — draggable */}
      <Stack direction="row" alignItems="center" spacing={1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        sx={{
          px: 1, py: 0.75,
          bgcolor: "primary.main", color: "primary.contrastText",
          cursor: maximised ? "default" : "move",
          userSelect: "none",
        }}>
        <DragIndicatorIcon fontSize="small" />
        <MenuBookIcon fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Οδηγός παραμετρικών {carrierName ? `— ${carrierName}` : ""}
        </Typography>
        {meta && (
          <Chip size="small" label={`${Math.round(meta.sizeBytes / 1024)} KB`}
            sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "inherit" }} />
        )}
        <Tooltip title="Λήψη αρχείου">
          <span>
            <IconButton size="small" sx={{ color: "inherit" }}
              disabled={!blobUrl || !meta}
              onClick={() => {
                if (!blobUrl || !meta) return;
                const a = document.createElement("a");
                a.href = blobUrl; a.download = meta.fileName; a.click();
              }}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={minimised ? "Μεγιστοποίηση" : "Ελαχιστοποίηση"}>
          <IconButton size="small" sx={{ color: "inherit" }}
            onClick={() => setMinimised(m => !m)}>
            <MinimizeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={maximised ? "Επαναφορά" : "Πλήρης οθόνη"}>
          <IconButton size="small" sx={{ color: "inherit" }}
            onClick={() => { setMaximised(m => !m); setMinimised(false); }}>
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Κλείσιμο">
          <IconButton size="small" sx={{ color: "inherit" }} onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {!minimised && (
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative", bgcolor: "action.hover", display: "flex", flexDirection: "column" }}>
          {loading && <LinearProgress />}
          {err && <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>}
          {!loading && !err && !meta && (
            <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
              <MenuBookIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography>Δεν έχει ανέβει οδηγός παραμετρικών για αυτή την ασφαλιστική.</Typography>
              <Typography variant="caption">
                Ο διαχειριστής της πλατφόρμας μπορεί να τον ανεβάσει από τη σελίδα Ασφαλιστικές (Platform).
              </Typography>
            </Box>
          )}
          {meta && blobUrl && (
            isPdf ? (
              <iframe src={blobUrl} title="Οδηγός παραμετρικών"
                style={{ border: 0, width: "100%", height: "100%" }} />
            ) : sheets.length > 0 ? (
              /* xlsx rendered inline via SheetJS — sheet tabs on top,
                 scrollable html-table body below. Injected via
                 dangerouslySetInnerHTML because sheet_to_html emits a
                 fully-formed <table> string; the content came from a
                 platform-admin-uploaded file so we trust it.

                 minHeight/minWidth: 0 on flex children is the classic
                 gotcha that lets `overflow: auto` actually trigger — the
                 default `min-content` sizing on flex items would grow the
                 child to fit its content and hide the scrollbars. */
              <Stack sx={{ height: "100%", minHeight: 0 }}>
                {sheets.length > 1 && (
                  <Tabs
                    value={activeSheet}
                    onChange={(_, v) => setActiveSheet(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ minHeight: 36, borderBottom: 1, borderColor: "divider",
                      bgcolor: "background.paper", flexShrink: 0,
                      "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: 12 } }}
                  >
                    {sheets.map((s, i) => (
                      <Tab key={i} label={s.name} />
                    ))}
                  </Tabs>
                )}
                <Box sx={{
                  flex: 1, minHeight: 0, minWidth: 0,
                  overflow: "auto",     // both axes scroll when the table exceeds
                  p: 1, bgcolor: "background.paper",
                  "& table": {
                    borderCollapse: "collapse",
                    fontSize: 12,
                    width: "max-content", // let it grow → horizontal scrollbar appears
                    minWidth: "100%",
                  },
                  "& td, & th": { border: "1px solid #ddd", padding: "4px 8px",
                    whiteSpace: "nowrap" },
                  "& th": { bgcolor: "rgba(11,37,69,0.08)", fontWeight: 700,
                    position: "sticky", top: 0, zIndex: 1 },
                  "& tr:nth-of-type(even) td": { bgcolor: "rgba(255,244,196,0.30)" },
                }}
                  dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html ?? "" }} />
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={1.5} sx={{ p: 4, textAlign: "center" }}>
                <Typography variant="h6">{meta.fileName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Αρχεία {meta.mimeType.split("/")[1]?.toUpperCase() || "αγνώστου τύπου"} δεν προβάλλονται εντός browser.
                  Πατήστε «Λήψη» για να τα ανοίξετε.
                </Typography>
              </Stack>
            )
          )}
        </Box>
      )}
    </Box>
  );
}
