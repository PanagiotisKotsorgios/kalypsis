import { Box, Stack, Typography } from "@mui/material";
import { auditValue, type AuditFieldChange } from "./auditValues";

/** One readable presentation for customer, entity and administrative audit history. */
export function AuditFieldChanges({ changes }: { changes?: AuditFieldChange[] | null }) {
  if (!changes?.length) return <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
    Δεν υπάρχουν καταγεγραμμένες τιμές πριν και μετά για αυτή την ενέργεια.
  </Typography>;
  return <Stack spacing={.75} sx={{ mt: 1 }} aria-label="Αναλυτικές αλλαγές πεδίων">
    {changes.map(change => <Box key={change.field} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(110px, .8fr) minmax(0, 1fr) minmax(0, 1fr)" }, gap: 1, p: 1, bgcolor: "#f8fafc", border: "1px solid #d5e0ec", borderRadius: 1 }}>
      <Typography variant="body2" fontWeight={750} color="#102d55" sx={{ overflowWrap: "anywhere" }}>{change.label}</Typography>
      {([false, true] as const).map(after => <Box key={String(after)} sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">{after ? "Μετά" : "Πριν"}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: after ? "#12613d" : "#654551" }}>
          {auditValue(change.field, after ? change.after : change.before, after ? change.afterRecorded : change.beforeRecorded)}
        </Typography>
      </Box>)}
    </Box>)}
  </Stack>;
}
