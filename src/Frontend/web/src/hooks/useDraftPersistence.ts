import { useEffect, useRef } from "react";

/**
 * Auto-save a form state object to localStorage keyed by user id +
 * form name so a lost tab / accidental close leaves the operator right
 * where they were.
 *
 *   const restored = useDraftPersistence("policy-form", userId, form, setForm);
 *
 * The hook:
 *   • On mount, reads the persisted blob (if any) and calls setForm(blob)
 *     so the form re-hydrates. Only fires once per (userId, key) pair.
 *   • On every form mutation, debounces 500ms and writes the JSON to
 *     `kalypsis:draft:{key}:{userId}`. Debounced to avoid a write per
 *     keystroke; still guarantees a save before an idle tab close.
 *   • Exposes clearDraft() so successful submit can wipe the entry.
 *
 * Only serialisable state should be passed in — no react refs or fns.
 */
export function useDraftPersistence<T>(
  key: string,
  userId: string | null | undefined,
  state: T,
  onRestore: (restored: T) => void,
  enabled = true,
): { clearDraft: () => void; hasDraft: boolean } {
  const storageKey = `kalypsis:draft:${key}:${userId ?? "anon"}`;
  const restoredRef = useRef(false);
  const hasDraftRef = useRef(false);

  useEffect(() => {
    if (!enabled || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as T;
      hasDraftRef.current = true;
      onRestore(parsed);
    } catch { /* corrupt draft — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); }
      catch { /* quota / private mode */ }
    }, 500);
    return () => clearTimeout(t);
  }, [enabled, state, storageKey]);

  const clearDraft = () => {
    try { localStorage.removeItem(storageKey); }
    catch { /* ignore */ }
    hasDraftRef.current = false;
  };

  return { clearDraft, hasDraft: hasDraftRef.current };
}
