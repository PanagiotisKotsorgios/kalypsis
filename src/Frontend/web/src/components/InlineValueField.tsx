import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Box, IconButton, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

export interface InlineValueOption {
  value: string;
  label: string;
}

interface InlineValueFieldProps {
  label: string;
  value?: string | number | null;
  /** Text copied to the clipboard (defaults to the stored value). */
  copyValue?: string | number | null;
  /** Optional display value when the stored value has a translated label. */
  displayValue?: ReactNode;
  onCommit?: (value: string) => void | Promise<void>;
  onRequestEdit?: () => void;
  options?: InlineValueOption[];
  type?: "text" | "date" | "email" | "number";
  mono?: boolean;
  valueColor?: string;
  multiline?: boolean;
  disabled?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
  /** Use the surrounding surface's spacing (tables/detail rows). */
  plain?: boolean;
  /** Render the desktop-style copy and edit controls on the right. */
  showActions?: boolean;
}

/**
 * A small, reusable value cell used in detail cards throughout the backoffice.
 *
 * • Single click copies the underlying value and briefly shows a green state.
 * • Double click either edits the value in place or opens the page's existing
 *   editor (when only onRequestEdit is supplied).
 * • Enter/blur commits an inline change; Escape cancels it.
 */
export function InlineValueField({
  label,
  value,
  copyValue,
  displayValue,
  onCommit,
  onRequestEdit,
  options,
  type = "text",
  mono = false,
  valueColor,
  multiline = false,
  disabled = false,
  compact = false,
  hideLabel = false,
  plain = false,
  showActions = false,
}: InlineValueFieldProps) {
  const raw = value === null || value === undefined ? "" : String(value);
  const clipboardText = copyValue === null || copyValue === undefined ? raw : String(copyValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(raw);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const clickTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) setDraft(raw);
  }, [raw, editing]);

  useEffect(() => {
    if (!editing) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  useEffect(() => () => {
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
  }, []);

  const copy = async () => {
    if (!clipboardText.trim() || editing) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        const helper = document.createElement("textarea");
        helper.value = clipboardText;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // Clipboard access can be denied by an embedded browser; the field stays usable.
    }
  };

  const commit = async () => {
    if (draft !== raw && onCommit) await onCommit(draft);
    setEditing(false);
  };

  const beginEdit = () => {
    if (disabled) return;
    if (onCommit) setEditing(true);
    else onRequestEdit?.();
  };

  const handleClick = () => {
    if (disabled || editing) return;
    // Delay a single click just enough to let the browser distinguish it from
    // a double click. This prevents a double click from copying first and then
    // entering edit mode.
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      void copy();
    }, 220);
  };

  const handleDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    beginEdit();
  };

  const missing = !raw.trim() || raw === "—" || raw === "-";
  return (
    <Box
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !editing) beginEdit();
        if (event.key === " " && !editing) { event.preventDefault(); void copy(); }
      }}
      title={disabled ? undefined : onCommit || onRequestEdit ? "Κλικ για αντιγραφή · διπλό κλικ για επεξεργασία" : "Κλικ για αντιγραφή"}
      sx={{
        p: plain ? 0.15 : compact ? 0.55 : 0.7,
        minWidth: 0,
        minHeight: plain ? 24 : compact ? 38 : 42,
        borderRadius: plain ? 0.5 : 0.9,
        cursor: disabled ? "default" : "pointer",
        bgcolor: copied ? "rgba(22, 155, 89, .13)" : plain ? "transparent" : missing ? "rgba(211,47,47,.055)" : "rgba(46,125,50,.065)",
        border: "1px solid",
        borderColor: copied ? "rgba(22,155,89,.55)" : plain ? "transparent" : missing ? "rgba(211,47,47,.2)" : "rgba(46,125,50,.2)",
        transition: "background-color .18s ease, border-color .18s ease, transform .18s ease",
        "&:hover": disabled ? undefined : { borderColor: "primary.main", bgcolor: copied ? "rgba(22,155,89,.18)" : "rgba(25,118,210,.10)" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
      }}
    >
      {!hideLabel && <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: compact ? ".64rem" : ".68rem", lineHeight: 1.1, mb: .2 }}>
        {label}
      </Typography>}
      <Box sx={{ display: "flex", alignItems: "center", gap: .35, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
      {editing ? (
        options ? (
          <TextField
            select
            size="small"
            fullWidth
            value={draft}
            onChange={(event) => { setDraft(event.target.value); void onCommit?.(event.target.value); setEditing(false); }}
            onBlur={() => void commit()}
            onKeyDown={(event) => { if (event.key === "Escape") { setDraft(raw); setEditing(false); } }}
            inputRef={inputRef}
            sx={{ "& .MuiInputBase-root": { minHeight: 32 }, "& .MuiSelect-select": { py: .45, fontSize: ".8rem" } }}
          >
            {options.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        ) : (
          <TextField
            autoFocus
            size="small"
            fullWidth
            type={type}
            value={draft}
            multiline={multiline}
            minRows={multiline ? 2 : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(event) => {
              if (event.key === "Escape") { setDraft(raw); setEditing(false); }
              if (event.key === "Enter" && !multiline) { event.preventDefault(); void commit(); }
            }}
            inputRef={inputRef}
            InputLabelProps={type === "date" ? { shrink: true } : undefined}
            sx={{ "& .MuiInputBase-root": { minHeight: 32 }, "& input, & textarea": { py: .45, fontSize: ".8rem", fontFamily: mono ? "monospace" : undefined } }}
          />
        )
      ) : (
        <Typography variant="body2" fontWeight={650} color={copied ? "success.dark" : (valueColor ?? (missing ? "error.dark" : "success.dark"))} sx={{ display: "flex", alignItems: "center", gap: .35, wordBreak: "break-word", whiteSpace: "pre-wrap", fontFamily: mono ? "monospace" : undefined, fontSize: compact ? ".76rem" : ".8rem", lineHeight: 1.2 }}>
          {displayValue ?? (raw || "—")}
          {copied && <CheckCircleIcon sx={{ fontSize: 15, color: "success.main", flexShrink: 0 }} />}
        </Typography>
      )}
      </Box>
      {showActions && (
        <Box sx={{ display: "flex", flex: "0 0 auto", gap: .25 }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <Tooltip title={copied ? "Αντιγράφηκε" : "Αντιγραφή"}>
            <IconButton
              size="small"
              aria-label={`Αντιγραφή ${label}`}
              onClick={() => void copy()}
              disabled={editing || !clipboardText.trim()}
              sx={{ width: 30, height: 30, borderRadius: .5, color: "#087ceB", bgcolor: "#e7f3fc", border: "1px solid #b6d6ed", "&:hover": { bgcolor: "#d1e9f8" } }}
            >
              <ContentCopyOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={onCommit || onRequestEdit ? "Επεξεργασία" : "Μη επεξεργάσιμο"}>
            <IconButton
              size="small"
              aria-label={`Επεξεργασία ${label}`}
              onClick={beginEdit}
              disabled={disabled || (!onCommit && !onRequestEdit)}
              sx={{ width: 30, height: 30, borderRadius: .5, color: "#936a00", bgcolor: "#fff6dc", border: "1px solid #e4c96b", "&:hover": { bgcolor: "#ffefb8" } }}
            >
              <EditOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      </Box>
    </Box>
  );
}

