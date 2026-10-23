import { useEffect, useRef, useState } from "react";

/**
 * Auto-save a form state object to localStorage keyed by user id +
 * form name so a lost tab / accidental close leaves the operator right
 * where they were.
 *
 *   const restored = useDraftPersistence("policy-form", userId, form, setForm);
 *
 * The hook:
 *   • On opening, reads the persisted blob (if any) and calls onRestore(blob).
 *     Initialise form defaults before calling this hook; wait for hydrated
 *     before applying asynchronous defaults. Closing permits a fresh restore.
 *   • On every form mutation, debounces 500ms and writes the JSON to
 *     `kalypsis:draft:{key}:{userId}`. Debounced to avoid a write per
 *     keystroke; still guarantees a save before an idle tab close.
 *   • Exposes clearDraft() so successful submit wipes the entry and cancels
 *     pending writes until the next opening.
 *
 * Only serialisable state should be passed in — no react refs or fns.
 */
export function useDraftPersistence<T>(
  key: string,
  userId: string | null | undefined,
  state: T,
  onRestore: (restored: T) => void,
  enabled = true,
): { clearDraft: () => void; hasDraft: boolean; hydrated: boolean } {
  const storageKey = `kalypsis:draft:${key}:${userId ?? "anon"}`;
  const restoredKey = useRef<string | null>(null);
  const [status, setStatus] = useState({ key: "", hasDraft: false });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const clearedForThisOpen = useRef(false);
  const hydrated = enabled && restoredKey.current === storageKey && status.key === storageKey;

  useEffect(() => {
    if (!enabled) { restoredKey.current = null; return; }
    if (restoredKey.current === storageKey) return;
    restoredKey.current = storageKey;
    clearedForThisOpen.current = false;
    let hasDraft = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          hasDraft = true;
          onRestore(parsed);
        }
      }
    } catch { /* corrupt draft — ignore */ }
    setStatus({ key: storageKey, hasDraft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!hydrated || clearedForThisOpen.current) return;
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); }
      catch { /* quota / private mode */ }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [hydrated, state, storageKey]);

  const clearDraft = () => {
    // Successful submit can trigger one last render before the dialog closes.
    // Do not recreate the submitted draft during that render.
    clearedForThisOpen.current = true;
    clearTimeout(saveTimer.current);
    try { localStorage.removeItem(storageKey); }
    catch { /* ignore */ }
    setStatus({ key: storageKey, hasDraft: false });
  };

  return { clearDraft, hasDraft: status.key === storageKey && status.hasDraft, hydrated };
}
