import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, IconButton, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import TitleIcon from "@mui/icons-material/Title";
import LinkIcon from "@mui/icons-material/Link";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { dateTime } from "../utils/format";
import { HelpHint } from "../components/HelpHint";

interface InstructionsDto {
  id: string;
  title: string;
  contentHtml: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByName: string | null;
}
/**
 * Per-tenant handbook. AgencyAdmin edits, everyone reads. The editor is a
 * `contenteditable` div driven by `document.execCommand` — deprecated but
 * still supported in every browser we ship to, and it avoids adding a
 * ~200KB rich-text dependency for a page that only formats a handful of
 * headings and paragraphs.
 */
export function AgencyInstructionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const canEdit = user?.role === "AgencyAdmin" ||
    (user?.permissions?.includes("agency-instructions.write") ?? false);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["agency-instructions"],
    queryFn: async () => (await api.get<InstructionsDto>("/agency-instructions")).data,
  });

  const data = q.data;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <MenuBookIcon sx={{ fontSize: 32, color: "primary.main", mr: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {data?.title || t("agencyInstructions.title", "Οδηγίες γραφείου")}
            </Typography>
            <HelpHint id="page.agencyInstructions" />
          </Stack>
          <Typography color="text.secondary">
            {t("agencyInstructions.subtitle", "Σημειώσεις και οδηγίες για το προσωπικό που ασχολείται με το πρόγραμμα.")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {canEdit && (
            <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}>
              <ToggleButton value="view">{t("agencyInstructions.viewMode", "Προβολή")}</ToggleButton>
              <ToggleButton value="edit"><EditIcon fontSize="small" sx={{ mr: 0.5 }} />{t("agencyInstructions.editMode", "Επεξεργασία")}</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : mode === "edit" && canEdit ? (
        <EditorPanel data={data ?? null} onDone={() => { void qc.invalidateQueries({ queryKey: ["agency-instructions"] }); setMode("view"); }} onError={setErr} />
      ) : (
        <ReaderPanel data={data ?? null} />
      )}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Read-only view.
// -----------------------------------------------------------------------------
function ReaderPanel({ data }: { data: InstructionsDto | null }) {
  const { t } = useTranslation();
  const hasContent = !!(data && data.contentHtml && data.contentHtml.trim().length > 0);

  return (
    <Card variant="outlined">
      <CardContent>
        {data?.updatedByName && data.updatedAt && (
          <Stack direction="row" spacing={1} alignItems="center" mb={1.5} flexWrap="wrap">
            <Chip size="small" variant="outlined" label={`Τελευταία επεξεργασία από ${data.updatedByName}`} />
            <Chip size="small" variant="outlined" color="default" label={dateTime(data.updatedAt)} />
            <Box sx={{ flex: 1 }} />
          </Stack>
        )}
        {!hasContent ? (
          <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
            <MenuBookIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography variant="body1">
              {t("agencyInstructions.empty", "Ο διαχειριστής του γραφείου δεν έχει καταχωρήσει οδηγίες ακόμη.")}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              "& h1": { fontSize: 24, mt: 2, mb: 1, color: "primary.dark" },
              "& h2": { fontSize: 20, mt: 2, mb: 1, color: "primary.dark" },
              "& h3": { fontSize: 16, mt: 2, mb: 0.5, color: "primary.dark" },
              "& p": { my: 0.75 },
              "& ul, & ol": { pl: 3 },
              "& li": { my: 0.25 },
              "& blockquote": {
                borderLeft: 3, borderColor: "primary.light", pl: 1.5, py: 0.5,
                color: "text.secondary", bgcolor: "action.hover", my: 1, borderRadius: 0.5
              },
              "& a": { color: "primary.main" },
              "& hr": { border: "none", borderTop: 1, borderColor: "divider", my: 2 },
              "& code": { bgcolor: "action.hover", px: 0.5, py: 0.25, borderRadius: 0.5, fontFamily: "monospace", fontSize: 13 },
            }}
            dangerouslySetInnerHTML={{ __html: data!.contentHtml }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Editor with mini toolbar.
// -----------------------------------------------------------------------------
function EditorPanel({
  data, onDone, onError
}: { data: InstructionsDto | null; onDone: () => void; onError: (m: string | null) => void }) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(data?.title ?? "Οδηγίες γραφείου");

  useEffect(() => {
    if (editorRef.current && data) editorRef.current.innerHTML = data.contentHtml || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    // document.execCommand is deprecated but every browser still supports
    // it for basic formatting — the "real" replacement (Selection API +
    // custom command dispatch) would triple this file's size for no user
    // benefit. Watch the console for a deprecation warning; that's fine.
    document.execCommand(cmd, false, arg);
  };

  const save = useMutation({
    mutationFn: async () => {
      const contentHtml = editorRef.current?.innerHTML ?? "";
      const body = { title: title.trim() || "Οδηγίες γραφείου", contentHtml };
      return (await api.put<InstructionsDto>("/agency-instructions", body)).data;
    },
    onSuccess: () => { onError(null); onDone(); },
    onError: e => onError(extractErrorMessage(e)),
  });

  const linkPrompt = () => {
    const url = window.prompt("Διεύθυνση URL:", "https://");
    if (url && /^https?:\/\//i.test(url)) exec("createLink", url);
  };

  const buttons = useMemo(() => ([
    { icon: <FormatBoldIcon />, cmd: "bold", label: "Bold (Ctrl+B)" },
    { icon: <FormatItalicIcon />, cmd: "italic", label: "Italic (Ctrl+I)" },
    { icon: <FormatUnderlinedIcon />, cmd: "underline", label: "Underline (Ctrl+U)" },
    { icon: <TitleIcon />, cmd: "formatBlock", arg: "<h2>", label: "Επικεφαλίδα 2" },
    { icon: <TitleIcon fontSize="small" />, cmd: "formatBlock", arg: "<h3>", label: "Επικεφαλίδα 3" },
    { icon: <FormatListBulletedIcon />, cmd: "insertUnorderedList", label: "Λίστα με κουκκίδες" },
    { icon: <FormatListNumberedIcon />, cmd: "insertOrderedList", label: "Αριθμημένη λίστα" },
    { icon: <FormatQuoteIcon />, cmd: "formatBlock", arg: "<blockquote>", label: "Απόσπασμα" },
    { icon: <HorizontalRuleIcon />, cmd: "insertHorizontalRule", label: "Οριζόντια γραμμή" },
    { icon: <UndoIcon />, cmd: "undo", label: "Αναίρεση (Ctrl+Z)" },
    { icon: <RedoIcon />, cmd: "redo", label: "Επανάληψη (Ctrl+Y)" },
  ]), []);

  return (
    <Card variant="outlined">
      <CardContent>
        <TextField
          fullWidth
          label={t("agencyInstructions.titleField", "Τίτλος")}
          value={title}
          onChange={e => setTitle(e.target.value)}
          size="small"
          sx={{ mb: 2 }}
        />
        <Stack direction="row" spacing={0.25} flexWrap="wrap" gap={0.25} sx={{ mb: 1, p: 0.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "action.hover" }}>
          {buttons.map((b, i) => (
            <Tooltip key={i} title={b.label}>
              <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); exec(b.cmd, b.arg); }}>
                {b.icon}
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title="Σύνδεσμος">
            <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); linkPrompt(); }}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          sx={{
            minHeight: 400,
            maxHeight: 600,
            overflowY: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            p: 2,
            fontSize: 15,
            lineHeight: 1.6,
            outline: "none",
            "&:focus": { borderColor: "primary.main", boxShadow: "0 0 0 2px rgba(25,118,210,0.15)" },
            "& h1, & h2, & h3": { color: "primary.dark", mt: 1.5, mb: 0.5 },
            "& blockquote": {
              borderLeft: 3, borderColor: "primary.light", pl: 1.5, py: 0.5,
              color: "text.secondary", bgcolor: "action.hover", my: 1
            },
            "& ul, & ol": { pl: 3 },
          }}
        />
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button startIcon={<CloseIcon />} onClick={onDone} color="error" variant="contained">{t("common.cancel", "Άκυρο")}</Button>
          <Button
            variant="contained"
            startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {t("common.save", "Αποθήκευση")}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
