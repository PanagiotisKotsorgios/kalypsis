import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Autocomplete, Box, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { SearchableSelect } from "./SearchableSelect";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";

export interface InlineValueOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
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
  suggestions?: string[];
  validate?: (value: string) => string | undefined;
  maxLength?: number;
  inputMode?: "text" | "tel" | "email" | "numeric" | "url";
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
  /** Enable this existing field in place as part of a card-wide edit session. */
  editMode?: boolean;
  /** Parent-owned drafts survive switching between tabs. */
  draftValue?: string;
  onDraftChange?: (value: string) => void;
}

/**
 * A small, reusable value cell used in detail cards throughout the backoffice.
 *
 * • Single click copies the underlying value and briefly shows a green state.
 * • Double click either edits the value in place or opens the page's existing
 *   editor (when only onRequestEdit is supplied).
 * • The pencil opens an explicit edit state. Save/Enter commits the draft;
 *   cancel/Escape restores the original value without an implicit blur-save.
 */
export function InlineValueField({
  label,
  value,
  copyValue,
  displayValue,
  onCommit,
  onRequestEdit,
  options,
  suggestions,
  validate,
  maxLength,
  inputMode,
  type = "text",
  mono = false,
  valueColor,
  multiline = false,
  disabled = false,
  compact = false,
  hideLabel = false,
  plain = false,
  showActions = false,
  editMode = false,
  draftValue,
  onDraftChange,
}: InlineValueFieldProps) {
  const raw = value === null || value === undefined ? "" : String(value);
  const clipboardText = copyValue === null || copyValue === undefined ? raw : String(copyValue);
  const [localEditing, setEditing] = useState(draftValue !== undefined && !!onCommit);
  const [localDraft, setLocalDraft] = useState(raw);
  const editing = localEditing || (editMode && !!onCommit);
  const draft = draftValue ?? localDraft;
  const validationError = editing ? validate?.(draft) : undefined;
  const setDraft = (next: string) => { setLocalDraft(next); onDraftChange?.(next); };
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const clickTimer = useRef<number | null>(null);
  const previousEditMode = useRef(editMode);

  useEffect(() => {
    if (!editing || (editMode && draftValue === undefined)) setLocalDraft(raw);
  }, [raw, editing, editMode, draftValue]);

  useEffect(() => {
    if (previousEditMode.current !== editMode) setEditing(false);
    previousEditMode.current = editMode;
  }, [editMode]);

  useEffect(() => {
    if (!editing || editMode || draftValue !== undefined) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editing, editMode]);

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

  const saveEdit = async () => {
    if (disabled) return;
    if (validationError) { inputRef.current?.focus(); return; }
    if (!onCommit || draft === raw) {
      setEditing(false);
      return;
    }
    try {
      await onCommit(draft);
      setEditing(false);
    } catch {
      // Keep the editor open so the user can correct/retry after a failed save.
    }
  };

  const cancelEdit = () => {
    setDraft(raw);
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
          <SearchableSelect
            label=""
            disabled={disabled}
            size="small"
            fullWidth
            value={draft}
            options={options.some(option => option.value === draft) ? options : [{ value: draft, label: draft === raw && typeof displayValue === "string" ? displayValue : draft || "—" }, ...options]}
            onChange={setDraft}
            placeholder="Αναζήτηση…"
            showSearchIcon={false}
            autocompleteProps={{
              clearOnBlur: true,
              disableClearable: !options.some(option => option.value === "" && !option.disabled),
              onKeyDown: event => {
                const open = inputRef.current?.getAttribute("aria-expanded") === "true";
                if (event.key === "Escape") { event.stopPropagation(); if (!open) cancelEdit(); }
                if (event.key === "Enter") { event.stopPropagation(); if (!open) { event.preventDefault(); void saveEdit(); } }
              },
            }}
            textFieldProps={{ inputRef, inputProps: { "aria-label": label }, error: !!validationError, helperText: validationError }}
            sx={{ "& .MuiInputBase-root": { minHeight: compact ? 30 : 32, py: 0 }, "& input": { fontSize: ".8rem" } }}
          />
        ) : suggestions ? (
          <Autocomplete freeSolo options={suggestions} inputValue={draft} value={draft || null}
            disabled={disabled} onInputChange={(_, next) => setDraft(next)}
            onChange={(_, next) => setDraft(next ?? "")}
            sx={{ "& .MuiInputBase-root": { minHeight: compact ? 30 : 32, py: 0 }, "& input": { fontSize: ".8rem" } }}
            onKeyDown={event => {
              if (event.key === "Enter" && !inputRef.current?.getAttribute("aria-activedescendant")) { event.preventDefault(); void saveEdit(); }
              if (event.key === "Escape") cancelEdit();
            }}
            renderInput={params => <TextField {...params} size="small" inputRef={inputRef}
              error={!!validationError} helperText={validationError}
              inputProps={{ ...params.inputProps, "aria-label": label, maxLength }}
            />}
          />
        ) : (
          <TextField
            autoFocus={!editMode && draftValue === undefined}
            disabled={disabled}
            inputProps={{ "aria-label": label, maxLength, inputMode }}
            error={!!validationError}
            helperText={validationError}
            size="small"
            fullWidth
            type={type}
            value={draft}
            multiline={multiline}
            minRows={multiline ? 2 : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelEdit();
              if (event.key === "Enter" && !multiline) { event.preventDefault(); void saveEdit(); }
            }}
            inputRef={inputRef}
            InputLabelProps={type === "date" ? { shrink: true } : undefined}
            sx={{ "& .MuiInputBase-root": { minHeight: compact ? 30 : 32 }, "& input, & textarea": { py: .45, fontSize: ".8rem", fontFamily: mono ? "monospace" : undefined } }}
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
          {editing ? (
            <>
              <Tooltip title="Αποθήκευση">
                <IconButton
                  size="small"
                  aria-label={`Αποθήκευση ${label}`}
                  onClick={() => void saveEdit()}
                  disabled={disabled || !onCommit || !!validationError}
                  sx={{ width: 30, height: 30, borderRadius: .5, color: "#fff", bgcolor: "#159b59", border: "1px solid #0f7f49", "&:hover": { bgcolor: "#0d7d46" } }}
                >
                  <SaveOutlinedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Ακύρωση">
                <IconButton
                  size="small"
                  aria-label={`Ακύρωση επεξεργασίας ${label}`}
                  onClick={cancelEdit}
                  disabled={disabled}
                  sx={{ width: 30, height: 30, borderRadius: .5, color: "#fff", bgcolor: "#64748b", border: "1px solid #475569", "&:hover": { bgcolor: "#475569" } }}
                >
                  <CloseOutlinedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip title={copied ? "Αντιγράφηκε" : "Αντιγραφή"}>
                <IconButton
                  size="small"
                  aria-label={`Αντιγραφή ${label}`}
                  onClick={() => void copy()}
                  disabled={!clipboardText.trim()}
                  sx={{
                    width: 30, height: 30, borderRadius: .5,
                    color: copied ? "#fff" : "#087ceb",
                    bgcolor: copied ? "#159b59" : "#e7f3fc",
                    border: "1px solid", borderColor: copied ? "#0f7f49" : "#b6d6ed",
                    transition: "background-color 180ms, color 180ms",
                    animation: copied ? "copy-confirm 350ms ease-out" : "none",
                    "@keyframes copy-confirm": { "0%": { transform: "scale(.85)" }, "60%": { transform: "scale(1.12)" }, "100%": { transform: "scale(1)" } },
                    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                    "&:hover": { bgcolor: copied ? "#0f7f49" : "#d1e9f8" },
                  }}
                >
                  {copied ? <CheckCircleIcon sx={{ fontSize: 17 }} /> : <ContentCopyOutlinedIcon sx={{ fontSize: 17 }} />}
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
            </>
          )}
        </Box>
      )}
      </Box>
    </Box>
  );
}

