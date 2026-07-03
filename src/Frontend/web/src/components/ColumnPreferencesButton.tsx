import { useState } from "react";
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  ListItemText, Stack, Tooltip, Typography
} from "@mui/material";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { ColumnConfig } from "../hooks/useColumnPreferences";

/**
 * Icon button that opens a per-user column preferences dialog. Lets the
 * operator drag rows to reorder, tick/untick visibility, or reset to the
 * table's defaults. Preferences are managed by `useColumnPreferences` —
 * this component is just the UI shell.
 *
 * Drag reorder uses native HTML5 drag events so we avoid pulling in a
 * dedicated dnd library for a single dialog. `alwaysVisible` columns are
 * rendered with a locked checkbox so the operator can't accidentally
 * hide them (typically a primary-id column).
 */
export function ColumnPreferencesButton({
  orderedColumns, hiddenSet, toggleVisibility, moveColumn, reset,
}: {
  orderedColumns: ColumnConfig[];
  hiddenSet: Set<string>;
  toggleVisibility: (key: string) => void;
  moveColumn: (from: string, to: string) => void;
  reset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  return (
    <>
      <Tooltip title="Στήλες πίνακα">
        <IconButton size="small" onClick={() => setOpen(true)} aria-label="Στήλες πίνακα">
          <ViewColumnIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Στήλες πίνακα</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Σύρετε από τη λαβή για να αλλάξετε τη σειρά. Τσεκάρετε ποιες θα εμφανίζονται.
          </Typography>
          <Stack sx={{ gap: 0.5 }}>
            {orderedColumns.map(c => (
              <Box
                key={c.key}
                draggable
                onDragStart={() => setDragKey(c.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragKey && dragKey !== c.key) moveColumn(dragKey, c.key);
                  setDragKey(null);
                }}
                onDragEnd={() => setDragKey(null)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1,
                  p: 0.75, borderRadius: 1,
                  border: "1px solid",
                  borderColor: dragKey === c.key ? "primary.main" : "divider",
                  bgcolor: dragKey === c.key ? "action.hover" : "background.paper",
                  cursor: "grab",
                  "&:active": { cursor: "grabbing" },
                }}
              >
                <DragIndicatorIcon fontSize="small" sx={{ color: "text.disabled" }} />
                <Checkbox
                  size="small"
                  checked={c.alwaysVisible || !hiddenSet.has(c.key)}
                  disabled={c.alwaysVisible}
                  onChange={() => toggleVisibility(c.key)}
                />
                <ListItemText primary={c.label}
                  primaryTypographyProps={{ fontWeight: 500 }} />
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={reset}>Επαναφορά</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setOpen(false)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
