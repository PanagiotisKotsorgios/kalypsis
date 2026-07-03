import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Static definition of a table column — the shape each page hands to
 * `useColumnPreferences`. `key` uniquely identifies the column across
 * versions of the code; `label` is shown to the user in the preferences
 * dialog; `alwaysVisible` locks the column on so a critical id column
 * can't be accidentally hidden.
 */
export interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible?: boolean;
  alwaysVisible?: boolean;
}

/** What we store in localStorage per (user × table) pair. */
interface PersistedPrefs {
  version: 1;
  order: string[];
  hidden: string[];
}

/**
 * Per-user, per-table column-order + visibility preferences that survive
 * a page reload and follow the user across tabs.
 *
 * Storage key: `kalypsis:cols:{userId}:{tableName}`.
 * Missing / corrupt entries fall back to the caller-declared defaults
 * so a rename in the code never wedges the picker in an unusable state.
 *
 * Guarantees the returned `visibleColumns` array always matches the
 * caller's `columns` list one-to-one (any new column the caller adds
 * shows up at the bottom of the order with defaultVisible respected)
 * so tables can render {visibleColumns.map(...)} without a null check.
 */
export function useColumnPreferences(tableName: string, columns: ColumnConfig[]) {
  const { user } = useAuth();
  const storageKey = `kalypsis:cols:${user?.userId ?? "anon"}:${tableName}`;

  const readPersisted = useCallback((): PersistedPrefs | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedPrefs;
      if (parsed.version !== 1 || !Array.isArray(parsed.order)) return null;
      return parsed;
    } catch { return null; }
  }, [storageKey]);

  const [prefs, setPrefs] = useState<PersistedPrefs>(() => {
    const persisted = readPersisted();
    if (persisted) return persisted;
    return {
      version: 1,
      order: columns.map(c => c.key),
      hidden: columns.filter(c => c.defaultVisible === false && !c.alwaysVisible).map(c => c.key),
    };
  });

  // Refresh from storage when the user changes (e.g. after re-login) so
  // preferences don't leak across accounts on shared devices.
  useEffect(() => {
    const persisted = readPersisted();
    if (persisted) setPrefs(persisted);
    else setPrefs({
      version: 1,
      order: columns.map(c => c.key),
      hidden: columns.filter(c => c.defaultVisible === false && !c.alwaysVisible).map(c => c.key),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Reconcile the persisted list with the currently-declared columns —
  // add newly-introduced keys at the end, drop any that were removed.
  const columnByKey = useMemo(() => {
    const m: Record<string, ColumnConfig> = {};
    for (const c of columns) m[c.key] = c;
    return m;
  }, [columns]);

  const orderedColumns = useMemo(() => {
    const seen = new Set<string>();
    const arranged: ColumnConfig[] = [];
    for (const k of prefs.order) {
      const c = columnByKey[k];
      if (c && !seen.has(k)) { arranged.push(c); seen.add(k); }
    }
    for (const c of columns) if (!seen.has(c.key)) arranged.push(c);
    return arranged;
  }, [prefs.order, columnByKey, columns]);

  const hiddenSet = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);
  const visibleColumns = useMemo(
    () => orderedColumns.filter(c => c.alwaysVisible || !hiddenSet.has(c.key)),
    [orderedColumns, hiddenSet]
  );

  const persist = useCallback((next: PersistedPrefs) => {
    setPrefs(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { /* quota / private mode */ }
  }, [storageKey]);

  const toggleVisibility = useCallback((key: string) => {
    const col = columnByKey[key];
    if (col?.alwaysVisible) return;
    const next = new Set(hiddenSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    persist({ ...prefs, hidden: Array.from(next) });
  }, [columnByKey, hiddenSet, persist, prefs]);

  const moveColumn = useCallback((fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const currentOrder = orderedColumns.map(c => c.key);
    const from = currentOrder.indexOf(fromKey);
    const to = currentOrder.indexOf(toKey);
    if (from < 0 || to < 0) return;
    const nextOrder = currentOrder.slice();
    const [moved] = nextOrder.splice(from, 1);
    nextOrder.splice(to, 0, moved);
    persist({ ...prefs, order: nextOrder });
  }, [orderedColumns, persist, prefs]);

  const reset = useCallback(() => {
    persist({
      version: 1,
      order: columns.map(c => c.key),
      hidden: columns.filter(c => c.defaultVisible === false && !c.alwaysVisible).map(c => c.key),
    });
  }, [columns, persist]);

  return {
    visibleColumns,
    orderedColumns,
    hiddenSet,
    toggleVisibility,
    moveColumn,
    reset,
  };
}
