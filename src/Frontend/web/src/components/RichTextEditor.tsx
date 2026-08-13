import { useEffect, useRef } from "react";
import { Box, Divider, IconButton, Stack, Tooltip } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import LinkIcon from "@mui/icons-material/Link";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import FormatClearIcon from "@mui/icons-material/FormatClear";

/**
 * Minimal WYSIWYG editor built on contentEditable + document.execCommand.
 *
 * We keep it deliberately tiny so no third-party editor library ships in
 * the bundle. It covers the ~six formatting knobs an insurance operator
 * ever reaches for (bold / italic / underline / bullets / numbered /
 * link) plus quote and «clear formatting». The output is raw HTML that
 * the backend re-sanitises before storing.
 *
 * execCommand is technically deprecated but every browser we support
 * still implements it, and the replacement (Selection + Range APIs) is
 * a 10× code hit for zero user-visible benefit.
 */
export function RichTextEditor({
  html, onHtmlChange, minHeight = 220, placeholder = "Γράψτε το μήνυμά σας…",
}: {
  html: string;
  onHtmlChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Sync the outside `html` prop into the DOM when it changes from the
  // parent (e.g. Reply prefills «> quoted body»). We compare innerHTML
  // to avoid clobbering the caret while the user is typing.
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== html) ref.current.innerHTML = html;
  }, [html]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onHtmlChange(ref.current.innerHTML);
  };
  const promptLink = () => {
    const url = prompt("URL:", "https://");
    if (!url) return;
    exec("createLink", url);
  };

  return (
    <Box sx={{
      border: 1, borderColor: "divider", borderRadius: 1.5,
      display: "flex", flexDirection: "column",
      "&:focus-within": { borderColor: "primary.main" },
    }}>
      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ px: 0.5, py: 0.25, flexWrap: "wrap" }}>
        <Tip title="Bold (Ctrl+B)"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={() => exec("bold")}><FormatBoldIcon fontSize="small" /></IconButton></Tip>
        <Tip title="Italic (Ctrl+I)"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={() => exec("italic")}><FormatItalicIcon fontSize="small" /></IconButton></Tip>
        <Tip title="Underline (Ctrl+U)"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={() => exec("underline")}><FormatUnderlinedIcon fontSize="small" /></IconButton></Tip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
        <Tip title="Bulleted list"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><FormatListBulletedIcon fontSize="small" /></IconButton></Tip>
        <Tip title="Numbered list"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={() => exec("insertOrderedList")}><FormatListNumberedIcon fontSize="small" /></IconButton></Tip>
        <Tip title="Παράθεση"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={() => exec("formatBlock", "blockquote")}><FormatQuoteIcon fontSize="small" /></IconButton></Tip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
        <Tip title="Σύνδεσμος"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={promptLink}><LinkIcon fontSize="small" /></IconButton></Tip>
        <Tip title="Καθαρισμός μορφοποίησης"><IconButton size="small" onMouseDown={e => e.preventDefault()} onClick={() => exec("removeFormat")}><FormatClearIcon fontSize="small" /></IconButton></Tip>
      </Stack>
      <Divider />
      <Box
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => { if (ref.current) onHtmlChange(ref.current.innerHTML); }}
        sx={{
          px: 1.5, py: 1.25,
          minHeight,
          outline: "none",
          fontSize: 14,
          lineHeight: 1.55,
          "& blockquote": {
            borderLeft: 3, borderColor: "divider",
            pl: 1.5, ml: 0, my: 1, color: "text.secondary",
          },
          "& ul, & ol": { pl: 3 },
          "&:empty::before": {
            content: "attr(data-placeholder)",
            color: "text.disabled",
          },
        }}
      />
    </Box>
  );
}

function Tip({ title, children }: { title: string; children: JSX.Element }) {
  return <Tooltip title={title} placement="top" arrow>{children}</Tooltip>;
}
