import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogTitle, Stack, Typography, Table, TableBody, TableCell, TableRow, Chip
} from "@mui/material";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcuts wired into the authenticated shell.
 * Ignores keystrokes originating from text inputs / textareas /
 * contenteditable so typing "n" inside a field never opens a dialog.
 *
 * Shortcuts (all Greek/EN locale-agnostic — bound to physical keys):
 *   /  focus the first visible search input on the page
 *   n  jump to /app/policies?new=1 (new policy)
 *   c  jump to /app/customers
 *   p  jump to /app/policies
 *   d  jump to /app/documents
 *   ?  open the shortcut cheat-sheet
 *   Esc close the cheat-sheet (browser handles native Dialog close)
 */
export function GlobalKeyboardShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      // MUI Autocomplete input inside a wrapper — still an <input>, caught above.
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;

      switch (e.key) {
        case "/": {
          const input = document.querySelector<HTMLInputElement>(
            'input[type="search"], input[placeholder*="Αναζήτηση"], input[placeholder*="Search"]'
          );
          if (input) { e.preventDefault(); input.focus(); input.select?.(); }
          break;
        }
        case "?":
          e.preventDefault();
          setHelpOpen(true);
          break;
        case "n":
          e.preventDefault();
          navigate("/app/policies?new=1");
          break;
        case "c":
          e.preventDefault();
          navigate("/app/customers");
          break;
        case "p":
          e.preventDefault();
          navigate("/app/policies");
          break;
        case "d":
          e.preventDefault();
          navigate("/app/documents");
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800 }}>
        <KeyboardIcon color="primary" />
        Συντομεύσεις πληκτρολογίου
      </DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableBody>
            {SHORTCUTS.map(s => (
              <TableRow key={s.key}>
                <TableCell sx={{ borderBottom: 0, width: 60 }}>
                  <Chip label={s.key} size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} />
                </TableCell>
                <TableCell sx={{ borderBottom: 0 }}>{s.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Stack sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Οι συντομεύσεις δεν ενεργοποιούνται όσο πληκτρολογείτε σε πεδίο εισαγωγής.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

const SHORTCUTS = [
  { key: "/",  description: "Εστίαση στο πεδίο αναζήτησης της τρέχουσας σελίδας" },
  { key: "n",  description: "Νέο συμβόλαιο" },
  { key: "p",  description: "Μετάβαση στα Συμβόλαια" },
  { key: "c",  description: "Μετάβαση στους Πελάτες" },
  { key: "d",  description: "Μετάβαση στα Έγγραφα" },
  { key: "?",  description: "Άνοιγμα αυτού του πίνακα" },
];
