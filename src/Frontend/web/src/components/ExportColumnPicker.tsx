import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Button, Checkbox, Divider, FormControlLabel, IconButton,
  Popover, Stack, Tooltip, Typography
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";

export interface ExportColumnDescriptor {
  key: string;
  label: string;
  /** Uncheck by default — useful for columns "not displayed" that the user
   *  can opt into (e.g. an internal ID or a rarely-needed audit field). */
  defaultOff?: boolean;
  /** Cannot be unchecked. Reserved for critical id columns. */
  alwaysOn?: boolean;
}

/**
 * Per-user, per-list export-column selection. Independent from the on-screen
 * `useColumnPreferences` because the caller often exposes MORE detail to the
 * export than the display (e.g. first/last name as separate fields where the
 * screen shows a single "Full name" column). Persisted in localStorage keyed
 * by user id, so signing out on a shared device drops the preference.
 */
export function useExportColumnSelection(
  storageId: string,
  columns: ExportColumnDescriptor[]
) {
  const { user } = useAuth();
  const storageKey = `kalypsis:export-cols:${user?.userId ?? "anon"}:${storageId}`;

  const initial = useMemo(() => {
    const off = new Set<string>();
    for (const c of columns) if (c.defaultOff && !c.alwaysOn) off.add(c.key);
    return off;
  }, [columns]);

  const readPersisted = useCallback((): Set<string> | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { off: string[] };
      if (!Array.isArray(parsed.off)) return null;
      return new Set(parsed.off);
    } catch { return null; }
  }, [storageKey]);

  const [off, setOff] = useState<Set<string>>(() => readPersisted() ?? initial);

  useEffect(() => {
    const p = readPersisted();
    setOff(p ?? initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback((next: Set<string>) => {
    setOff(next);
    try { localStorage.setItem(storageKey, JSON.stringify({ off: Array.from(next) })); }
    catch { /* quota / private mode */ }
  }, [storageKey]);

  const toggle = useCallback((key: string) => {
    const col = columns.find(c => c.key === key);
    if (col?.alwaysOn) return;
    const next = new Set(off);
    if (next.has(key)) next.delete(key); else next.add(key);
    persist(next);
  }, [columns, off, persist]);

  const setAll = useCallback((on: boolean) => {
    // "all on" = empty "off" set. "all off" = every non-locked column in the off set.
    if (on) persist(new Set<string>());
    else    persist(new Set(columns.filter(c => !c.alwaysOn).map(c => c.key)));
  }, [columns, persist]);

  const reset = useCallback(() => persist(new Set(initial)), [initial, persist]);

  const activeKeys = useMemo(
    () => columns.filter(c => c.alwaysOn || !off.has(c.key)).map(c => c.key),
    [columns, off]
  );

  return { off, activeKeys, toggle, setAll, reset };
}

/**
 * A gear-icon popover that lists every column the current list can export
 * and lets the user tick/untick each one. Changes take effect immediately —
 * the next CSV/Excel/PDF/Print will honour the new selection.
 */
export function ExportColumnPicker({
  columns, off, toggle, setAll, reset,
}: {
  columns: ExportColumnDescriptor[];
  off: Set<string>;
  toggle: (key: string) => void;
  setAll: (on: boolean) => void;
  reset: () => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const activeCount = columns.length - Array.from(off).filter(k => columns.some(c => c.key === k)).length;

  return (
    <>
      <Tooltip title={t("common.exportColumns", "Στήλες εξαγωγής")}>
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={String(t("common.exportColumns", "Στήλες εξαγωγής"))}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            px: 0.75,
            py: 0.5,
          }}
        >
          <TuneIcon fontSize="small" />
          <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 600, color: "text.secondary" }}>
            {activeCount}/{columns.length}
          </Typography>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1.5, minWidth: 280, maxWidth: 360, maxHeight: 480 } } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
          {t("common.exportColumns", "Στήλες εξαγωγής")}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {t("common.exportColumnsHelp", "Επιλέξτε ποιες στήλες θα συμπεριληφθούν σε CSV, Excel, PDF και εκτύπωση.")}
        </Typography>
        <Stack sx={{ gap: 0.25, overflowY: "auto", maxHeight: 300, pr: 0.5 }}>
          {columns.map(c => {
            const on = c.alwaysOn || !off.has(c.key);
            return (
              <FormControlLabel
                key={c.key}
                sx={{ m: 0, py: 0.25 }}
                control={
                  <Checkbox
                    size="small"
                    checked={on}
                    disabled={c.alwaysOn}
                    onChange={() => toggle(c.key)}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: on ? 500 : 400, color: on ? "text.primary" : "text.secondary" }}>
                    {c.label}
                  </Typography>
                }
              />
            );
          })}
        </Stack>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={() => setAll(true)}>{t("common.selectAll", "Επιλογή όλων")}</Button>
          <Button size="small" onClick={() => setAll(false)}>{t("common.selectNone", "Καμία")}</Button>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={reset}>{t("common.reset", "Επαναφορά")}</Button>
        </Box>
      </Popover>
    </>
  );
}
