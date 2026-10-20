import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Button, Checkbox, Divider, FormControlLabel, IconButton, Popover,
  Stack, Tooltip, Typography,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { useAuth } from "../auth/AuthContext";

export interface FilterVisibilityDescriptor { key: string; label: string; defaultOff?: boolean }

export function useFilterVisibility(storageId: string, filters: FilterVisibilityDescriptor[]) {
  const { user } = useAuth();
  const storageKey = `kalypsis:visible-filters:${user?.userId ?? "anon"}:${storageId}`;
  const defaults = useMemo(() => new Set(filters.filter(f => f.defaultOff).map(f => f.key)), [filters]);
  const read = useCallback(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { off?: string[] } | null;
      return parsed?.off && Array.isArray(parsed.off) ? new Set(parsed.off) : null;
    } catch { return null; }
  }, [storageKey]);
  const [off, setOff] = useState<Set<string>>(() => read() ?? defaults);
  useEffect(() => { setOff(read() ?? defaults); }, [read, defaults]);
  const persist = useCallback((next: Set<string>) => {
    setOff(next);
    try { localStorage.setItem(storageKey, JSON.stringify({ off: [...next] })); } catch { /* private mode */ }
  }, [storageKey]);
  const toggle = useCallback((key: string) => {
    const next = new Set(off); next.has(key) ? next.delete(key) : next.add(key); persist(next);
  }, [off, persist]);
  return {
    off,
    visible: (key: string) => !off.has(key),
    toggle,
    setAll: (shown: boolean) => persist(shown ? new Set() : new Set(filters.map(f => f.key))),
    reset: () => persist(new Set(defaults)),
  };
}

export function FilterVisibilityPicker({ filters, off, toggle, setAll, reset }: {
  filters: FilterVisibilityDescriptor[]; off: Set<string>; toggle: (key: string) => void;
  setAll: (shown: boolean) => void; reset: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = filters.filter(f => !off.has(f.key)).length;
  return <>
    <Tooltip title="Επιλογή φίλτρων που εμφανίζονται">
      <IconButton size="small" onClick={event => setAnchor(event.currentTarget)} aria-label="Διαχείριση φίλτρων"
        sx={{ border: "1px solid #087ceb", borderRadius: 1, px: .75, py: .5, bgcolor: "#087ceb", color: "#fff", "&:hover": { bgcolor: "#065fb7" } }}>
        <TuneIcon fontSize="small" /><Typography variant="caption" sx={{ ml: .5, fontWeight: 800, color: "inherit" }}>{active}/{filters.length}</Typography>
      </IconButton>
    </Tooltip>
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { p: 1.5, minWidth: 300, maxHeight: 520 } } }}>
      <Typography variant="subtitle2" fontWeight={850}>Εμφανιζόμενα φίλτρα</Typography>
      <Typography variant="caption" color="text.secondary">Επιλέξτε ποια φίλτρα θα εμφανίζονται στη λίστα και στο responsive popup.</Typography>
      <Stack sx={{ mt: 1, maxHeight: 330, overflowY: "auto" }}>
        {filters.map(filter => <FormControlLabel key={filter.key} sx={{ m: 0 }} control={<Checkbox size="small" checked={!off.has(filter.key)} onChange={() => toggle(filter.key)} />} label={filter.label} />)}
      </Stack>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: "flex", gap: .5 }}><Button size="small" onClick={() => setAll(true)}>Όλα</Button><Button size="small" onClick={() => setAll(false)}>Κανένα</Button><Box sx={{ flex: 1 }} /><Button size="small" onClick={reset}>Επαναφορά</Button></Box>
    </Popover>
  </>;
}
