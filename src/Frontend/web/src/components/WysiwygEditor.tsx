import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import TitleIcon from "@mui/icons-material/Title";
import LinkIcon from "@mui/icons-material/Link";
import FormatClearIcon from "@mui/icons-material/FormatClear";
import CodeIcon from "@mui/icons-material/Code";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";

/**
 * Lightweight WYSIWYG editor built on contentEditable + document.execCommand.
 * execCommand is deprecated but still supported in every browser we ship to
 * and adds zero dependencies vs pulling in TinyMCE / CKEditor / Quill.
 *
 * The editor emits `onChange(html)` on every keystroke; the raw HTML round-
 * trips through localStorage / the API unchanged so existing bodyHtml fields
 * keep working. A «HTML» toggle exposes the raw markup for operators who
 * previously edited templates by hand.
 */
export function WysiwygEditor({
  value, onChange, label, minRows = 6, placeholder
}: {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  minRows?: number;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [rawMode, setRawMode] = useState(false);

  // Only push the incoming value into the DOM when it actually differs from
  // what's already there — otherwise every keystroke would blow away the
  // caret position after React re-renders the parent.
  useEffect(() => {
    if (rawMode) return;
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value ?? "";
    }
  }, [value, rawMode]);

  const exec = (cmd: string, arg?: string) => {
    // Ensure the editor is focused before running the command, otherwise
    // Firefox refuses to apply formatting.
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    // Push the fresh HTML out to the parent so React state stays in sync.
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertLink = () => {
    const url = window.prompt("Διεύθυνση συνδέσμου (https://…):");
    if (!url) return;
    exec("createLink", url);
  };

  const insertPlaceholder = () => {
    const key = window.prompt("Placeholder (π.χ. customerName, policyNumber):");
    if (!key) return;
    exec("insertHTML", `{{${key.trim()}}}`);
  };

  const minHeight = 24 * minRows + 16;

  return (
    <Box>
      {label && <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={0.5}>{label}</Typography>}
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
        <Stack direction="row" spacing={0.25} alignItems="center" flexWrap="wrap"
          sx={{ p: 0.5, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}>
          <ToolbarBtn tip="Bold (Ctrl+B)"      onClick={() => exec("bold")}      icon={<FormatBoldIcon fontSize="small" />} />
          <ToolbarBtn tip="Italic (Ctrl+I)"    onClick={() => exec("italic")}    icon={<FormatItalicIcon fontSize="small" />} />
          <ToolbarBtn tip="Underline (Ctrl+U)" onClick={() => exec("underline")} icon={<FormatUnderlinedIcon fontSize="small" />} />
          <Divider />
          <ToolbarBtn tip="Επικεφαλίδα Η1" onClick={() => exec("formatBlock", "<h1>")} icon={<TitleIcon fontSize="small" />} />
          <ToolbarBtn tip="Επικεφαλίδα Η2" onClick={() => exec("formatBlock", "<h2>")} icon={<TitleIcon fontSize="small" sx={{ fontSize: 16 }} />} />
          <ToolbarBtn tip="Απλή παράγραφος" onClick={() => exec("formatBlock", "<p>")} icon={<Typography variant="caption" sx={{ fontWeight: 700, width: 20, textAlign: "center" }}>¶</Typography>} />
          <Divider />
          <ToolbarBtn tip="Λίστα με τελείες"    onClick={() => exec("insertUnorderedList")} icon={<FormatListBulletedIcon fontSize="small" />} />
          <ToolbarBtn tip="Λίστα με αρίθμηση"   onClick={() => exec("insertOrderedList")}   icon={<FormatListNumberedIcon fontSize="small" />} />
          <Divider />
          <ToolbarBtn tip="Στοίχιση αριστερά"   onClick={() => exec("justifyLeft")}   icon={<FormatAlignLeftIcon fontSize="small" />} />
          <ToolbarBtn tip="Στοίχιση κέντρο"     onClick={() => exec("justifyCenter")} icon={<FormatAlignCenterIcon fontSize="small" />} />
          <ToolbarBtn tip="Στοίχιση δεξιά"      onClick={() => exec("justifyRight")}  icon={<FormatAlignRightIcon fontSize="small" />} />
          <Divider />
          <ToolbarBtn tip="Εισαγωγή συνδέσμου"  onClick={insertLink} icon={<LinkIcon fontSize="small" />} />
          <ToolbarBtn tip="Εισαγωγή placeholder — {{...}} που θα αντικατασταθεί κατά την εκτύπωση" onClick={insertPlaceholder} icon={<Typography variant="caption" sx={{ fontWeight: 700, width: 20, textAlign: "center" }}>{"{ }"}</Typography>} />
          <ToolbarBtn tip="Καθαρισμός μορφοποίησης" onClick={() => exec("removeFormat")} icon={<FormatClearIcon fontSize="small" />} />
          <Divider />
          <ToolbarBtn tip="Undo (Ctrl+Z)" onClick={() => exec("undo")} icon={<UndoIcon fontSize="small" />} />
          <ToolbarBtn tip="Redo (Ctrl+Y)" onClick={() => exec("redo")} icon={<RedoIcon fontSize="small" />} />
          <Box sx={{ flex: 1 }} />
          <Tooltip title={rawMode ? "Επιστροφή σε WYSIWYG" : "Προβολή HTML"}>
            <IconButton size="small" color={rawMode ? "primary" : "default"} onClick={() => setRawMode(v => !v)}>
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        {rawMode ? (
          <TextField
            fullWidth multiline minRows={minRows} value={value}
            onChange={(e) => onChange(e.target.value)}
            InputProps={{
              disableUnderline: true,
              sx: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.5, p: 1 }
            }}
            variant="standard"
          />
        ) : (
          <Box
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder ?? ""}
            onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
            sx={{
              minHeight,
              p: 1.5,
              outline: "none",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
              fontSize: 14,
              lineHeight: 1.6,
              "& h1": { fontSize: 20, fontWeight: 700, m: "8px 0" },
              "& h2": { fontSize: 16, fontWeight: 700, m: "8px 0" },
              "& p":  { m: "4px 0" },
              "& ul, & ol": { pl: 3, m: "4px 0" },
              "& a":  { color: "primary.main", textDecoration: "underline" },
              "&:empty::before": {
                content: `attr(data-placeholder)`,
                color: "text.disabled",
                pointerEvents: "none"
              }
            }}
          />
        )}
      </Box>
    </Box>
  );
}

function ToolbarBtn({ tip, onClick, icon }: { tip: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <Tooltip title={tip} arrow>
      <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function Divider() {
  return <Box sx={{ width: 1, height: 20, bgcolor: "divider", mx: 0.5 }} />;
}
