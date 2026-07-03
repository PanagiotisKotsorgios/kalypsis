import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Snackbar } from "@mui/material";
import { api } from "../api/client";

/**
 * Undo toast: after any soft-delete, the caller pushes a
 * `{ category, id, message }` entry via `pushUndoable(...)`. A snackbar
 * pops in the bottom-left with an «Αναίρεση» button that POSTs to the
 * recycle-bin restore endpoint. Auto-dismisses after 8 seconds.
 *
 * Category strings match the RecycleBinController map ("policies",
 * "customers", "receipts", "payments", "claims", …). See its Categories
 * array for the full set.
 *
 * Usage inside any mutation:
 *   const { pushUndoable } = useUndoable();
 *   ...
 *   onSuccess: () => pushUndoable({
 *     category: "policies", id: deletedId,
 *     message: `Το συμβόλαιο ${p.policyNumber} διαγράφηκε`,
 *     onRestore: () => qc.invalidateQueries({ queryKey: ["policies"] }),
 *   })
 */
interface UndoEntry {
  category: string;
  id: string;
  message: string;
  onRestore?: () => void;
}

interface UndoContextValue {
  pushUndoable: (e: UndoEntry) => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndoable(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndoable must be used within <UndoProvider>");
  return ctx;
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<UndoEntry | null>(null);
  const [restoring, setRestoring] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const pushUndoable = useCallback((e: UndoEntry) => {
    clearTimer();
    setCurrent(e);
    timerRef.current = window.setTimeout(() => setCurrent(null), 8000);
  }, []);

  const dismiss = () => { clearTimer(); setCurrent(null); };

  const restore = async () => {
    if (!current) return;
    setRestoring(true);
    try {
      await api.post(`/recycle-bin/${current.category}/${current.id}/restore`);
      current.onRestore?.();
    } catch {
      // Restore may fail silently — usually because the tenant lacks
      // the recycle-bin premium feature. Toast just closes.
    } finally {
      setRestoring(false);
      dismiss();
    }
  };

  const value = useMemo<UndoContextValue>(() => ({ pushUndoable }), [pushUndoable]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      <Snackbar
        open={!!current}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        onClose={dismiss}
        autoHideDuration={null /* controlled by internal timer above */}
      >
        <Alert
          severity="info" variant="filled"
          onClose={dismiss}
          action={
            <Button
              color="inherit" size="small"
              disabled={restoring}
              onClick={restore}
              sx={{ fontWeight: 700 }}
            >
              {restoring ? "Αναίρεση…" : "Αναίρεση"}
            </Button>
          }
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </UndoContext.Provider>
  );
}
